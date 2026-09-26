import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { client, register, startServer, type TestServer } from './helpers';

let s: TestServer;
beforeAll(async () => { s = await startServer(); });
afterAll(() => s.close());

describe('auth', () => {
  it('registro → el primero es admin, devuelve token y cookie', async () => {
    const res = await fetch(`${s.url}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'Ana@Example.com', name: 'Ana', password: 'contraseña-larga' }) });
    expect(res.status).toBe(201);
    const body = await res.json() as { user: unknown; token: string };
    expect(body.user).toMatchObject({ email: 'ana@example.com', isAdmin: true });
    expect(body.token).toMatch(/^ads_/);
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toContain('alldraw_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // La cookie también identifica
    const me = await fetch(`${s.url}/api/auth/me`, { headers: { cookie: cookie.split(';')[0]! } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { via: string }).via).toBe('session');
  });

  it('segundo usuario no es admin; email duplicado → 409; contraseña corta → 400', async () => {
    const b = await register(s.url, 'bea@example.com');
    expect(b.user.isAdmin).toBe(false);
    expect((await client(s.url).post('/api/auth/register', { email: 'bea@example.com', name: 'x', password: 'contraseña-larga' })).status).toBe(409);
    expect((await client(s.url).post('/api/auth/register', { email: 'c@example.com', name: 'x', password: 'corta' })).status).toBe(400);
  });

  it('login bueno/malo, me, logout invalida el token', async () => {
    const bad = await client(s.url).post('/api/auth/login', { email: 'ana@example.com', password: 'mal' });
    expect(bad.status).toBe(401);
    const ok = await client(s.url).post('/api/auth/login', { email: 'ana@example.com', password: 'contraseña-larga' });
    expect(ok.status).toBe(200);
    const api = client(s.url, ok.body.token);
    expect((await api.get('/api/auth/me')).body.user.email).toBe('ana@example.com');
    expect((await api.post('/api/auth/logout')).status).toBe(204);
    expect((await api.get('/api/auth/me')).status).toBe(401);
    expect((await client(s.url).get('/api/auth/me')).status).toBe(401);
  });

  it('rate limit de login', async () => {
    const c = client(s.url);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await c.post('/api/auth/login', { email: 'nadie@example.com', password: 'x' })).status;
    expect(last).toBe(429);
  });

  it('API keys: crear (secreto una vez), usar como Bearer, listar sin secreto, revocar', async () => {
    const a = await register(s.url, 'dani@example.com');
    const created = await a.api.post('/api/keys', { name: 'agente' });
    expect(created.status).toBe(201);
    expect(created.body.key).toMatch(/^adk_/);
    const viaKey = client(s.url, created.body.key);
    const me = await viaKey.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.via).toBe('apikey');
    // Con API key no se crean más keys
    expect((await viaKey.post('/api/keys', { name: 'otra' })).status).toBe(403);
    const list = await a.api.get('/api/keys');
    expect(list.body.keys).toHaveLength(1);
    expect(list.body.keys[0]).not.toHaveProperty('key');
    expect(list.body.keys[0]).not.toHaveProperty('keyHash');
    expect((await a.api.del(`/api/keys/${created.body.id}`)).status).toBe(204);
    expect((await viaKey.get('/api/auth/me')).status).toBe(401);
  });
});
