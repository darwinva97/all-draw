/**
 * Criptografía y resolución de identidad, sólo con **WebCrypto** (`crypto.subtle`) para que el
 * mismo código corra en Node, Cloudflare Workers, Bun o Deno.
 *
 * - Contraseñas: PBKDF2-HMAC-SHA256 (100 000 iteraciones, el máximo que permiten los Workers) con
 *   sal aleatoria → `pbkdf2$<iter>$<sal>$<hash>`. Los hashes heredados `scrypt$<sal>$<hash>` se
 *   verifican con un esquema registrado por el runtime (`registerPasswordScheme('scrypt', fn)`,
 *   Node lo hace con `node:crypto`) y la API los re-hashea a PBKDF2 en el primer login correcto.
 * - Tokens (sesión, API key, enlace): aleatorios; en la BD sólo va su hash (SHA-256, o HMAC si hay
 *   `SESSION_SECRET`). El hasher es asíncrono porque WebCrypto lo es.
 * - Principal: sesión (cookie o Bearer), API key (Bearer `adk_…`) o enlace compartido (`?token=` / Bearer `lnk_…`).
 */
import type { Role, Session, ShareLink, User, WorkspaceStore } from './store/types';
import { sessionIdOf, type ConnIdentity } from './docs';

export const PBKDF2_ITERATIONS = 100_000;
const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

export const toHex = (b: Uint8Array | ArrayBuffer): string => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string): Uint8Array => {
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) return new Uint8Array(0);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
/** Comparación en tiempo constante (misma longitud requerida). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

/** Verificadores de formatos heredados, por prefijo (`scrypt`). Los registra el runtime que sepa calcularlos. */
export type PasswordVerifier = (password: string, stored: string) => Promise<boolean>;
const legacySchemes = new Map<string, PasswordVerifier>();
export function registerPasswordScheme(prefix: string, verify: PasswordVerifier): void { legacySchemes.set(prefix, verify); }

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  const alg = parts[0];
  if (alg === 'pbkdf2') {
    const [, iterStr, saltHex, hashHex] = parts;
    const iterations = Number(iterStr);
    if (!saltHex || !hashHex || !Number.isInteger(iterations) || iterations <= 0) return false;
    const hash = await pbkdf2(password, fromHex(saltHex), iterations);
    return timingSafeEqual(hash, fromHex(hashHex));
  }
  const legacy = alg ? legacySchemes.get(alg) : undefined;
  return legacy ? legacy(password, stored) : false;
}
/** ¿Conviene re-hashear con el esquema actual? (hash heredado o con otro coste). */
export const needsRehash = (stored: string): boolean => !stored.startsWith(`pbkdf2$${PBKDF2_ITERATIONS}$`);

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomToken(prefix: string, bytes = 32): string {
  return prefix + [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => ALPHABET[b % ALPHABET.length]).join('');
}
export const SESSION_PREFIX = 'ads_';
export const APIKEY_PREFIX = 'adk_';
export const LINK_PREFIX = 'lnk_';
/** Enlaces de inserción (`/embed/…`): de lectura y con alcance a una vista; no son una identidad de la API. */
export const EMBED_PREFIX = 'emb_';
export const SESSION_COOKIE = 'alldraw_session';
/** Caducidad deslizante: cada uso renueva 30 días (a lo sumo una vez por `SESSION_RENEW_MS`). */
export const SESSION_DAYS = 30;
export const SESSION_MS = SESSION_DAYS * 86_400_000;
export const SESSION_RENEW_MS = 86_400_000;
/** Cabecera que manda la SPA en toda petición: una web de otro origen no puede añadirla a un envío con cookie. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'all-draw';
/** Usuario técnico dueño de los espacios importados de la persistencia antigua (no cuenta como humano). */
export const LEGACY_EMAIL = 'legacy@alldraw.local';

export type Hasher = (token: string) => Promise<string>;
export function makeHasher(secret: string | null): Hasher {
  if (!secret) return async token => toHex(await subtle.digest('SHA-256', te.encode(token)));
  const keyP = subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return async token => toHex(await subtle.sign('HMAC', await keyP, te.encode(token)));
}

// ---------------------------------------------------------------- Principal
export type Principal =
  | { kind: 'user'; user: User; via: 'session' | 'apikey'; sessionHash?: string; session?: Session; keyId?: string }
  | { kind: 'link'; link: ShareLink };

export interface AuthContext { store: WorkspaceStore; hash: Hasher }

/** Resuelve cualquier token (sesión, API key o enlace) a un principal. */
export async function resolveToken(ctx: AuthContext, token: string | null | undefined): Promise<Principal | null> {
  if (!token) return null;
  if (token.startsWith(APIKEY_PREFIX)) {
    const key = await ctx.store.resolveApiKey(await ctx.hash(token));
    if (!key) return null;
    const user = await ctx.store.getUser(key.userId);
    if (!user) return null;
    void ctx.store.touchApiKey(key.id).catch(() => { /* no importa */ });
    return { kind: 'user', user, via: 'apikey', keyId: key.id };
  }
  if (token.startsWith(LINK_PREFIX)) {
    const link = await ctx.store.resolveShareLink(token);
    // Un enlace con alcance a una vista (inserción) nunca da acceso a la API ni al WebSocket.
    return link && !link.viewId ? { kind: 'link', link } : null;
  }
  const h = await ctx.hash(token);
  const session = await ctx.store.getSession(h);
  if (!session) return null;
  const user = await ctx.store.getUser(session.userId);
  return user ? { kind: 'user', user, via: 'session', sessionHash: h, session } : null;
}

/** ¿Toca renovar la caducidad de esta sesión? (ha pasado más de `SESSION_RENEW_MS` desde la última renovación). */
export const sessionNeedsRenewal = (session: Session, now = Date.now()): boolean => Date.parse(session.expiresAt) - now < SESSION_MS - SESSION_RENEW_MS;

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) { try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie corrupta */ } }
  }
  return out;
}

export type CredentialSource = 'bearer' | 'cookie' | 'query';
/** Token de una petición HTTP y de dónde salió: `Authorization: Bearer`, luego cookie de sesión, luego `?token=`. */
export function credentialsFromRequest(headers: { get(n: string): string | null }, url: URL): { token: string | null; source: CredentialSource | null } {
  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return { token: auth.slice(7).trim(), source: 'bearer' };
  const cookie = parseCookies(headers.get('cookie'))[SESSION_COOKIE];
  if (cookie) return { token: cookie, source: 'cookie' };
  const q = url.searchParams.get('token');
  return q ? { token: q, source: 'query' } : { token: null, source: null };
}
export const tokenFromRequest = (headers: { get(n: string): string | null }, url: URL): string | null => credentialsFromRequest(headers, url).token;

/** Host público de la petición (detrás de un proxy, el que vio el navegador). */
export const requestHost = (headers: { get(n: string): string | null }, url: URL): string => headers.get('x-forwarded-host')?.split(',')[0]?.trim() ?? headers.get('host') ?? url.host;

/**
 * Defensa CSRF para peticiones autenticadas **por cookie**: se aceptan si traen la cabecera de la SPA
 * (`X-Requested-With: all-draw`, imposible de añadir desde otro origen sin CORS), si el navegador declara
 * `Sec-Fetch-Site: same-origin`/`none`, o si `Origin`/`Referer` apuntan al mismo host que la petición.
 * Sin ninguna de esas señales (o con `Sec-Fetch-Site: cross-site`/`same-site`) se rechaza.
 */
export function isTrustedOrigin(headers: { get(n: string): string | null }, url: URL): boolean {
  if (headers.get(CSRF_HEADER) === CSRF_VALUE) return true;
  const sfs = headers.get('sec-fetch-site');
  if (sfs) return sfs === 'same-origin' || sfs === 'none';
  const src = headers.get('origin') ?? headers.get('referer');
  if (!src) return false;
  try { return new URL(src).host === requestHost(headers, url); } catch { return false; }
}

/** Comparación de secretos cortos (códigos de invitación) sin fugas de tiempo por longitud. */
export function safeEqualString(a: string, b: string): boolean {
  const ea = te.encode(a), eb = te.encode(b);
  const n = Math.max(ea.length, eb.length, 1);
  const pa = new Uint8Array(n), pb = new Uint8Array(n);
  pa.set(ea); pb.set(eb);
  return timingSafeEqual(pa, pb) && ea.length === eb.length;
}

/** Rol efectivo de un principal sobre un espacio (los admins actúan como dueños). */
export async function roleFor(store: WorkspaceStore, p: Principal | null, workspaceId: string): Promise<Role | null> {
  if (!p) return null;
  if (p.kind === 'link') return p.link.workspaceId === workspaceId ? p.link.role : null;
  if (p.user.isAdmin) return (await store.getWorkspace(workspaceId)) ? 'owner' : null;
  return store.getRole(workspaceId, p.user.id);
}

/** Identidad de una conexión a partir de su principal (para poder cerrarla al revocar ese acceso). */
export const identityOf = (p: Principal): ConnIdentity => (p.kind === 'link'
  ? { userId: null, linkToken: p.link.token }
  : { userId: p.user.id, linkToken: null, sessionId: p.sessionHash ? sessionIdOf(p.sessionHash) : null, keyId: p.via === 'apikey' ? p.keyId ?? null : null });

/**
 * Identifica y autoriza una conexión (WebSocket) a un espacio; devuelve el código de cierre si no procede.
 * Con permiso, además del rol devuelve la identidad (usuario o enlace) que hay que registrar en la conexión.
 */
export async function authorizeConnection(ctx: AuthContext, token: string | null, workspaceId: string): Promise<{ role: Role; identity: ConnIdentity; expiresAt: string | null } | { close: number; reason: string }> {
  const principal = await resolveToken(ctx, token);
  if (!(await ctx.store.getWorkspace(workspaceId))) return { close: 4404, reason: 'el espacio no existe' };
  const role = await roleFor(ctx.store, principal, workspaceId);
  if (!role || !principal) return { close: 4401, reason: 'sin permiso' };
  // Con un enlace que caduca, la conexión se cierra al llegar la hora (`WS_EXPIRED_REASON`; Node con un temporizador, el DO con `alarm()`).
  return { role, identity: identityOf(principal), expiresAt: principal.kind === 'link' ? principal.link.expiresAt : null };
}

/** Razón del cierre 4401 cuando caduca el enlace con el que se abrió la conexión. */
export const WS_EXPIRED_REASON = 'expired';
/** Milisegundos hasta `expiresAt` (0 si ya pasó; `null` si no caduca o no es una fecha). */
export function msUntil(expiresAt: string | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) ? Math.max(0, t - now) : null;
}
export const SAFE_ID = /^[A-Za-z0-9_\-:.]{1,120}$/;

// ---------------------------------------------------------------- Rate limit (memoria)
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 10, private windowMs = 15 * 60_000) {}
  /** true si se permite (y lo cuenta). */
  check(key: string): boolean {
    if (this.blocked(key)) return false;
    this.hit(key);
    return true;
  }
  /** ¿Ya se llegó al máximo en la ventana? (no cuenta nada). */
  blocked(key: string): boolean {
    const from = Date.now() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter(x => x > from);
    if (list.length) this.hits.set(key, list); else this.hits.delete(key);
    return list.length >= this.max;
  }
  /** Cuenta un intento (p. ej. sólo los fallidos). */
  hit(key: string): void {
    const t = Date.now(), from = t - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter(x => x > from);
    list.push(t); this.hits.set(key, list);
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some(x => x > from)) this.hits.delete(k);
  }
  reset(key: string) { this.hits.delete(key); }
}
