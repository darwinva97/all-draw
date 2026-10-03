/**
 * API REST (Hono + zod-openapi), sin nada de Node: corre en `@hono/node-server` y en Cloudflare
 * Workers. Toda ruta vive bajo `/api`; el documento OpenAPI 3.1 se genera de las mismas
 * definiciones y se sirve en `/api/openapi.json`. El contenido de los espacios se toca a través de
 * un `DocHost` (`host.ts`).
 *
 * Identidad: `Authorization: Bearer <sesión|API key|enlace>`, cookie `alldraw_session` o `?token=`.
 * Roles por espacio: owner > editor > viewer. Los admins actúan como dueños de cualquier espacio.
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { CommandSchema, Workspace as WorkspaceSchema, type Command, type NotationPack, type Workspace } from '@all-draw/core';
import type { DocHost } from './host';
import type { ConnMatch } from './docs';
import { WS_REVOKED, WS_ROLE_CHANGED } from './ysync';
import { ALL_PACKS, describePacks } from './notations';
import { CommandError, DOC_TOO_LARGE, formatBytes, normalizeCommand } from './ops';
import { jsonLogger, redactPath, redactTokens, truncateIp, type Logger } from './log';
import {
  APIKEY_PREFIX, CSRF_HEADER, CSRF_VALUE, LEGACY_EMAIL, LINK_PREFIX, RateLimiter, SAFE_ID, SESSION_COOKIE, SESSION_MS, SESSION_PREFIX,
  credentialsFromRequest, hashPassword, isTrustedOrigin, needsRehash, randomToken, resolveToken, roleFor, safeEqualString, sessionNeedsRenewal, verifyPassword,
  type Hasher, type Principal,
} from './auth';
import { atLeast, type Member, type Role, type ShareLink, type SnapshotMeta, type User, type WorkspaceRow, type WorkspaceStore } from './store/types';

/** Tamaños máximos de cuerpo: 5 MB para Workspace JSON completos, 1 MB para el resto (comandos incluidos). */
export const MAX_BODY_SNAPSHOT = 5 * 1024 * 1024;
export const MAX_BODY_DEFAULT = 1024 * 1024;
/** Informes de errores del cliente (`POST /api/client-errors`): pequeños y sin datos del diagrama. */
export const MAX_BODY_CLIENT_ERROR = 8 * 1024;
/** Cuotas por defecto (ver `ApiConfig`). */
export const DEFAULT_MAX_WORKSPACES_PER_USER = 100;
export const DEFAULT_MAX_DOC_BYTES = 20 * 1024 * 1024;
/** Tiempo mínimo entre que se pide el formulario de registro (`GET /api/auth/config`) y se envía. */
export const DEFAULT_REGISTER_MIN_MS = 2000;
/** Un `formToken` de registro vale un día. */
export const FORM_TOKEN_MAX_AGE_MS = 86_400_000;

/** Lo que la API necesita saber del despliegue (subconjunto de la `Config` de cada runtime). */
export interface ApiConfig {
  allowRegistration: boolean;
  /** Fuerza `Secure` en la cookie aunque la petición llegue por http (detrás de un proxy sin `x-forwarded-proto`). */
  cookieSecure: boolean;
  /** URL pública (para construir enlaces compartidos); si falta se deduce de la petición. */
  publicUrl: string | null;
  /** Si está, el registro exige este código (`inviteCode` en el cuerpo); `GET /api/auth/config` lo anuncia como `invite`. */
  inviteCode?: string | null;
  /** Espacios de los que una cuenta puede ser dueña (`MAX_WORKSPACES_PER_USER`, 100); 0 = sin límite. Los admins no tienen límite. */
  maxWorkspacesPerUser?: number;
  /** Tamaño máximo de un espacio en bytes (`MAX_DOC_BYTES`, 20 MB; 0 = sin límite). Lo aplica el `DocHost`; aquí se anuncia y se comprueban los Workspace JSON enteros. */
  maxDocBytes?: number;
  /** Tiempo mínimo del formulario de registro en ms (`REGISTER_MIN_MS`, 2000); 0 desactiva el `formToken`. */
  registerMinMs?: number;
}

/** Versión desplegada (la publica `GET /api/status`). */
export interface BuildInfo {
  version: string;
  /** Commit corto (`git rev-parse --short HEAD` o `ALLDRAW_COMMIT`); `null` si no se sabe. */
  commit: string | null;
  /** `node` o `cloudflare`. */
  runtime: string;
  /** Motor del registro: `sqlite`, `postgres`, `memory`, `durable-object`, `d1`. */
  db: string;
  startedAt: string;
}

/** Lo que se archiva de un espacio que se borra con la cuenta de su dueño (formato `all-draw-backup/1` de `backup.mjs`). */
export interface WorkspaceArchive {
  format: 'all-draw-backup/1';
  exportedAt: string;
  reason: 'account-deleted';
  deletedBy: { id: string; email: string };
  workspace: { id: string; name: string; ownerId: string; ownerEmail: string; createdAt: string; updatedAt: string; members: { userId: string; email: string | null; role: string; createdAt: string }[]; links: { token: string; role: string; createdBy: string; createdAt: string; expiresAt: string | null }[] };
  snapshot: Workspace | null;
}
export interface ApiDeps {
  store: WorkspaceStore;
  docs: DocHost;
  hash: Hasher;
  config: ApiConfig;
  /** Packs anunciados en `GET /api/notations` (por defecto todos los del monorepo). */
  notations?: NotationPack[];
  /** Registro estructurado (por defecto JSON por `console`). */
  logger?: Logger;
  /** Versión, commit y motor (para `GET /api/status`). */
  build?: Partial<BuildInfo>;
  /** Se llama con la identidad resuelta de cada petición `/api` (el servidor Node la pone en su log de accesos). */
  onIdentity?: (c: Context, principal: Principal | null) => void;
  /**
   * Guarda una copia final de un espacio antes de borrarlo con la cuenta de su dueño (`DELETE /api/auth/account`).
   * En Node escribe en las copias de seguridad del VPS; si lanza, la cuenta no se borra.
   */
  archiveWorkspace?: (a: WorkspaceArchive) => Promise<void>;
}
type Env = { Variables: { principal: Principal | null } };

// ---------------------------------------------------------------- Esquemas
const RoleSchema = z.enum(['owner', 'editor', 'viewer']);
const MemberRoleSchema = z.enum(['editor', 'viewer']);
const UserOut = z.object({ id: z.string(), email: z.string(), name: z.string(), isAdmin: z.boolean(), createdAt: z.string() }).meta({ id: 'User' });
const AuthOut = z.object({ user: UserOut, token: z.string().describe('Token de sesión (también va en la cookie)') });
const KeyOut = z.object({ id: z.string(), name: z.string(), prefix: z.string(), createdAt: z.string(), lastUsedAt: z.string().nullable() });
const WorkspaceOut = z.object({ id: z.string(), name: z.string(), ownerId: z.string(), createdAt: z.string(), updatedAt: z.string(), role: RoleSchema }).meta({ id: 'WorkspaceInfo' });
const MemberOut = z.object({ userId: z.string(), role: MemberRoleSchema, createdAt: z.string(), user: z.object({ id: z.string(), email: z.string(), name: z.string() }).nullable() });
const LinkOut = z.object({ token: z.string(), url: z.string(), workspaceId: z.string(), role: MemberRoleSchema, createdAt: z.string(), expiresAt: z.string().nullable() });
const ErrorOut = z.object({ error: z.string(), issues: z.array(z.unknown()).optional() }).meta({ id: 'Error' });
const SnapshotOut = z.object({ id: z.string(), workspaceId: z.string(), createdAt: z.string(), authorId: z.string().nullable(), author: z.object({ id: z.string(), name: z.string() }).nullable(), label: z.string().nullable(), size: z.number() }).meta({ id: 'Snapshot' });
const SafeId = z.string().regex(SAFE_ID, 'id no válido');
const Id = z.object({ id: SafeId });
const SnapshotParams = Id.extend({ sid: SafeId });
const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8).max(200);
const jsonBody = <T extends z.ZodTypeAny>(schema: T, description?: string) => ({ required: true, content: { 'application/json': { schema } }, ...(description ? { description } : {}) });
const jsonRes = <T extends z.ZodTypeAny>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
const errors = {
  400: jsonRes(ErrorOut, 'Petición inválida'),
  401: jsonRes(ErrorOut, 'Sin identificar'),
  403: jsonRes(ErrorOut, 'Sin permiso'),
  404: jsonRes(ErrorOut, 'No existe'),
};
const bearer: Record<string, string[]>[] = [{ bearerAuth: [] }, { cookieAuth: [] }];

const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501 | 503, error: string, extra: Record<string, unknown> = {}) =>
  new HTTPException(status, { res: Response.json({ error, ...extra }, { status }) });

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin, createdAt: u.createdAt });

const QuotasOut = z.object({
  workspaces: z.object({ used: z.number(), limit: z.number().nullable().describe('null = sin límite') }),
  docBytes: z.object({ limit: z.number().nullable() }),
}).meta({ id: 'Quotas' });
const ClientError = z.object({
  message: z.string().max(1000),
  stack: z.string().max(4000).optional(),
  componentStack: z.string().max(2000).optional(),
  source: z.enum(['boundary', 'onerror', 'unhandledrejection', 'manual']).optional(),
  url: z.string().max(500).optional().describe('URL de la página (los tokens se borran antes de registrarla)'),
  release: z.string().max(100).optional(),
  userAgent: z.string().max(300).optional(),
  count: z.number().int().min(1).max(10_000).optional().describe('Veces que se repitió (deduplicado en el cliente)'),
});

export function createApi({ store, docs, hash, config, notations = ALL_PACKS, logger = jsonLogger(), build = {}, onIdentity, archiveWorkspace }: ApiDeps) {
  const maxWorkspaces = config.maxWorkspacesPerUser ?? DEFAULT_MAX_WORKSPACES_PER_USER;
  const maxDocBytes = config.maxDocBytes ?? DEFAULT_MAX_DOC_BYTES;
  const registerMinMs = config.registerMinMs ?? DEFAULT_REGISTER_MIN_MS;
  const startedAt = build.startedAt ?? new Date().toISOString();
  /** Comprueba el tamaño de un Workspace JSON entero (crear con `initial`, reemplazar) antes de cargarlo. */
  const checkWorkspaceSize = (ws: unknown) => {
    if (maxDocBytes > 0 && JSON.stringify(ws).length > maxDocBytes) throw fail(413, `El espacio supera el tamaño máximo (${formatBytes(maxDocBytes)}). Reparte el modelo en varios espacios.`, { code: DOC_TOO_LARGE, limit: maxDocBytes });
  };
  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'validación', issues: result.error.issues }, 400);
    },
  });
  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const registerLimiter = new RateLimiter(10, 60 * 60_000);
  const passwordLimiter = new RateLimiter(10, 15 * 60_000);
  const linkLimiter = new RateLimiter(30, 15 * 60_000);
  const accountLimiter = new RateLimiter(10, 15 * 60_000);
  const clientErrorLimiter = new RateLimiter(30, 10 * 60_000);
  const auth = { store, hash };
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    if (err instanceof CommandError) return c.json({ error: err.message, ...(err.issues ? { issues: err.issues } : {}), ...err.extra }, err.status);
    logger.error('error interno', { err, method: c.req.method, path: redactPath(c.req.path) });
    return c.json({ error: 'error interno' }, 500);
  });
  app.notFound(c => c.json({ error: 'ruta desconocida' }, 404));

  // Tamaño máximo del cuerpo (413) antes de leer nada.
  app.use('/api/*', async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const p = c.req.path;
    const big = p === '/api/workspaces' || /\/snapshot$/.test(p) || /\/snapshots\/[^/]+\/restore$/.test(p);
    const maxSize = p === '/api/client-errors' ? MAX_BODY_CLIENT_ERROR : big ? MAX_BODY_SNAPSHOT : MAX_BODY_DEFAULT;
    return bodyLimit({ maxSize, onError: () => { throw fail(413, 'Cuerpo demasiado grande'); } })(c, next);
  });

  // Identidad + CSRF + renovación deslizante de la sesión.
  app.use('/api/*', async (c, next) => {
    const url = new URL(c.req.url);
    const cred = credentialsFromRequest(c.req.raw.headers, url);
    if (cred.source === 'cookie' && !SAFE_METHODS.has(c.req.method) && !isTrustedOrigin(c.req.raw.headers, url)) {
      throw fail(403, `Petición con cookie desde otro origen rechazada (CSRF): añade la cabecera ${CSRF_HEADER}: ${CSRF_VALUE} o usa Authorization: Bearer`);
    }
    const p = await resolveToken(auth, cred.token);
    if (p?.kind === 'user' && p.session && p.sessionHash && sessionNeedsRenewal(p.session)) {
      const expires = new Date(Date.now() + SESSION_MS);
      void store.touchSession(p.sessionHash, expires.toISOString()).catch(() => { /* se reintenta en la siguiente */ });
      if (cred.source === 'cookie') setCookie(c, SESSION_COOKIE, cred.token!, { httpOnly: true, sameSite: 'Lax', secure: cookieSecure(c), path: '/', expires });
    }
    c.set('principal', p);
    onIdentity?.(c, p);
    await next();
  });

  const requireUser = (c: { get(k: 'principal'): Principal | null }): Extract<Principal, { kind: 'user' }> => {
    const p = c.get('principal');
    if (!p) throw fail(401, 'Identifícate: cookie de sesión o Authorization: Bearer <token>');
    if (p.kind !== 'user') throw fail(403, 'Esta operación requiere una cuenta, no un enlace compartido');
    return p;
  };
  const requireRole = async (c: { get(k: 'principal'): Principal | null }, workspaceId: string, min: Role) => {
    const ws = await store.getWorkspace(workspaceId);
    if (!ws) throw fail(404, 'El espacio no existe');
    const p = c.get('principal');
    const role = await roleFor(store, p, workspaceId);
    if (!role) throw fail(p ? 403 : 401, p ? 'No tienes acceso a este espacio' : 'Identifícate para acceder al espacio');
    if (!atLeast(role, min)) throw fail(403, `Se requiere rol ${min} (tienes ${role})`);
    return { ws, role, principal: p! };
  };
  /**
   * Cierra las conexiones WebSocket abiertas con un acceso que acaba de cambiar (4401 revocado, 4205 cambio de rol).
   * Es un efecto secundario: si falla se registra, pero la operación (ya guardada en el store) no se deshace.
   */
  const kick = async (workspaceId: string, match: ConnMatch, code: number, reason: string) => {
    try {
      const n = await docs.revoke(workspaceId, match, code, reason);
      if (n) logger.info('ws revocado', { workspace: workspaceId, code, closed: n, ...(match.userId ? { user: match.userId } : { link: true }) });
    } catch (e) { logger.error('no se pudieron cerrar las conexiones revocadas', { workspace: workspaceId, code, err: e }); }
  };
  const cookieSecure = (c: { req: { header(n: string): string | undefined } }) => config.cookieSecure || c.req.header('x-forwarded-proto') === 'https';
  const clientIp = (c: { req: { header(n: string): string | undefined } }) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'local';
  const requireAdmin = (c: { get(k: 'principal'): Principal | null }) => { const p = requireUser(c); if (!p.user.isAdmin) throw fail(403, 'Sólo administradores'); return p; };
  /** Estado del registro para `GET /api/auth/config` y para `register`. */
  const registrationState = async (): Promise<'open' | 'invite' | 'closed'> => {
    const n = (await store.countUsers()) - ((await store.getUserByEmail(LEGACY_EMAIL)) ? 1 : 0);
    // Cerrado es cerrado también con cero usuarios: un despliegue nuevo con el registro cerrado no deja que
    // cualquiera se haga administrador. Para crear el primero: abrir el registro, o `INVITE_CODE`, o importar.
    if (!config.allowRegistration && (n > 0 || !config.inviteCode)) return 'closed';
    return config.inviteCode ? 'invite' : 'open';
  };
  const authorOf = async (m: SnapshotMeta) => {
    const u = m.authorId ? await store.getUser(m.authorId) : null;
    return { ...m, author: u ? { id: u.id, name: u.name } : null };
  };
  const baseUrl = (c: { req: { header(n: string): string | undefined } }) => config.publicUrl ?? `${c.req.header('x-forwarded-proto') ?? 'http'}://${c.req.header('x-forwarded-host') ?? c.req.header('host') ?? 'localhost'}`;
  const linkUrl = (c: { req: { header(n: string): string | undefined } }, workspaceId: string, token: string) => `${baseUrl(c)}/#/s/${encodeURIComponent(workspaceId)}?token=${encodeURIComponent(token)}`;

  async function startSession(c: Parameters<typeof setCookie>[0], user: User) {
    const token = randomToken(SESSION_PREFIX);
    const expires = new Date(Date.now() + SESSION_MS);
    await store.createSession(user.id, await hash(token), expires.toISOString());
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', secure: cookieSecure(c), path: '/', expires });
    void store.purgeExpiredSessions().catch(() => { /* limpieza oportunista */ });
    return token;
  }

  // Anti-abuso del registro: `formToken` = `<emitido-ms>.<hash('register-form:<emitido-ms>')>` (HMAC con
  // `SESSION_SECRET` si está). Lo da `GET /api/auth/config` y el registro exige que tenga ≥ `registerMinMs`.
  const formToken = async (t = Date.now()) => `${t}.${(await hash(`register-form:${t}`)).slice(0, 32)}`;
  const checkFormToken = async (token: string | undefined): Promise<string | null> => {
    if (registerMinMs <= 0) return null;
    const m = /^(\d{10,16})\.([0-9a-f]{32})$/.exec(token ?? '');
    if (!m || !safeEqualString(await formToken(Number(m[1])), token!)) return 'Formulario de registro no válido o caducado: recarga la página y vuelve a intentarlo';
    const age = Date.now() - Number(m[1]);
    if (age > FORM_TOKEN_MAX_AGE_MS) return 'El formulario de registro ha caducado: recarga la página';
    if (age < registerMinMs) return 'Demasiado rápido: espera un par de segundos y vuelve a enviar el formulario';
    return null;
  };
  const humanUsers = async () => (await store.listUsers()).filter(u => u.email !== LEGACY_EMAIL);
  const quotasFor = async (u: User) => ({
    workspaces: { used: await store.countOwnedWorkspaces(u.id), limit: u.isAdmin || maxWorkspaces <= 0 ? null : maxWorkspaces },
    docBytes: { limit: maxDocBytes > 0 ? maxDocBytes : null },
  });

  // ---------------------------------------------------------------- Salud y catálogo
  app.openapi(createRoute({ method: 'get', path: '/healthz', tags: ['sistema'], responses: { 200: { description: 'ok', content: { 'text/plain': { schema: z.string() } } } } }),
    c => c.text('ok'));

  const StatusOut = z.object({
    status: z.enum(['ok', 'degraded']), version: z.string(), commit: z.string().nullable(), runtime: z.string(), startedAt: z.string(), uptimeS: z.number(),
    db: z.object({ kind: z.string(), ok: z.boolean(), ms: z.number(), error: z.string().optional() }),
  });
  app.openapi(createRoute({
    method: 'get', path: '/api/status', tags: ['sistema'], summary: 'Estado público: versión, commit, tiempo en marcha y si la base de datos responde',
    responses: { 200: jsonRes(StatusOut, 'Todo bien'), 503: jsonRes(StatusOut, 'La base de datos no responde') },
  }), async c => {
    const t0 = Date.now();
    let dbOk = true, dbError: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([store.countUsers(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timeout')), 3000); })]);
    } catch (e) { dbOk = false; dbError = e instanceof Error && e.message === 'timeout' ? 'timeout' : 'error'; logger.error('status: la BD no responde', { err: e }); }
    finally { clearTimeout(timer); }
    const body = {
      status: dbOk ? 'ok' as const : 'degraded' as const,
      version: build.version ?? '0.0.0', commit: build.commit ?? null, runtime: build.runtime ?? 'unknown', startedAt,
      uptimeS: Math.round((Date.now() - Date.parse(startedAt)) / 1000),
      db: { kind: build.db ?? 'unknown', ok: dbOk, ms: Date.now() - t0, ...(dbError ? { error: dbError } : {}) },
    };
    c.header('cache-control', 'no-store');
    return dbOk ? c.json(body, 200) : c.json(body, 503);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/client-errors', tags: ['sistema'], summary: 'Informe de un error de la app web (máx. 8 KB, sin datos del diagrama); se registra en el log del servidor',
    request: { body: jsonBody(ClientError) },
    responses: { 204: { description: 'Registrado' }, 400: errors[400], 413: jsonRes(ErrorOut, 'Demasiado grande'), 429: jsonRes(ErrorOut, 'Demasiados informes') },
  }), async c => {
    const ip = clientIp(c);
    if (!clientErrorLimiter.check(`ip:${ip}`)) throw fail(429, 'Demasiados informes de error; gracias, ya tenemos bastantes');
    const e = c.req.valid('json');
    const p = c.get('principal');
    logger.warn('client-error', {
      source: e.source ?? 'manual', message: redactTokens(e.message),
      ...(e.stack ? { stack: redactTokens(e.stack) } : {}),
      ...(e.componentStack ? { componentStack: redactTokens(e.componentStack) } : {}),
      ...(e.url ? { url: redactTokens(e.url) } : {}),
      ...(e.release ? { release: e.release } : {}), ...(e.userAgent ? { userAgent: e.userAgent } : {}), ...(e.count ? { count: e.count } : {}),
      user: p ? (p.kind === 'user' ? p.user.id : 'link') : 'anon', ip: truncateIp(ip),
    });
    return c.body(null, 204);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/notations', tags: ['catálogo'], summary: 'Packs de notación con sus tipos de elemento, relación y puerto (ids a usar en los comandos)',
    responses: { 200: jsonRes(z.object({ packs: z.array(z.record(z.string(), z.unknown())) }), 'Packs') },
  }), c => c.json({ packs: describePacks(notations) as Record<string, unknown>[] }, 200));

  // ---------------------------------------------------------------- Auth
  app.openapi(createRoute({
    method: 'get', path: '/api/auth/config', tags: ['auth'], summary: 'Qué necesita el registro: abierto, con código de invitación o cerrado',
    responses: { 200: jsonRes(z.object({
      registration: z.enum(['open', 'invite', 'closed']), passwordMinLength: z.number(),
      formToken: z.string().describe('Mándalo en el registro; vale tras `formMinMs` y durante un día'), formMinMs: z.number(),
    }), 'Configuración pública') },
  }), async c => {
    c.header('cache-control', 'no-store');
    return c.json({ registration: await registrationState(), passwordMinLength: 8, formToken: await formToken(), formMinMs: registerMinMs }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/register', tags: ['auth'], summary: 'Crear cuenta (el primer usuario es admin)',
    request: { body: jsonBody(z.object({
      email: Email, name: z.string().trim().min(1).max(120), password: Password, inviteCode: z.string().max(200).optional(),
      formToken: z.string().max(100).optional().describe('El de `GET /api/auth/config` (obligatorio salvo con REGISTER_MIN_MS=0)'),
      website: z.string().max(500).optional().describe('Trampa para bots: debe ir vacío'),
    })) },
    responses: { 201: jsonRes(AuthOut, 'Cuenta creada y sesión iniciada'), 400: errors[400], 403: errors[403], 409: jsonRes(ErrorOut, 'Email ya registrado'), 429: jsonRes(ErrorOut, 'Demasiados registros') },
  }), async c => {
    const body = c.req.valid('json');
    if (!registerLimiter.check(`ip:${clientIp(c)}`)) throw fail(429, 'Demasiados registros desde esta dirección; espera un rato');
    if (body.website) {
      logger.warn('registro: trampa rellenada', { ip: truncateIp(clientIp(c)) });
      throw fail(400, 'Registro rechazado');
    }
    const formError = await checkFormToken(body.formToken);
    if (formError) throw fail(400, formError, { code: 'form_token' });
    // El usuario técnico de la migración heredada no cuenta: el primer humano es admin.
    const n = (await store.countUsers()) - ((await store.getUserByEmail(LEGACY_EMAIL)) ? 1 : 0);
    if (!config.allowRegistration && (n > 0 || !config.inviteCode)) throw fail(403, 'El registro está cerrado');
    if (config.inviteCode && !safeEqualString(body.inviteCode ?? '', config.inviteCode)) throw fail(403, 'Código de invitación incorrecto');
    if (await store.getUserByEmail(body.email)) throw fail(409, 'Ese email ya está registrado');
    const user = await store.createUser({ email: body.email, name: body.name, passwordHash: await hashPassword(body.password), isAdmin: n === 0 });
    const token = await startSession(c, user);
    return c.json({ user: publicUser(user), token }, 201);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/login', tags: ['auth'], summary: 'Iniciar sesión',
    request: { body: jsonBody(z.object({ email: Email, password: z.string().min(1) })) },
    responses: { 200: jsonRes(AuthOut, 'Sesión iniciada'), 400: errors[400], 401: errors[401], 429: jsonRes(ErrorOut, 'Demasiados intentos') },
  }), async c => {
    const { email, password } = c.req.valid('json');
    if (!loginLimiter.check(`ip:${clientIp(c)}`) || !loginLimiter.check(`email:${email}`)) throw fail(429, 'Demasiados intentos; espera unos minutos');
    const user = await store.getUserByEmail(email);
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw fail(401, 'Email o contraseña incorrectos');
    loginLimiter.reset(`email:${email}`);
    // Migración transparente de hashes heredados (scrypt) al esquema actual (PBKDF2/WebCrypto).
    if (needsRehash(user.passwordHash)) { try { await store.setPasswordHash(user.id, await hashPassword(password)); } catch (e) { console.error('no se pudo re-hashear', e); } }
    const token = await startSession(c, user);
    return c.json({ user: publicUser(user), token }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/logout', tags: ['auth'], summary: 'Cerrar sesión (borra la sesión actual y la cookie)', security: bearer,
    responses: { 204: { description: 'Sesión cerrada' } },
  }), async c => {
    const p = c.get('principal');
    if (p?.kind === 'user' && p.sessionHash) await store.deleteSession(p.sessionHash);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/auth/sessions', tags: ['auth'], summary: 'Cerrar todas mis sesiones (en todos los navegadores)', security: bearer,
    responses: { 204: { description: 'Sesiones cerradas' }, 401: errors[401], 403: errors[403] },
  }), async c => {
    const p = requireUser(c);
    await store.deleteUserSessions(p.user.id);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.body(null, 204);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/auth/me', tags: ['auth'], summary: 'Quién soy y mis cuotas', security: bearer,
    responses: { 200: jsonRes(z.object({ user: UserOut, via: z.enum(['session', 'apikey']), quotas: QuotasOut }), 'Usuario'), 401: errors[401], 403: errors[403] },
  }), async c => { const p = requireUser(c); return c.json({ user: publicUser(p.user), via: p.via, quotas: await quotasFor(p.user) }, 200); });

  app.openapi(createRoute({
    method: 'patch', path: '/api/auth/me', tags: ['auth'], summary: 'Cambiar mi nombre o mi email (el email exige la contraseña actual y una sesión)', security: bearer,
    request: { body: jsonBody(z.object({ name: z.string().trim().min(1).max(120).optional(), email: Email.optional(), password: z.string().max(200).optional().describe('Contraseña actual (obligatoria para cambiar el email)') })) },
    responses: { 200: jsonRes(z.object({ user: UserOut }), 'Actualizado'), 400: errors[400], 401: errors[401], 403: errors[403], 409: jsonRes(ErrorOut, 'Email ya registrado'), 429: jsonRes(ErrorOut, 'Demasiados intentos') },
  }), async c => {
    const p = requireUser(c);
    const body = c.req.valid('json');
    const patch: { name?: string; email?: string } = {};
    if (body.name !== undefined && body.name !== p.user.name) patch.name = body.name;
    if (body.email !== undefined && body.email !== p.user.email) {
      if (p.via !== 'session') throw fail(403, 'Cambia el email desde una sesión, no con una API key');
      if (!accountLimiter.check(`user:${p.user.id}`)) throw fail(429, 'Demasiados intentos; espera unos minutos');
      if (!body.password || !p.user.passwordHash || !(await verifyPassword(body.password, p.user.passwordHash))) throw fail(403, 'Para cambiar el email escribe tu contraseña actual');
      if (await store.getUserByEmail(body.email)) throw fail(409, 'Ese email ya está registrado');
      patch.email = body.email;
    }
    let user = p.user;
    if (patch.name !== undefined || patch.email !== undefined) {
      try { user = (await store.updateUser(p.user.id, patch)) ?? user; }
      catch (e) { if (String(e).includes('email ya registrado')) throw fail(409, 'Ese email ya está registrado'); throw e; }
    }
    return c.json({ user: publicUser(user) }, 200);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/auth/export', tags: ['auth'], summary: 'Exportar mis datos (RGPD): cuenta, API keys, espacios propios como Workspace JSON con miembros y enlaces, y los compartidos conmigo', security: bearer,
    responses: { 200: jsonRes(z.record(z.string(), z.unknown()), 'JSON descargable (`all-draw-account/1`)'), 401: errors[401], 403: errors[403] },
  }), async c => {
    const p = requireUser(c);
    const u = p.user;
    const rows = await store.listWorkspaces(u.id);
    const workspaces = [];
    for (const w of rows) {
      if (w.role !== 'owner') { workspaces.push({ id: w.id, name: w.name, role: w.role, ownerId: w.ownerId, createdAt: w.createdAt, updatedAt: w.updatedAt }); continue; }
      const members = (await store.listMembers(w.id)).map(m => ({ userId: m.userId, email: m.user?.email ?? null, name: m.user?.name ?? null, role: m.role, createdAt: m.createdAt }));
      const links = (await store.listShareLinks(w.id)).map(l => ({ role: l.role, tokenPrefix: `${l.token.slice(0, 8)}…`, createdBy: l.createdBy, createdAt: l.createdAt, expiresAt: l.expiresAt }));
      let snapshot: Workspace | null = null;
      try { snapshot = await docs.snapshot(w.id); } catch (e) { logger.error('export: no se pudo leer el espacio', { workspace: w.id, err: e }); }
      workspaces.push({ id: w.id, name: w.name, role: w.role, ownerId: w.ownerId, createdAt: w.createdAt, updatedAt: w.updatedAt, members, links, snapshot });
    }
    const apiKeys = (await store.listApiKeys(u.id)).map(({ keyHash: _h, userId: _u, ...k }) => k);
    const stamp = new Date().toISOString();
    c.header('content-disposition', `attachment; filename="alldraw-${u.id}-${stamp.slice(0, 10)}.json"`);
    c.header('cache-control', 'no-store');
    return c.json({ format: 'all-draw-account/1', exportedAt: stamp, user: publicUser(u), quotas: await quotasFor(u), apiKeys, workspaces }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/auth/account', tags: ['auth'],
    summary: 'Borrar mi cuenta (confirma con la contraseña). Mis espacios pasan al editor más antiguo; si no tienen editores se borran (en el VPS, con copia final en las copias de seguridad)',
    security: bearer,
    request: { body: jsonBody(z.object({ password: z.string().min(1).max(200) })) },
    responses: {
      200: jsonRes(z.object({ ok: z.literal(true), deleted: z.array(z.string()), transferred: z.array(z.object({ id: z.string(), to: z.string() })) }), 'Cuenta borrada'),
      400: errors[400], 401: errors[401], 403: errors[403], 409: jsonRes(ErrorOut, 'Eres el único administrador'), 429: jsonRes(ErrorOut, 'Demasiados intentos'), 500: jsonRes(ErrorOut, 'No se pudo archivar un espacio: no se ha borrado nada'),
    },
  }), async c => {
    const p = requireUser(c);
    if (p.via !== 'session') throw fail(403, 'Borra la cuenta desde una sesión, no con una API key');
    if (!accountLimiter.check(`user:${p.user.id}`)) throw fail(429, 'Demasiados intentos; espera unos minutos');
    const { password } = c.req.valid('json');
    const u = p.user;
    if (!u.passwordHash || !(await verifyPassword(password, u.passwordHash))) throw fail(403, 'La contraseña no es correcta');
    if (u.isAdmin) {
      const others = (await humanUsers()).filter(x => x.id !== u.id);
      if (others.length > 0 && !others.some(x => x.isAdmin)) throw fail(409, 'Eres el único administrador: nombra antes a otro administrador (Cuenta → Usuarios del servidor)', { code: 'last_admin' });
    }
    // 1. Plan: cada espacio propio pasa a su editor más antiguo; sin editores, se borra (archivándolo antes).
    const mine = await store.listWorkspaces(u.id);
    const owned = mine.filter(w => w.role === 'owner');
    // Espacios en los que puede tener un WebSocket abierto y dejará de tener acceso (un admin entra en todos).
    const reachable = u.isAdmin ? (await store.listAllWorkspaces()).map(w => w.id) : mine.map(w => w.id);
    const plan: { ws: WorkspaceRow; heir: string | null; members: (Member & { user: Pick<User, 'id' | 'email' | 'name'> | null })[]; links: ShareLink[] }[] = [];
    for (const ws of owned) {
      const members = await store.listMembers(ws.id);
      const heir = members.filter(m => m.role === 'editor' && m.user && m.userId !== u.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.userId ?? null;
      plan.push({ ws, heir, members, links: heir ? [] : await store.listShareLinks(ws.id) });
    }
    // 2. Copias finales primero: si alguna falla no se toca nada.
    if (archiveWorkspace) {
      for (const { ws, heir, members, links } of plan) {
        if (heir) continue;
        let snapshot: Workspace | null = null;
        try { snapshot = await docs.snapshot(ws.id); } catch (e) { logger.error('borrar cuenta: no se pudo leer el espacio', { workspace: ws.id, err: e }); }
        try {
          await archiveWorkspace({
            format: 'all-draw-backup/1', exportedAt: new Date().toISOString(), reason: 'account-deleted', deletedBy: { id: u.id, email: u.email },
            workspace: { id: ws.id, name: ws.name, ownerId: ws.ownerId, ownerEmail: u.email, createdAt: ws.createdAt, updatedAt: ws.updatedAt,
              members: members.map(m => ({ userId: m.userId, email: m.user?.email ?? null, role: m.role, createdAt: m.createdAt })),
              links: links.map(l => ({ token: l.token, role: l.role, createdBy: l.createdBy, createdAt: l.createdAt, expiresAt: l.expiresAt })) },
            snapshot,
          });
        } catch (e) {
          logger.error('borrar cuenta: no se pudo archivar', { workspace: ws.id, err: e });
          throw fail(500, 'No se pudo guardar la copia final de un espacio; no se ha borrado nada. Inténtalo más tarde.');
        }
      }
    }
    // 3. Transferir o borrar, y por último la cuenta (sesiones, claves y membresías).
    const deleted: string[] = [], transferred: { id: string; to: string }[] = [];
    for (const { ws, heir } of plan) {
      if (heir) {
        await store.updateMeta(ws.id, { ownerId: heir });
        await store.setRole(ws.id, heir, null);
        transferred.push({ id: ws.id, to: heir });
      } else {
        await docs.drop(ws.id);
        await store.deleteWorkspace(ws.id);
        deleted.push(ws.id);
      }
    }
    await store.deleteUser(u.id);
    // 4. Fuera los WebSockets: los del usuario (4401) donde aún podía estar; el heredero pasa a dueño (4205, reconecta).
    for (const wid of reachable) if (!deleted.includes(wid)) await kick(wid, { userId: u.id }, WS_REVOKED, 'cuenta borrada');
    for (const t of transferred) await kick(t.id, { userId: t.to }, WS_ROLE_CHANGED, 'rol cambiado');
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    logger.info('cuenta borrada', { user: u.id, deleted: deleted.length, transferred: transferred.length });
    return c.json({ ok: true as const, deleted, transferred }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/password', tags: ['auth'], summary: 'Cambiar mi contraseña (actual + nueva); cierra las demás sesiones', security: bearer,
    request: { body: jsonBody(z.object({ current: z.string().min(1), password: Password })) },
    responses: { 200: jsonRes(z.object({ ok: z.literal(true) }), 'Cambiada'), 400: errors[400], 401: errors[401], 403: errors[403], 429: jsonRes(ErrorOut, 'Demasiados intentos') },
  }), async c => {
    const p = requireUser(c);
    if (p.via !== 'session') throw fail(403, 'Cambia la contraseña desde una sesión, no con una API key');
    if (!passwordLimiter.check(`user:${p.user.id}`)) throw fail(429, 'Demasiados intentos; espera unos minutos');
    const { current, password } = c.req.valid('json');
    if (!p.user.passwordHash || !(await verifyPassword(current, p.user.passwordHash))) throw fail(403, 'La contraseña actual no es correcta');
    await store.setPasswordHash(p.user.id, await hashPassword(password));
    await store.deleteUserSessions(p.user.id, p.sessionHash);
    passwordLimiter.reset(`user:${p.user.id}`);
    return c.json({ ok: true as const }, 200);
  });

  // ---------------------------------------------------------------- Administración
  app.openapi(createRoute({
    method: 'get', path: '/api/admin/users', tags: ['admin'], summary: 'Todas las cuentas (admin)', security: bearer,
    responses: { 200: jsonRes(z.object({ users: z.array(UserOut) }), 'Usuarios'), 401: errors[401], 403: errors[403] },
  }), async c => {
    requireAdmin(c);
    return c.json({ users: (await store.listUsers()).filter(u => u.email !== LEGACY_EMAIL).map(publicUser) }, 200);
  });

  app.openapi(createRoute({
    method: 'patch', path: '/api/admin/users/{id}', tags: ['admin'], summary: 'Nombrar o quitar administrador (admin, desde sesión)', security: bearer,
    request: { params: Id, body: jsonBody(z.object({ isAdmin: z.boolean() })) },
    responses: { 200: jsonRes(z.object({ user: UserOut }), 'Actualizado'), 400: errors[400], 401: errors[401], 403: errors[403], 404: errors[404], 409: jsonRes(ErrorOut, 'Quedaría sin administradores') },
  }), async c => {
    const p = requireAdmin(c);
    if (p.via !== 'session') throw fail(403, 'Cambia administradores desde una sesión, no con una API key');
    const id = c.req.valid('param').id;
    const { isAdmin } = c.req.valid('json');
    const target = await store.getUser(id);
    if (!target || target.email === LEGACY_EMAIL) throw fail(404, 'Usuario desconocido');
    if (!isAdmin && target.isAdmin && !(await humanUsers()).some(x => x.isAdmin && x.id !== id)) throw fail(409, 'Tiene que quedar al menos un administrador');
    const user = await store.updateUser(id, { isAdmin });
    return c.json({ user: publicUser(user!) }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/admin/users/{id}/reset', tags: ['admin'], summary: 'Restablecer la contraseña de un usuario: devuelve una temporal y cierra sus sesiones (admin, desde sesión)', security: bearer,
    request: { params: Id },
    responses: { 200: jsonRes(z.object({ password: z.string() }), 'Contraseña temporal (sólo se muestra aquí)'), 401: errors[401], 403: errors[403], 404: errors[404] },
  }), async c => {
    const p = requireAdmin(c);
    if (p.via !== 'session') throw fail(403, 'Restablece contraseñas desde una sesión, no con una API key');
    const id = c.req.valid('param').id;
    const u = await store.getUser(id);
    if (!u || u.email === LEGACY_EMAIL) throw fail(404, 'Usuario desconocido');
    const password = randomToken('', 16);
    await store.setPasswordHash(u.id, await hashPassword(password));
    await store.deleteUserSessions(u.id);
    return c.json({ password }, 200);
  });

  // ---------------------------------------------------------------- API keys
  app.openapi(createRoute({
    method: 'get', path: '/api/keys', tags: ['auth'], summary: 'Mis API keys', security: bearer,
    responses: { 200: jsonRes(z.object({ keys: z.array(KeyOut) }), 'Claves (sin el secreto)'), 401: errors[401] },
  }), async c => {
    const p = requireUser(c);
    const keys = await store.listApiKeys(p.user.id);
    return c.json({ keys: keys.map(({ keyHash: _h, userId: _u, ...k }) => k) }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/keys', tags: ['auth'], summary: 'Crear API key (el secreto sólo se devuelve aquí)', security: bearer,
    request: { body: jsonBody(z.object({ name: z.string().trim().min(1).max(80).default('API key') })) },
    responses: { 201: jsonRes(KeyOut.extend({ key: z.string() }), 'Clave creada'), 400: errors[400], 401: errors[401] },
  }), async c => {
    const p = requireUser(c);
    if (p.via !== 'session') throw fail(403, 'Crea las API keys desde una sesión, no con otra API key');
    const key = randomToken(APIKEY_PREFIX);
    const row = await store.createApiKey({ userId: p.user.id, name: c.req.valid('json').name, prefix: key.slice(0, 10), keyHash: await hash(key) });
    return c.json({ id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt, lastUsedAt: null, key }, 201);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/keys/{id}', tags: ['auth'], summary: 'Revocar API key', security: bearer, request: { params: Id },
    responses: { 204: { description: 'Revocada' }, 401: errors[401], 404: errors[404] },
  }), async c => {
    const p = requireUser(c);
    if (!(await store.deleteApiKey(p.user.id, c.req.valid('param').id))) throw fail(404, 'No existe esa clave');
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------- Espacios
  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces', tags: ['espacios'], summary: 'Mis espacios y los compartidos conmigo', security: bearer,
    responses: { 200: jsonRes(z.object({ workspaces: z.array(WorkspaceOut) }), 'Espacios'), 401: errors[401] },
  }), async c => {
    const p = requireUser(c);
    const rows = p.user.isAdmin ? (await store.listAllWorkspaces()).map(w => ({ ...w, role: 'owner' as Role })) : await store.listWorkspaces(p.user.id);
    return c.json({ workspaces: rows }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces', tags: ['espacios'], summary: 'Crear espacio (vacío o desde un Workspace JSON)', security: bearer,
    request: { body: jsonBody(z.object({ name: z.string().trim().min(1).max(200).optional(), initial: z.unknown().optional().describe('Workspace JSON completo (esquema de @all-draw/core)') })) },
    responses: { 201: jsonRes(WorkspaceOut, 'Creado'), 400: errors[400], 401: errors[401], 403: jsonRes(ErrorOut, 'Cuota de espacios agotada (`code: quota_workspaces`)'), 413: jsonRes(ErrorOut, 'Demasiado grande') },
  }), async c => {
    const p = requireUser(c);
    const body = c.req.valid('json');
    if (maxWorkspaces > 0 && !p.user.isAdmin && (await store.countOwnedWorkspaces(p.user.id)) >= maxWorkspaces) {
      throw fail(403, `Has llegado al máximo de ${maxWorkspaces} espacios por cuenta: borra los que ya no uses para crear otros.`, { code: 'quota_workspaces', limit: maxWorkspaces });
    }
    let initial: Workspace | null = null;
    if (body.initial !== undefined) {
      const r = WorkspaceSchema.safeParse(body.initial);
      if (!r.success) throw fail(400, 'initial no es un Workspace válido', { issues: r.error.issues });
      initial = r.data;
      checkWorkspaceSize(initial);
    }
    const name = body.name ?? initial?.meta.name ?? 'Sin nombre';
    const row = await store.createWorkspace({ ownerId: p.user.id, name });
    await docs.init(row.id, name, initial);
    return c.json({ ...row, role: 'owner' as const }, 201);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}', tags: ['espacios'], summary: 'Meta del espacio y mi rol (vale con token de enlace)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(WorkspaceOut, 'Espacio'), ...errors },
  }), async c => {
    const { ws, role } = await requireRole(c, c.req.valid('param').id, 'viewer');
    return c.json({ ...ws, role }, 200);
  });

  app.openapi(createRoute({
    method: 'patch', path: '/api/workspaces/{id}', tags: ['espacios'], summary: 'Renombrar (editor+) o transferir la propiedad (owner)', security: bearer,
    request: { params: Id, body: jsonBody(z.object({ name: z.string().trim().min(1).max(200).optional(), ownerId: z.string().optional() })) },
    responses: { 200: jsonRes(WorkspaceOut, 'Actualizado'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id, body = c.req.valid('json');
    const { role, principal } = await requireRole(c, id, body.ownerId !== undefined ? 'owner' : 'editor');
    if (principal.kind !== 'user') throw fail(403, 'Un enlace compartido no puede cambiar la meta');
    if (body.ownerId !== undefined && !(await store.getUser(body.ownerId))) throw fail(400, 'ownerId no existe');
    const prevOwner = (await store.getWorkspace(id))?.ownerId;
    const row = await store.updateMeta(id, body);
    if (body.name !== undefined) await docs.setMeta(id, { name: body.name });
    // Cambio de dueño: el anterior y el nuevo cambian de rol → reconectan y el servidor les da el que tengan ahora.
    if (body.ownerId !== undefined && prevOwner && prevOwner !== body.ownerId) {
      for (const uid of [prevOwner, body.ownerId]) await kick(id, { userId: uid }, WS_ROLE_CHANGED, 'rol cambiado');
    }
    return c.json({ ...row!, role }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}', tags: ['espacios'], summary: 'Borrar espacio (owner); los WebSockets abiertos se cierran con 4410', security: bearer, request: { params: Id },
    responses: { 204: { description: 'Borrado' }, ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'owner');
    await docs.drop(id);
    await store.deleteWorkspace(id);
    return c.body(null, 204);
  });

  // Miembros
  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/members', tags: ['permisos'], summary: 'Miembros (además del dueño)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ ownerId: z.string(), members: z.array(MemberOut) }), 'Miembros'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    const { ws } = await requireRole(c, id, 'viewer');
    const members = await store.listMembers(id);
    return c.json({ ownerId: ws.ownerId, members: members.map(({ workspaceId: _w, ...m }) => m) }, 200);
  });

  app.openapi(createRoute({
    method: 'put', path: '/api/workspaces/{id}/members/{userId}', tags: ['permisos'], summary: 'Dar o cambiar rol a un usuario (owner); si cambia, sus WebSockets abiertos se cierran con 4205 y reconectan con el rol nuevo', security: bearer,
    request: { params: Id.extend({ userId: z.string().min(1) }), body: jsonBody(z.object({ role: MemberRoleSchema })) },
    responses: { 200: jsonRes(MemberOut, 'Rol fijado'), ...errors },
  }), async c => {
    const { id, userId } = c.req.valid('param'); const { role } = c.req.valid('json');
    const { ws } = await requireRole(c, id, 'owner');
    if (userId === ws.ownerId) throw fail(400, 'El dueño no necesita rol');
    const u = await store.getUser(userId);
    if (!u) throw fail(404, 'Usuario desconocido');
    const prev = await store.getRole(id, userId);
    await store.setRole(id, userId, role);
    // Si ya tenía rol y cambia, sus WebSockets se cierran con 4205: el cliente reconecta y recibe el rol nuevo
    // (un editor que pasa a viewer deja de poder escribir al momento). Un admin es dueño igualmente: no se toca.
    if (prev && prev !== role && !u.isAdmin) await kick(id, { userId }, WS_ROLE_CHANGED, 'rol cambiado');
    const m = (await store.listMembers(id)).find(x => x.userId === userId)!;
    const { workspaceId: _w, ...out } = m;
    return c.json(out, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/members/{userId}', tags: ['permisos'], summary: 'Quitar a un usuario (owner); sus WebSockets abiertos se cierran con 4401', security: bearer,
    request: { params: Id.extend({ userId: z.string().min(1) }) },
    responses: { 204: { description: 'Quitado' }, ...errors },
  }), async c => {
    const { id, userId } = c.req.valid('param');
    const { ws } = await requireRole(c, id, 'owner');
    const prev = userId === ws.ownerId ? null : await store.getRole(id, userId);
    await store.setRole(id, userId, null);
    if (prev && !(await store.getUser(userId))?.isAdmin) await kick(id, { userId }, WS_REVOKED, 'acceso revocado');
    return c.body(null, 204);
  });

  // Enlaces
  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/links', tags: ['permisos'], summary: 'Crear enlace compartido con rol (owner)', security: bearer,
    request: { params: Id, body: jsonBody(z.object({ role: MemberRoleSchema, expiresAt: z.string().datetime().optional() })) },
    responses: { 201: jsonRes(LinkOut, 'Enlace'), ...errors, 429: jsonRes(ErrorOut, 'Demasiados enlaces') },
  }), async c => {
    const id = c.req.valid('param').id; const body = c.req.valid('json');
    const { principal } = await requireRole(c, id, 'owner');
    if (!linkLimiter.check(principal.kind === 'user' ? `user:${principal.user.id}` : `ip:${clientIp(c)}`)) throw fail(429, 'Demasiados enlaces creados; espera unos minutos');
    const link = await store.createShareLink({ workspaceId: id, role: body.role, createdBy: principal.kind === 'user' ? principal.user.id : 'link', token: randomToken(LINK_PREFIX), expiresAt: body.expiresAt ?? null });
    return c.json({ ...link, url: linkUrl(c, id, link.token) }, 201);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/links', tags: ['permisos'], summary: 'Enlaces del espacio (owner)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ links: z.array(LinkOut) }), 'Enlaces'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'owner');
    const links = await store.listShareLinks(id);
    return c.json({ links: links.map(l => ({ ...l, url: linkUrl(c, id, l.token) })) }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/links/{token}', tags: ['permisos'], summary: 'Revocar enlace (owner); quien lo tenga abierto se desconecta (WebSocket 4401)', security: bearer,
    request: { params: Id.extend({ token: z.string().min(1) }) },
    responses: { 204: { description: 'Revocado' }, ...errors },
  }), async c => {
    const { id, token } = c.req.valid('param');
    await requireRole(c, id, 'owner');
    if (!(await store.deleteShareLink(id, token))) throw fail(404, 'No existe ese enlace');
    await kick(id, { linkToken: token }, WS_REVOKED, 'enlace revocado');
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------- Contenido
  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/snapshot', tags: ['contenido'], summary: 'Workspace JSON completo (viewer+)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(WorkspaceSchema, 'Workspace'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'viewer');
    const snap = await docs.snapshot(id);
    return c.json(snap, 200);
  });

  app.openapi(createRoute({
    method: 'put', path: '/api/workspaces/{id}/snapshot', tags: ['contenido'], summary: 'Reemplazar todo el contenido por un Workspace JSON (editor+)', security: bearer,
    request: { params: Id, body: jsonBody(WorkspaceSchema) },
    responses: { 200: jsonRes(z.object({ ok: z.literal(true) }), 'Reemplazado'), ...errors, 413: jsonRes(ErrorOut, 'El espacio superaría MAX_DOC_BYTES (`code: doc_too_large`)') },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'editor');
    const ws = c.req.valid('json') as Workspace;
    checkWorkspaceSize(ws);
    await docs.replace(id, ws);
    if (ws.meta.name) await store.updateMeta(id, { name: ws.meta.name });
    return c.json({ ok: true as const }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/commands', tags: ['contenido'], summary: 'Aplicar comandos sobre el documento vivo (editor+); los clientes conectados lo ven al instante',
    security: bearer,
    request: { params: Id, body: jsonBody(z.object({ commands: z.array(CommandSchema).min(1).max(5000), label: z.string().optional() })) },
    responses: { 200: jsonRes(z.object({ applied: z.number(), inverse: z.unknown().describe('Comando inverso (deshacer)') }), 'Aplicados'), ...errors, 413: jsonRes(ErrorOut, 'El espacio está en MAX_DOC_BYTES (`code: doc_too_large`)'), 422: jsonRes(ErrorOut, 'Un comando no se pudo aplicar (nada se aplicó)') },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'editor');
    const { label } = c.req.valid('json');
    const commands = (c.req.valid('json').commands as Command[]).map(normalizeCommand); // lanza CommandError 400
    const inverse = await docs.commands(id, commands, label); // lanza CommandError 422
    return c.json({ applied: commands.length, inverse }, 200);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/validate', tags: ['contenido'], summary: 'Diagnósticos del modelo (viewer+)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ diagnostics: z.array(z.object({ code: z.string(), severity: z.enum(['error', 'warning', 'info']), subject: z.object({ collection: z.string(), id: z.string() }), message: z.string(), evidence: z.record(z.string(), z.unknown()).optional(), supportedFixes: z.array(z.object({ label: z.string(), command: z.unknown() })) })), summary: z.object({ error: z.number(), warning: z.number(), info: z.number() }) }), 'Diagnósticos'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'viewer');
    const diagnostics = await docs.validate(id);
    const summary = { error: 0, warning: 0, info: 0 };
    for (const d of diagnostics) summary[d.severity]++;
    return c.json({ diagnostics, summary }, 200);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/views/{viewId}/svg', tags: ['contenido'], summary: 'Render SVG de una vista (viewer+)', security: bearer,
    request: { params: Id.extend({ viewId: z.string().min(1) }), query: z.object({ theme: z.enum(['light', 'dark', 'dual']).optional(), padding: z.coerce.number().min(0).max(500).optional() }) },
    responses: { 200: { description: 'SVG', content: { 'image/svg+xml': { schema: z.string() } } }, ...errors, 501: jsonRes(ErrorOut, 'Render no disponible en esta build') },
  }), async c => {
    const { id, viewId } = c.req.valid('param');
    const { theme, padding } = c.req.valid('query');
    await requireRole(c, id, 'viewer');
    const svg = await docs.renderSvg(id, viewId, { ...(theme ? { theme } : {}), ...(padding !== undefined ? { padding } : {}) });
    if (svg === null) throw fail(404, 'La vista no existe');
    // Se puede incrustar desde otras webs (`<img src=…?token=lnk_…>`): única excepción a CORP same-origin.
    return c.body(svg, 200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-cache', 'cross-origin-resource-policy': 'cross-origin' });
  });

  // ---------------------------------------------------------------- Historial de versiones
  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/snapshots', tags: ['historial'], summary: 'Instantáneas del espacio, la más reciente primero (viewer+)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ snapshots: z.array(SnapshotOut) }), 'Instantáneas'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'viewer');
    return c.json({ snapshots: await Promise.all((await docs.listSnapshots(id)).map(authorOf)) }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/snapshots', tags: ['historial'], summary: 'Guardar una instantánea del estado actual, con etiqueta opcional (editor+)', security: bearer,
    request: { params: Id, body: jsonBody(z.object({ label: z.string().trim().min(1).max(120).optional() })) },
    responses: { 201: jsonRes(SnapshotOut, 'Instantánea creada'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    const { principal } = await requireRole(c, id, 'editor');
    const meta = await docs.createSnapshot(id, principal.kind === 'user' ? principal.user.id : null, c.req.valid('json').label ?? null);
    return c.json(await authorOf(meta), 201);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/snapshots/{sid}', tags: ['historial'], summary: 'Workspace JSON de una instantánea (viewer+)', security: bearer, request: { params: SnapshotParams },
    responses: { 200: jsonRes(WorkspaceSchema, 'Workspace'), ...errors },
  }), async c => {
    const { id, sid } = c.req.valid('param');
    await requireRole(c, id, 'viewer');
    const ws = await docs.getSnapshot(id, sid);
    if (!ws) throw fail(404, 'No existe esa instantánea');
    return c.json(ws, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/snapshots/{sid}/restore', tags: ['historial'], summary: 'Restaurar una instantánea sobre el documento vivo; antes guarda una automática del estado actual (editor+)', security: bearer,
    request: { params: SnapshotParams },
    responses: { 200: jsonRes(z.object({ ok: z.literal(true) }), 'Restaurada'), ...errors },
  }), async c => {
    const { id, sid } = c.req.valid('param');
    const { principal } = await requireRole(c, id, 'editor');
    const ws = await docs.restoreSnapshot(id, sid, principal.kind === 'user' ? principal.user.id : null);
    if (!ws) throw fail(404, 'No existe esa instantánea');
    if (ws.meta.name) await store.updateMeta(id, { name: ws.meta.name });
    return c.json({ ok: true as const }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/snapshots/{sid}', tags: ['historial'], summary: 'Borrar una instantánea (owner)', security: bearer, request: { params: SnapshotParams },
    responses: { 204: { description: 'Borrada' }, ...errors },
  }), async c => {
    const { id, sid } = c.req.valid('param');
    await requireRole(c, id, 'owner');
    if (!(await docs.deleteSnapshot(id, sid))) throw fail(404, 'No existe esa instantánea');
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------- OpenAPI
  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', { type: 'http', scheme: 'bearer', description: 'Sesión (`ads_…`), API key (`adk_…`) o enlace compartido (`lnk_…`)' });
  app.openAPIRegistry.registerComponent('securitySchemes', 'cookieAuth', { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE });
  app.doc31('/api/openapi.json', c => ({
    openapi: '3.1.0',
    info: { title: 'all-draw API', version: '0.1.0', description: 'Espacios de modelado colaborativos: autenticación, permisos, comandos y sincronización Yjs (`/ws/<workspaceId>?token=`).' },
    servers: [{ url: baseUrl(c) }],
  }));

  return app;
}
