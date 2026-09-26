/**
 * Worker de Cloudflare: la misma API Hono de `@all-draw/server-core` sobre D1, con el contenido de
 * cada espacio en su Durable Object (`WorkspaceDO`) y la app web servida por Assets.
 *
 *   /api/*, /healthz   → createApi (store D1, docs → DO)
 *   /ws/<id>?token=    → autoriza aquí y reenvía el upgrade al DO con el rol en una cabecera
 *   resto              → ASSETS (fallback SPA)
 */
import { SAFE_ID, authorizeConnection, createApi, makeHasher, tokenFromRequest, type Hasher } from '@all-draw/server-core';
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
    config: { allowRegistration: env.ALLOW_REGISTRATION !== 'false', cookieSecure: true, publicUrl: env.PUBLIC_URL || null },
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
      const auth = await authorizeConnection({ store: rt.store, hash: rt.hash }, tokenFromRequest(request.headers, url), id);
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

    if (url.pathname === '/healthz' || url.pathname === '/api' || url.pathname.startsWith('/api/')) return rt.api.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
