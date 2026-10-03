/**
 * Sesiones, API keys y WebSockets (QA 2026-10-03, fallos 8, 9, 29, 30, 51, 52, 53, 54, 65 y 27):
 * cerrar sesiones / cambiar o restablecer la contraseña corta al momento los WebSockets de esas sesiones y, con la
 * casilla, revoca también las API keys; una API key no puede cerrar sesiones ni cambiar la contraseña.
 */
import { describe, expect, it } from 'vitest';
import { makeApi } from './helpers';
import { makeHasher } from '../src/auth';
import { jsonLogger } from '../src/log';
import { sessionIdOf, type ConnIdentity } from '../src/docs';
import { WS_REVOKED, WS_SESSION_CLOSED, attachConnection, type SyncSocket } from '../src/ysync';

const PW = 'contraseña-larga';
type T = ReturnType<typeof makeApi>;
const hash = makeHasher(null);

/** Conexión falsa registrada en el doc vivo con su identidad; `closed` guarda el código de cierre. */
async function connect(t: T, id: string, identity: ConnIdentity) {
  const live = await t.docs.get(id);
  const out = { closed: null as null | { code?: number; reason?: string } };
  const conn: SyncSocket = { identity, send() {}, isOpen: () => out.closed === null, close: (code, reason) => { out.closed ??= { code, reason }; } };
  attachConnection(conn, live, 'editor');
  return out;
}
/** Identidad de una conexión abierta con una sesión o una API key (lo que pone `authorizeConnection`). */
const viaSession = async (userId: string, token: string): Promise<ConnIdentity> => ({ userId, linkToken: null, sessionId: sessionIdOf(await hash(token)), keyId: null });
const viaKey = (userId: string, keyId: string): ConnIdentity => ({ userId, linkToken: null, sessionId: null, keyId });

async function setup() {
  const t = makeApi();
  const a = await t.register('ana@x.io');
  const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
  const login = async () => (await t.client().post('/api/auth/login', { email: 'ana@x.io', password: PW })).body.token as string;
  const second = await login();
  const key = (await a.api.post('/api/keys', { name: 'agente' })).body as { id: string; key: string };
  return { t, a, id, second, key, login };
}

describe('sesiones, claves y WebSockets', () => {
  it('«Cerrar sesión» cierra sólo los WebSockets de ese navegador (4402)', async () => {
    const { t, a, id, second, key } = await setup();
    const mine = await connect(t, id, await viaSession(a.user.id, a.token));
    const other = await connect(t, id, await viaSession(a.user.id, second));
    const agent = await connect(t, id, viaKey(a.user.id, key.id));
    expect((await a.api.post('/api/auth/logout')).status).toBe(204);
    expect(mine.closed).toEqual({ code: WS_SESSION_CLOSED, reason: 'sesión cerrada' });
    expect(other.closed).toBeNull();
    expect(agent.closed).toBeNull();
    expect((await t.client(second).get('/api/auth/me')).status).toBe(200);
    await t.close();
  });

  it('«Cerrar todas las sesiones»: sin casilla deja las claves; con `revokeKeys=true` las revoca y corta sus WebSockets', async () => {
    const { t, a, id, second, key, login } = await setup();
    const s1 = await connect(t, id, await viaSession(a.user.id, a.token));
    const s2 = await connect(t, id, await viaSession(a.user.id, second));
    const agent = await connect(t, id, viaKey(a.user.id, key.id));
    // Una API key no puede cerrar sesiones (fallo 54)
    const byKey = await t.client(key.key).del('/api/auth/sessions');
    expect(byKey.status).toBe(403);
    expect(byKey.body.code).toBe('session_required');
    expect(s1.closed).toBeNull();

    expect((await a.api.del('/api/auth/sessions')).status).toBe(204);
    expect(s1.closed?.code).toBe(WS_SESSION_CLOSED);
    expect(s2.closed?.code).toBe(WS_SESSION_CLOSED);
    expect(agent.closed).toBeNull();
    expect((await t.client(a.token).get('/api/auth/me')).status).toBe(401);
    expect((await t.client(second).get('/api/auth/me')).status).toBe(401);
    expect((await t.client(key.key).get('/api/auth/me')).status).toBe(200);

    const fresh = await login();
    const agent2 = await connect(t, id, viaKey(a.user.id, key.id));
    expect((await t.client(fresh).del('/api/auth/sessions?revokeKeys=true')).status).toBe(204);
    expect((await t.client(key.key).get('/api/auth/me')).status).toBe(401); // fallo 8
    expect(agent2.closed?.code).toBe(WS_SESSION_CLOSED);
    expect(await t.store.listApiKeys(a.user.id)).toEqual([]);
    await t.close();
  });

  it('cambiar la contraseña: cierra las demás sesiones y sus WebSockets, no la propia; con `revokeKeys` también las claves', async () => {
    const { t, a, id, second, key } = await setup();
    const mine = await connect(t, id, await viaSession(a.user.id, a.token));
    const other = await connect(t, id, await viaSession(a.user.id, second));
    const agent = await connect(t, id, viaKey(a.user.id, key.id));
    // Validación (fallo 52): ocho espacios no; la nueva igual a la actual tampoco; con API key tampoco (fallo 54)
    const blank = await a.api.post('/api/auth/password', { current: PW, password: '        ' });
    expect(blank.status).toBe(400);
    expect(blank.body.fields).toEqual(['password']);
    expect(blank.body.error).toMatch(/password/);
    const same = await a.api.post('/api/auth/password', { current: PW, password: PW });
    expect(same.status).toBe(400);
    expect(same.body.code).toBe('password_same');
    expect((await t.client(key.key).post('/api/auth/password', { current: PW, password: 'otra-contraseña' })).status).toBe(403);
    expect(other.closed).toBeNull();

    expect((await a.api.post('/api/auth/password', { current: PW, password: 'otra-contraseña', revokeKeys: true })).status).toBe(200);
    expect(mine.closed).toBeNull();
    expect(other.closed?.code).toBe(WS_SESSION_CLOSED);
    expect(agent.closed?.code).toBe(WS_SESSION_CLOSED);
    expect((await a.api.get('/api/auth/me')).status).toBe(200);
    expect((await t.client(second).get('/api/auth/me')).status).toBe(401);
    expect((await t.client(key.key).get('/api/auth/me')).status).toBe(401);
    await t.close();
  });

  it('restablecer la contraseña (admin): cierra sus sesiones y WebSockets; las claves sólo con `revokeKeys=true`', async () => {
    const t = makeApi();
    const admin = await t.register('admin@x.io');
    const b = await t.register('bea@x.io');
    const id = (await b.api.post('/api/workspaces', { name: 'De Bea' })).body.id as string;
    const key = (await b.api.post('/api/keys', { name: 'agente' })).body as { id: string; key: string };
    const ws = await connect(t, id, await viaSession(b.user.id, b.token));
    const agent = await connect(t, id, viaKey(b.user.id, key.id));
    expect((await admin.api.post(`/api/admin/users/${b.user.id}/reset`)).status).toBe(200);
    expect(ws.closed?.code).toBe(WS_SESSION_CLOSED);
    expect(agent.closed).toBeNull();
    expect((await t.client(key.key).get('/api/auth/me')).status).toBe(200);
    expect((await admin.api.post(`/api/admin/users/${b.user.id}/reset?revokeKeys=true`)).status).toBe(200);
    expect(agent.closed?.code).toBe(WS_SESSION_CLOSED);
    expect((await t.client(key.key).get('/api/auth/me')).status).toBe(401);
    await t.close();
  });

  it('revocar una API key cierra los WebSockets abiertos con ella (4401)', async () => {
    const { t, a, id, key } = await setup();
    const agent = await connect(t, id, viaKey(a.user.id, key.id));
    const mine = await connect(t, id, await viaSession(a.user.id, a.token));
    expect((await a.api.del(`/api/keys/${key.id}`)).status).toBe(204);
    expect(agent.closed?.code).toBe(WS_REVOKED);
    expect(mine.closed).toBeNull();
    await t.close();
  });

  it('GET /api/auth/session responde 200 también sin sesión (sin 401 en la consola de cada visita)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    expect(await t.client().get('/api/auth/session')).toMatchObject({ status: 200, body: { user: null, via: null } });
    expect(await a.api.get('/api/auth/session')).toMatchObject({ status: 200, body: { user: { id: a.user.id }, via: 'session' } });
    await t.close();
  });
});

describe('login sin fugas', () => {
  it('cuesta lo mismo exista o no el correo (se verifica una contraseña igualmente)', async () => {
    const t = makeApi();
    await t.register('ana@x.io');
    const c = t.client();
    await c.post('/api/auth/login', { email: 'nadie@x.io', password: 'x' }); // calienta el hash de relleno
    const time = async (email: string) => { const t0 = performance.now(); for (let i = 0; i < 3; i++) await c.post('/api/auth/login', { email, password: `mala-${i}` }); return performance.now() - t0; };
    const known = await time('ana@x.io'), unknown = await time('nadie@x.io');
    // PBKDF2 de 100 000 iteraciones domina: sin el relleno, el correo inexistente tardaría una fracción
    expect(unknown).toBeGreaterThan(known * 0.5);
    await t.close();
  });

  it('los fallos de una dirección no bloquean el correo para las demás', async () => {
    let ip = '203.0.113.1';
    const t0 = makeApi();
    const { createApi } = await import('../src/api');
    // Mismo store y docs, pero la API sabe la IP del cliente (como hace el servidor Node con TRUSTED_PROXIES)
    const app = createApi({ store: t0.store, docs: new (await import('../src/host')).LocalDocHost(t0.docs), hash, config: { allowRegistration: true, cookieSecure: false, publicUrl: null, registerMinMs: 0 }, logger: jsonLogger({ level: 'silent' }), clientIp: () => ip });
    const post = (body: unknown) => Promise.resolve(app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then(r => r.status);
    await t0.register('ana@x.io');
    let last = 0;
    for (let i = 0; i < 12; i++) last = await post({ email: 'ana@x.io', password: 'mala' });
    expect(last).toBe(429);
    ip = '198.51.100.7';
    expect(await post({ email: 'ana@x.io', password: PW })).toBe(200);
    await t0.close();
  });
});

describe('privacidad y enlaces', () => {
  it('con un enlace se ven los nombres de los miembros, no sus correos (fallo 30)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io', 'Bea');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'viewer' });
    const link = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const byLink = await t.client(link).get(`/api/workspaces/${id}/members`);
    expect(byLink.status).toBe(200);
    expect(byLink.body.members[0].user).toEqual({ id: b.user.id, name: 'Bea' });
    expect(JSON.stringify(byLink.body)).not.toContain('@x.io');
    expect((await a.api.get(`/api/workspaces/${id}/members`)).body.members[0].user.email).toBe('bea@x.io');
    await t.close();
  });

  it('no se crean enlaces caducados; al abrir uno caducado o revocado el error lo dice (fallo 51)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const past = await a.api.post(`/api/workspaces/${id}/links`, { role: 'viewer', expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(past.status).toBe(400);
    expect(past.body.code).toBe('link_expires_past');
    const link = await t.store.createShareLink({ workspaceId: id, role: 'viewer', createdBy: a.user.id, token: 'lnk_caducado', expiresAt: '2020-01-02T00:00:00.000Z' });
    const r = await t.client(link.token).get(`/api/workspaces/${id}`);
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ code: 'link_expired', expiresAt: '2020-01-02T00:00:00.000Z' });
    expect(r.body.error).toMatch(/caducó el 2020-01-02/);
    const gone = await t.client('lnk_noexiste').get(`/api/workspaces/${id}`);
    expect(gone.body.code).toBe('link_invalid');
    expect((await t.client().get(`/api/workspaces/${id}`)).body.code).toBe('login_required'); // sin credencial: no es un error de enlace
    await t.close();
  });

  it('un enlace de edición puede renombrar el espacio (y el nombre del servidor cambia), no cambiar el dueño (fallo 27)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const link = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    expect((await t.client(link).patch(`/api/workspaces/${id}`, { name: 'Nuevo' })).status).toBe(200);
    expect((await a.api.get('/api/workspaces')).body.workspaces[0].name).toBe('Nuevo');
    expect((await t.client(link).patch(`/api/workspaces/${id}`, { ownerId: a.user.id })).status).toBe(403);
    expect((await a.api.patch(`/api/workspaces/${id}`, { name: '   ' })).status).toBe(400);
    await t.close();
  });

  it('los errores de validación dicen qué campo (fallo 29)', async () => {
    const t = makeApi();
    const r = await t.client().post('/api/auth/register', { email: 'a@b', name: '   ', password: PW });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('validation');
    expect(r.body.fields).toEqual(['email', 'name']);
    expect(r.body.error).toMatch(/email/);
    await t.close();
  });
});
