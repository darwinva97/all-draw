import { describe, it, expect } from 'vitest';
import {
  MemoryStore, NotationRegistry, CORE_PACK, exampleWorkspace, parseWorkspace, execute, makeElement, makeView, makeNode, makeRelation, makeEdge,
  type NotationPack, type Command, type ViewNode,
} from '@all-draw/core';
import { layoutView, layoutSequence, autoLayoutDefaults, createLayoutEngine, containerPadding } from '../src';
import ELK from 'elkjs/lib/elk.bundled.js';

const PACK: NotationPack = {
  id: 'freeform', name: 'Libre', categories: [], portTypes: [], viewpoints: [],
  elementTypes: [
    { id: 'freeform:box', name: 'Caja', shape: 'rounded', fields: [{ key: 'api', label: 'API', kind: 'json' }] },
    { id: 'freeform:group', name: 'Grupo', shape: 'group', container: true, fields: [] },
    { id: 'freeform:pool', name: 'Pool', shape: 'pool', container: true, fields: [] },
  ],
  relationTypes: [{ id: 'freeform:arrow', name: 'Flecha', fields: [] }],
};
const reg = () => new NotationRegistry().register(CORE_PACK).register(PACK);

function rectsOverlap(a: ViewNode, b: ViewNode) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

describe('autoLayoutDefaults', () => {
  it('elige algoritmo y dirección por notación', () => {
    expect(autoLayoutDefaults('archimate')).toEqual({ algorithm: 'layered', direction: 'DOWN' });
    expect(autoLayoutDefaults('c4')).toEqual({ algorithm: 'layered', direction: 'DOWN' });
    expect(autoLayoutDefaults('bpmn')).toEqual({ algorithm: 'layered', direction: 'RIGHT' });
    expect(autoLayoutDefaults('statechart')).toEqual({ algorithm: 'layered', direction: 'RIGHT' });
    expect(autoLayoutDefaults('freeform').algorithm).toBe('stress');
    expect(containerPadding('pool').left).toBeGreaterThan(containerPadding('group').left);
  });
});

describe('layoutView con el exampleWorkspace', () => {
  it('devuelve un batch "layout" de moveNodes con posiciones enteras y sin solapes', async () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const cmd = await layoutView(store, reg(), 'vw_1', { algorithm: 'layered', direction: 'RIGHT' });
    expect(cmd.type).toBe('batch');
    if (cmd.type !== 'batch') return;
    expect(cmd.label).toBe('layout');
    const moves = cmd.commands.filter(c => c.type === 'moveNodes').flatMap(c => (c.type === 'moveNodes' ? c.moves : []));
    for (const m of moves) { expect(Number.isInteger(m.x)).toBe(true); expect(Number.isInteger(m.y)).toBe(true); expect(m.parentNodeId).toBeUndefined(); }
    execute(store, cmd);
    const a = store.get('nodes', 'vn_1')!, b = store.get('nodes', 'vn_2')!;
    expect(rectsOverlap(a, b)).toBe(false);
    // Con dirección RIGHT el origen queda a la izquierda del destino
    expect(a.x + a.w).toBeLessThanOrEqual(b.x);
    // No toca los nodos de otras vistas
    expect(store.get('nodes', 'vn_3')).toEqual(parseWorkspace(exampleWorkspace()).nodes['vn_3']);
  });

  it('DOWN coloca el origen encima del destino', async () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    execute(store, await layoutView(store, reg(), 'vw_1', { algorithm: 'layered', direction: 'DOWN' }));
    const a = store.get('nodes', 'vn_1')!, b = store.get('nodes', 'vn_2')!;
    expect(a.y + a.h).toBeLessThanOrEqual(b.y);
  });

  it('funciona con stress, mrtree y force', async () => {
    for (const algorithm of ['stress', 'mrtree', 'force'] as const) {
      const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
      execute(store, await layoutView(store, reg(), 'vw_1', { algorithm }));
      const a = store.get('nodes', 'vn_1')!, b = store.get('nodes', 'vn_2')!;
      expect(rectsOverlap(a, b)).toBe(false);
    }
  });
});

function hierarchical() {
  const store = new MemoryStore();
  const view = makeView('Jerárquica', { id: 'v', notationId: 'freeform' });
  store.set('views', view.id, view);
  const mk = (id: string, typeId: string, name: string, pos: { x: number; y: number; w?: number; h?: number }, extra: Partial<ViewNode> = {}) => {
    const el = makeElement(typeId, name, { id: `el_${id}` });
    store.set('elements', el.id, el);
    const n = makeNode('v', el.id, pos, { id, ...extra });
    store.set('nodes', n.id, n);
    return n;
  };
  mk('pool', 'freeform:pool', 'Pool', { x: 0, y: 0, w: 100, h: 100 });
  mk('a', 'freeform:box', 'A', { x: 10, y: 10 }, { parentNodeId: 'pool' });
  mk('b', 'freeform:box', 'B', { x: 10, y: 10 }, { parentNodeId: 'pool' });
  mk('c', 'freeform:box', 'C', { x: 10, y: 10 }, { parentNodeId: 'pool' });
  mk('out', 'freeform:box', 'Fuera', { x: 500, y: 500 });
  const link = (id: string, from: string, to: string, extra: Partial<ReturnType<typeof makeEdge>> = {}) => {
    const rel = makeRelation('freeform:arrow', { elementId: `el_${from}` }, { elementId: `el_${to}` }, { id: `rel_${id}` });
    store.set('relations', rel.id, rel);
    const e = makeEdge('v', rel.id, from, to, { id, ...extra });
    store.set('edges', e.id, e);
  };
  link('e1', 'a', 'b');
  link('e2', 'b', 'c');
  link('e3', 'c', 'out');
  return store;
}

describe('layoutView jerárquico', () => {
  it('coloca los hijos dentro del contenedor, con padding de cabecera, y lo redimensiona', async () => {
    const store = hierarchical();
    const cmd = await layoutView(store, reg(), 'v', { algorithm: 'layered', direction: 'DOWN', spacing: 30 });
    expect(cmd.type).toBe('batch');
    const patches = (cmd as { commands: Command[] }).commands.filter(c => c.type === 'patch');
    expect(patches.some(p => p.type === 'patch' && p.id === 'pool')).toBe(true);
    execute(store, cmd);
    const pool = store.get('nodes', 'pool')!;
    const pad = containerPadding('pool');
    const kids = ['a', 'b', 'c'].map(id => store.get('nodes', id)!);
    for (const k of kids) {
      expect(k.parentNodeId).toBe('pool');
      expect(k.x).toBeGreaterThanOrEqual(pad.left);
      expect(k.y).toBeGreaterThanOrEqual(pad.top);
      expect(k.x + k.w).toBeLessThanOrEqual(pool.w);
      expect(k.y + k.h).toBeLessThanOrEqual(pool.h);
    }
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) expect(rectsOverlap(kids[i]!, kids[j]!)).toBe(false);
    // a → b → c en vertical
    expect(kids[0]!.y + kids[0]!.h).toBeLessThanOrEqual(kids[1]!.y);
    expect(kids[1]!.y + kids[1]!.h).toBeLessThanOrEqual(kids[2]!.y);
    // El nodo exterior no se solapa con la pool
    expect(rectsOverlap(pool, store.get('nodes', 'out')!)).toBe(false);
  });

  it('layoutSequence = layered RIGHT', async () => {
    const store = hierarchical();
    execute(store, await layoutSequence(store, 'v', reg()));
    const a = store.get('nodes', 'a')!, b = store.get('nodes', 'b')!, c = store.get('nodes', 'c')!;
    expect(a.x + a.w).toBeLessThanOrEqual(b.x);
    expect(b.x + b.w).toBeLessThanOrEqual(c.x);
  });

  it('aristas por puerto crean puertos ELK sin romper el resultado', async () => {
    const store = hierarchical();
    const e = store.get('edges', 'e1')!;
    store.set('edges', 'e1', { ...e, fromPortId: 'el_a#api.x', toPortId: 'el_b#api.y' });
    const cmd = await layoutView(store, reg(), 'v', { algorithm: 'layered', direction: 'RIGHT' });
    execute(store, cmd);
    const a = store.get('nodes', 'a')!, b = store.get('nodes', 'b')!;
    expect(rectsOverlap(a, b)).toBe(false);
    expect(a.x + a.w).toBeLessThanOrEqual(b.x);
  });
});

describe('layoutView en rejilla', () => {
  it('hace layout por celda y conserva `cell`', async () => {
    const store = new MemoryStore();
    const view = makeView('Tablero', { id: 'g', kind: 'grid', notationId: 'grid', grid: { layers: [{ id: 'L1', name: 'L1' }], stages: [{ id: 'S1', name: 'S1' }, { id: 'S2', name: 'S2' }], stageGroups: [] } });
    store.set('views', view.id, view);
    const put = (id: string, stageId: string) => {
      const el = makeElement('freeform:box', id, { id: `el_${id}` }); store.set('elements', el.id, el);
      const n = makeNode('g', el.id, { x: 5, y: 5 }, { id, cell: { layerId: 'L1', stageId } }); store.set('nodes', n.id, n);
    };
    put('a1', 'S1'); put('a2', 'S1'); put('b1', 'S2'); put('b2', 'S2');
    const rel = makeRelation('freeform:arrow', { elementId: 'el_a1' }, { elementId: 'el_b1' }, { id: 'r' }); store.set('relations', rel.id, rel);
    const e = makeEdge('g', rel.id, 'a1', 'b1', { id: 'e' }); store.set('edges', e.id, e);
    const cmd = await layoutView(store, reg(), 'g');
    execute(store, cmd);
    const a1 = store.get('nodes', 'a1')!, a2 = store.get('nodes', 'a2')!, b1 = store.get('nodes', 'b1')!, b2 = store.get('nodes', 'b2')!;
    expect(a1.cell).toEqual({ layerId: 'L1', stageId: 'S1' });
    expect(b1.cell).toEqual({ layerId: 'L1', stageId: 'S2' });
    expect(rectsOverlap(a1, a2)).toBe(false);
    expect(rectsOverlap(b1, b2)).toBe(false);
    for (const n of [a1, a2, b1, b2]) { expect(n.x).toBeGreaterThanOrEqual(0); expect(n.y).toBeGreaterThanOrEqual(0); }
  });
});

describe('createLayoutEngine', () => {
  it('acepta una instancia ELK externa', async () => {
    const engine = createLayoutEngine(new ELK());
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const cmd = await engine.layoutView(store, reg(), 'vw_1');
    expect(cmd.type).toBe('batch');
  });
  it('una vista vacía produce un batch vacío', async () => {
    const store = new MemoryStore();
    const view = makeView('Vacía', { id: 'empty' }); store.set('views', view.id, view);
    const cmd = await layoutView(store, reg(), 'empty');
    expect(cmd).toEqual({ type: 'batch', label: 'layout', commands: [] });
  });
});
