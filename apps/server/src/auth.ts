/**
 * Criptografía y resolución de identidad.
 * - Contraseñas: `crypto.scrypt` (N=2^15) con sal aleatoria → `scrypt$<sal>$<hash>`.
 * - Tokens (sesión, API key, enlace): aleatorios; en la BD sólo va su hash (SHA-256 o HMAC si hay `SESSION_SECRET`).
 * - Principal: sesión (cookie o Bearer), API key (Bearer `adk_…`) o enlace compartido (`?token=` / Bearer `lnk_…`).
 */
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Role, ShareLink, User, WorkspaceStore } from './store/types';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, hashHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), 32, SCRYPT);
  const expected = Buffer.from(hashHex, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function randomToken(prefix: string, bytes = 32): string {
  return prefix + [...randomBytes(bytes)].map(b => ALPHABET[b % ALPHABET.length]).join('');
}
export const SESSION_PREFIX = 'ads_';
export const APIKEY_PREFIX = 'adk_';
export const LINK_PREFIX = 'lnk_';
export const SESSION_COOKIE = 'alldraw_session';
export const SESSION_DAYS = 30;

export function makeHasher(secret: string | null) {
  return (token: string): string => secret
    ? createHmac('sha256', secret).update(token).digest('hex')
    : createHash('sha256').update(token).digest('hex');
}
export type Hasher = ReturnType<typeof makeHasher>;

// ---------------------------------------------------------------- Principal
export type Principal =
  | { kind: 'user'; user: User; via: 'session' | 'apikey'; sessionHash?: string }
  | { kind: 'link'; link: ShareLink };

export interface AuthContext { store: WorkspaceStore; hash: Hasher }

/** Resuelve cualquier token (sesión, API key o enlace) a un principal. */
export async function resolveToken(ctx: AuthContext, token: string | null | undefined): Promise<Principal | null> {
  if (!token) return null;
  if (token.startsWith(APIKEY_PREFIX)) {
    const key = await ctx.store.resolveApiKey(ctx.hash(token));
    if (!key) return null;
    const user = await ctx.store.getUser(key.userId);
    if (!user) return null;
    void ctx.store.touchApiKey(key.id);
    return { kind: 'user', user, via: 'apikey' };
  }
  if (token.startsWith(LINK_PREFIX)) {
    const link = await ctx.store.resolveShareLink(token);
    return link ? { kind: 'link', link } : null;
  }
  const h = ctx.hash(token);
  const session = await ctx.store.getSession(h);
  if (!session) return null;
  const user = await ctx.store.getUser(session.userId);
  return user ? { kind: 'user', user, via: 'session', sessionHash: h } : null;
}

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Token de una petición HTTP: `Authorization: Bearer`, luego cookie de sesión, luego `?token=`. */
export function tokenFromRequest(headers: { get(n: string): string | null }, url: URL): string | null {
  const auth = headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const cookie = parseCookies(headers.get('cookie'))[SESSION_COOKIE];
  if (cookie) return cookie;
  return url.searchParams.get('token');
}

/** Rol efectivo de un principal sobre un espacio (los admins actúan como dueños). */
export async function roleFor(store: WorkspaceStore, p: Principal | null, workspaceId: string): Promise<Role | null> {
  if (!p) return null;
  if (p.kind === 'link') return p.link.workspaceId === workspaceId ? p.link.role : null;
  if (p.user.isAdmin) return (await store.getWorkspace(workspaceId)) ? 'owner' : null;
  return store.getRole(workspaceId, p.user.id);
}

// ---------------------------------------------------------------- Rate limit (memoria)
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max = 10, private windowMs = 15 * 60_000) {}
  /** true si se permite. */
  check(key: string): boolean {
    const t = Date.now(), from = t - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter(x => x > from);
    if (list.length >= this.max) { this.hits.set(key, list); return false; }
    list.push(t); this.hits.set(key, list);
    if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (!v.some(x => x > from)) this.hits.delete(k);
    return true;
  }
  reset(key: string) { this.hits.delete(key); }
}
