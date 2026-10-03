/**
 * Supr sobre una arista la quita solo de esta vista (como con los nodos); Shift+Supr / "Borrar del modelo" borra la
 * relación con todas sus aristas. Sin DOM, el diálogo de confirmación se cancela: no se borra nada del modelo.
 */
import { describe, it, expect } from 'vitest';
import { MemoryStore, History, makeElement, makeNode, makeRelation, makeEdge, makeView, type Store, type Command } from '@all-draw/core';
import { t } from '@all-draw/i18n';
import { deleteSelection, deleteSelectionCommands, relationsOfEdges } from '../src/delete-selection';

function setup() {
  const store = new MemoryStore();
  const h = new History(store);
  const v1 = makeView('A'), v2 = makeView('B');
  const a = makeElement('freeform:box', 'a'), b = makeElement('freeform:box', 'b');
  const rel = makeRelation('core:link', { elementId: a.id }, { elementId: b.id });
  const cmds: Command[] = [{ type: 'set', collection: 'views', id: v1.id, value: v1 }, { type: 'set', collection: 'views', id: v2.id, value: v2 }];
  const nodes: Record<string, string> = {};
  for (const v of [v1, v2]) {
    const na = makeNode(v.id, a.id, { x: 0, y: 0, w: 10, h: 10 }), nb = makeNode(v.id, b.id, { x: 50, y: 0, w: 10, h: 10 });
    nodes[`${v.name}a`] = na.id; nodes[`${v.name}b`] = nb.id;
    cmds.push({ type: 'set', collection: 'nodes', id: na.id, value: na }, { type: 'set', collection: 'nodes', id: nb.id, value: nb });
  }
  cmds.push({ type: 'set', collection: 'elements', id: a.id, value: a }, { type: 'set', collection: 'elements', id: b.id, value: b });
  cmds.push({ type: 'set', collection: 'relations', id: rel.id, value: rel });
  const e1 = { ...makeEdge(v1.id, rel.id, nodes.Aa!, nodes.Ab!) }, e2 = { ...makeEdge(v2.id, rel.id, nodes.Ba!, nodes.Bb!) };
  cmds.push({ type: 'set', collection: 'edges', id: e1.id, value: e1 }, { type: 'set', collection: 'edges', id: e2.id, value: e2 });
  h.run({ type: 'batch', commands: cmds });
  return { store: store as Store, h, rel, e1, e2, nodes };
}

describe('borrar la selección', () => {
  it('Supr sobre una arista la quita solo de esta vista: la relación y la arista de la otra vista siguen', () => {
    const { store, h, rel, e1, e2 } = setup();
    const cmds = deleteSelectionCommands(store, { nodes: [], edges: [e1.id] }, false);
    expect(cmds).toEqual([{ type: 'delete', collection: 'edges', id: e1.id }]);
    h.run({ type: 'batch', commands: cmds });
    expect(store.get('edges', e1.id)).toBeUndefined();
    expect(store.get('edges', e2.id)).toBeDefined();
    expect(store.get('relations', rel.id)).toBeDefined();
    h.undo();
    expect(store.get('edges', e1.id)).toBeDefined();
  });

  it('Shift+Supr borra la relación del modelo con todas sus aristas (una vez aunque se elijan varias aristas suyas)', () => {
    const { store, h, rel, e1, e2 } = setup();
    expect(relationsOfEdges(store, [e1.id, e2.id])).toEqual([rel.id]);
    const cmds = deleteSelectionCommands(store, { nodes: [], edges: [e1.id, e2.id] }, true);
    expect(cmds).toEqual([{ type: 'deleteRelation', id: rel.id }]);
    h.run({ type: 'batch', commands: cmds });
    expect(store.get('relations', rel.id)).toBeUndefined();
    expect(store.get('edges', e1.id)).toBeUndefined();
    expect(store.get('edges', e2.id)).toBeUndefined();
  });

  it('los nodos se quitan de la vista en ambos casos (el elemento sigue en el modelo)', () => {
    const { store, nodes } = setup();
    for (const fromModel of [false, true]) {
      expect(deleteSelectionCommands(store, { nodes: [nodes.Aa!], edges: [] }, fromModel)).toEqual([{ type: 'deleteNode', id: nodes.Aa }]);
    }
  });

  it('del modelo pide confirmación; si se cancela (aquí, sin DOM) no se toca nada', async () => {
    const { store, rel, e1 } = setup();
    const ran: Command[] = [];
    expect(await deleteSelection(store, c => ran.push(c), { nodes: [], edges: [e1.id] }, true, t)).toBe(false);
    expect(ran).toEqual([]);
    expect(store.get('relations', rel.id)).toBeDefined();
    // Quitar de la vista no pregunta
    expect(await deleteSelection(store, c => ran.push(c), { nodes: [], edges: [e1.id] }, false, t)).toBe(true);
    expect(ran).toHaveLength(1);
  });
});
