/**
 * El índice incremental de `query.ts` debe coincidir siempre con un recorrido completo del store,
 * tras cualquier secuencia de comandos (con deshacer/rehacer y cargas completas).
 */
import { describe, it, expect } from 'vitest';
import {
  MemoryStore, History, createIndex, indexOf, nodesOfView, edgesOfView, nodesOfElement, edgesOfRelation, viewsOfElement,
  exampleWorkspace, parseWorkspace, loadInto, makeElement, makeNode, makeRelation, makeEdge, makeView, type Store, type StoreIndex, type Command,
} from '@all-draw/core';

/** Generador determinista (LCG) para secuencias reproducibles sin dependencias. */
function rng(seed: number) { let s = seed >>> 0; return (n: number) => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s % n; }; }

const ids = (xs: { id: string }[]) => xs.map(x => x.id).sort();

function expectCoherent(store: Store, idx: StoreIndex) {
  const nodes = store.list('nodes'), edges = store.list('edges');
  for (const v of store.list('views')) {
    expect(ids(idx.nodesOfView(v.id))).toEqual(ids(nodes.filter(n => n.viewId === v.id)));
    expect(ids(idx.edgesOfView(v.id))).toEqual(ids(edges.filter(e => e.viewId === v.id)));
  }
  for (const e of store.list('elements')) {
    expect(ids(idx.nodesOfElement(e.id))).toEqual(ids(nodes.filter(n => n.elementId === e.id)));
    expect([...idx.viewIdsOfElement(e.id)].sort()).toEqual([...new Set(nodes.filter(n => n.elementId === e.id).map(n => n.viewId))].sort());
  }
  for (const r of store.list('relations')) expect(ids(idx.edgesOfRelation(r.id))).toEqual(ids(edges.filter(e => e.relationId === r.id)));
  // Vistas/ids que ya no existen no dejan restos
  expect(idx.nodesOfView('no-existe')).toEqual([]);
  // Los registros indexados son los actuales (identidad tras un set)
  for (const n of nodes) expect(idx.nodesOfView(n.viewId).find(x => x.id === n.id)).toBe(n);
}

function randomStep(store: Store, h: History, r: (n: number) => number) {
  const els = store.list('elements'), nodes = store.list('nodes'), views = store.list('views'), edges = store.list('edges');
  switch (r(9)) {
    case 0: { const v = views[r(views.length)]!; h.run({ type: 'addElementToView', element: makeElement('freeform:box', `E${r(100)}`), node: makeNode(v.id, undefined, { x: r(500), y: r(500) }) }); break; }
    case 1: { if (nodes.length < 2) break; const a = nodes[r(nodes.length)]!, b = nodes[r(nodes.length)]!; if (a.viewId !== b.viewId || !a.elementId || !b.elementId || a.id === b.id) break;
      h.run({ type: 'connect', relation: makeRelation('core:link', { elementId: a.elementId }, { elementId: b.elementId }), edge: makeEdge(a.viewId, undefined, a.id, b.id) }); break; }
    case 2: if (els.length) h.run({ type: 'deleteElement', id: els[r(els.length)]!.id }); break;
    case 3: if (nodes.length) h.run({ type: 'deleteNode', id: nodes[r(nodes.length)]!.id }); break;
    case 4: { // mover un nodo a otra vista (cambio de clave del índice). Se evita meter un nodo en su propia vista de detalle:
      // `deleteView` del core borraría el nodo y luego intentaría parchearle `detailViewId` (fallo conocido de commands.ts).
      if (!nodes.length) break; const n = nodes[r(nodes.length)]!; const v = views[r(views.length)]!;
      if (n.detailViewId) break;
      h.run({ type: 'patch', collection: 'nodes', id: n.id, patch: { viewId: v.id, x: r(100) } }); break; }
    case 5: { if (!nodes.length || !els.length) break; const n = nodes[r(nodes.length)]!; h.run({ type: 'patch', collection: 'nodes', id: n.id, patch: { elementId: els[r(els.length)]!.id } }); break; }
    case 6: { const v = makeView(`V${r(100)}`); h.run({ type: 'set', collection: 'views', id: v.id, value: v }); break; }
    case 7: if (views.length > 1) h.run({ type: 'deleteView', id: views[r(views.length)]!.id }); break;
    case 8: if (edges.length) h.run({ type: 'delete', collection: 'edges', id: edges[r(edges.length)]!.id }); break;
  }
}

describe('índice del store', () => {
  it('coincide con el recorrido completo tras secuencias aleatorias de comandos, deshacer y rehacer', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
      const h = new History(store);
      const idx = createIndex(store);
      const r = rng(seed);
      expectCoherent(store, idx);
      const steps = 10 + r(30);
      for (let i = 0; i < steps; i++) { randomStep(store, h, r); expectCoherent(store, idx); }
      const undos = r(steps);
      for (let i = 0; i < undos; i++) { h.undo(); expectCoherent(store, idx); }
      for (let i = 0; i < undos; i++) { h.redo(); expectCoherent(store, idx); }
      idx.dispose();
    }
  });
  it('version crece solo con cambios de nodos o aristas; dispose deja de escuchar', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const idx = createIndex(store);
    const v0 = idx.version;
    store.set('elements', 'e9', makeElement('freeform:box', 'x', { id: 'e9' }));
    expect(idx.version).toBe(v0);
    store.set('nodes', 'n9', makeNode('vw_1', 'e9', { x: 0, y: 0 }, { id: 'n9' }));
    expect(idx.version).toBe(v0 + 1);
    expect(idx.nodesOfElement('e9').map(n => n.id)).toEqual(['n9']);
    idx.dispose();
    store.delete('nodes', 'n9');
    expect(idx.nodesOfElement('e9').map(n => n.id)).toEqual(['n9']); // congelado
  });
  it('loadInto (carga completa) y "*" reconstruyen; indexOf comparte el índice por store y lo usan las consultas', () => {
    const store = new MemoryStore();
    const idx = indexOf(store);
    expect(indexOf(store)).toBe(idx);
    loadInto(store, parseWorkspace(exampleWorkspace()));
    expect(nodesOfView(store, 'vw_1').map(n => n.id).sort()).toEqual(['vn_1', 'vn_2']);
    expect(edgesOfView(store, 'vw_1').map(e => e.id)).toEqual(['ve_1']);
    expect(nodesOfElement(store, 'el_alta').map(n => n.id).sort()).toEqual(['vn_1', 'vn_3']);
    expect(edgesOfRelation(store, 'rel_1').map(e => e.id)).toEqual(['ve_1']);
    expect(viewsOfElement(store, 'el_alta').appearsIn.map(v => v.id)).toEqual(['vw_1']);
    const h = new History(store);
    const cmd: Command = { type: 'deleteView', id: 'vw_1' };
    h.run(cmd);
    expect(nodesOfView(store, 'vw_1')).toEqual([]);
    expect(edgesOfRelation(store, 'rel_1')).toEqual([]);
    h.undo();
    expect(nodesOfView(store, 'vw_1').map(n => n.id).sort()).toEqual(['vn_1', 'vn_2']);
    expectCoherent(store, idx);
  });
});
