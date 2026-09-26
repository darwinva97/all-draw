import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exampleWorkspace, makeElement, makeNode, makeView, type Command } from '@all-draw/core';
import { client, register, startServer, type TestServer } from './helpers';

let s: TestServer;
let owner: Awaited<ReturnType<typeof register>>, editor: typeof owner, viewer: typeof owner, stranger: typeof owner;
let wsId: string;
beforeAll(async () => {
  s = await startServer();
  owner = await register(s.url, 'owner@example.com');
  editor = await register(s.url, 'editor@example.com');
  viewer = await register(s.url, 'viewer@example.com');
  stranger = await register(s.url, 'stranger@example.com');
});
afterAll(() => s.close());

describe('espacios y permisos', () => {
  it('crear espacio vacío y con initial', async () => {
    const r = await owner.api.post('/api/workspaces', { name: 'Mi espacio' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: 'Mi espacio', role: 'owner' });
    wsId = r.body.id;
    const snap = await owner.api.get(`/api/workspaces/${wsId}/snapshot`);
    expect(snap.status).toBe(200);
    expect(snap.body.meta.name).toBe('Mi espacio');
    expect(snap.body.elements).toEqual({});

    const r2 = await owner.api.post('/api/workspaces', { initial: exampleWorkspace() });
    expect(r2.status).toBe(201);
    expect(r2.body.name).toBe('Ejemplo');
    const snap2 = await owner.api.get(`/api/workspaces/${r2.body.id}/snapshot`);
    expect(Object.keys(snap2.body.elements)).toEqual(['el_alta', 'el_crm']);
    expect((await owner.api.post('/api/workspaces', { initial: { elements: 'no' } })).status).toBe(400);
  });

  it('lista: míos y compartidos con rol; desconocidos no ven nada', async () => {
    expect((await owner.api.put(`/api/workspaces/${wsId}/members/${editor.user.id}`, { role: 'editor' })).status).toBe(200);
    expect((await owner.api.put(`/api/workspaces/${wsId}/members/${viewer.user.id}`, { role: 'viewer' })).status).toBe(200);
    expect((await owner.api.put(`/api/workspaces/${wsId}/members/usr_inexistente`, { role: 'viewer' })).status).toBe(404);
    expect((await owner.api.get('/api/workspaces')).body.workspaces.map((w: { role: string }) => w.role)).toEqual(['owner', 'owner']);
    const e = await editor.api.get('/api/workspaces');
    expect(e.body.workspaces).toHaveLength(1);
    expect(e.body.workspaces[0]).toMatchObject({ id: wsId, role: 'editor' });
    expect((await viewer.api.get(`/api/workspaces/${wsId}`)).body.role).toBe('viewer');
    expect((await stranger.api.get(`/api/workspaces/${wsId}`)).status).toBe(403);
    expect((await client(s.url).get(`/api/workspaces/${wsId}`)).status).toBe(401);
    expect((await owner.api.get('/api/workspaces/ws_nope')).status).toBe(404);
    const members = await viewer.api.get(`/api/workspaces/${wsId}/members`);
    expect(members.body.ownerId).toBe(owner.user.id);
    expect(members.body.members.map((m: { role: string }) => m.role).sort()).toEqual(['editor', 'viewer']);
  });

  it('viewer no puede PATCH, commands ni snapshot PUT; editor sí; sólo owner gestiona miembros/enlaces/borrado', async () => {
    const cmd: Command = { type: 'meta', patch: { description: 'hola' } };
    expect((await viewer.api.patch(`/api/workspaces/${wsId}`, { name: 'x' })).status).toBe(403);
    expect((await viewer.api.post(`/api/workspaces/${wsId}/commands`, { commands: [cmd] })).status).toBe(403);
    expect((await viewer.api.put(`/api/workspaces/${wsId}/snapshot`, exampleWorkspace())).status).toBe(403);
    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [cmd] })).status).toBe(200);
    expect((await editor.api.patch(`/api/workspaces/${wsId}`, { name: 'Renombrado' })).status).toBe(200);
    expect((await editor.api.patch(`/api/workspaces/${wsId}`, { ownerId: editor.user.id })).status).toBe(403);
    expect((await editor.api.put(`/api/workspaces/${wsId}/members/${stranger.user.id}`, { role: 'viewer' })).status).toBe(403);
    expect((await editor.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer' })).status).toBe(403);
    expect((await editor.api.del(`/api/workspaces/${wsId}`)).status).toBe(403);
    expect((await owner.api.get(`/api/workspaces/${wsId}`)).body.name).toBe('Renombrado');
    expect((await owner.api.get(`/api/workspaces/${wsId}/snapshot`)).body.meta).toMatchObject({ name: 'Renombrado', description: 'hola' });
  });

  it('commands aplica (alto nivel) y snapshot lo refleja; inválido → 400; no aplicable → 422 sin efectos', async () => {
    const view = makeView('Proceso', { notationId: 'bpmn' });
    const task = makeElement('bpmn:Task', 'Revisar pedido');
    const node = makeNode(view.id, undefined, { x: 10, y: 20 });
    const { elementId: _e, ...nodeNoEl } = node;
    const commands: Command[] = [
      { type: 'set', collection: 'views', id: view.id, value: view },
      { type: 'addElementToView', element: task, node: nodeNoEl },
    ];
    const r = await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands, label: 'crear tarea' });
    expect(r.status).toBe(200);
    expect(r.body.applied).toBe(2);
    expect(r.body.inverse.type).toBe('batch');
    const snap = await viewer.api.get(`/api/workspaces/${wsId}/snapshot`);
    expect(snap.body.elements[task.id]).toMatchObject({ name: 'Revisar pedido', typeId: 'bpmn:Task' });
    expect(snap.body.nodes[node.id]).toMatchObject({ elementId: task.id, viewId: view.id, x: 10 });

    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'explode' }] })).status).toBe(400);
    // `set` valida el registro contra el esquema de la colección y rellena valores por defecto
    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'set', collection: 'nodes', id: 'vn_bad', value: { id: 'vn_bad' } }] })).status).toBe(400);
    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'set', collection: 'views', id: 'vw_a', value: { id: 'vw_b', name: 'x' } }] })).status).toBe(400);
    await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'set', collection: 'nodes', id: 'vn_min', value: { id: 'vn_min', viewId: view.id, elementId: task.id } }] });
    expect((await viewer.api.get(`/api/workspaces/${wsId}/snapshot`)).body.nodes['vn_min']).toMatchObject({ style: {}, w: 160, h: 56 });
    await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'deleteNode', id: 'vn_min' }] });
    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [] })).status).toBe(400);
    const bad = await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [
      { type: 'patch', collection: 'elements', id: task.id, patch: { name: 'Cambiado' } },
      { type: 'patch', collection: 'elements', id: 'no_existe', patch: { name: 'x' } },
    ] });
    expect(bad.status).toBe(422);
    expect((await viewer.api.get(`/api/workspaces/${wsId}/snapshot`)).body.elements[task.id].name).toBe('Revisar pedido');

    // Deshacer con el inverso devuelto
    expect((await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [r.body.inverse] })).status).toBe(200);
    expect((await viewer.api.get(`/api/workspaces/${wsId}/snapshot`)).body.elements[task.id]).toBeUndefined();
  });

  it('validate devuelve diagnósticos; snapshot PUT reemplaza', async () => {
    expect((await editor.api.put(`/api/workspaces/${wsId}/snapshot`, exampleWorkspace())).status).toBe(200);
    const v = await viewer.api.get(`/api/workspaces/${wsId}/validate`);
    expect(v.status).toBe(200);
    expect(Array.isArray(v.body.diagnostics)).toBe(true);
    expect(v.body.summary).toHaveProperty('error');
    // relación inválida en BPMN (flujo de secuencia desde un objeto de datos) → error
    const a = makeElement('bpmn:DataObject', 'A'), b = makeElement('bpmn:Task', 'B');
    const rel = { id: 'rel_x', typeId: 'bpmn:SequenceFlow', name: '', doc: '', from: { elementId: a.id }, to: { elementId: b.id }, mappings: [], fields: {}, props: {}, features: {} };
    await editor.api.post(`/api/workspaces/${wsId}/commands`, { commands: [
      { type: 'set', collection: 'elements', id: a.id, value: a }, { type: 'set', collection: 'elements', id: b.id, value: b },
      { type: 'set', collection: 'relations', id: rel.id, value: rel },
    ] });
    const v2 = await viewer.api.get(`/api/workspaces/${wsId}/validate`);
    expect(v2.body.diagnostics.some((d: { code: string; subject: { id: string } }) => d.code === 'invalid-relation' && d.subject.id === 'rel_x')).toBe(true);
  });

  it('svg de una vista (render de @all-draw/io); vista inexistente → 404', async () => {
    const r = await fetch(`${s.url}/api/workspaces/${wsId}/views/vw_1/svg?theme=dark`, { headers: { authorization: `Bearer ${viewer.token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('image/svg+xml');
    const svg = await r.text();
    expect(svg).toContain('<svg');
    expect(svg).toContain('Proceso de alta');
    expect((await viewer.api.get(`/api/workspaces/${wsId}/views/vw_nope/svg`)).status).toBe(404);
    expect((await stranger.api.get(`/api/workspaces/${wsId}/views/vw_1/svg`)).status).toBe(403);
  });

  it('enlaces compartidos: crear, usar como Bearer con rol, listar, revocar', async () => {
    const l = await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer' });
    expect(l.status).toBe(201);
    expect(l.body.token).toMatch(/^lnk_/);
    expect(l.body.url).toContain(`#/s/${wsId}?token=lnk_`);
    const viaLink = client(s.url, l.body.token);
    expect((await viaLink.get(`/api/workspaces/${wsId}`)).body.role).toBe('viewer');
    expect((await viaLink.get(`/api/workspaces/${wsId}/snapshot`)).status).toBe(200);
    expect((await viaLink.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'meta', patch: { x: 1 } }] })).status).toBe(403);
    expect((await viaLink.get('/api/workspaces')).status).toBe(403);
    const le = await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'editor' });
    expect((await client(s.url, le.body.token).post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'meta', patch: { description: 'por enlace' } }] })).status).toBe(200);
    expect((await owner.api.get(`/api/workspaces/${wsId}/links`)).body.links).toHaveLength(2);
    expect((await owner.api.del(`/api/workspaces/${wsId}/links/${l.body.token}`)).status).toBe(204);
    expect((await viaLink.get(`/api/workspaces/${wsId}`)).status).toBe(401);
    // Enlace caducado no vale
    const old = await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect((await client(s.url, old.body.token).get(`/api/workspaces/${wsId}`)).status).toBe(401);
  });

  it('admin (primer usuario) ve todo; owner borra; quitar miembro', async () => {
    const admin = await client(s.url).post('/api/auth/login', { email: 'owner@example.com', password: 'contraseña-larga' });
    expect(admin.body.user.isAdmin).toBe(true);
    const other = await editor.api.post('/api/workspaces', { name: 'Del editor' });
    expect((await owner.api.get(`/api/workspaces/${other.body.id}`)).body.role).toBe('owner'); // admin
    expect((await stranger.api.get(`/api/workspaces/${other.body.id}`)).status).toBe(403);
    expect((await owner.api.del(`/api/workspaces/${wsId}/members/${viewer.user.id}`)).status).toBe(204);
    expect((await viewer.api.get(`/api/workspaces/${wsId}`)).status).toBe(403);
    expect((await editor.api.del(`/api/workspaces/${other.body.id}`)).status).toBe(204);
    expect((await editor.api.get(`/api/workspaces/${other.body.id}`)).status).toBe(404);
  });

  it('notations y openapi.json', async () => {
    const n = await client(s.url).get('/api/notations');
    expect(n.status).toBe(200);
    const ids = n.body.packs.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['core', 'bpmn', 'archimate', 'c4', 'statechart', 'freeform', 'grid']));
    expect(n.body.packs.find((p: { id: string }) => p.id === 'bpmn').elementTypes.some((t: { id: string }) => t.id === 'bpmn:Task')).toBe(true);

    const o = await client(s.url).get('/api/openapi.json');
    expect(o.status).toBe(200);
    expect(o.body.openapi).toBe('3.1.0');
    expect(o.body.info.title).toContain('all-draw');
    for (const p of ['/api/auth/login', '/api/workspaces', '/api/workspaces/{id}/commands', '/api/workspaces/{id}/snapshot', '/api/workspaces/{id}/links', '/api/notations']) expect(o.body.paths).toHaveProperty(p);
    expect(o.body.components.schemas).toHaveProperty('Command');
    expect(o.body.components.securitySchemes).toHaveProperty('bearerAuth');
    expect((await client(s.url).get('/healthz')).status).toBe(200);
  });
});

describe('ejemplo de SKILL.md', () => {
  it('el lote de examples/bpmn-archimate-trazas.json se aplica sin errores de validación', async () => {
    const { readFileSync } = await import('node:fs');
    const example = JSON.parse(readFileSync(new URL('../examples/bpmn-archimate-trazas.json', import.meta.url), 'utf8'));
    const w = await owner.api.post('/api/workspaces', { name: 'Skill' });
    const r = await owner.api.post(`/api/workspaces/${w.body.id}/commands`, example);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const v = await owner.api.get(`/api/workspaces/${w.body.id}/validate`);
    expect(v.body.diagnostics.filter((d: { severity: string }) => d.severity === 'error'), JSON.stringify(v.body.diagnostics.filter((d: { severity: string }) => d.severity === 'error'))).toEqual([]);
    const snap = await owner.api.get(`/api/workspaces/${w.body.id}/snapshot`);
    expect(Object.keys(snap.body.views)).toHaveLength(3);
    expect(snap.body.nodes['vn_t_pool'].elementId).toBe('el_pool');
    expect(snap.body.meta.name).toBe('Alta de cliente');
    for (const vw of ['vw_bpmn', 'vw_arch', 'vw_trace']) expect((await owner.api.get(`/api/workspaces/${w.body.id}/views/${vw}/svg`)).status).toBe(200);
  });
});
