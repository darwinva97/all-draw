import { describe, it, expect } from 'vitest';
import { MemoryStore, emptyWorkspace, execute, makeElement, makeView, makeNode, makeRelation, makeEdge, type Store } from '@all-draw/core';
import {
  sequenceLayout, nextOrder, messageYCommand, insertMessageAt, reorderLifeline, lifelineIndexAt, lifelineAtX, nextLifelineX, activationX,
  messageKind, lifelineOf, SEQ_LIFELINE, SEQ_ACTIVATION, SEQ_FRAGMENT, SEQ_MESSAGE, SEQ_RETURN,
} from '../src/views/sequence';

/** Vista de secuencia con tres líneas de vida (desordenadas en el store), una activación y varios mensajes. */
function fixture() {
  const store: Store = new MemoryStore(emptyWorkspace());
  const view = makeView('Secuencia', { id: 'vw_seq', notationId: 'sequence', kind: 'sequence' });
  store.set('views', view.id, view);
  const el = (id: string, typeId: string, fields: Record<string, unknown> = {}) => { const e = makeElement(typeId, id, { id: `el_${id}`, fields }); store.set('elements', e.id, e); return e; };
  const nd = (id: string, elementId: string, x: number, y: number, w: number, h: number, parentNodeId?: string) => {
    const n = makeNode(view.id, elementId, { x, y, w, h }, { id: `vn_${id}`, parentNodeId }); store.set('nodes', n.id, n); return n;
  };
  const a = el('a', SEQ_LIFELINE, { kind: 'actor' }), b = el('b', SEQ_LIFELINE, { kind: 'control' }), c = el('c', SEQ_LIFELINE, { kind: 'database' });
  const act = el('act', SEQ_ACTIVATION), frag = el('frag', SEQ_FRAGMENT, { kind: 'alt' });
  // En el store, B se inserta antes que A, pero A tiene menor x
  const nB = nd('b', b.id, 260, 0, 140, 60);
  const nA = nd('a', a.id, 40, 0, 140, 60);
  const nC = nd('c', c.id, 480, 0, 140, 60);
  const nAct = nd('act', act.id, 64, 100, 12, 120, nB.id);
  const nFrag = nd('frag', frag.id, 200, 300, 400, 100);
  const msg = (id: string, from: typeof a, to: typeof a, fields: Record<string, unknown>, fromNode: string, toNode: string, bend?: number, typeId = SEQ_MESSAGE) => {
    const r = makeRelation(typeId, { elementId: from.id }, { elementId: to.id }, { id: `rel_${id}`, fields }); store.set('relations', r.id, r);
    const e = makeEdge(view.id, r.id, fromNode, toNode, { id: `ve_${id}`, bendpoints: bend === undefined ? [] : [{ x: 0, y: bend }] }); store.set('edges', e.id, e);
    return e;
  };
  // Creación en orden distinto al `order`
  msg('m2', b, c, { order: 2, text: 'dos', kind: 'async' }, nAct.id, nC.id);
  msg('m1', a, b, { order: 1, text: 'uno' }, nA.id, nB.id);
  msg('m3', c, b, { order: 3, text: 'tres' }, nC.id, nB.id, undefined, SEQ_RETURN);
  msg('mx', a, a, { text: 'sin orden' }, nA.id, nA.id);
  msg('m4', b, a, { order: 4, text: 'cuatro' }, nB.id, nA.id, 400);
  return { store, view, nA, nB, nC, nAct, nFrag };
}

describe('sequenceLayout', () => {
  it('ordena las líneas de vida por x y resuelve activaciones a su línea de vida', () => {
    const { store, view, nA, nB, nC, nAct } = fixture();
    const l = sequenceLayout(store, view.id);
    expect(l.lifelines.map(x => x.nodeId)).toEqual([nA.id, nB.id, nC.id]);
    expect(l.lifelines.map(x => x.order)).toEqual([0, 1, 2]);
    expect(lifelineOf(store, nAct.id)?.id).toBe(nB.id);
    const m2 = l.messages.find(m => m.edgeId === 've_m2')!;
    expect(m2.fromLifelineId).toBe(nB.id);
    expect(m2.fromX).toBe(260 + 70);
    expect(m2.toX).toBe(480 + 70);
    expect(m2.kind).toBe('async');
  });
  it('asigna y a los mensajes sin bendpoint de 40 en 40 por order y luego por creación', () => {
    const { store, view } = fixture();
    const l = sequenceLayout(store, view.id);
    const y = Object.fromEntries(l.messages.map(m => [m.edgeId, m.y]));
    expect(y['ve_m1']).toBe(100);
    expect(y['ve_m2']).toBe(140);
    expect(y['ve_m3']).toBe(180);
    // El explícito conserva su altura y no se recoloca
    expect(y['ve_m4']).toBe(400);
    expect(l.messages.find(m => m.edgeId === 've_m4')!.explicit).toBe(true);
    // Sin `order` va al final, después del explícito (cursor = 400)
    expect(y['ve_mx']).toBe(440);
    expect(l.messages.find(m => m.edgeId === 've_mx')!.self).toBe(true);
    expect(l.messages.find(m => m.edgeId === 've_m3')!.kind).toBe('return');
  });
  it('alto y ancho cubren mensajes, fragmentos y activaciones', () => {
    const { store, view } = fixture();
    const l = sequenceLayout(store, view.id);
    // último mensaje (self) 440 + 24 + 40 de margen
    expect(l.height).toBe(504);
    expect(l.width).toBe(480 + 140 + 40);
    expect(sequenceLayout(new MemoryStore(emptyWorkspace()), 'nada')).toEqual({ lifelines: [], messages: [], height: 240, width: 40 });
  });
  it('un mensaje a sí mismo (from === to) sale como self, con origen y destino en la misma x y ocupa el escalón', () => {
    const store: Store = new MemoryStore(emptyWorkspace());
    const view = makeView('Solo', { id: 'vw_self', notationId: 'sequence', kind: 'sequence' });
    store.set('views', view.id, view);
    const a = makeElement(SEQ_LIFELINE, 'A', { id: 'el_solo' }); store.set('elements', a.id, a);
    const n = makeNode(view.id, a.id, { x: 100, y: 0, w: 140, h: 60 }, { id: 'vn_solo' }); store.set('nodes', n.id, n);
    const r = makeRelation(SEQ_MESSAGE, { elementId: a.id }, { elementId: a.id }, { id: 'rel_self', fields: { order: 1, text: 'me llamo' } }); store.set('relations', r.id, r);
    const e = makeEdge(view.id, r.id, n.id, n.id, { id: 've_self' }); store.set('edges', e.id, e);
    const l = sequenceLayout(store, view.id);
    expect(l.messages).toHaveLength(1);
    const m = l.messages[0]!;
    expect(m.self).toBe(true);
    expect(m.fromLifelineId).toBe(n.id);
    expect(m.toLifelineId).toBe(n.id);
    expect(m.fromX).toBe(170);
    expect(m.toX).toBe(170);
    expect(m.y).toBe(100);
    // El escalón (24 px) cuenta para el alto: 100 + 24 + 40 de margen < mínimo 240
    expect(l.height).toBe(240);
    expect(sequenceLayout(store, view.id, { minHeight: 0 }).height).toBe(164);
  });
  it('respeta opciones de separación', () => {
    const { store, view } = fixture();
    const l = sequenceLayout(store, view.id, { headerH: 80, gapY: 30 });
    expect(l.messages.find(m => m.edgeId === 've_m1')!.y).toBe(110);
    expect(l.messages.find(m => m.edgeId === 've_m2')!.y).toBe(140);
  });
});

describe('órdenes y comandos', () => {
  it('nextOrder es el máximo + 1 (1 si no hay mensajes)', () => {
    const { store, view } = fixture();
    expect(nextOrder(store, view.id)).toBe(5);
    expect(nextOrder(store, 'otra')).toBe(1);
  });
  it('messageYCommand escribe un único bendpoint redondeado', () => {
    const { store } = fixture();
    const cmd = messageYCommand('ve_m1', 123.6);
    expect(cmd).toEqual({ type: 'patch', collection: 'edges', id: 've_m1', patch: { bendpoints: [{ x: 0, y: 124 }] } });
    execute(store, cmd);
    expect(store.get('edges', 've_m1')!.bendpoints).toEqual([{ x: 0, y: 124 }]);
  });
  it('insertMessageAt calcula el orden a esa altura y desplaza los siguientes', () => {
    const { store, view } = fixture();
    // Entre m1 (100) y m2 (140): orden 2; m2, m3 y m4 pasan a 3, 4 y 5
    const r = insertMessageAt(store, view.id, 120);
    expect(r.order).toBe(2);
    expect(r.commands.map(c => (c.type === 'patch' ? [c.id, (c.patch['fields'] as Record<string, unknown>)['order']] : null))).toEqual([['rel_m2', 3], ['rel_m3', 4], ['rel_m4', 5]]);
    // Debajo de todo: siguiente orden libre y nada que desplazar
    const end = insertMessageAt(store, view.id, 1000);
    expect(end).toEqual({ order: 5, commands: [] });
  });
  it('messageKind cae a sync si no hay relación o el valor es raro', () => {
    const { store } = fixture();
    expect(messageKind(store, makeEdge('v', undefined, 'a', 'b'))).toBe('sync');
    store.set('relations', 'rel_m1', { ...store.get('relations', 'rel_m1')!, fields: { kind: 'lo que sea' } });
    expect(messageKind(store, store.get('edges', 've_m1')!)).toBe('sync');
  });
});

describe('reorderLifeline', () => {
  it('permuta las columnas existentes y fuerza y = 0', () => {
    const { store, view, nA, nB, nC } = fixture();
    store.set('nodes', nC.id, { ...nC, y: 33 });
    const cmd = reorderLifeline(store, view.id, nC.id, 0);
    expect(cmd.type).toBe('moveNodes');
    if (cmd.type !== 'moveNodes') return;
    expect(cmd.moves).toEqual([{ id: nC.id, x: 40, y: 0 }, { id: nA.id, x: 260, y: 0 }, { id: nB.id, x: 480, y: 0 }]);
    execute(store, cmd);
    expect(sequenceLayout(store, view.id).lifelines.map(l => l.nodeId)).toEqual([nC.id, nA.id, nB.id]);
  });
  it('sin cambio de posición no genera movimientos; nodo desconocido tampoco', () => {
    const { store, view, nA } = fixture();
    expect(reorderLifeline(store, view.id, nA.id, 0)).toEqual({ type: 'moveNodes', moves: [] });
    expect(reorderLifeline(store, view.id, 'nope', 1)).toEqual({ type: 'moveNodes', moves: [] });
  });
  it('lifelineIndexAt y lifelineAtX localizan columnas', () => {
    const { store, view, nA, nB, nC } = fixture();
    const l = sequenceLayout(store, view.id);
    expect(lifelineIndexAt(l, 10, nA.id)).toBe(0);
    expect(lifelineIndexAt(l, 400, nA.id)).toBe(1);
    expect(lifelineIndexAt(l, 900, nA.id)).toBe(2);
    expect(lifelineAtX(l, 330)?.nodeId).toBe(nB.id);
    expect(lifelineAtX(l, 560)?.nodeId).toBe(nC.id);
    expect(lifelineAtX(l, 5000)).toBeUndefined();
  });
  it('nextLifelineX y activationX', () => {
    const { store, view } = fixture();
    expect(nextLifelineX(store, view.id)).toBe(680);
    expect(nextLifelineX(store, 'vacía')).toBe(40);
    expect(activationX(140)).toBe(64);
  });
});
