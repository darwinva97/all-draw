import { describe, it, expect } from 'vitest';
import { MemoryStore, History, exampleWorkspace, parseWorkspace, makeView, makeNode, makeElement, type ViewNode } from '@all-draw/core';
import { copySelection, pastePlan } from '../src/clipboard';

const CELL_A = { layerId: 'ly1', stageId: 'st1' };
const CELL_B = { layerId: 'ly2', stageId: 'st2' };
const isValidCell = (c: { layerId: string; stageId: string }) => (c.layerId === 'ly1' || c.layerId === 'ly2') && (c.stageId === 'st1' || c.stageId === 'st2');

function setup() {
  const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
  store.set('views', 'vw_g', makeView('Rejilla', { id: 'vw_g', kind: 'grid', notationId: 'grid', grid: { layers: [{ id: 'ly1', name: 'A' }, { id: 'ly2', name: 'B' }], stages: [{ id: 'st1', name: '1' }, { id: 'st2', name: '2' }], stageGroups: [] } }));
  return { store, h: new History(store) };
}
const nodes = (store: MemoryStore, plan: { newNodeIds: string[] }) => plan.newNodeIds.map(id => store.get('nodes', id)!);

describe('pegar en una vista de rejilla', () => {
  it('nodos sin celda (de una vista libre) van a la celda destino, conservando su disposición relativa', () => {
    const { store, h } = setup();
    const clip = copySelection(store, ['vn_1', 'vn_2'], []); // vn_1 (40,40), vn_2 (320,40)
    const plan = pastePlan(clip, { viewId: 'vw_g', offset: { x: 0, y: 0 }, mode: 'appearance', isGrid: true, gridTarget: { cell: CELL_A, origin: { x: 10, y: 20 }, isValidCell } });
    h.run({ type: 'batch', commands: plan.commands });
    const ns = nodes(store, plan);
    expect(ns).toHaveLength(2);
    for (const n of ns) { expect(n.cell).toEqual(CELL_A); expect(n.viewId).toBe('vw_g'); }
    const a = ns.find(n => n.elementId === 'el_alta')!, b = ns.find(n => n.elementId === 'el_crm')!;
    expect([a.x, a.y]).toEqual([10, 20]);
    expect([b.x, b.y]).toEqual([290, 20]);
    // Las aristas entre ellos se pegan también
    expect(store.list('edges').filter(e => e.viewId === 'vw_g')).toHaveLength(1);
  });
  it('sin celda destino, en una rejilla no se pega nada fuera de una celda', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1', 'vn_2'], []);
    const plan = pastePlan(clip, { viewId: 'vw_g', offset: { x: 0, y: 0 }, mode: 'appearance', isGrid: true });
    expect(plan.newNodeIds).toEqual([]);
    expect(plan.commands.filter(c => c.type === 'set' && c.collection === 'nodes')).toEqual([]);
    expect(plan.commands.filter(c => c.type === 'set' && c.collection === 'edges')).toEqual([]);
  });
  it('nodos con celda válida la conservan (con offset); con celda inexistente pasan a la celda destino', () => {
    const { store, h } = setup();
    store.set('nodes', 'g1', makeNode('vw_g', 'el_alta', { x: 5, y: 5 }, { id: 'g1', cell: CELL_B }));
    store.set('nodes', 'g2', makeNode('vw_g', 'el_crm', { x: 50, y: 60 }, { id: 'g2', cell: { layerId: 'borrada', stageId: 'st1' } }));
    const clip = copySelection(store, ['g1', 'g2'], []);
    const plan = pastePlan(clip, { viewId: 'vw_g', offset: { x: 24, y: 24 }, mode: 'appearance', isGrid: true, gridTarget: { cell: CELL_A, isValidCell } });
    h.run({ type: 'batch', commands: plan.commands });
    const ns = nodes(store, plan);
    const a = ns.find(n => n.elementId === 'el_alta')!, b = ns.find(n => n.elementId === 'el_crm')!;
    expect(a.cell).toEqual(CELL_B); expect([a.x, a.y]).toEqual([29, 29]);
    expect(b.cell).toEqual(CELL_A); expect([b.x, b.y]).toEqual([8 + 45 + 24, 8 + 55 + 24]); // origen por defecto 8,8 + posición relativa al primer nodo + offset
  });
  it('con tamaño de celda, los nodos se acotan para no sobresalir', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1', 'vn_2'], []); // 180 de ancho cada uno, en x=40 y x=320
    const plan = pastePlan(clip, { viewId: 'vw_g', offset: { x: 0, y: 0 }, mode: 'appearance', isGrid: true, gridTarget: { cell: CELL_A, origin: { x: 0, y: 0 }, size: { w: 300, h: 100 } } });
    const vals = plan.commands.filter(c => c.type === 'set' && c.collection === 'nodes').map(c => (c as { value: ViewNode }).value);
    const b = vals.find(v => v.elementId === 'el_crm')!;
    expect([b.x, b.y]).toEqual([120, 0]); // 300 - 180
    expect(vals.every(v => v.x >= 0 && v.y >= 0 && v.x + v.w <= 300 && v.y + v.h <= 100)).toBe(true);
  });
  it('los hijos anidados siguen a su padre (relativos a él) y no reciben celda', () => {
    const { store, h } = setup();
    store.set('nodes', 'grp', makeNode('vw_1', undefined, { x: 100, y: 100, w: 300, h: 200 }, { id: 'grp', visualType: 'core:group' }));
    store.set('elements', 'el_c', makeElement('freeform:box', 'Hijo', { id: 'el_c' }));
    store.set('nodes', 'child', makeNode('vw_1', 'el_c', { x: 10, y: 10 }, { id: 'child', parentNodeId: 'grp' }));
    const clip = copySelection(store, ['grp'], []);
    const plan = pastePlan(clip, { viewId: 'vw_g', offset: { x: 0, y: 0 }, mode: 'appearance', isGrid: true, gridTarget: { cell: CELL_A, isValidCell } });
    h.run({ type: 'batch', commands: plan.commands });
    const ns = nodes(store, plan);
    const g = ns.find(n => n.visualType === 'core:group')!, c = ns.find(n => n.elementId === 'el_c')!;
    expect(g.cell).toEqual(CELL_A); expect([g.x, g.y]).toEqual([8, 8]);
    expect(c.parentNodeId).toBe(g.id); expect(c.cell).toBeUndefined(); expect([c.x, c.y]).toEqual([10, 10]);
  });
  it('en una vista libre la celda se descarta y el comportamiento anterior no cambia', () => {
    const { store } = setup();
    store.set('nodes', 'g1', makeNode('vw_g', 'el_alta', { x: 5, y: 5 }, { id: 'g1', cell: CELL_B }));
    const plan = pastePlan(copySelection(store, ['g1'], []), { viewId: 'vw_1', offset: { x: 1, y: 2 }, mode: 'appearance' });
    const v = (plan.commands[0] as { value: ViewNode }).value;
    expect(v.cell).toBeUndefined(); expect([v.x, v.y]).toEqual([6, 7]);
  });
});
