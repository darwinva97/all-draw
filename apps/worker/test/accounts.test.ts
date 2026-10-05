/**
 * Cuentas en workerd: correo apagado por defecto (`email: false`), recuperar y verificar con el registro real (RegistryDO
 * o D1) y un correo de prueba, sesiones activas, enlaces que caducan con el WebSocket abierto (`alarm()` del DO → 4401
 * `expired`) y menciones detectadas en el doc vivo del `WorkspaceDO`.
 */
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApi, makeHasher, type MailMessage, type Mailer } from '@all-draw/server-core';
import { D1WorkspaceStore } from '../src/store/d1';
import { registryStore, type RegistryStub } from '../src/store/do-sql';
import { RemoteDocHost } from '../src/remote-host';

const BASE = 'https://alldraw.test';
const uniq = () => Math.random().toString(36).slice(2, 8);
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any });
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const clientOf = (f: Fetcher) => (token?: string, extra: Record<string, string> = {}) => {
  const headers = (more: Record<string, string> = {}) => ({ ...extra, ...(token ? { authorization: `Bearer ${token}` } : {}), ...more });
  return {
    get: (p: string) => f(BASE + p, { headers: headers() }).then(j),
    del: (p: string) => f(BASE + p, { method: 'DELETE', headers: headers() }).then(j),
    post: (p: string, body?: unknown) => f(BASE + p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
    put: (p: string, body: unknown) => f(BASE + p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  };
};
const client = clientOf((u, i) => SELF.fetch(u, i));
async function register(name: string, c = client) {
  const r = await c().post('/api/auth/register', { email: `${name}-${uniq()}@example.com`, name, password: 'contraseña-larga' });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token as string, user: r.body.user as { id: string; email: string }, api: c(r.body.token) };
}
const until = async (fn: () => boolean | Promise<boolean>, ms = 5000) => { const t0 = Date.now(); while (!(await fn())) { if (Date.now() - t0 > ms) throw new Error('timeout'); await new Promise(r => setTimeout(r, 25)); } };
const tokenIn = (m?: MailMessage) => decodeURIComponent(/[?&]token=([^\s&]+)/.exec(m?.text ?? '')?.[1] ?? '');

describe(`worker: cuentas (${env.DB ? 'D1' : 'RegistryDO'})`, () => {
  it('sin MAIL_PROVIDER no hay correo: email false y forgot 503', async () => {
    const cfg = await client().get('/api/auth/config');
    expect(cfg.body).toMatchObject({ email: false, emailVerificationRequired: false });
    expect((await client().post('/api/auth/forgot', { email: 'x@example.com' })).body.code).toBe('email_disabled');
  });

  it('con correo (API sobre el registro real): restablecer y verificar, tokens de un solo uso', async () => {
    const sent: MailMessage[] = [];
    const mailer: Mailer = { kind: 'test', enabled: true, async send(m) { sent.push(m); } };
    const stub = env.REGISTRY.get(env.REGISTRY.newUniqueId()) as unknown as RegistryStub;
    const store = env.DB ? new D1WorkspaceStore(env.DB) : registryStore(env.REGISTRY, () => stub);
    const app = createApi({ store, hash: makeHasher(null), docs: new RemoteDocHost(env.WORKSPACES), mailer, config: { allowRegistration: true, cookieSecure: true, publicUrl: 'https://draw.example', registerMinMs: 0, forgotMinMs: 0 } });
    const c = clientOf((u, i) => Promise.resolve(app.request(u, i)));
    const a = await register('ana', c);
    const verify = sent.find(m => m.to === a.user.email && /verificar/.test(m.text));
    expect(verify?.text).toContain('https://draw.example/#/verificar?token=vfy_');
    expect((await c().post('/api/auth/verify', { token: tokenIn(verify) })).body.user.emailVerified).toBe(true);
    expect((await c().post('/api/auth/verify', { token: tokenIn(verify) })).body.code).toBe('token_invalid');
    expect((await c().post('/api/auth/forgot', { email: a.user.email })).status).toBe(202);
    await until(() => sent.some(m => /restablecer/.test(m.text)));
    const token = tokenIn(sent.find(m => /restablecer/.test(m.text)));
    expect((await c().post('/api/auth/reset', { token, password: 'otra-contraseña-larga' })).status).toBe(200);
    expect((await c().post('/api/auth/reset', { token, password: 'tercera-contraseña' })).body.code).toBe('token_invalid');
    expect((await a.api.get('/api/auth/me')).status).toBe(401);
    expect((await c().post('/api/auth/login', { email: a.user.email, password: 'otra-contraseña-larga' })).status).toBe(200);
  });

  it('sesiones activas: lista con el dispositivo y la actual; cerrar una', async () => {
    const a = await register('ses');
    const other = await client(undefined, { 'user-agent': 'curl/8.5.0' }).post('/api/auth/login', { email: a.user.email, password: 'contraseña-larga' });
    const list = (await a.api.get('/api/auth/sessions')).body.sessions as { id: string; current: boolean; device: { browser: string | null; type: string } }[];
    expect(list).toHaveLength(2);
    expect(list.filter(s => s.current)).toHaveLength(1);
    const cli = list.find(s => s.device.browser === 'curl')!;
    expect(cli.device.type).toBe('cli');
    expect((await a.api.del(`/api/auth/sessions/${cli.id}`)).status).toBe(204);
    expect((await client(other.body.token).get('/api/auth/me')).status).toBe(401);
    expect((await a.api.get('/api/auth/me')).status).toBe(200);
  });

  it('un enlace que caduca con el WebSocket abierto se corta a su hora (alarm del DO): 4401 expired', async () => {
    const a = await register('exp');
    const id = (await a.api.post('/api/workspaces', { name: 'Caduca' })).body.id as string;
    const soon = new Date(Date.now() + 1500).toISOString();
    const tok = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor', expiresAt: soon })).body.token as string;
    const open = async (token: string) => {
      const res = await SELF.fetch(`${BASE}/ws/${id}?token=${token}`, { headers: { upgrade: 'websocket' } });
      const ws = res.webSocket!;
      const st = { code: 0, reason: '' };
      ws.addEventListener('close', (e: { code: number; reason: string }) => { st.code = e.code; st.reason = e.reason; });
      ws.accept();
      return { ws, st };
    };
    const x = await open(tok);
    const y = await open(a.token);
    await until(() => x.st.code !== 0, 8000);
    expect(x.st).toEqual({ code: 4401, reason: 'expired' });
    await new Promise(r => setTimeout(r, 200));
    expect(y.st.code).toBe(0);
    y.ws.close(1000, 'fin');
  });

  it('menciones en el doc vivo del DO → notificación para la cuenta mencionada', async () => {
    const a = await register('men-a');
    const b = await register('men-b');
    const id = (await a.api.post('/api/workspaces', { name: 'Menciones' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' });
    const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(id));
    await runInDurableObject(stub, async (instance: unknown) => {
      const live = await (instance as { doc(): Promise<import('@all-draw/server-core').LiveDoc> }).doc();
      live.store.set('people', 'p1', { id: 'p1', name: 'Bea', email: b.user.email, assignments: [] } as never);
      live.store.set('comments', 'c1', { id: 'c1', threadId: 'c1', anchor: { kind: 'view', id: 'v1' }, author: { name: 'Ana', userId: a.user.id }, text: '@Bea mira', mentions: ['p1'], createdAt: new Date().toISOString() } as never);
      await (instance as { drainNotifications(): Promise<unknown> }).drainNotifications();
    });
    await until(async () => ((await b.api.get('/api/notifications')).body.notifications as { kind: string }[]).some(n => n.kind === 'mention'));
    const n = ((await b.api.get('/api/notifications')).body.notifications as { kind: string; href: string; payload: Record<string, unknown> }[]).find(x => x.kind === 'mention')!;
    expect(n).toMatchObject({ href: `#/s/${id}/v/v1`, payload: { workspaceName: 'Menciones', actorName: 'Ana', excerpt: '@Bea mira' } });
    const shared = ((await b.api.get('/api/notifications')).body.notifications as { kind: string }[]).find(x => x.kind === 'shared');
    expect(shared).toBeTruthy();
  });
});
