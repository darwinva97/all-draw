/**
 * Worker de Cloudflare: la misma API Hono de `@all-draw/server-core`, con el registro (cuentas, espacios,
 * permisos) en el Durable Object `RegistryDO` (o en D1 si existe el binding `DB`), el contenido de cada
 * espacio en su Durable Object (`WorkspaceDO`) y la app web servida por Assets.
 *
 *   /api/admin/import  → importación desde otra instalación (sólo worker, ver admin-import.ts)
 *   /.well-known/security.txt → contacto de seguridad (RFC 9116)
 *   /api/*, /healthz   → createApi (store RegistryDO o D1, docs → WorkspaceDO)
 *   /ws/<id>?token=    → autoriza aquí y reenvía el upgrade al DO con el rol y la identidad (usuario o enlace) en cabeceras
 *   /embed/<id>/<vista>[.svg] → insertar diagramas en otras webs (`handleEmbed`; las únicas rutas que se dejan incrustar)
 *
 * El MCP remoto (`POST /mcp`) sólo existe en el servidor Node: ver `docs/manual/agentes-y-api.md`.
 *   resto              → ASSETS (fallback SPA)
 *
 * Antes de la API, el rate limit de Workers (`ratelimit.ts`, bindings opcionales). Con `STANDBY="true"` el worker es la
 * copia de respaldo de solo lectura del VPS: la API rechaza las escrituras (`config.standby` de server-core) y los
 * WebSocket entran como `viewer`.
 */
import {
  SAFE_ID, SECURITY_TXT_PATH, authorizeConnection, handleEmbed, createApi, credentialsFromRequest, isTrustedOrigin, jsonLogger, makeHasher, parseLogLevel, requestHost,
  securityTxtResponse, withSecurityHeaders, type Hasher,
} from '@all-draw/server-core';
import { IMPORT_PATH, handleImport } from './admin-import';
import { RESET_PATH, handleReset } from './admin-reset';
import { EXPIRES_HEADER, KEY_HEADER, LINK_HEADER, ROLE_HEADER, SESSION_HEADER, USER_HEADER, WORKSPACE_HEADER, WorkspaceDO } from './do';
import { envInt, type Env } from './env';
import { workerMailer, workerNotifier } from './mail-env';
import { workerWebhooks } from './webhooks-env';
import { checkRateLimit } from './ratelimit';
import { RegistryDO } from './registry';
import { RemoteDocHost } from './remote-host';
import { D1WorkspaceStore } from './store/d1';
import { registryStore, REGISTRY_NAME, type RegistryStub, type RegistryWorkspaceStore } from './store/do-sql';

export { RegistryDO, WorkspaceDO };

/** Copia de respaldo de solo lectura (`STANDBY="true"` en `wrangler.toml`). */
export const isStandby = (env: Env) => env.STANDBY === 'true';

interface Runtime { api: ReturnType<typeof createApi>; store: RegistryWorkspaceStore; hash: Hasher; docs: RemoteDocHost }
let runtime: Runtime | null = null;
const optional = <K extends string>(k: K, v: number | undefined) => (v === undefined ? {} : { [k]: v }) as Partial<Record<K, number>>;
/** Se construye una vez por isolate (los bindings son estables). */
function boot(env: Env): Runtime {
  if (runtime) return runtime;
  // D1 es opcional: sin el binding `DB`, el registro vive en el SQLite del `RegistryDO`.
  const store: RegistryWorkspaceStore = env.DB ? new D1WorkspaceStore(env.DB) : registryStore(env.REGISTRY, () => env.REGISTRY.get(env.REGISTRY.idFromName(env.REGISTRY_NAME || REGISTRY_NAME)) as unknown as RegistryStub);
  const hash = makeHasher(env.SESSION_SECRET || null);
  const docs = new RemoteDocHost(env.WORKSPACES);
  const logger = jsonLogger({ level: parseLogLevel(env.LOG_LEVEL) });
  // Correo apagado por defecto (`MAIL_PROVIDER` = none); sólo `log` o `http` en Workers (`mail-env.ts`).
  const mailer = workerMailer(env, logger);
  const api = createApi({
    store, hash, docs, mailer, notifier: workerNotifier(env, store),
    // Webhooks: los eventos se envían desde el DO del espacio (`webhooks-env.ts`); nada en la copia de respaldo.
    webhooks: workerWebhooks(env, store, docs),
    config: {
      allowRegistration: env.ALLOW_REGISTRATION !== 'false', cookieSecure: true, publicUrl: env.PUBLIC_URL || null, inviteCode: env.INVITE_CODE || null,
      ...optional('maxWorkspacesPerUser', envInt(env.MAX_WORKSPACES_PER_USER)), ...optional('maxDocBytes', envInt(env.MAX_DOC_BYTES)), ...optional('registerMinMs', envInt(env.REGISTER_MIN_MS)),
      ...(isStandby(env) ? { standby: true, primaryUrl: env.PRIMARY_URL || null } : {}),
      requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION === 'true',
    },
    // Una línea JSON por evento en `console`: Workers Observability la indexa (`[observability] enabled`).
    logger,
    // En Cloudflare la IP del cliente la pone el propio borde (`CF-Connecting-IP`); el cliente no puede falsearla.
    clientIp: c => c.req.header('cf-connecting-ip') ?? 'unknown',
    build: { version: env.ALLDRAW_VERSION || '0.1.0', commit: env.ALLDRAW_COMMIT || null, runtime: 'cloudflare', db: env.DB ? 'd1' : 'durable-object' },
  });
  return (runtime = { api, store, hash, docs });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const rt = boot(env);

    if (url.pathname.startsWith('/ws/')) {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('se esperaba un WebSocket', { status: 426 });
      const id = url.pathname.slice(4);
      if (!SAFE_ID.test(id)) return new Response('id no válido', { status: 400 });
      const cred = credentialsFromRequest(request.headers, url);
      // Con cookie, sólo desde el propio origen (el navegador manda la cookie desde cualquier web).
      const auth = cred.source === 'cookie' && request.headers.get('origin') && !isTrustedOrigin(request.headers, url)
        ? { close: 4403, reason: 'origen no permitido' }
        : await authorizeConnection({ store: rt.store, hash: rt.hash }, cred.token, id);
      // Sin permiso: aceptamos y cerramos con el mismo código que el servidor Node (4401/4404).
      if ('close' in auth) {
        const pair = new WebSocketPair();
        pair[1].accept();
        pair[1].close(auth.close, auth.reason);
        return new Response(null, { status: 101, webSocket: pair[0] });
      }
      const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(id));
      const headers = new Headers(request.headers);
      // En la copia de respaldo nadie escribe: todos entran como `viewer` (el DO no aplica sus cambios).
      headers.set(ROLE_HEADER, isStandby(env) ? 'viewer' : auth.role);
      // Identidad para poder cerrar la conexión al revocar el acceso; las que mande el cliente se descartan.
      for (const h of [USER_HEADER, LINK_HEADER, SESSION_HEADER, KEY_HEADER, EXPIRES_HEADER, WORKSPACE_HEADER]) headers.delete(h);
      // El DO sabe así qué espacio es (menciones) y cuándo caduca el enlace (lo corta con `alarm()`).
      headers.set(WORKSPACE_HEADER, id);
      if (auth.expiresAt) headers.set(EXPIRES_HEADER, auth.expiresAt);
      if (auth.identity.userId) {
        headers.set(USER_HEADER, auth.identity.userId);
        if (auth.identity.sessionId) headers.set(SESSION_HEADER, auth.identity.sessionId);
        else if (auth.identity.keyId) headers.set(KEY_HEADER, auth.identity.keyId);
      } else if (auth.identity.linkToken) headers.set(LINK_HEADER, auth.identity.linkToken);
      return stub.fetch(new Request('https://do/ws', { headers }));
    }

    const sec = { https: url.protocol === 'https:', host: requestHost(request.headers, url) };
    const limited = await checkRateLimit(request, url.pathname, env);
    if (limited) return withSecurityHeaders(limited, sec);
    if (url.pathname === SECURITY_TXT_PATH) return withSecurityHeaders(securityTxtResponse(env.PUBLIC_URL || url.origin), sec);
    if (url.pathname === RESET_PATH) return withSecurityHeaders(await handleReset(request, rt.store, env.RESET_CODE || null), sec);
    if (url.pathname === IMPORT_PATH) return withSecurityHeaders(await handleImport(request, { store: rt.store, hash: rt.hash, docs: rt.docs, importSecret: env.IMPORT_SECRET || null, standby: isStandby(env) }), sec);
    if (url.pathname.startsWith('/embed/')) {
      const res = await handleEmbed(request, { store: rt.store, docs: rt.docs, publicUrl: env.PUBLIC_URL || null, ...(isStandby(env) ? { standby: true } : {}) });
      if (res) return withSecurityHeaders(res, { ...sec, embed: true });
    }
    if (url.pathname === '/healthz' || url.pathname === '/api' || url.pathname.startsWith('/api/')) return withSecurityHeaders(await rt.api.fetch(request, env, ctx), sec);
    return withSecurityHeaders(await env.ASSETS.fetch(request), sec);
  },
} satisfies ExportedHandler<Env>;
