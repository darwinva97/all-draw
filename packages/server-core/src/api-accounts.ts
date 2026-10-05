/**
 * Rutas de cuenta que dependen del correo o lo complementan (las registra `createApi`):
 *
 *   POST   /api/auth/forgot             pedir un enlace para restablecer la contraseña (respuesta idéntica exista o no la cuenta)
 *   POST   /api/auth/reset              elegir contraseña nueva con el enlace (un solo uso, 1 h); cierra sesiones y conexiones
 *   POST   /api/auth/verify             verificar el correo (o confirmar el cambio de correo) con el enlace (un solo uso, 24 h)
 *   POST   /api/auth/verify/resend      volver a mandar el enlace de verificación
 *   GET    /api/auth/sessions           sesiones activas (dispositivo resumido, IP truncada, creada, último uso, la actual)
 *   DELETE /api/auth/sessions/{id}      cerrar una sesión (corta sus WebSockets con 4402)
 *   GET    /api/notifications           notificaciones (las más recientes) y cuántas sin leer
 *   POST   /api/notifications/read      marcarlas como leídas
 *
 * Los tokens de correo son aleatorios (`rst_…`, `vfy_…`, 32 caracteres) y en la BD sólo va su hash (el mismo `Hasher`
 * que las sesiones: HMAC con `SESSION_SECRET` si está). Ver `docs/07-seguridad.md`.
 */
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { deleteCookie } from 'hono/cookie';
import type { HTTPException } from 'hono/http-exception';
import { LEGACY_EMAIL, RateLimiter, SESSION_COOKIE, hashPassword, randomToken, type Hasher, type Principal } from './auth';
import { sessionIdOf } from './docs';
import { parseDevice } from './devices';
import type { Logger } from './log';
import type { Mailer } from './mail';
import { emailChangeNoticeEmail, mailLang, resetPasswordEmail, verifyEmailEmail } from './mail-templates';
import { notificationHref, type Notifier } from './notifications';
import type { User, WorkspaceStore } from './store/types';
import { WS_SESSION_CLOSED } from './ysync';

export const RESET_PREFIX = 'rst_';
export const VERIFY_PREFIX = 'vfy_';
export const RESET_TTL_MS = 60 * 60_000;
export const VERIFY_TTL_MS = 24 * 3_600_000;
/** Tiempo mínimo de respuesta de `POST /api/auth/forgot` (el trabajo real va en segundo plano): no delata si la cuenta existe. */
export const DEFAULT_FORGOT_MIN_MS = 400;

type FailStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501 | 503;
type UserPrincipal = Extract<Principal, { kind: 'user' }>;
type Getter = { get(k: 'principal'): Principal | null };

export interface AccountRoutesCtx {
  store: WorkspaceStore;
  hash: Hasher;
  logger: Logger;
  mailer: Mailer;
  notifier: Notifier;
  forgotMinMs: number;
  fail: (status: FailStatus, error: string, extra?: Record<string, unknown>) => HTTPException;
  requireUser: (c: Getter) => UserPrincipal;
  requireSession: (c: Getter, what: string) => UserPrincipal;
  clientIp: (c: unknown) => string;
  baseUrl: (c: { req: { header(n: string): string | undefined } }) => string;
  publicUser: (u: User) => Record<string, unknown>;
  afterSessionsClosed: (u: User, opts: { revokeKeys: boolean; exceptSessionHash?: string; reason: string }) => Promise<number>;
  kickUser: (u: User, match: { sessionId: string }, code: number, reason: string) => Promise<void>;
  /** Esquemas compartidos con `api.ts`. */
  schemas: { Password: z.ZodTypeAny; Email: z.ZodTypeAny; UserOut: z.ZodTypeAny; ErrorOut: z.ZodTypeAny; SafeId: z.ZodTypeAny };
}

/** Ejecuta una tarea después de responder: `waitUntil` en Workers (si no, se cancelaría), sin más en Node. */
export function background(c: Context, p: Promise<unknown>): void {
  try { c.executionCtx.waitUntil(p); } catch { /* Node: la promesa sigue sola */ }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function registerAccountRoutes(app: OpenAPIHono<{ Variables: { principal: Principal | null } }>, x: AccountRoutesCtx) {
  const { store, hash, logger, mailer, notifier, fail, schemas } = x;
  const bearer: Record<string, string[]>[] = [{ bearerAuth: [] }, { cookieAuth: [] }];
  const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ required: true, content: { 'application/json': { schema } } });
  const jsonRes = <T extends z.ZodTypeAny>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
  const err = (d: string) => jsonRes(schemas.ErrorOut, d);
  const forgotIpLimiter = new RateLimiter(10, 15 * 60_000);
  const forgotEmailLimiter = new RateLimiter(3, 60 * 60_000);
  const tokenLimiter = new RateLimiter(30, 15 * 60_000);
  const resendLimiter = new RateLimiter(5, 60 * 60_000);
  const requireMail = () => { if (!mailer.enabled) throw fail(503, 'Este servidor no tiene correo configurado: pide a un administrador que te restablezca la contraseña', { code: 'email_disabled' }); };
  const badToken = () => fail(400, 'El enlace no es válido, ya se usó o ha caducado: pide otro', { code: 'token_invalid' });
  const link = (c: Parameters<typeof x.baseUrl>[0], route: string, token: string) => `${x.baseUrl(c).replace(/\/+$/, '')}/#/${route}?token=${encodeURIComponent(token)}`;

  /**
   * Manda el enlace de verificación a `email` (el actual o, al cambiarlo, el nuevo). Invalida los enlaces de verificación
   * anteriores. Lanza si el proveedor falla (el llamador decide si importa).
   */
  async function sendVerification(c: Parameters<typeof x.baseUrl>[0], u: User, email: string, change: boolean): Promise<void> {
    if (!mailer.enabled) return;
    const token = randomToken(VERIFY_PREFIX);
    await store.deleteAccountTokens(u.id, 'verify');
    await store.createAccountToken({ tokenHash: await hash(token), userId: u.id, kind: 'verify', email, expiresAt: new Date(Date.now() + VERIFY_TTL_MS).toISOString() });
    const lang = mailLang(u.locale);
    await mailer.send({ to: email, ...verifyEmailEmail({ lang, name: u.name, url: link(c, 'verificar', token), hours: VERIFY_TTL_MS / 3_600_000, change }) });
    if (change) {
      await mailer.send({ to: u.email, ...emailChangeNoticeEmail({ lang, name: u.name, newEmail: email, accountUrl: `${x.baseUrl(c).replace(/\/+$/, '')}/#/keys` }) })
        .catch(e => logger.error('no se pudo avisar al correo anterior', { user: u.id, err: e }));
    }
    logger.info('enlace de verificación enviado', { user: u.id, change });
  }

  // ---------------------------------------------------------------- Restablecer la contraseña por correo
  app.openapi(createRoute({
    method: 'post', path: '/api/auth/forgot', tags: ['auth'],
    summary: 'Pedir por correo un enlace para restablecer la contraseña (1 h, un solo uso). Responde igual exista o no la cuenta. Sólo si `GET /api/auth/config` dice `email: true`',
    request: { body: jsonBody(z.object({ email: schemas.Email })) },
    responses: { 202: jsonRes(z.object({ ok: z.literal(true) }), 'Si hay una cuenta con ese correo, se le ha enviado el enlace'), 400: err('Petición inválida'), 429: err('Demasiadas peticiones'), 503: err('Sin correo en este servidor (`code: email_disabled`)') },
  }), async c => {
    requireMail();
    const t0 = Date.now();
    const { email } = c.req.valid('json') as { email: string };
    // Los límites cuentan igual exista o no la cuenta: un 429 no dice nada de ella.
    if (!forgotIpLimiter.check(`ip:${x.clientIp(c)}`) || !forgotEmailLimiter.check(`email:${email}`)) throw fail(429, 'Demasiados intentos; espera unos minutos', { code: 'too_many_attempts' });
    background(c, (async () => {
      const u = await store.getUserByEmail(email);
      if (!u || u.email === LEGACY_EMAIL) { logger.info('restablecer: correo sin cuenta'); return; }
      const token = randomToken(RESET_PREFIX);
      await store.deleteAccountTokens(u.id, 'reset'); // sólo vale el último enlace
      await store.createAccountToken({ tokenHash: await hash(token), userId: u.id, kind: 'reset', email: u.email, expiresAt: new Date(Date.now() + RESET_TTL_MS).toISOString() });
      await mailer.send({ to: u.email, ...resetPasswordEmail({ lang: mailLang(u.locale), name: u.name, url: link(c, 'restablecer', token), minutes: RESET_TTL_MS / 60_000 }) });
      logger.info('enlace para restablecer enviado', { user: u.id });
    })().catch(e => logger.error('restablecer: no se pudo enviar el correo', { err: e })));
    await sleep(Math.max(0, t0 + x.forgotMinMs - Date.now()));
    c.header('cache-control', 'no-store');
    return c.json({ ok: true as const }, 202);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/reset', tags: ['auth'],
    summary: 'Elegir una contraseña nueva con el enlace del correo. Cierra todas las sesiones y sus WebSockets (4402); con `revokeKeys: true` revoca también las API keys. Deja el correo verificado',
    request: { body: jsonBody(z.object({ token: z.string().min(10).max(200), password: schemas.Password, revokeKeys: z.boolean().optional() })) },
    responses: { 200: jsonRes(z.object({ ok: z.literal(true), email: z.string() }), 'Contraseña cambiada: entra con ella'), 400: err('Enlace no válido o caducado (`code: token_invalid`)'), 429: err('Demasiados intentos') },
  }), async c => {
    if (!tokenLimiter.check(`ip:${x.clientIp(c)}`)) throw fail(429, 'Demasiados intentos; espera unos minutos', { code: 'too_many_attempts' });
    const { token, password, revokeKeys } = c.req.valid('json') as { token: string; password: string; revokeKeys?: boolean };
    if (!token.startsWith(RESET_PREFIX)) throw badToken();
    const tok = await store.consumeAccountToken(await hash(token), 'reset');
    const u = tok ? await store.getUser(tok.userId) : null;
    // Si el correo cambió después de pedir el enlace, el enlace (enviado a la dirección vieja) ya no vale.
    if (!tok || !u || tok.email !== u.email) throw badToken();
    await store.setPasswordHash(u.id, await hashPassword(password));
    await store.deleteAccountTokens(u.id, 'reset');
    await store.deleteUserSessions(u.id);
    if (!u.emailVerifiedAt) await store.updateUser(u.id, { emailVerifiedAt: new Date().toISOString() }); // ha demostrado que lee ese correo
    await x.afterSessionsClosed(u, { revokeKeys: !!revokeKeys, reason: 'contraseña restablecida por correo' });
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true as const, email: u.email }, 200);
  });

  // ---------------------------------------------------------------- Verificar el correo
  app.openapi(createRoute({
    method: 'post', path: '/api/auth/verify', tags: ['auth'],
    summary: 'Verificar el correo con el enlace recibido (al registrarse o al cambiarlo: entonces el correo de la cuenta pasa a ser el nuevo). No hace falta sesión',
    request: { body: jsonBody(z.object({ token: z.string().min(10).max(200) })) },
    responses: { 200: jsonRes(z.object({ user: schemas.UserOut, changed: z.boolean().describe('`true` si el enlace confirmaba un cambio de correo') }), 'Verificado'), 400: err('Enlace no válido o caducado (`code: token_invalid`)'), 409: err('El correo nuevo ya lo usa otra cuenta'), 429: err('Demasiados intentos') },
  }), async c => {
    if (!tokenLimiter.check(`ip:${x.clientIp(c)}`)) throw fail(429, 'Demasiados intentos; espera unos minutos', { code: 'too_many_attempts' });
    const { token } = c.req.valid('json') as { token: string };
    if (!token.startsWith(VERIFY_PREFIX)) throw badToken();
    const tok = await store.consumeAccountToken(await hash(token), 'verify');
    const u = tok ? await store.getUser(tok.userId) : null;
    if (!tok || !u) throw badToken();
    const now = new Date().toISOString();
    if (tok.email === u.email) {
      const user = (await store.updateUser(u.id, { emailVerifiedAt: now })) ?? u;
      logger.info('correo verificado', { user: u.id });
      return c.json({ user: x.publicUser(user), changed: false }, 200);
    }
    const taken = await store.getUserByEmail(tok.email);
    if (taken && taken.id !== u.id) throw fail(409, 'Ese email ya está registrado', { code: 'email_taken' });
    let user: User;
    try { user = (await store.updateUser(u.id, { email: tok.email, emailVerifiedAt: now })) ?? u; }
    catch (e) { if (String(e).includes('email ya registrado')) throw fail(409, 'Ese email ya está registrado', { code: 'email_taken' }); throw e; }
    await store.deleteAccountTokens(u.id, 'reset'); // los enlaces enviados a la dirección vieja ya no sirven
    logger.info('correo cambiado y verificado', { user: u.id });
    return c.json({ user: x.publicUser(user), changed: true }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/auth/verify/resend', tags: ['auth'], security: bearer,
    summary: 'Volver a mandar el enlace de verificación al correo de la cuenta (desde una sesión; 5 por hora)',
    responses: { 202: jsonRes(z.object({ ok: z.literal(true), alreadyVerified: z.boolean() }), 'Enviado (o ya estaba verificado)'), 401: err('Sin identificar'), 403: err('Sin permiso'), 429: err('Demasiados envíos'), 503: err('Sin correo en este servidor') },
  }), async c => {
    const p = x.requireSession(c, 'Pide el enlace');
    if (!mailer.enabled) throw fail(503, 'Este servidor no tiene correo configurado', { code: 'email_disabled' });
    if (p.user.emailVerifiedAt) return c.json({ ok: true as const, alreadyVerified: true }, 202);
    if (!resendLimiter.check(`user:${p.user.id}`)) throw fail(429, 'Demasiados intentos; espera unos minutos', { code: 'too_many_attempts' });
    try { await sendVerification(c, p.user, p.user.email, false); }
    catch (e) { logger.error('no se pudo reenviar la verificación', { user: p.user.id, err: e }); throw fail(503, 'No se pudo enviar el correo; inténtalo más tarde', { code: 'email_failed' }); }
    return c.json({ ok: true as const, alreadyVerified: false }, 202);
  });

  // ---------------------------------------------------------------- Sesiones activas
  const SessionOut = z.object({
    id: z.string().describe('Identificador de la sesión (no es el token)'), current: z.boolean().describe('La de esta petición'),
    device: z.object({ browser: z.string().nullable(), os: z.string().nullable(), type: z.enum(['desktop', 'mobile', 'tablet', 'cli', 'unknown']) }),
    ip: z.string().nullable().describe('IP truncada (sin el último octeto, o el /48 en IPv6)'), createdAt: z.string(), lastUsedAt: z.string().nullable(), expiresAt: z.string(),
  }).meta({ id: 'Session' });
  app.openapi(createRoute({
    method: 'get', path: '/api/auth/sessions', tags: ['auth'], security: bearer,
    summary: 'Mis sesiones activas (desde una sesión): navegador y sistema resumidos, IP truncada, cuándo se abrió y su último uso; `current` marca la de esta petición',
    responses: { 200: jsonRes(z.object({ sessions: z.array(SessionOut) }), 'Sesiones'), 401: err('Sin identificar'), 403: err('Sin permiso') },
  }), async c => {
    const p = x.requireSession(c, 'Consulta las sesiones');
    const rows = await store.listUserSessions(p.user.id);
    c.header('cache-control', 'no-store');
    return c.json({ sessions: rows.map(s => ({ id: sessionIdOf(s.tokenHash), current: s.tokenHash === p.sessionHash, device: parseDevice(s.device), ip: s.ip ?? null, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt ?? null, expiresAt: s.expiresAt })) }, 200);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/auth/sessions/{id}', tags: ['auth'], security: bearer,
    summary: 'Cerrar una de mis sesiones (desde una sesión); sus WebSockets se cierran con 4402. Si es la actual, también se borra la cookie',
    request: { params: z.object({ id: schemas.SafeId }) },
    responses: { 204: { description: 'Cerrada' }, 401: err('Sin identificar'), 403: err('Sin permiso'), 404: err('No existe esa sesión') },
  }), async c => {
    const p = x.requireSession(c, 'Cierra las sesiones');
    const { id } = c.req.valid('param') as { id: string };
    const s = (await store.listUserSessions(p.user.id)).find(r => sessionIdOf(r.tokenHash) === id);
    if (!s) throw fail(404, 'No existe esa sesión', { code: 'session_not_found' });
    await store.deleteSession(s.tokenHash);
    await x.kickUser(p.user, { sessionId: id }, WS_SESSION_CLOSED, 'sesión cerrada');
    if (s.tokenHash === p.sessionHash) deleteCookie(c, SESSION_COOKIE, { path: '/' });
    logger.info('sesión cerrada desde la lista', { user: p.user.id, current: s.tokenHash === p.sessionHash });
    return c.body(null, 204);
  });

  // ---------------------------------------------------------------- Notificaciones
  const NotificationOut = z.object({
    id: z.string(), kind: z.enum(['mention', 'shared', 'role', 'restored']), workspaceId: z.string().nullable(),
    payload: z.record(z.string(), z.unknown()).describe('Según `kind`: `workspaceName`, `actorName`, `role`, `previousRole`, `excerpt`, `commentId`, `threadId`, `viewId`, `snapshotId`…'),
    createdAt: z.string(), readAt: z.string().nullable(), href: z.string().nullable().describe('Ruta de la app web (`#/s/<espacio>[/v/<vista>]`)'),
  }).meta({ id: 'Notification' });
  app.openapi(createRoute({
    method: 'get', path: '/api/notifications', tags: ['notificaciones'], security: bearer,
    summary: 'Mis notificaciones, la más reciente primero (menciones, espacios compartidos conmigo, cambios de rol, instantáneas restauradas en mis espacios) y cuántas hay sin leer',
    request: { query: z.object({ limit: z.coerce.number().int().min(1).max(200).optional() }) },
    responses: { 200: jsonRes(z.object({ notifications: z.array(NotificationOut), unread: z.number() }), 'Notificaciones'), 401: err('Sin identificar'), 403: err('Sin permiso') },
  }), async c => {
    const p = x.requireUser(c);
    const { limit } = c.req.valid('query') as { limit?: number };
    const rows = await store.listNotifications(p.user.id, limit ?? 50);
    c.header('cache-control', 'no-store');
    return c.json({ notifications: rows.map(n => ({ id: n.id, kind: n.kind, workspaceId: n.workspaceId, payload: n.payload, createdAt: n.createdAt, readAt: n.readAt, href: notificationHref(n) })), unread: await store.countUnreadNotifications(p.user.id) }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/notifications/read', tags: ['notificaciones'], security: bearer,
    summary: 'Marcar como leídas las notificaciones `ids` (o todas sin `ids`)',
    request: { body: jsonBody(z.object({ ids: z.array(schemas.SafeId).max(200).optional() })) },
    responses: { 200: jsonRes(z.object({ updated: z.number(), unread: z.number() }), 'Hecho'), 400: err('Petición inválida'), 401: err('Sin identificar'), 403: err('Sin permiso') },
  }), async c => {
    const p = x.requireUser(c);
    const { ids } = c.req.valid('json') as { ids?: string[] };
    const updated = await store.markNotificationsRead(p.user.id, ids);
    return c.json({ updated, unread: await store.countUnreadNotifications(p.user.id) }, 200);
  });

  return { sendVerification, notifier };
}
