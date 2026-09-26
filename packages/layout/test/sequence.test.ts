import { describe, it, expect } from 'vitest';
import { MemoryStore, emptyWorkspace, execute, makeElement, makeView, makeNode, makeRelation, makeEdge, type Store } from '@all-draw/core';
import { sequenceLayoutCommand, layoutView, SEQ_LAYOUT } from '../src';

function fixture() {
  const store: Store = new MemoryStore(emptyWorkspace());
  const view = makeView('Secuencia', { id: 'vw_seq', notationId: 'sequence', kind: 'sequence' });
  store.set('views', view.id, view);
  const el = (id: string, typeId: string) => { const e = makeElement(typeId, id, { id: `el_${id}` }); store.set('elements', e.id, e); return e; };
  const nd = (id: string, elementId: string, x: number, y: number, w: number, h: number, parentNodeId?: string) => {
    const n = makeNode(view.id, elementId, { x, y, w, h }, { id: `vn_${id}`, parentNodeId }); store.set('nodes', n.id, n); return n;
  };
  const a = el('a', 'sequence:Lifeline'), b = el('b', 'sequence:Lifeline'), c = el('c', 'sequence:Lifeline'), act = el('act', 'sequence:Activation');
  const nB = nd('b', b.id, 300, 12, 140, 60);
  const nA = nd('a', a.id, 10, 0, 140, 60);
  const nC = nd('c', c.id, 900, 0, 160, 60);
  const nAct = nd('act', act.id, 0, 100, 12, 80, nB.id);
  const msg = (id: string, from: typeof a, to: typeof a, order: number | undefined, fromNode: string, toNode: string, typeId = 'sequence:Message') => {
    const r = makeRelation(typeId, { elementId: from.id }, { elementId: to.id }, { id: `rel_${id}`, fields: order === undefined ? {} : { order } }); store.set('relations', r.id, r);
    const e = makeEdge(view.id, r.id, fromNode, toNode, { id: `ve_${id}`, bendpoints: [{ x: 5, y: 999 }] }); store.set('edges', e.id, e);
    return e;
  };
  msg('m2', b, c, 2, nAct.id, nC.id);
  msg('m1', a, b, 1, nA.id, nB.id);
  msg('m3', c, b, 3, nC.id, nB.id, 'sequence:Return');
  msg('mx', a, a, undefined, nA.id, nA.id);
  return { store, view, nA, nB, nC, nAct };
}

describe('sequenceLayoutCommand', () => {
  it('reparte las líneas de vida en columnas, centra activaciones y apila los mensajes por order', () => {
    const { store, view, nA, nB, nC, nAct } = fixture();
    const cmd = sequenceLayoutCommand(store, view.id);
    expect(cmd.type).toBe('batch');
    if (cmd.type !== 'batch') return;
    expect(cmd.label).toBe('layout');
    const moves = cmd.commands.flatMap(c => (c.type === 'moveNodes' ? c.moves : []));
    expect(moves).toEqual([
      { id: nA.id, x: 40, y: 0 }, { id: nB.id, x: 240, y: 0 }, { id: nC.id, x: 440, y: 0 },
      { id: nAct.id, x: 64, y: 100 },
    ]);
    execute(store, cmd);
    const y = (id: string) => store.get('edges', id)!.bendpoints;
    expect(y('ve_m1')).toEqual([{ x: 0, y: 100 }]);
    expect(y('ve_m2')).toEqual([{ x: 0, y: 140 }]);
    expect(y('ve_m3')).toEqual([{ x: 0, y: 180 }]);
    expect(y('ve_mx')).toEqual([{ x: 0, y: 220 }]);
    expect(SEQ_LAYOUT.gapX).toBe(200);
    // Idempotente: una segunda pasada no produce comandos
    const again = sequenceLayoutCommand(store, view.id);
    expect(again.type === 'batch' && again.commands).toEqual([]);
  });
  it('layoutView desvía a este layout cuando la vista es de secuencia (sin ELK)', async () => {
    const { store, view, nA } = fixture();
    const cmd = await layoutView(store, undefined, view.id, { algorithm: 'force' });
    expect(cmd).toEqual(sequenceLayoutCommand(store, view.id));
    execute(store, cmd);
    expect(store.get('nodes', nA.id)!.x).toBe(40);
  });
  it('ignora nodos y aristas de otras vistas', () => {
    const { store, view } = fixture();
    const other = makeNode('vw_otra', 'el_a', { x: 5, y: 5 }, { id: 'vn_otra' }); store.set('nodes', other.id, other);
    const cmd = sequenceLayoutCommand(store, view.id);
    expect(JSON.stringify(cmd)).not.toContain('vn_otra');
  });
});
