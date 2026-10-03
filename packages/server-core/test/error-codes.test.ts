/** Errores con `code` estable (fallo 13): el cliente traduce por `code`; `error` sigue en español por compatibilidad. */
import { describe, expect, it } from 'vitest';
import { makeApi } from './helpers';

describe('códigos de error estables', () => {
  it('login, permisos, recursos y roles devuelven `code` además del texto en español', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const bad = await t.client().post('/api/auth/login', { email: 'ana@x.io', password: 'otra-contraseña' });
    expect(bad.status).toBe(401);
    expect(bad.body).toMatchObject({ code: 'bad_credentials', error: 'Email o contraseña incorrectos' });
    expect((await t.client().get('/api/admin/users')).body.code).toBe('unauthenticated');
    const b = await t.register('bea@x.io');
    expect((await b.api.get('/api/admin/users')).body).toMatchObject({ code: 'admin_only', error: 'Solo administradores' });
    expect((await a.api.get('/api/workspaces/no-existe')).body.code).toBe('workspace_not_found');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    expect((await b.api.get(`/api/workspaces/${id}`)).body.code).toBe('no_access');
    const link = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const viewer = await t.client(link).post(`/api/workspaces/${id}/snapshots`, {});
    expect(viewer.status).toBe(403);
    expect(viewer.body).toMatchObject({ code: 'role_required', required: 'editor', role: 'viewer' });
    await t.close();
  });
});
