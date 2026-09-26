import { afterAll, describe, expect, it } from 'vitest';
import { exampleWorkspace, makeElement } from '@all-draw/core';
import { hashPassword, registerPasswordScheme } from '../src/auth';
import { makeApi } from './helpers';

const api = makeApi();
afterAll(() => api.close());

describe('API compartida (sin servidor Node)', () => {
  it('registro: el primero es admin; login; me; logout; registro cerrado', async () => {
    const a = await api.register('ana@example.com');
    expect(a.user.isAdmin).toBe(true);
    const b = await api.register('bea@example.com');
    expect(b.user.isAdmin).toBe(false);
    expect((await api.client().post('/api/auth/login', { email: 'ana@example.com', password: 'mal' })).status).toBe(401);
    const ok = await api.client().post('/api/auth/login', { email: 'ana@example.com', password: 'contraseña-larga' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('set-cookie')).toContain('alldraw_session=');
    expect((await api.client(ok.body.token).get('/api/auth/me')).body.user.email).toBe('ana@example.com');
    expect((await api.client(ok.body.token).post('/api/auth/logout')).status).toBe(204);
    expect((await api.client(ok.body.token).get('/api/auth/me')).status).toBe(401);
    const closed = makeApi({ allowRegistration: false });
    expect((await closed.client().post('/api/auth/register', { email: 'x@example.com', name: 'x', password: 'contraseña-larga' })).status).toBe(201); // el primero siempre puede
    expect((await closed.client().post('/api/auth/register', { email: 'y@example.com', name: 'y', password: 'contraseña-larga' })).status).toBe(403);
    await closed.close();
  });

  it('login con hash scrypt heredado → se verifica con el esquema registrado y se migra a pbkdf2', async () => {
    registerPasswordScheme('scrypt', async (pw, stored) => stored === 'scrypt$sal$hash' && pw === 'vieja-contraseña');
    const u = await api.store.createUser({ email: 'vieja@example.com', name: 'V', passwordHash: 'scrypt$sal$hash' });
    expect((await api.client().post('/api/auth/login', { email: 'vieja@example.com', password: 'otra' })).status).toBe(401);
    expect((await api.client().post('/api/auth/login', { email: 'vieja@example.com', password: 'vieja-contraseña' })).status).toBe(200);
    expect((await api.store.getUser(u.id))!.passwordHash).toMatch(/^pbkdf2\$/);
    expect((await api.client().post('/api/auth/login', { email: 'vieja@example.com', password: 'vieja-contraseña' })).status).toBe(200);
  });

  it('API keys y espacios con permisos', async () => {
    const owner = await api.register('owner@example.com');
    const editor = await api.register('editor@example.com');
    const viewer = await api.register('viewer@example.com');
    const stranger = await api.register('stranger@example.com');
    const key = await owner.api.post('/api/keys', { name: 'agente' });
    expect(key.status).toBe(201);
    expect((await api.client(key.body.key).get('/api/auth/me')).body.via).toBe('apikey');
    expect((await api.client(key.body.key).post('/api/keys', { name: 'no' })).status).toBe(403);

    const w = await owner.api.post('/api/workspaces', { initial: exampleWorkspace() });
    expect(w.status).toBe(201);
    const id = w.body.id as string;
    expect((await owner.api.put(`/api/workspaces/${id}/members/${editor.user.id}`, { role: 'editor' })).status).toBe(200);
    expect((await owner.api.put(`/api/workspaces/${id}/members/${viewer.user.id}`, { role: 'viewer' })).status).toBe(200);
    expect((await stranger.api.get(`/api/workspaces/${id}`)).status).toBe(403);
    expect((await api.client().get(`/api/workspaces/${id}`)).status).toBe(401);
    expect((await viewer.api.get(`/api/workspaces/${id}`)).body.role).toBe('viewer');
    expect((await viewer.api.get(`/api/workspaces/${id}/snapshot`)).body.meta.name).toBe('Ejemplo');
    expect((await viewer.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'meta', patch: { description: 'no' } }] })).status).toBe(403);
    expect((await editor.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'meta', patch: { description: 'sí' } }] })).status).toBe(200);
    expect((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.meta.description).toBe('sí');
    expect((await editor.api.patch(`/api/workspaces/${id}`, { ownerId: editor.user.id })).status).toBe(403);
    expect((await editor.api.get(`/api/workspaces/${id}/members`)).body.members.length).toBe(2);
    // El admin (ana) ve todo
    const admin = api.client((await api.client().post('/api/auth/login', { email: 'ana@example.com', password: 'contraseña-larga' })).body.token);
    expect((await admin.get(`/api/workspaces/${id}`)).body.role).toBe('owner');

    // Enlaces
    const link = await owner.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' });
    expect(link.status).toBe(201);
    expect(link.body.url).toContain(`/#/s/${id}?token=lnk_`);
    const viaLink = api.client(link.body.token);
    expect((await viaLink.get(`/api/workspaces/${id}/validate`)).status).toBe(200);
    expect((await viaLink.get('/api/workspaces')).status).toBe(403);
    expect((await viaLink.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'meta', patch: { description: 'x' } }] })).status).toBe(403);
    expect((await owner.api.del(`/api/workspaces/${id}/links/${link.body.token}`)).status).toBe(204);
    expect((await viaLink.get(`/api/workspaces/${id}`)).status).toBe(401);

    // SVG
    const views = Object.keys((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.views);
    const svg = await api.app.request(`/api/workspaces/${id}/views/${views[0]}/svg`, { headers: { authorization: `Bearer ${owner.token}` } });
    expect(svg.status).toBe(200);
    expect(await svg.text()).toContain('<svg');
    expect((await owner.api.get(`/api/workspaces/${id}/views/v_nope/svg`)).status).toBe(404);

    // Borrar
    expect((await editor.api.del(`/api/workspaces/${id}`)).status).toBe(403);
    expect((await owner.api.del(`/api/workspaces/${id}`)).status).toBe(204);
    expect((await owner.api.get(`/api/workspaces/${id}`)).status).toBe(404);
  });

  it('comandos: set normaliza, 400 de forma, 422 no aplicable (atómico)', async () => {
    const u = await api.register('cmd@example.com');
    const id = (await u.api.post('/api/workspaces', { name: 'C' })).body.id;
    const el = makeElement('freeform:box', 'Caja');
    const ok = await u.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el.id, value: el }] });
    expect(ok.status).toBe(200);
    expect(ok.body.applied).toBe(1);
    expect(ok.body.inverse.type).toBe('delete');
    const bad = await u.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: 'el_x', value: { id: 'el_otro' } }] });
    expect(bad.status).toBe(400);
    const el2 = makeElement('freeform:box', 'Dos');
    const partial = await u.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el2.id, value: el2 }, { type: 'patch', collection: 'elements', id: 'el_no_existe', patch: { name: 'x' } }] });
    expect(partial.status).toBe(422);
    expect(Object.keys((await u.api.get(`/api/workspaces/${id}/snapshot`)).body.elements)).toEqual([el.id]);
    expect((await u.api.get(`/api/workspaces/${id}/validate`)).body.summary).toMatchObject({ error: 0 });
    expect((await u.api.get('/api/openapi.json')).body.openapi).toBe('3.1.0');
    expect((await u.api.get('/api/notations')).body.packs.length).toBeGreaterThan(5);
    expect(typeof (await hashPassword('x'))).toBe('string');
  });
});
