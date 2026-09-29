/** Seguridad de la API (memoria): CSRF, sesiones con caducidad deslizante, contraseñas, administración, invitación, límites. */
import { afterAll, describe, expect, it } from 'vitest';
import { exampleWorkspace } from '@all-draw/core';
import { CSRF_HEADER, CSRF_VALUE, SESSION_COOKIE, SESSION_MS, isTrustedOrigin, safeEqualString } from '../src/auth';
import { makeApi } from './helpers';

const api = makeApi();
afterAll(() => api.close());

const cookieOf = (res: { headers: Headers }) => res.headers.get('set-cookie')!.split(';')[0]!;

describe('CSRF', () => {
  it('isTrustedOrigin: cabecera de la SPA, Sec-Fetch-Site, Origin/Referer del mismo host', () => {
    const url = new URL('https://app.example.com/api/x');
    const h = (o: Record<string, string>) => new Headers(o);
    expect(isTrustedOrigin(h({}), url)).toBe(false);
    expect(isTrustedOrigin(h({ [CSRF_HEADER]: CSRF_VALUE }), url)).toBe(true);
    expect(isTrustedOrigin(h({ 'sec-fetch-site': 'same-origin' }), url)).toBe(true);
    expect(isTrustedOrigin(h({ 'sec-fetch-site': 'cross-site', origin: 'https://app.example.com' }), url)).toBe(false);
    expect(isTrustedOrigin(h({ 'sec-fetch-site': 'same-site' }), url)).toBe(false);
    expect(isTrustedOrigin(h({ origin: 'https://app.example.com', host: 'app.example.com' }), url)).toBe(true);
    expect(isTrustedOrigin(h({ origin: 'https://evil.example.com', host: 'app.example.com' }), url)).toBe(false);
    expect(isTrustedOrigin(h({ referer: 'https://app.example.com/#/s/x', host: 'app.example.com' }), url)).toBe(true);
    expect(isTrustedOrigin(h({ origin: 'https://app.example.com', host: '127.0.0.1:4002', 'x-forwarded-host': 'app.example.com' }), url)).toBe(true);
    expect(isTrustedOrigin(h({ origin: 'null', host: 'app.example.com' }), url)).toBe(false);
  });

  it('con cookie: POST sin señal de origen → 403; con X-Requested-With, Sec-Fetch-Site u Origin → pasa; GET nunca se bloquea; Bearer no lo necesita', async () => {
    const login = await api.client().post('/api/auth/login', { email: (await api.register('csrf@example.com')).user.email, password: 'contraseña-larga' });
    const cookie = cookieOf(login);
    const post = (extra: Record<string, string>) => api.app.request('/api/workspaces', { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...extra }, body: JSON.stringify({ name: 'x' }) });
    expect((await post({})).status).toBe(403);
    expect((await (await post({})).json() as { error: string }).error).toMatch(/CSRF/);
    expect((await post({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' })).status).toBe(403);
    expect((await post({ origin: 'https://evil.example', host: 'localhost' })).status).toBe(403);
    expect((await post({ [CSRF_HEADER]: CSRF_VALUE })).status).toBe(201);
    expect((await post({ 'sec-fetch-site': 'same-origin' })).status).toBe(201);
    expect((await post({ origin: 'http://localhost', host: 'localhost' })).status).toBe(201);
    expect((await api.app.request('/api/workspaces', { headers: { cookie } })).status).toBe(200);
    expect((await api.client(login.body.token).post('/api/workspaces', { name: 'bearer' })).status).toBe(201);
    // logout con cookie también exige la señal
    expect((await api.app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })).status).toBe(403);
    expect((await api.app.request('/api/auth/logout', { method: 'POST', headers: { cookie, [CSRF_HEADER]: CSRF_VALUE } })).status).toBe(204);
  });
});

describe('sesiones', () => {
  it('caducan; se renuevan (deslizante) al usarlas cuando ha pasado más de un día; DELETE /api/auth/sessions cierra todas', async () => {
    const u = await api.register('ses@example.com');
    const login2 = await api.client().post('/api/auth/login', { email: 'ses@example.com', password: 'contraseña-larga' });
    const cookie = cookieOf(login2);
    // Caducada → 401 y se borra
    const [hash] = [...api.store.sessions.entries()].find(([, s]) => s.userId === u.user.id)!;
    api.store.sessions.get(hash)!.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect((await u.api.get('/api/auth/me')).status).toBe(401);
    expect(api.store.sessions.has(hash)).toBe(false);
    // Renovación: sesión con 10 días de vida → al usarla vuelve a 30 y refresca la cookie
    const [hash2] = [...api.store.sessions.entries()].find(([, s]) => s.userId === u.user.id)!;
    api.store.sessions.get(hash2)!.expiresAt = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const me = await api.app.request('/api/auth/me', { headers: { cookie } });
    expect(me.status).toBe(200);
    expect(me.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
    expect(Date.parse(api.store.sessions.get(hash2)!.expiresAt)).toBeGreaterThan(Date.now() + SESSION_MS - 60_000);
    // Fresca (recién creada) → no se toca ni se manda cookie
    const me2 = await api.app.request('/api/auth/me', { headers: { cookie } });
    expect(me2.headers.get('set-cookie')).toBeNull();
    // Cerrar todas
    const login3 = await api.client().post('/api/auth/login', { email: 'ses@example.com', password: 'contraseña-larga' });
    expect((await api.client(login3.body.token).del('/api/auth/sessions')).status).toBe(204);
    expect((await api.client(login3.body.token).get('/api/auth/me')).status).toBe(401);
    expect((await api.app.request('/api/auth/me', { headers: { cookie } })).status).toBe(401);
    expect((await api.client().del('/api/auth/sessions')).status).toBe(401);
  });
});

describe('contraseñas y administración', () => {
  it('cambio de contraseña: actual incorrecta → 403; corta → 400; correcta cierra las demás sesiones; no con API key', async () => {
    const u = await api.register('pw@example.com');
    const other = await api.client().post('/api/auth/login', { email: 'pw@example.com', password: 'contraseña-larga' });
    expect((await u.api.post('/api/auth/password', { current: 'mal', password: 'nueva-contraseña' })).status).toBe(403);
    expect((await u.api.post('/api/auth/password', { current: 'contraseña-larga', password: 'corta' })).status).toBe(400);
    const key = (await u.api.post('/api/keys', { name: 'k' })).body.key as string;
    expect((await api.client(key).post('/api/auth/password', { current: 'contraseña-larga', password: 'nueva-contraseña' })).status).toBe(403);
    expect((await u.api.post('/api/auth/password', { current: 'contraseña-larga', password: 'nueva-contraseña' })).status).toBe(200);
    expect((await u.api.get('/api/auth/me')).status).toBe(200); // la sesión actual sigue
    expect((await api.client(other.body.token).get('/api/auth/me')).status).toBe(401); // la otra no
    expect((await api.client().post('/api/auth/login', { email: 'pw@example.com', password: 'contraseña-larga' })).status).toBe(401);
    expect((await api.client().post('/api/auth/login', { email: 'pw@example.com', password: 'nueva-contraseña' })).status).toBe(200);
  });

  it('admin: lista usuarios y restablece contraseñas (temporal, cierra sesiones); los demás → 403', async () => {
    const admin = api.client((await api.client().post('/api/auth/login', { email: 'csrf@example.com', password: 'contraseña-larga' })).body.token);
    const victim = await api.register('victim@example.com');
    expect((await victim.api.get('/api/admin/users')).status).toBe(403);
    expect((await victim.api.post(`/api/admin/users/${victim.user.id}/reset`)).status).toBe(403);
    const list = await admin.get('/api/admin/users');
    expect(list.status).toBe(200);
    expect(list.body.users.map((x: { email: string }) => x.email)).toContain('victim@example.com');
    expect(list.body.users[0]).not.toHaveProperty('passwordHash');
    expect((await admin.post('/api/admin/users/usr_nope/reset')).status).toBe(404);
    const r = await admin.post(`/api/admin/users/${victim.user.id}/reset`);
    expect(r.status).toBe(200);
    expect(r.body.password).toMatch(/^[A-Za-z0-9]{16}$/);
    expect((await victim.api.get('/api/auth/me')).status).toBe(401);
    expect((await api.client().post('/api/auth/login', { email: 'victim@example.com', password: r.body.password })).status).toBe(200);
    // Con API key de admin no se puede restablecer
    const key = (await admin.post('/api/keys', { name: 'k' })).body.key as string;
    expect((await api.client(key).post(`/api/admin/users/${victim.user.id}/reset`)).status).toBe(403);
  });
});

describe('registro', () => {
  it('config anuncia open/invite/closed; con INVITE_CODE el registro exige el código', async () => {
    expect((await api.client().get('/api/auth/config')).body.registration).toBe('open');
    const inv = makeApi({ inviteCode: 'secreto-123' });
    expect((await inv.client().get('/api/auth/config')).body.registration).toBe('invite');
    expect((await inv.client().post('/api/auth/register', { email: 'a@example.com', name: 'a', password: 'contraseña-larga' })).status).toBe(403);
    expect((await inv.client().post('/api/auth/register', { email: 'a@example.com', name: 'a', password: 'contraseña-larga', inviteCode: 'otro' })).status).toBe(403);
    expect((await inv.client().post('/api/auth/register', { email: 'a@example.com', name: 'a', password: 'contraseña-larga', inviteCode: 'secreto-123' })).status).toBe(201);
    await inv.close();
    // Cerrado es cerrado también sin usuarios (nadie se hace admin de un despliegue nuevo)…
    const closed = makeApi({ allowRegistration: false });
    expect((await closed.client().get('/api/auth/config')).body.registration).toBe('closed');
    expect((await closed.client().post('/api/auth/register', { email: 'first@example.com', name: 'f', password: 'contraseña-larga' })).status).toBe(403);
    await closed.close();
    // …salvo el primero con código de invitación; después, cerrado para todos.
    const boot = makeApi({ allowRegistration: false, inviteCode: 'arranque' });
    expect((await boot.client().get('/api/auth/config')).body.registration).toBe('invite');
    const first = await boot.client().post('/api/auth/register', { email: 'first@example.com', name: 'f', password: 'contraseña-larga', inviteCode: 'arranque' });
    expect(first.status).toBe(201);
    expect(first.body.user.isAdmin).toBe(true);
    expect((await boot.client().get('/api/auth/config')).body.registration).toBe('closed');
    expect((await boot.client().post('/api/auth/register', { email: 's@example.com', name: 's', password: 'contraseña-larga', inviteCode: 'arranque' })).status).toBe(403);
    await boot.close();
    expect(safeEqualString('abc', 'abc')).toBe(true);
    expect(safeEqualString('abc', 'abd')).toBe(false);
    expect(safeEqualString('abc', 'abcd')).toBe(false);
    expect(safeEqualString('', '')).toBe(true);
  });

  it('rate limit de registro por IP', async () => {
    const fresh = makeApi();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await fresh.app.request('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.9' }, body: JSON.stringify({ email: `u${i}@example.com`, name: 'u', password: 'contraseña-larga' }) })).status;
    expect(last).toBe(429);
    await fresh.close();
  });
});

describe('límites y validación', () => {
  it('cuerpo demasiado grande → 413 (1 MB comandos, 5 MB snapshot); id de espacio inválido → 400', async () => {
    const u = await api.register('lim@example.com');
    const id = (await u.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id as string;
    const big = 'x'.repeat(1024 * 1024 + 10);
    const cmd = await api.app.request(`/api/workspaces/${id}/commands`, { method: 'POST', headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ commands: [{ type: 'meta', patch: { description: big } }] }) });
    expect(cmd.status).toBe(413);
    // El mismo tamaño en PUT snapshot entra (límite 5 MB): pasa del límite y llega a la validación del esquema
    const snap = await api.app.request(`/api/workspaces/${id}/snapshot`, { method: 'PUT', headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ meta: { name: big } }) });
    expect([200, 400]).toContain(snap.status);
    const huge = await api.app.request(`/api/workspaces/${id}/snapshot`, { method: 'PUT', headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json', 'content-length': String(6 * 1024 * 1024) }, body: '{}' });
    expect(huge.status).toBe(413);
    expect((await u.api.get('/api/workspaces/ws%20malo')).status).toBe(400);
    expect((await u.api.get('/api/workspaces/../etc')).status).not.toBe(200);
  });

  it('rate limit de creación de enlaces por usuario', async () => {
    const u = await api.register('links@example.com');
    const id = (await u.api.post('/api/workspaces', { name: 'L' })).body.id as string;
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await u.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).status;
    expect(last).toBe(429);
  });
});
