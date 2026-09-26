/**
 * Worker de Cloudflare: la misma API Hono de `@all-draw/server-core` sobre D1, con el contenido de
 * cada espacio en su Durable Object (`WorkspaceDO`) y la app web servida por Assets.
 *
 *   /api/*, /healthz   → createApi (store D1, docs → DO)
 *   /ws/<id>?token=    → autoriza aquí y reenvía el upgrade al DO con el rol en una cabecera
 *   resto              → ASSETS (fallback SPA)
 */
import { SAFE_ID, authorizeConnection, createApi, credentialsFromRequest, isTrustedOrigin, makeHasher, requestHost, withSecurityHeaders, type Hasher } from '@all-draw/server-core';
import { ROLE_HEADER, WorkspaceDO } from './do';
import type { Env } from './env';
import { RemoteDocHost } from './remote-host';
import { D1WorkspaceStore } from './store/d1';

export { WorkspaceDO };

interface Runtime { api: ReturnType<typeof createApi>; store: D1WorkspaceStore; hash: Hasher }
let runtime: Runtime | null = null;
/** Se construye una vez por isolate (los bindings son estables). */
function boot(env: Env): Runtime {
  if (runtime) return runtime;
  const store = new D1WorkspaceStore(env.DB);
  const hash = makeHasher(env.SESSION_SECRET || null);
  const api = createApi({
    store, hash, docs: new RemoteDocHost(env.WORKSPACES),
    config: { allowRegistration: env.ALLOW_REGISTRATION !== 'false', cookieSecure: true, publicUrl: env.PUBLIC_URL || null, inviteCode: env.INVITE_CODE || null },
  });
  return (runtime = { api, store, hash });
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
      return stub.fetch(new Request('https://do/ws', { headers }));
    }

    const sec = { https: url.protocol === 'https:', host: requestHost(request.headers, url) };
    if (url.pathname === '/healthz' || url.pathname === '/api' || url.pathname.startsWith('/api/')) return withSecurityHeaders(await rt.api.fetch(request, env, ctx), sec);
    return withSecurityHeaders(await env.ASSETS.fetch(request), sec);
  },
} satisfies ExportedHandler<Env>;
