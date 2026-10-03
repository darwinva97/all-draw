/**
 * Revocar un acceso cierra los WebSockets abiertos en el `WorkspaceDO` (etiquetas de hibernación con usuario o
 * enlace + `POST /revoke` interno): enlace revocado → 4401, cambio de rol → 4205 (reconecta), miembro quitado → 4401,
 * espacio borrado → 4410, cuenta borrada → 4401. También que el cliente no puede colarse una identidad por cabecera.
 */
import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const BASE = 'https://alldraw.test';
const uniq = () => Math.random().toString(36).slice(2, 8);
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any });
const client = (token?: string) => {
  const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
  return {
    get: (p: string) => SELF.fetch(BASE + p, { headers: headers() }).then(j),
    del: (p: string, body?: unknown) => SELF.fetch(BASE + p, { method: 'DELETE', headers: headers(body ? { 'content-type': 'application/json' } : {}), ...(body ? { body: JSON.stringify(body) } : {}) }).then(j),
    post: (p: string, body?: unknown) => SELF.fetch(BASE + p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
    put: (p: string, body: unknown) => SELF.fetch(BASE + p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  };
};
async function register(name: string) {
  const r = await client().post('/api/auth/register', { email: `${name}-${uniq()}@example.com`, name, password: 'contraseña-larga' });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token as string, user: r.body.user as { id: string; isAdmin: boolean }, api: client(r.body.token) };
}
async function openWs(id: string, token: string, extra: Record<string, string> = {}) {
  const res = await SELF.fetch(`${BASE}/ws/${id}?token=${token}`, { headers: { upgrade: 'websocket', ...extra } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  let state: { code: number; reason: string } | null = null;
  const closed = new Promise<{ code: number; reason: string }>(r => ws.addEventListener('close', (e: { code: number; reason: string }) => { state = { code: e.code, reason: e.reason }; r(state); }));
  ws.accept();
  return { ws, closed, isClosed: () => state !== null };
}
const within = <T,>(p: Promise<T>, ms = 5000) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout esperando el cierre')), ms))]);
const tick = (ms = 200) => new Promise(r => setTimeout(r, ms));

describe(`worker: revocar accesos cierra los WebSockets (${env.DB ? 'D1' : 'RegistryDO'})`, () => {
  it('revocar un enlace cierra con 4401 sólo sus sockets; reabrir con él da 4401', async () => {
    const owner = await register('rv-owner');
    const id = (await owner.api.post('/api/workspaces', { name: 'Sala' })).body.id as string;
    const tok = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const keep = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const a = await openWs(id, tok);
    const b = await openWs(id, keep);
    const o = await openWs(id, owner.token);
    expect((await owner.api.del(`/api/workspaces/${id}/links/${tok}`)).status).toBe(204);
    expect(await within(a.closed)).toEqual({ code: 4401, reason: 'enlace revocado' });
    await tick();
    expect(b.isClosed()).toBe(false);
    expect(o.isClosed()).toBe(false);
    expect((await within((await openWs(id, tok)).closed)).code).toBe(4401);
    b.ws.close(1000, 'fin'); o.ws.close(1000, 'fin');
  });

  it('cambio de rol de un miembro → 4205; quitarlo → 4401; borrar el espacio → 4410', async () => {
    const owner = await register('rv-own2');
    const bea = await register('rv-bea');
    const id = (await owner.api.post('/api/workspaces', { name: 'Roles' })).body.id as string;
    expect((await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'editor' })).status).toBe(200);
    const b1 = await openWs(id, bea.token);
    expect((await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'viewer' })).status).toBe(200);
    expect(await within(b1.closed)).toEqual({ code: 4205, reason: 'rol cambiado' });
    const b2 = await openWs(id, bea.token); // reconecta como viewer
    await tick();
    expect(b2.isClosed()).toBe(false);
    expect((await owner.api.del(`/api/workspaces/${id}/members/${bea.user.id}`)).status).toBe(204);
    expect((await within(b2.closed)).code).toBe(4401);
    const o = await openWs(id, owner.token);
    expect((await owner.api.del(`/api/workspaces/${id}`)).status).toBe(204);
    expect((await within(o.closed)).code).toBe(4410);
  });

  it('borrar la cuenta cierra (4401) sus sockets en espacios ajenos', async () => {
    const owner = await register('rv-own3');
    const eva = await register('rv-eva');
    const id = (await owner.api.post('/api/workspaces', { name: 'Ajeno' })).body.id as string;
    await owner.api.put(`/api/workspaces/${id}/members/${eva.user.id}`, { role: 'editor' });
    const e = await openWs(id, eva.token);
    const r = await eva.api.del('/api/auth/account', { password: 'contraseña-larga' });
    expect(r.status).toBe(200);
    expect((await within(e.closed)).code).toBe(4401);
  });

  it('cerrar sesión corta ese navegador (4402); cerrar todas, las demás; la API key sólo con revokeKeys (QA 8 y 9)', async () => {
    const ana = await register('rv-ses');
    const id = (await ana.api.post('/api/workspaces', { name: 'Sesiones' })).body.id as string;
    const me = (await ana.api.get('/api/auth/me')).body.user as { email: string };
    const login = async () => (await client().post('/api/auth/login', { email: me.email, password: 'contraseña-larga' })).body.token as string;
    const t2 = await login(), t3 = await login();
    const key = (await ana.api.post('/api/keys', { name: 'agente' })).body.key as string;
    const s1 = await openWs(id, ana.token), s2 = await openWs(id, t2), k = await openWs(id, key);
    expect((await ana.api.post('/api/auth/logout')).status).toBe(204);
    expect(await within(s1.closed)).toEqual({ code: 4402, reason: 'sesión cerrada' });
    await tick();
    expect(s2.isClosed()).toBe(false);
    expect((await client(key).del('/api/auth/sessions')).status).toBe(403); // una API key no cierra sesiones
    expect((await client(t3).del('/api/auth/sessions')).status).toBe(204);
    expect((await within(s2.closed)).code).toBe(4402);
    await tick();
    expect(k.isClosed()).toBe(false);
    expect((await client(await login()).del('/api/auth/sessions?revokeKeys=true')).status).toBe(204);
    expect((await within(k.closed)).code).toBe(4402);
    expect((await client(key).get('/api/auth/me')).status).toBe(401);
  });

  it('la identidad la pone el worker: una cabecera x-alldraw-user del cliente no sirve para escapar de la revocación', async () => {
    const owner = await register('rv-own4');
    const id = (await owner.api.post('/api/workspaces', { name: 'Cabeceras' })).body.id as string;
    const tok = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const a = await openWs(id, tok, { 'x-alldraw-user': 'usr_inventado', 'x-alldraw-link': 'lnk_otro', 'x-alldraw-session': 'inventada', 'x-alldraw-key': 'key_x' });
    expect((await owner.api.del(`/api/workspaces/${id}/links/${tok}`)).status).toBe(204);
    expect((await within(a.closed)).code).toBe(4401);
  });
});
