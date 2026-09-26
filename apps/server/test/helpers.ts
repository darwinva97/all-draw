import { createApp, type App } from '../src/app';
import { configFromEnv, type Config } from '../src/config';
import { MemoryWorkspaceStore } from '../src/store/memory';
import type { WorkspaceStore } from '../src/store/types';

export interface TestServer<S extends WorkspaceStore = MemoryWorkspaceStore> { app: App; store: S; url: string; wsUrl: string; close(): Promise<void> }

export async function startServer(): Promise<TestServer>;
export async function startServer<S extends WorkspaceStore>(opts: { store: S; config?: Partial<Config> }): Promise<TestServer<S>>;
export async function startServer(opts: { store?: WorkspaceStore; config?: Partial<Config> } = {}): Promise<TestServer<WorkspaceStore>> {
  const store = opts.store ?? new MemoryWorkspaceStore();
  const config = { ...configFromEnv({}), staticDir: '/nonexistent', allowRegistration: true, ...opts.config };
  const app = createApp(config, store);
  await new Promise<void>(r => app.server.listen(0, '127.0.0.1', () => r()));
  const port = (app.server.address() as { port: number }).port;
  return { app, store, url: `http://127.0.0.1:${port}`, wsUrl: `ws://127.0.0.1:${port}/ws`, close: async () => { await app.close(); await store.close(); } };
}

export function client(base: string, token?: string) {
  const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cuerpos JSON libres en los tests
  const j = async (res: Response): Promise<{ status: number; body: any; headers: Headers }> => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null), headers: res.headers });
  return {
    get: (p: string) => fetch(base + p, { headers: headers() }).then(j),
    del: (p: string) => fetch(base + p, { method: 'DELETE', headers: headers() }).then(j),
    post: (p: string, body?: unknown) => fetch(base + p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
    put: (p: string, body: unknown) => fetch(base + p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
    patch: (p: string, body: unknown) => fetch(base + p, { method: 'PATCH', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  };
}

export async function register(base: string, email: string, name = email.split('@')[0]!, password = 'contraseña-larga') {
  const r = await client(base).post('/api/auth/register', { email, name, password });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token as string, user: r.body.user as { id: string; email: string; isAdmin: boolean }, api: client(base, r.body.token) };
}

export const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
export async function until(fn: () => boolean, ms = 5000, step = 20) {
  const t0 = Date.now();
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error('timeout esperando condición'); await wait(step); }
}
