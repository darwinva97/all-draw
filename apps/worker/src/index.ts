/**
 * Worker de Cloudflare: la misma API Hono de `@all-draw/server-core`, con el registro (cuentas, espacios,
 * permisos) en el Durable Object `RegistryDO` (o en D1 si existe el binding `DB`), el contenido de cada
 * espacio en su Durable Object (`WorkspaceDO`) y la app web servida por Assets.
 *
 *   /api/admin/import  → importación desde otra instalación (sólo worker, ver admin-import.ts)
 *   /.well-known/security.txt → contacto de seguridad (RFC 9116)
 *   /api/*, /healthz   → createApi (store RegistryDO o D1, docs → WorkspaceDO)
 *   /ws/<id>?token=    → autoriza aquí y reenvía el upgrade al DO con el rol y la identidad (usuario o enlace) en cabeceras
 *   resto              → ASSETS (fallback SPA)
 */
import {
  SAFE_ID, SECURITY_TXT_PATH, authorizeConnection, createApi, credentialsFromRequest, isTrustedOrigin, jsonLogger, makeHasher, parseLogLevel, requestHost,
  securityTxtResponse, withSecurityHeaders, type Hasher,
} from '@all-draw/server-core';
import { IMPORT_PATH, handleImport } from './admin-import';
import { RESET_PATH, handleReset } from './admin-reset';
import { LINK_HEADER, ROLE_HEADER, USER_HEADER, WorkspaceDO } from './do';
import { envInt, type Env } from './env';
import { RegistryDO } from './registry';
import { RemoteDocHost } from './remote-host';
import { D1WorkspaceStore } from './store/d1';
import { registryStore, REGISTRY_NAME, type RegistryStub, type RegistryWorkspaceStore } from './store/do-sql';

export { RegistryDO, WorkspaceDO };

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
  const api = createApi({
    store, hash, docs,
    config: {
      allowRegistration: env.ALLOW_REGISTRATION !== 'false', cookieSecure: true, publicUrl: env.PUBLIC_URL || null, inviteCode: env.INVITE_CODE || null,
      ...optional('maxWorkspacesPerUser', envInt(env.MAX_WORKSPACES_PER_USER)), ...optional('maxDocBytes', envInt(env.MAX_DOC_BYTES)), ...optional('registerMinMs', envInt(env.REGISTER_MIN_MS)),
    },
    // Una línea JSON por evento en `console`: Workers Observability la indexa (`[observability] enabled`).
    logger: jsonLogger({ level: parseLogLevel(env.LOG_LEVEL) }),
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
      headers.set(ROLE_HEADER, auth.role);
      // Identidad para poder cerrar la conexión al revocar el acceso; las que mande el cliente se descartan.
      headers.delete(USER_HEADER); headers.delete(LINK_HEADER);
      if (auth.identity.userId) headers.set(USER_HEADER, auth.identity.userId);
      else if (auth.identity.linkToken) headers.set(LINK_HEADER, auth.identity.linkToken);
      return stub.fetch(new Request('https://do/ws', { headers }));
    }

    const sec = { https: url.protocol === 'https:', host: requestHost(request.headers, url) };
    if (url.pathname === SECURITY_TXT_PATH) return withSecurityHeaders(securityTxtResponse(env.PUBLIC_URL || url.origin), sec);
    if (url.pathname === RESET_PATH) return withSecurityHeaders(await handleReset(request, rt.store, env.RESET_CODE || null), sec);
    if (url.pathname === IMPORT_PATH) return withSecurityHeaders(await handleImport(request, { store: rt.store, hash: rt.hash, docs: rt.docs, importSecret: env.IMPORT_SECRET || null }), sec);
    if (url.pathname === '/healthz' || url.pathname === '/api' || url.pathname.startsWith('/api/')) return withSecurityHeaders(await rt.api.fetch(request, env, ctx), sec);
    return withSecurityHeaders(await env.ASSETS.fetch(request), sec);
  },
} satisfies ExportedHandler<Env>;
