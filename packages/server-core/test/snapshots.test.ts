/** Historial de versiones: instantáneas por API (memoria) y automáticas en `LiveDoc`. */
import { afterAll, describe, expect, it } from 'vitest';
import { exampleWorkspace, makeElement } from '@all-draw/core';
import { LiveDoc, MAX_SNAPSHOTS, workspaceFromUpdate } from '../src/docs';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { makeApi } from './helpers';

const api = makeApi();
afterAll(() => api.close());
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('instantáneas por API', () => {
  it('crear (editor+), listar (viewer+), leer JSON, restaurar (editor+, guarda automática antes), borrar (owner); permisos', async () => {
    const owner = await api.register('owner@example.com');
    const editor = await api.register('editor@example.com');
    const viewer = await api.register('viewer@example.com');
    const stranger = await api.register('stranger@example.com');
    const id = (await owner.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id as string;
    await owner.api.put(`/api/workspaces/${id}/members/${editor.user.id}`, { role: 'editor' });
    await owner.api.put(`/api/workspaces/${id}/members/${viewer.user.id}`, { role: 'viewer' });

    expect((await viewer.api.get(`/api/workspaces/${id}/snapshots`)).body.snapshots).toEqual([]);
    expect((await viewer.api.post(`/api/workspaces/${id}/snapshots`, { label: 'no' })).status).toBe(403);
    expect((await stranger.api.get(`/api/workspaces/${id}/snapshots`)).status).toBe(403);
    expect((await api.client().get(`/api/workspaces/${id}/snapshots`)).status).toBe(401);

    const s1 = await editor.api.post(`/api/workspaces/${id}/snapshots`, { label: 'v1' });
    expect(s1.status).toBe(201);
    expect(s1.body).toMatchObject({ workspaceId: id, label: 'v1', authorId: editor.user.id, author: { id: editor.user.id, name: 'editor' } });
    expect(s1.body.size).toBeGreaterThan(50);
    expect((await editor.api.post(`/api/workspaces/${id}/snapshots`, { label: '' })).status).toBe(400);

    // Cambiamos el doc y guardamos otra sin etiqueta
    const el = makeElement('freeform:box', 'Nuevo');
    await editor.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el.id, value: el }, { type: 'meta', patch: { name: 'Renombrado' } }] });
    await wait(5);
    const s2 = await owner.api.post(`/api/workspaces/${id}/snapshots`, {});
    expect(s2.body.label).toBeNull();
    const list = await viewer.api.get(`/api/workspaces/${id}/snapshots`);
    expect(list.body.snapshots.map((s: { id: string }) => s.id)).toEqual([s2.body.id, s1.body.id]);

    // JSON de la instantánea v1: sin el elemento nuevo
    const json = await viewer.api.get(`/api/workspaces/${id}/snapshots/${s1.body.id}`);
    expect(json.status).toBe(200);
    expect(json.body.meta.name).toBe('Ejemplo');
    expect(json.body.elements[el.id]).toBeUndefined();
    expect(Object.keys(json.body.elements)).toEqual(['el_alta', 'el_crm']);
    expect((await viewer.api.get(`/api/workspaces/${id}/snapshots/snp_nope`)).status).toBe(404);

    // Restaurar v1: el doc vivo vuelve atrás, se guarda una automática del estado previo y la meta del espacio se actualiza
    expect((await viewer.api.post(`/api/workspaces/${id}/snapshots/${s1.body.id}/restore`)).status).toBe(403);
    expect((await editor.api.post(`/api/workspaces/${id}/snapshots/snp_nope/restore`)).status).toBe(404);
    expect((await editor.api.post(`/api/workspaces/${id}/snapshots/${s1.body.id}/restore`)).status).toBe(200);
    const snap = await viewer.api.get(`/api/workspaces/${id}/snapshot`);
    expect(snap.body.meta.name).toBe('Ejemplo');
    expect(snap.body.elements[el.id]).toBeUndefined();
    expect((await viewer.api.get(`/api/workspaces/${id}`)).body.name).toBe('Ejemplo');
    const after = await viewer.api.get(`/api/workspaces/${id}/snapshots`);
    expect(after.body.snapshots).toHaveLength(3);
    expect(after.body.snapshots[0]).toMatchObject({ label: null, authorId: editor.user.id });
    const pre = await viewer.api.get(`/api/workspaces/${id}/snapshots/${after.body.snapshots[0].id}`);
    expect(pre.body.elements[el.id]).toBeDefined(); // la automática guardó el estado anterior a restaurar
    expect(pre.body.meta.name).toBe('Renombrado');

    // Borrar: sólo owner
    expect((await editor.api.del(`/api/workspaces/${id}/snapshots/${s1.body.id}`)).status).toBe(403);
    expect((await owner.api.del(`/api/workspaces/${id}/snapshots/snp_nope`)).status).toBe(404);
    expect((await owner.api.del(`/api/workspaces/${id}/snapshots/${s1.body.id}`)).status).toBe(204);
    expect((await viewer.api.get(`/api/workspaces/${id}/snapshots`)).body.snapshots).toHaveLength(2);
    // Un enlace de edición puede crear (autor null)
    const link = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const byLink = await api.client(link).post(`/api/workspaces/${id}/snapshots`, { label: 'desde enlace' });
    expect(byLink.status).toBe(201);
    expect(byLink.body.authorId).toBeNull();
    // Al borrar el espacio se van sus instantáneas
    await owner.api.del(`/api/workspaces/${id}`);
    expect(await api.store.listSnapshots(id)).toEqual([]);
  });

  it('poda: al pasar de 100 se borran las automáticas más antiguas; las etiquetadas se quedan', async () => {
    const u = await api.register('prune@example.com');
    const id = (await u.api.post('/api/workspaces', { name: 'P' })).body.id as string;
    const labelled = (await u.api.post(`/api/workspaces/${id}/snapshots`, { label: 'fija' })).body.id as string;
    for (let i = 0; i < MAX_SNAPSHOTS + 5; i++) await api.store.createSnapshot({ workspaceId: id, authorId: null, label: null, data: new Uint8Array([i]) });
    expect((await api.store.listSnapshots(id)).length).toBe(MAX_SNAPSHOTS + 6);
    await u.api.post(`/api/workspaces/${id}/snapshots`, {}); // dispara la poda
    const list = (await u.api.get(`/api/workspaces/${id}/snapshots`)).body.snapshots as { id: string; label: string | null }[];
    expect(list).toHaveLength(MAX_SNAPSHOTS);
    expect(list.some(s => s.id === labelled)).toBe(true); // la etiquetada sobrevive aunque sea la más antigua
    expect(list.filter(s => s.label === null)).toHaveLength(MAX_SNAPSHOTS - 1);
  });
});

describe('LiveDoc: instantánea automática por actividad', () => {
  it('con cambios tras el intervalo se guarda una automática; no al cargar; restaurar conserva el doc vivo', async () => {
    const store = new MemoryWorkspaceStore();
    const w = await store.createWorkspace({ ownerId: 'u', name: 'A' });
    const live = new LiveDoc(w.id, store, () => {}, 10, 300);
    await live.load();
    live.store.setMeta({ name: 'A', createdAt: new Date().toISOString(), schemaVersion: 1 });
    expect(await store.listSnapshots(w.id)).toEqual([]); // acaba de cargarse: aún no toca
    await wait(350);
    const el = makeElement('freeform:box', 'Uno');
    live.store.set('elements', el.id, el);
    await wait(20);
    const snaps = await store.listSnapshots(w.id);
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ label: null, authorId: null });
    const ws = workspaceFromUpdate((await store.getSnapshot(w.id, snaps[0]!.id))!.data);
    expect(ws.elements[el.id]?.name).toBe('Uno');
    // Cambios seguidos no crean más
    live.store.set('elements', el.id, { ...el, name: 'Dos' });
    await wait(5);
    expect(await store.listSnapshots(w.id)).toHaveLength(1);
    // Restaurar sobre el doc vivo: mismo Y.Doc, conserva clientID/historial, y guarda una automática antes
    const before = live.doc.clientID;
    const restored = await live.restoreSnapshot(snaps[0]!.id, 'u');
    expect(restored?.elements[el.id]?.name).toBe('Uno');
    expect(live.store.get('elements', el.id)?.name).toBe('Uno');
    expect(live.doc.clientID).toBe(before);
    expect(await store.listSnapshots(w.id)).toHaveLength(2);
    expect(await live.restoreSnapshot('snp_nope', null)).toBeNull();
    // Recarga desde otro doc: no crea instantánea (origen 'load')
    const live2 = new LiveDoc(w.id, store, () => {}, 10, 0);
    await live.flush();
    await live2.load();
    await wait(10);
    expect(await store.listSnapshots(w.id)).toHaveLength(2);
    await live.destroy(); await live2.destroy();
  });
});
