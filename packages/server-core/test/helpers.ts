/** API en memoria sin servidor HTTP: `app.request()` de Hono. Sirve para probar auth, permisos y comandos en cualquier runtime. */
import { createApi } from '../src/api';
import { makeHasher } from '../src/auth';
import { DocManager } from '../src/docs';
import { LocalDocHost } from '../src/host';
import { MemoryWorkspaceStore } from '../src/store/memory';

export function makeApi(opts: { allowRegistration?: boolean; secret?: string | null; publicUrl?: string | null } = {}) {
  const store = new MemoryWorkspaceStore();
  const docs = new DocManager(store);
  const app = createApi({ store, docs: new LocalDocHost(docs), hash: makeHasher(opts.secret ?? null), config: { allowRegistration: opts.allowRegistration ?? true, cookieSecure: false, publicUrl: opts.publicUrl ?? null } });
  const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
  const req = (p: string, init: RequestInit) => Promise.resolve(app.request(p, init));
  const client = (token?: string) => {
    const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
    return {
      get: (p: string) => req(p, { headers: headers() }).then(j),
      del: (p: string) => req(p, { method: 'DELETE', headers: headers() }).then(j),
      post: (p: string, body?: unknown) => req(p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
      put: (p: string, body: unknown) => req(p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
      patch: (p: string, body: unknown) => req(p, { method: 'PATCH', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
    };
  };
  const register = async (email: string, name = email.split('@')[0]!, password = 'contraseña-larga') => {
    const r = await client().post('/api/auth/register', { email, name, password });
    if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
    return { token: r.body.token as string, user: r.body.user as { id: string; email: string; isAdmin: boolean }, api: client(r.body.token) };
  };
  return { app, store, docs, client, register, close: () => docs.closeAll() };
}
