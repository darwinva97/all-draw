/** Producción en el worker (workerd): estado, security.txt, cabeceras, errores del cliente, perfil, cuotas, exportar y borrar la cuenta (con los espacios en sus Durable Objects). */
import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { exampleWorkspace } from '@all-draw/core';

const BASE = 'https://alldraw.test';
const PW = 'contraseña-larga';
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
const client = (token?: string) => {
  const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
  const send = (method: string, p: string, body?: unknown) => SELF.fetch(BASE + p, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }).then(j);
  return {
    get: (p: string) => send('GET', p),
    post: (p: string, body?: unknown) => send('POST', p, body ?? {}),
    put: (p: string, body: unknown) => send('PUT', p, body),
    patch: (p: string, body: unknown) => send('PATCH', p, body),
    del: (p: string, body?: unknown) => send('DELETE', p, body),
  };
};
async function register(email: string) {
  const r = await client().post('/api/auth/register', { email, name: email.split('@')[0], password: PW });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token as string, user: r.body.user as { id: string; isAdmin: boolean }, api: client(r.body.token) };
}
const tag = () => Math.random().toString(36).slice(2, 8);

describe(`worker en producción (${env.DB ? 'D1' : 'RegistryDO'})`, () => {
  it('GET /api/status: runtime cloudflare, commit inyectado y registro', async () => {
    const r = await client().get('/api/status');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', runtime: 'cloudflare', commit: 'abc1234', db: { kind: env.DB ? 'd1' : 'durable-object', ok: true } });
  });

  it('security.txt y cabeceras COOP/CORP', async () => {
    const r = await SELF.fetch(`${BASE}/.well-known/security.txt`);
    expect(r.status).toBe(200);
    const txt = await r.text();
    expect(txt).toContain('Contact: https://github.com/darwinva97/all-draw/security');
    expect(txt).toMatch(/Expires: \d{4}-/);
    for (const p of ['/healthz', '/api/notations']) {
      const h = (await SELF.fetch(BASE + p)).headers;
      expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(h.get('cross-origin-resource-policy')).toBe('same-origin');
    }
  });

  it('POST /api/client-errors', async () => {
    expect((await client().post('/api/client-errors', { message: 'Error: x', source: 'onerror', url: '/#/s/ws?token=lnk_abc' })).status).toBe(204);
    expect((await client().post('/api/client-errors', { stack: 'sin mensaje' })).status).toBe(400);
  });

  it('perfil, cuotas y config del registro', async () => {
    const cfg = await client().get('/api/auth/config');
    expect(cfg.body).toMatchObject({ formMinMs: 0 });
    expect(typeof cfg.body.formToken).toBe('string');
    expect((await client().post('/api/auth/register', { email: `bot-${tag()}@x.io`, name: 'b', password: PW, website: 'spam' })).status).toBe(400);
    const a = await register(`ana-${tag()}@x.io`);
    await a.api.post('/api/workspaces', { name: 'uno' });
    const me = await a.api.get('/api/auth/me');
    expect(me.body.quotas.workspaces.used).toBe(1);
    expect(me.body.quotas.docBytes.limit).toBe(20 * 1024 * 1024);
    const email = `nueva-${tag()}@x.io`;
    expect((await a.api.patch('/api/auth/me', { name: 'Ana', email, password: PW })).body.user).toMatchObject({ name: 'Ana', email });
  });

  it('exportar y borrar la cuenta: transfiere al editor, borra el resto (y su Durable Object)', async () => {
    const a = await register(`ana-${tag()}@x.io`);
    const b = await register(`bea-${tag()}@x.io`);
    const shared = (await a.api.post('/api/workspaces', { name: 'compartido' })).body.id;
    await a.api.put(`/api/workspaces/${shared}/members/${b.user.id}`, { role: 'editor' });
    const alone = (await a.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;

    const exp = await a.api.get('/api/auth/export');
    expect(exp.status).toBe(200);
    expect(exp.headers.get('content-disposition')).toMatch(/attachment/);
    const mine = exp.body.workspaces.find((w: { id: string }) => w.id === alone);
    expect(Object.keys(mine.snapshot.elements).length).toBeGreaterThan(0);

    expect((await a.api.del('/api/auth/account', { password: 'otra-contraseña' })).status).toBe(403);
    const r = await a.api.del('/api/auth/account', { password: PW });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, deleted: [alone], transferred: [{ id: shared, to: b.user.id }] });
    expect((await b.api.get(`/api/workspaces/${shared}`)).body.role).toBe('owner');
    expect((await a.api.get('/api/auth/me')).status).toBe(401);
    // el DO del espacio borrado quedó vacío
    const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(alone));
    const snap = await (await stub.fetch('https://do/snapshot')).json() as { elements: Record<string, unknown> };
    expect(Object.keys(snap.elements)).toEqual([]);
  });
});
