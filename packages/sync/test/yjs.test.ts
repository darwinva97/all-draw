// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { execute, exampleWorkspace, loadInto, makeElement, makeComment, threadsOf, threadsOfView, openThreadCount, type StoreChange, type Workspace } from '@all-draw/core';
import { YjsStore, YjsHistory, toJsonFile, fromJsonFile, serializeDoc, loadUpdate, openLocalWorkspace, listLocalWorkspaces, deleteLocalWorkspace } from '../src';

/** JSON con claves ordenadas, para comparar snapshots sin depender del orden de inserción. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, (x as Record<string, unknown>)[k]])) : x);
}

describe('YjsStore cumple el contrato Store', () => {
  it('set/get/delete/list/ids/meta', () => {
    const s = new YjsStore();
    const a = makeElement('freeform:box', 'A'), b = makeElement('freeform:box', 'B');
    s.set('elements', a.id, a); s.set('elements', b.id, b);
    expect(s.get('elements', a.id)).toEqual(a);
    expect(s.list('elements')).toHaveLength(2);
    expect(s.ids('elements').sort()).toEqual([a.id, b.id].sort());
    s.delete('elements', a.id);
    expect(s.get('elements', a.id)).toBeUndefined();
    expect(s.list('elements').map(e => e.id)).toEqual([b.id]);
    expect(s.meta().name).toBe('Sin nombre'); // valor por defecto
    s.setMeta({ name: 'Hola', currentViewId: 'v1' });
    expect(s.meta()).toMatchObject({ name: 'Hola', currentViewId: 'v1' });
    s.setMeta({ currentViewId: undefined });
    expect(s.meta().currentViewId).toBeUndefined();
  });

  it('subscribe recibe un solo cambio por transact con los ids tocados', () => {
    const s = new YjsStore();
    const changes: StoreChange[] = [];
    s.subscribe(c => changes.push(c));
    const a = makeElement('freeform:box', 'A'), b = makeElement('freeform:box', 'B');
    s.transact(() => { s.set('elements', a.id, a); s.set('elements', b.id, b); s.delete('elements', a.id); }, 'local');
    expect(changes).toHaveLength(1);
    expect(changes[0]!.collection).toBe('elements');
    expect(changes[0]!.origin).toBe('local');
    expect([...changes[0]!.ids].sort()).toEqual([a.id, b.id].sort());
    // fuera de transact cada set es un cambio propio con origen 'local'
    s.set('elements', a.id, a);
    expect(changes).toHaveLength(2);
    expect(changes[1]).toMatchObject({ collection: 'elements', ids: [a.id], origin: 'local' });
    // la caché de list se invalida
    expect(s.list('elements')).toHaveLength(2);
  });

  it('snapshot devuelve un Workspace validado e independiente', () => {
    const s = new YjsStore();
    const ws = exampleWorkspace();
    loadInto(s, ws);
    const snap = s.snapshot();
    expect(stable(snap)).toBe(stable(ws));
    snap.elements['el_alta']!.name = 'mutado';
    expect(s.get('elements', 'el_alta')!.name).not.toBe('mutado');
  });
});

describe('execute + YjsHistory', () => {
  it('deleteElement y undo restaura el snapshot', () => {
    const s = new YjsStore();
    loadInto(s, exampleWorkspace()); // origen 'load': no entra en el historial
    const h = new YjsHistory(s);
    expect(h.canUndo).toBe(false);
    const before = stable(s.snapshot());
    h.run({ type: 'deleteElement', id: 'el_alta' });
    expect(s.get('elements', 'el_alta')).toBeUndefined();
    expect(s.list('nodes').some(n => n.elementId === 'el_alta')).toBe(false);
    expect(stable(s.snapshot())).not.toBe(before);
    expect(h.canUndo).toBe(true);
    expect(h.undo()).toBe(true);
    expect(stable(s.snapshot())).toBe(before);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toBe(true);
    expect(s.get('elements', 'el_alta')).toBeUndefined();
    h.undo();
    expect(stable(s.snapshot())).toBe(before);
  });

  it('cada run es un paso y el origen de undo/redo se propaga a subscribe', () => {
    const s = new YjsStore();
    const h = new YjsHistory(s);
    const origins: string[] = [];
    s.subscribe(c => origins.push(c.origin));
    const a = makeElement('freeform:box', 'A'), b = makeElement('freeform:box', 'B');
    h.run({ type: 'set', collection: 'elements', id: a.id, value: a });
    h.run({ type: 'set', collection: 'elements', id: b.id, value: b });
    h.undo();
    expect(s.ids('elements')).toEqual([a.id]);
    h.undo();
    expect(s.ids('elements')).toEqual([]);
    h.redo();
    expect(origins).toEqual(['local', 'local', 'undo', 'undo', 'redo']);
    // execute directo sin historial también funciona sobre YjsStore
    const inv = execute(s, { type: 'delete', collection: 'elements', id: a.id });
    expect(inv.type).toBe('set');
  });
});

describe('sincronización entre docs', () => {
  it('dos docs convergen tras cambios concurrentes en registros distintos', () => {
    const d1 = new Y.Doc(), d2 = new Y.Doc();
    const s1 = new YjsStore(d1), s2 = new YjsStore(d2);
    loadInto(s1, exampleWorkspace());
    Y.applyUpdate(d2, Y.encodeStateAsUpdate(d1));
    expect(stable(s2.snapshot())).toBe(stable(s1.snapshot()));

    const origins2: string[] = [];
    s2.subscribe(c => origins2.push(c.origin));
    const sv1 = Y.encodeStateVector(d1), sv2 = Y.encodeStateVector(d2);
    // Concurrente: s1 renombra el_alta; s2 crea un elemento nuevo y borra el_baja (si existe)
    s1.set('elements', 'el_alta', { ...s1.get('elements', 'el_alta')!, name: 'Alta v2' });
    const nuevo = makeElement('freeform:box', 'Nuevo');
    s2.set('elements', nuevo.id, nuevo);
    // Origen no-string (como hacen los proveedores): el store lo reporta como 'remote'
    const provider = {};
    Y.applyUpdate(d2, Y.encodeStateAsUpdate(d1, sv2), provider);
    Y.applyUpdate(d1, Y.encodeStateAsUpdate(d2, sv1), provider);

    expect(stable(s1.snapshot())).toBe(stable(s2.snapshot()));
    expect(s2.get('elements', 'el_alta')!.name).toBe('Alta v2');
    expect(s1.get('elements', nuevo.id)).toEqual(nuevo);
    expect(origins2).toContain('remote');
  });

  it('los comentarios convergen: hilo en un doc, respuesta y resolución en el otro, reanclaje al borrar', () => {
    const d1 = new Y.Doc(), d2 = new Y.Doc();
    const s1 = new YjsStore(d1), s2 = new YjsStore(d2);
    const sync = () => { Y.applyUpdate(d2, Y.encodeStateAsUpdate(d1, Y.encodeStateVector(d2))); Y.applyUpdate(d1, Y.encodeStateAsUpdate(d2, Y.encodeStateVector(d1))); };
    loadInto(s1, exampleWorkspace());
    sync();
    const root = makeComment({ kind: 'node', id: 'vn_1' }, { name: 'Ana' }, 'Revisar el alta');
    execute(s1, { type: 'set', collection: 'comments', id: root.id, value: root });
    sync();
    expect(threadsOfView(s2, 'vw_1').map(t => t.root.text)).toEqual(['Revisar el alta']);
    // Concurrente: s2 responde y resuelve; s1 añade un hilo en un punto
    const reply = makeComment(root.anchor, { name: 'Luis' }, 'Hecho', { threadId: root.id });
    execute(s2, { type: 'batch', commands: [
      { type: 'set', collection: 'comments', id: reply.id, value: reply },
      { type: 'patch', collection: 'comments', id: root.id, patch: { resolved: true, resolvedBy: 'Luis' } },
    ] });
    const pt = makeComment({ kind: 'point', viewId: 'vw_1', x: 5, y: 5 }, { name: 'Ana' }, 'Aquí falta algo');
    execute(s1, { type: 'set', collection: 'comments', id: pt.id, value: pt });
    sync();
    expect(stable(s1.snapshot())).toBe(stable(s2.snapshot()));
    expect(threadsOf(s1, { kind: 'node', id: 'vn_1' })[0]!.comments.map(c => c.text)).toEqual(['Revisar el alta', 'Hecho']);
    expect(openThreadCount(s1, 'vw_1')).toBe(1);
    // Borrar el nodo en s2 reancla el hilo en la vista, también en s1
    execute(s2, { type: 'deleteNode', id: 'vn_1' });
    sync();
    expect(s1.get('comments', root.id)!.anchor).toEqual({ kind: 'view', id: 'vw_1', viewId: 'vw_1' });
    expect(s1.snapshot().comments[reply.id]!.anchor.kind).toBe('view');
  });

  it('serializeDoc/loadUpdate reproduce el estado', () => {
    const s1 = new YjsStore(); loadInto(s1, exampleWorkspace());
    const s2 = new YjsStore(); loadUpdate(s2.doc, serializeDoc(s1.doc));
    expect(stable(s2.snapshot())).toBe(stable(s1.snapshot()));
  });
});

describe('fichero .alldraw', () => {
  it('toJsonFile/fromJsonFile ida y vuelta', () => {
    const s1 = new YjsStore(); loadInto(s1, exampleWorkspace());
    const text = toJsonFile(s1);
    const parsed: Workspace = JSON.parse(text);
    expect(parsed.meta.name).toBe('Ejemplo');
    const s2 = new YjsStore();
    s2.set('elements', 'basura', makeElement('freeform:box', 'basura'));
    fromJsonFile(s2, text);
    expect(s2.get('elements', 'basura')).toBeUndefined();
    expect(stable(s2.snapshot())).toBe(stable(s1.snapshot()));
    expect(toJsonFile(s2)).toBe(text);
  });
});

describe('local.ts con fake-indexeddb', () => {
  it('persiste, lista y borra', async () => {
    const w1 = await openLocalWorkspace('ws-test');
    await w1.whenSynced;
    loadInto(w1.store, exampleWorkspace());
    w1.store.setMeta({ updatedAt: '2026-01-01T00:00:00.000Z' });
    await new Promise(r => setTimeout(r, 50)); // deja que y-indexeddb escriba
    w1.destroy();

    const list = await listLocalWorkspaces();
    expect(list).toEqual([{ id: 'ws-test', name: 'Ejemplo', updatedAt: '2026-01-01T00:00:00.000Z' }]);

    const w2 = await openLocalWorkspace('ws-test');
    await w2.whenSynced;
    expect(w2.store.get('elements', 'el_alta')?.name).toBe('Proceso de alta');
    expect(w2.history.canUndo).toBe(false); // lo cargado de disco no es deshacible
    w2.destroy();

    await deleteLocalWorkspace('ws-test');
    expect(await listLocalWorkspaces()).toEqual([]);
    const w3 = await openLocalWorkspace('ws-test');
    await w3.whenSynced;
    expect(w3.store.ids('elements')).toEqual([]);
    w3.destroy();
  });
});
