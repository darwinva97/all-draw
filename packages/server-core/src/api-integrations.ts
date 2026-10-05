/**
 * Rutas de integraciones (las registra `createApi`):
 *
 *   GET    /api/workspaces/{id}/webhooks             webhooks del espacio con sus últimas entregas (dueño)
 *   POST   /api/workspaces/{id}/webhooks             registrar uno (máx. 10; el secreto de la firma sólo se devuelve aquí)
 *   DELETE /api/workspaces/{id}/webhooks/{hid}       borrarlo
 *   POST   /api/workspaces/{id}/webhooks/{hid}/test  enviar un `ping` ahora y ver la respuesta
 *   GET    /api/workspaces/{id}/embeds               enlaces de inserción (dueño)
 *   POST   /api/workspaces/{id}/embeds               crear uno para una vista (`emb_…`)
 *   DELETE /api/workspaces/{id}/embeds/{token}       revocarlo
 *   GET    /api/oembed?url=…&format=json             oEmbed de una URL `/embed/…` (público; el token va dentro de la URL)
 *
 * Ver `webhooks.ts`, `embed.ts` y `docs/07-seguridad.md`.
 */
import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';
import type { HTTPException } from 'hono/http-exception';
import { EMBED_PREFIX, RateLimiter, SAFE_ID, randomToken, type Principal } from './auth';
import { embedUrls, oembedFor } from './embed';
import type { DocHost } from './host';
import type { Logger } from './log';
import { mailLang } from './mail-templates';
import { MAX_WEBHOOKS_PER_WORKSPACE, WEBHOOK_EVENTS, WEBHOOK_FORMATS, type Role, type ShareLink, type WorkspaceRow, type WorkspaceStore } from './store/types';
import { WebhookUrlError, newWebhookSecret, publicWebhook, resolveWebhookFormat, type WebhookService } from './webhooks';

type FailStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 500 | 501 | 503;
type Getter = { get(k: 'principal'): Principal | null; req: { raw: Request; url: string } };
type HeaderCtx = { req: { header(n: string): string | undefined } };

export interface IntegrationRoutesCtx {
  store: WorkspaceStore;
  docs: DocHost;
  logger: Logger;
  webhooks: WebhookService | null;
  publicUrl: string | null;
  standby: boolean;
  fail: (status: FailStatus, error: string, extra?: Record<string, unknown>) => HTTPException;
  requireRole: (c: Getter, workspaceId: string, min: Role) => Promise<{ ws: WorkspaceRow; role: Role; principal: Principal }>;
  baseUrl: (c: HeaderCtx) => string;
  schemas: { ErrorOut: z.ZodTypeAny };
}

export function registerIntegrationRoutes(app: OpenAPIHono<{ Variables: { principal: Principal | null } }>, x: IntegrationRoutesCtx) {
  const { store, docs, logger, webhooks, fail, requireRole, schemas } = x;
  const bearer: Record<string, string[]>[] = [{ bearerAuth: [] }, { cookieAuth: [] }];
  const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ required: true, content: { 'application/json': { schema } } });
  const jsonRes = <T extends z.ZodTypeAny>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
  const err = (d: string) => jsonRes(schemas.ErrorOut, d);
  const errors = { 400: err('Petición inválida'), 401: err('Sin identificar'), 403: err('Sin permiso'), 404: err('No existe') };
  const SafeId = z.string().regex(SAFE_ID, 'id no válido');
  const Id = z.object({ id: SafeId });
  const testLimiter = new RateLimiter(20, 10 * 60_000);
  const embedLimiter = new RateLimiter(30, 15 * 60_000);
  /** Gestionar webhooks e inserciones: dueño del espacio y con cuenta (no con un enlace). */
  const requireOwner = async (c: Getter, id: string) => {
    const r = await requireRole(c, id, 'owner');
    if (r.principal.kind !== 'user') throw fail(403, 'Esta operación requiere una cuenta, no un enlace compartido');
    return r as typeof r & { principal: Extract<Principal, { kind: 'user' }> };
  };
  const base = (c: HeaderCtx) => (x.publicUrl ?? x.baseUrl(c)).replace(/\/+$/, '');

  // ---------------------------------------------------------------- Webhooks
  const DeliveryOut = z.object({
    id: z.string(), event: z.string(), at: z.string(), status: z.number().describe('Estado HTTP del último intento (0 = sin respuesta)'), ok: z.boolean(),
    ms: z.number().describe('Latencia del último intento'), attempts: z.number(), pending: z.boolean().describe('Quedan reintentos programados'), error: z.string().nullable(),
  }).meta({ id: 'WebhookDelivery' });
  const WebhookOut = z.object({
    id: z.string(), workspaceId: z.string(), url: z.string(), events: z.array(z.enum(WEBHOOK_EVENTS)), format: z.enum(WEBHOOK_FORMATS), lang: z.enum(['es', 'en']),
    createdBy: z.string(), createdAt: z.string(), secretPrefix: z.string().describe('Principio del secreto, para reconocerlo'), deliveries: z.array(DeliveryOut).describe('Últimas 20, la más reciente primero'),
  }).meta({ id: 'Webhook' });
  const HookParams = Id.extend({ hid: SafeId });
  const requireService = () => {
    if (!webhooks) throw fail(501, 'Los webhooks no están disponibles en esta instalación', { code: 'webhooks_unavailable' });
    return webhooks;
  };

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/webhooks', tags: ['integraciones'], summary: 'Webhooks del espacio con sus últimas entregas (dueño)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ webhooks: z.array(WebhookOut), events: z.array(z.string()), max: z.number(), enabled: z.boolean().describe('`false` si esta instalación no envía webhooks (copia de respaldo)') }), 'Webhooks'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireOwner(c, id);
    c.header('cache-control', 'no-store');
    return c.json({ webhooks: (await store.listWebhooks(id)).map(publicWebhook), events: [...WEBHOOK_EVENTS], max: MAX_WEBHOOKS_PER_WORKSPACE, enabled: !!webhooks && !x.standby }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/webhooks', tags: ['integraciones'],
    summary: 'Registrar un webhook (dueño; máx. 10). Sólo `https:` a direcciones públicas. El secreto de la firma `X-AllDraw-Signature` sólo se devuelve aquí',
    security: bearer,
    request: { params: Id, body: jsonBody(z.object({
      url: z.string().trim().min(1).max(2000),
      events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
      format: z.enum(['auto', ...WEBHOOK_FORMATS] as const).optional().describe('`auto` (por defecto): Slack, Teams o Discord según la URL; si no, `json`'),
      lang: z.enum(['es', 'en']).optional().describe('Idioma de los mensajes (por defecto, el de tu cuenta)'),
    })) },
    responses: { 201: jsonRes(z.object({ webhook: WebhookOut, secret: z.string() }), 'Creado'), ...errors, 409: err('Máximo de webhooks (`code: webhooks_limit`)'), 501: err('Sin webhooks en esta instalación') },
  }), async c => {
    const id = c.req.valid('param').id;
    const { principal } = await requireOwner(c, id);
    const svc = requireService();
    const body = c.req.valid('json');
    if ((await store.listWebhooks(id)).length >= MAX_WEBHOOKS_PER_WORKSPACE) throw fail(409, `Un espacio puede tener como mucho ${MAX_WEBHOOKS_PER_WORKSPACE} webhooks: borra alguno antes`, { code: 'webhooks_limit', limit: MAX_WEBHOOKS_PER_WORKSPACE });
    let url: URL;
    try { url = await svc.checkUrl(body.url); } catch (e) {
      if (e instanceof WebhookUrlError) throw fail(400, e.message, { code: e.code, fields: ['url'] });
      throw e;
    }
    const secret = newWebhookSecret();
    const hook = await store.createWebhook({
      workspaceId: id, url: url.toString(), events: [...new Set(body.events)], format: resolveWebhookFormat(body.format, url.toString()),
      // Los mensajes de webhook existen en español e inglés: una cuenta en portugués o francés los recibe en inglés.
      lang: body.lang ?? (mailLang(principal.user.locale) === 'es' ? 'es' : 'en'), secret, createdBy: principal.user.id,
    });
    logger.info('webhook creado', { workspace: id, webhook: hook.id, host: url.host, events: hook.events.join(','), format: hook.format });
    await svc.invalidate?.(id).catch(e => logger.error('webhook: no se pudo avisar del alta', { workspace: id, err: e }));
    return c.json({ webhook: publicWebhook(hook), secret }, 201);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/webhooks/{hid}', tags: ['integraciones'], summary: 'Borrar un webhook (dueño)', security: bearer, request: { params: HookParams },
    responses: { 204: { description: 'Borrado' }, ...errors },
  }), async c => {
    const { id, hid } = c.req.valid('param');
    await requireOwner(c, id);
    if (!(await store.deleteWebhook(id, hid))) throw fail(404, 'No existe ese webhook', { code: 'webhook_not_found' });
    await webhooks?.invalidate?.(id).catch(e => logger.error('webhook: no se pudo avisar de la baja', { workspace: id, err: e }));
    logger.info('webhook borrado', { workspace: id, webhook: hid });
    return c.body(null, 204);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/webhooks/{hid}/test', tags: ['integraciones'], summary: 'Probar un webhook: envía un evento `ping` ahora (un intento, sin reintentos) y devuelve cómo fue (dueño)',
    security: bearer, request: { params: HookParams },
    responses: { 200: jsonRes(z.object({ delivery: DeliveryOut }), 'Resultado del envío'), ...errors, 429: err('Demasiadas pruebas'), 501: err('Sin webhooks en esta instalación') },
  }), async c => {
    const { id, hid } = c.req.valid('param');
    await requireOwner(c, id);
    const svc = requireService();
    const hook = await store.getWebhook(id, hid);
    if (!hook) throw fail(404, 'No existe ese webhook', { code: 'webhook_not_found' });
    if (!testLimiter.check(`hook:${hid}`)) throw fail(429, 'Demasiadas pruebas; espera unos minutos', { code: 'too_many_attempts' });
    return c.json({ delivery: await svc.test(hook, x.baseUrl(c)) }, 200);
  });

  // ---------------------------------------------------------------- Inserción
  const EmbedOut = z.object({
    token: z.string(), viewId: z.string(), createdAt: z.string(), expiresAt: z.string().nullable(),
    url: z.string().describe('Página HTML para `<iframe>` (añade `&theme=light|dark`)'), svgUrl: z.string().describe('Sólo el SVG, para `<img>` o Markdown'),
  }).meta({ id: 'Embed' });
  const embedOut = (c: HeaderCtx, l: ShareLink) => ({ token: l.token, viewId: l.viewId!, createdAt: l.createdAt, expiresAt: l.expiresAt, ...embedUrls(base(c), l.workspaceId, l.viewId!, l.token) });

  app.openapi(createRoute({
    method: 'get', path: '/api/workspaces/{id}/embeds', tags: ['integraciones'], summary: 'Enlaces de inserción del espacio (dueño)', security: bearer, request: { params: Id },
    responses: { 200: jsonRes(z.object({ embeds: z.array(EmbedOut) }), 'Enlaces de inserción'), ...errors },
  }), async c => {
    const id = c.req.valid('param').id;
    await requireOwner(c, id);
    c.header('cache-control', 'no-store');
    return c.json({ embeds: (await store.listShareLinks(id)).filter(l => !!l.viewId).map(l => embedOut(c, l)) }, 200);
  });

  app.openapi(createRoute({
    method: 'post', path: '/api/workspaces/{id}/embeds', tags: ['integraciones'],
    summary: 'Crear un enlace de inserción para una vista (dueño): de lectura, sólo para esa vista y sólo para `/embed/…` (no vale para la API ni para abrir el espacio)',
    security: bearer,
    request: { params: Id, body: jsonBody(z.object({ viewId: SafeId, expiresAt: z.string().datetime().optional() })) },
    responses: { 201: jsonRes(EmbedOut, 'Enlace de inserción'), ...errors, 429: err('Demasiados enlaces') },
  }), async c => {
    const id = c.req.valid('param').id;
    const { principal } = await requireOwner(c, id);
    const { viewId, expiresAt } = c.req.valid('json');
    if (expiresAt !== undefined && Date.parse(expiresAt) <= Date.now()) throw fail(400, 'La fecha de caducidad ya ha pasado: elige una futura', { code: 'link_expires_past', fields: ['expiresAt'] });
    if (!embedLimiter.check(`user:${principal.user.id}`)) throw fail(429, 'Demasiados enlaces creados; espera unos minutos');
    if ((await docs.renderSvg(id, viewId, {})) === null) throw fail(404, 'La vista no existe');
    const link = await store.createShareLink({ workspaceId: id, role: 'viewer', createdBy: principal.user.id, token: randomToken(EMBED_PREFIX), expiresAt: expiresAt ?? null, viewId });
    return c.json(embedOut(c, link), 201);
  });

  app.openapi(createRoute({
    method: 'delete', path: '/api/workspaces/{id}/embeds/{token}', tags: ['integraciones'], summary: 'Revocar un enlace de inserción (dueño): las páginas que lo incrustan dejan de verlo en el siguiente sondeo', security: bearer,
    request: { params: Id.extend({ token: z.string().min(1).max(200) }) },
    responses: { 204: { description: 'Revocado' }, ...errors },
  }), async c => {
    const { id, token } = c.req.valid('param');
    await requireOwner(c, id);
    const link = (await store.listShareLinks(id)).find(l => l.token === token && !!l.viewId);
    if (!link || !(await store.deleteShareLink(id, token))) throw fail(404, 'No existe ese enlace');
    return c.body(null, 204);
  });

  app.openapi(createRoute({
    method: 'get', path: '/api/oembed', tags: ['integraciones'], summary: 'oEmbed (https://oembed.com) de una URL de inserción `/embed/…` de este servidor: `type: rich` con un `<iframe>`',
    request: { query: z.object({
      url: z.string().min(1).max(4000), format: z.string().optional().describe('Sólo `json`'),
      maxwidth: z.coerce.number().int().positive().optional(), maxheight: z.coerce.number().int().positive().optional(),
    }) },
    responses: { 200: jsonRes(z.record(z.string(), z.unknown()), 'oEmbed'), 404: err('No es una URL de inserción válida'), 501: err('Formato no soportado') },
  }), async c => {
    const q = c.req.valid('query');
    c.header('access-control-allow-origin', '*');
    c.header('cache-control', 'private, max-age=300');
    if (q.format && q.format !== 'json') throw fail(501, 'Sólo se sirve oEmbed en JSON', { code: 'oembed_format' });
    const out = await oembedFor({ store, docs, publicUrl: x.publicUrl }, q.url, base(c), { ...(q.maxwidth ? { width: q.maxwidth } : {}), ...(q.maxheight ? { height: q.maxheight } : {}) });
    if (!out) throw fail(404, 'No es un enlace de inserción válido de este servidor', { code: 'oembed_not_found' });
    return c.json(out, 200);
  });
}
