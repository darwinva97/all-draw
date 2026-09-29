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
import { HTTPException } from 'hono/http-exception';
import { setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { CommandSchema, Workspace as WorkspaceSchema, type Command, type NotationPack, type Workspace } from '@all-draw/core';
import type { DocHost } from './host';
import { ALL_PACKS, describePacks } from './notations';
import { CommandError, normalizeCommand } from './ops';
import {
  APIKEY_PREFIX, CSRF_HEADER, CSRF_VALUE, LEGACY_EMAIL, LINK_PREFIX, RateLimiter, SAFE_ID, SESSION_COOKIE, SESSION_MS, SESSION_PREFIX,
  credentialsFromRequest, hashPassword, isTrustedOrigin, needsRehash, randomToken, resolveToken, roleFor, safeEqualString, sessionNeedsRenewal, verifyPassword,
  type Hasher, type Principal,
} from './auth';
import { atLeast, type Role, type SnapshotMeta, type User, type WorkspaceStore } from './store/types';

/** Tamaños máximos de cuerpo: 5 MB para Workspace JSON completos, 1 MB para el resto (comandos incluidos). */
export const MAX_BODY_SNAPSHOT = 5 * 1024 * 1024;
export const MAX_BODY_DEFAULT = 1024 * 1024;

/** Lo que la API necesita saber del despliegue (subconjunto de la `Config` de cada runtime). */
export interface ApiConfig {
  allowRegistration: boolean;
  /** Fuerza `Secure` en la cookie aunque la petición llegue por http (detrás de un proxy sin `x-forwarded-proto`). */
  cookieSecure: boolean;
  /** URL pública (para construir enlaces compartidos); si falta se deduce de la petición. */
  publicUrl: string | null;
  /** Si está, el registro exige este código (`inviteCode` en el cuerpo); `GET /api/auth/config` lo anuncia como `invite`. */
  inviteCode?: string | null;
}
export interface ApiDeps {
  store: WorkspaceStore;
  docs: DocHost;
  hash: Hasher;
  config: ApiConfig;
  /** Packs anunciados en `GET /api/notations` (por defecto todos los del monorepo). */
  notations?: NotationPack[];
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

const fail = (status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 501, error: string, extra: Record<string, unknown> = {}) =>
  new HTTPException(status, { res: Response.json({ error, ...extra }, { status }) });

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, isAdmin: u.isAdmin, createdAt: u.createdAt });

export function createApi({ store, docs, hash, config, notations = ALL_PACKS }: ApiDeps) {
  const app = new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: 'validación', issues: result.error.issues }, 400);
    },
  });
  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const registerLimiter = new RateLimiter(10, 60 * 60_000);
  const passwordLimiter = new RateLimiter(10, 15 * 60_000);
  const linkLimiter = new RateLimiter(30, 15 * 60_000);
  const auth = { store, hash };
  const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    if (err instanceof CommandError) return c.json({ error: err.message, ...(err.issues ? { issues: err.issues } : {}) }, err.status);
    console.error(err);
    return c.json({ error: 'error interno' }, 500);
  });
  app.notFound(c => c.json({ error: 'ruta desconocida' }, 404));

  // Tamaño máximo del cuerpo (413) antes de leer nada.
  app.use('/api/*', async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next();
    const p = c.req.path;
    const big = p === '/api/workspaces' || /\/snapshot$/.test(p) || /\/snapshots\/[^/]+\/restore$/.test(p);
    return bodyLimit({ maxSize: big ? MAX_BODY_SNAPSHOT : MAX_BODY_DEFAULT, onError: () => { throw fail(413, 'Cuerpo demasiado grande'); } })(c, next);
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

  // ---------------------------------------------------------------- Salud y catálogo
  app.openapi(createRoute({ method: 'get', path: '/healthz', tags: ['sistema'], responses: { 200: { description: 'ok', content: { 'text/plain': { schema: z.string() } } } } }),
    c => c.text('ok'));

  app.openapi(createRoute({
    method: 'get', path: '/api/notations', tags: ['catálogo'], summary: 'Packs de notación con sus tipos de elemento, relación y puerto (ids a usar en los comandos)',
    responses: { 200: jsonRes(z.object({ packs: z.array(z.record(z.string(), z.unknown())) }), 'Packs') },
  }), c => c.json({ packs: describePacks(notations) as Record<string, unknown>[] }, 200));

  // ---------------------------------------------------------------- Auth
  app.openapi(createRoute({
    method: 'get', path: '/api/auth/config', tags: ['auth'], summary: 'Qué necesita el registro: abierto, con código de invitación o cerrado',
    responses: { 200: jsonRes(z.object({ registration: z.enum(['open', 'invite', 'closed']), passwordMinLength: z.number() }), 'Configuración pública') },
  }), async c => c.json({ registration: await registrationState(), passwordMinLength: 8 }, 200));

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/register', tags: ['auth'], summary: 'Crear cuenta (el primer usuario es admin)',
    request: { body: jsonBody(z.object({ email: Email, name: z.string().trim().min(1).max(120), password: Password, inviteCode: z.string().max(200).optional() })) },
    responses: { 201: jsonRes(AuthOut, 'Cuenta creada y sesión iniciada'), 400: errors[400], 403: errors[403], 409: jsonRes(ErrorOut, 'Email ya registrado'), 429: jsonRes(ErrorOut, 'Demasiados registros') },
  }), async c => {
    const body = c.req.valid('json');
    if (!registerLimiter.check(`ip:${clientIp(c)}`)) throw fail(429, 'Demasiados registros desde esta dirección; espera un rato');
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
    method: 'get', path: '/api/auth/me', tags: ['auth'], summary: 'Quién soy', security: bearer,
    responses: { 200: jsonRes(z.object({ user: UserOut, via: z.enum(['session', 'apikey']) }), 'Usuario'), 401: errors[401], 403: errors[403] },
  }), c => { const p = requireUser(c); return c.json({ user: publicUser(p.user), via: p.via }, 200); });

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
    responses: { 201: jsonRes(WorkspaceOut, 'Creado'), 400: errors[400], 401: errors[401] },
  }), async c => {
    const p = requireUser(c);
    const body = c.req.valid('json');
    let initial: Workspace | null = null;
    if (body.initial !== undefined) {
      const r = WorkspaceSchema.safeParse(body.initial);
      if (!r.success) throw fail(400, 'initial no es un Workspace válido', { issues: r.error.issues });
      initial = r.data;
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
    const row = await store.updateMeta(id, body);
    if (body.name !== undefined) await docs.setMeta(id, { name: body.name });
    return c.json({ ...row!, role }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}', tags: ['espacios'], summary: 'Borrar espacio (owner)', security: bearer, request: { params: Id },
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
    method: 'put', path: '/api/workspaces/{id}/members/{userId}', tags: ['permisos'], summary: 'Dar o cambiar rol a un usuario (owner)', security: bearer,
    request: { params: Id.extend({ userId: z.string().min(1) }), body: jsonBody(z.object({ role: MemberRoleSchema })) },
    responses: { 200: jsonRes(MemberOut, 'Rol fijado'), ...errors },
  }), async c => {
    const { id, userId } = c.req.valid('param'); const { role } = c.req.valid('json');
    const { ws } = await requireRole(c, id, 'owner');
    if (userId === ws.ownerId) throw fail(400, 'El dueño no necesita rol');
    const u = await store.getUser(userId);
    if (!u) throw fail(404, 'Usuario desconocido');
    await store.setRole(id, userId, role);
    const m = (await store.listMembers(id)).find(x => x.userId === userId)!;
    const { workspaceId: _w, ...out } = m;
    return c.json(out, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/members/{userId}', tags: ['permisos'], summary: 'Quitar a un usuario (owner)', security: bearer,
    request: { params: Id.extend({ userId: z.string().min(1) }) },
    responses: { 204: { description: 'Quitado' }, ...errors },
  }), async c => {
    const { id, userId } = c.req.valid('param');
    await requireRole(c, id, 'owner');
    await store.setRole(id, userId, null);
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
    method: 'delete', path: '/api/workspaces/{id}/links/{token}', tags: ['permisos'], summary: 'Revocar enlace (owner)', security: bearer,
    request: { params: Id.extend({ token: z.string().min(1) }) },
    responses: { 204: { description: 'Revocado' }, ...errors },
  }), async c => {
    const { id, token } = c.req.valid('param');
    await requireRole(c, id, 'owner');
    if (!(await store.deleteShareLink(id, token))) throw fail(404, 'No existe ese enlace');
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
    responses: { 200: jsonRes(z.object({ ok: z.literal(true) }), 'Reemplazado'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireRole(c, id, 'editor');
    const ws = c.req.valid('json') as Workspace;
    await docs.replace(id, ws);
    if (ws.meta.name) await store.updateMeta(id, { name: ws.meta.name });
    return c.json({ ok: true as const }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/commands', tags: ['contenido'], summary: 'Aplicar comandos sobre el documento vivo (editor+); los clientes conectados lo ven al instante',
    security: bearer,
    request: { params: Id, body: jsonBody(z.object({ commands: z.array(CommandSchema).min(1).max(5000), label: z.string().optional() })) },
    responses: { 200: jsonRes(z.object({ applied: z.number(), inverse: z.unknown().describe('Comando inverso (deshacer)') }), 'Aplicados'), ...errors, 422: jsonRes(ErrorOut, 'Un comando no se pudo aplicar (nada se aplicó)') },
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
    return c.body(svg, 200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-cache' });
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
