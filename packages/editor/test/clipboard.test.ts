import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore, exampleWorkspace, parseWorkspace, History, makeNode, makeElement, makeEdge, makeRelation, makeView, type ViewNode, type ViewEdge, type Element, type Relation } from '@all-draw/core';
import { copySelection, pastePlan, setClipboard, readClipboard, parseClip, _resetClipboard, CLIP_MIME } from '../src/clipboard';

function setup() {
  const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
  return { store, history: new History(store) };
}
const nodesOf = (store: MemoryStore, viewId: string) => store.list('nodes').filter(n => n.viewId === viewId);
const edgesOf = (store: MemoryStore, viewId: string) => store.list('edges').filter(e => e.viewId === viewId);

describe('copySelection', () => {
  it('copia nodos, elementos y las aristas entre nodos copiados aunque no estén seleccionadas', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1', 'vn_2'], []);
    expect(clip.nodes.map(n => n.id).sort()).toEqual(['vn_1', 'vn_2']);
    expect(clip.edges.map(e => e.id)).toEqual(['ve_1']);
    expect(clip.elements.map(e => e.id).sort()).toEqual(['el_alta', 'el_crm']);
    expect(clip.relations.map(r => r.id)).toEqual(['rel_1']);
    expect(clip.viewId).toBe('vw_1');
  });
  it('no incluye aristas hacia nodos no copiados', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1'], ['ve_1']);
    expect(clip.edges).toEqual([]);
    expect(clip.relations).toEqual([]);
  });
  it('incluye descendientes anidados', () => {
    const { store } = setup();
    store.set('nodes', 'vn_g', makeNode('vw_1', undefined, { x: 0, y: 0, w: 300, h: 200 }, { id: 'vn_g', visualType: 'core:group' }));
    store.set('nodes', 'vn_c', makeNode('vw_1', 'el_crm', { x: 10, y: 10 }, { id: 'vn_c', parentNodeId: 'vn_g' }));
    store.set('nodes', 'vn_cc', makeNode('vw_1', 'el_alta', { x: 20, y: 20 }, { id: 'vn_cc', parentNodeId: 'vn_c' }));
    const clip = copySelection(store, ['vn_g'], []);
    expect(clip.nodes.map(n => n.id).sort()).toEqual(['vn_c', 'vn_cc', 'vn_g']);
  });
  it('ignora ids inexistentes y devuelve copias (no referencias al store)', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1', 'nope'], []);
    expect(clip.nodes).toHaveLength(1);
    clip.nodes[0]!.x = 999;
    expect(store.get('nodes', 'vn_1')!.x).toBe(40);
  });
});

describe('pastePlan appearance', () => {
  it('crea nuevas apariciones de los mismos elementos y relaciones, con offset, en un solo lote', () => {
    const { store, history } = setup();
    const clip = copySelection(store, ['vn_1', 'vn_2'], []);
    const plan = pastePlan(clip, { viewId: 'vw_1', offset: { x: 24, y: 24 }, mode: 'appearance' });
    expect(plan.newNodeIds).toHaveLength(2);
    expect(plan.commands.every(c => c.type === 'set')).toBe(true);
    history.run({ type: 'batch', label: 'pegar', commands: plan.commands });
    const nodes = nodesOf(store, 'vw_1');
    expect(nodes).toHaveLength(4);
    const nuevos = nodes.filter(n => plan.newNodeIds.includes(n.id));
    expect(nuevos.map(n => n.elementId).sort()).toEqual(['el_alta', 'el_crm']);
    expect(nuevos.find(n => n.elementId === 'el_alta')!.x).toBe(64);
    const edges = edgesOf(store, 'vw_1');
    expect(edges).toHaveLength(2);
    const ne = edges.find(e => e.id !== 've_1')!;
    expect(ne.relationId).toBe('rel_1');
    expect(plan.newNodeIds).toContain(ne.fromNodeId);
    expect(plan.newNodeIds).toContain(ne.toNodeId);
    // Modelo intacto
    expect(store.list('elements')).toHaveLength(2);
    expect(store.list('relations')).toHaveLength(1);
    // Un solo paso de undo
    history.undo();
    expect(nodesOf(store, 'vw_1')).toHaveLength(2);
    expect(edgesOf(store, 'vw_1')).toHaveLength(1);
  });
  it('pega en otra vista y conserva detailViewId', () => {
    const { store, history } = setup();
    const clip = copySelection(store, ['vn_1'], []);
    const plan = pastePlan(clip, { viewId: 'vw_2', offset: { x: 0, y: 0 }, mode: 'appearance' });
    history.run({ type: 'batch', commands: plan.commands });
    const n = store.get('nodes', plan.newNodeIds[0]!)!;
    expect(n.viewId).toBe('vw_2');
    expect(n.elementId).toBe('el_alta');
    expect(n.detailViewId).toBe('vw_2');
    expect(nodesOf(store, 'vw_2')).toHaveLength(2); // dos apariciones del mismo elemento son válidas
  });
  it('remapea parentNodeId, no desplaza a los hijos y descarta padres no copiados', () => {
    const { store } = setup();
    store.set('nodes', 'vn_g', makeNode('vw_1', undefined, { x: 100, y: 100, w: 300, h: 200 }, { id: 'vn_g', visualType: 'core:group' }));
    store.set('nodes', 'vn_c', makeNode('vw_1', 'el_crm', { x: 10, y: 10 }, { id: 'vn_c', parentNodeId: 'vn_g' }));
    const clip = copySelection(store, ['vn_g'], []);
    const plan = pastePlan(clip, { viewId: 'vw_1', offset: { x: 24, y: 24 }, mode: 'appearance' });
    const values = plan.commands.filter(c => c.type === 'set' && c.collection === 'nodes').map(c => (c as { value: ViewNode }).value);
    const g = values.find(v => v.visualType === 'core:group')!, c = values.find(v => v.elementId === 'el_crm')!;
    expect(g.parentNodeId).toBeUndefined();
    expect(g.x).toBe(124);
    expect(c.parentNodeId).toBe(g.id);
    expect(c.x).toBe(10);
    // el padre va antes que el hijo
    expect(values.indexOf(g)).toBeLessThan(values.indexOf(c));
    // hijo solo, sin su padre: queda como raíz
    const plan2 = pastePlan(copySelection(store, ['vn_c'], []), { viewId: 'vw_1', offset: { x: 0, y: 0 }, mode: 'appearance' });
    const c2 = (plan2.commands[0] as { value: ViewNode }).value;
    expect(c2.parentNodeId).toBeUndefined();
  });
  it('conserva cell solo si la vista destino es grid', () => {
    const { store } = setup();
    store.set('nodes', 'vn_cell', makeNode('vw_1', 'el_crm', { x: 5, y: 5 }, { id: 'vn_cell', cell: { layerId: 'l1', stageId: 's1' } }));
    const clip = copySelection(store, ['vn_cell'], []);
    const grid = (pastePlan(clip, { viewId: 'vw_g', offset: { x: 0, y: 0 }, mode: 'appearance', isGrid: true }).commands[0] as { value: ViewNode }).value;
    const free = (pastePlan(clip, { viewId: 'vw_1', offset: { x: 0, y: 0 }, mode: 'appearance' }).commands[0] as { value: ViewNode }).value;
    expect(grid.cell).toEqual({ layerId: 'l1', stageId: 's1' });
    expect(free.cell).toBeUndefined();
    expect('cell' in free).toBe(false);
  });
  it('desplaza también los bendpoints de las aristas', () => {
    const { store } = setup();
    store.set('edges', 've_1', { ...store.get('edges', 've_1')!, bendpoints: [{ x: 200, y: 10 }] });
    const plan = pastePlan(copySelection(store, ['vn_1', 'vn_2'], []), { viewId: 'vw_1', offset: { x: 24, y: 24 }, mode: 'appearance' });
    const e = plan.commands.find(c => c.type === 'set' && c.collection === 'edges') as { value: ViewEdge };
    expect(e.value.bendpoints).toEqual([{ x: 224, y: 34 }]);
  });
});

describe('pastePlan clone', () => {
  it('crea elementos y relaciones nuevos con el mismo nombre y templateId', () => {
    const { store, history } = setup();
    store.set('elements', 'el_crm', { ...store.get('elements', 'el_crm')!, templateId: 'tpl_x' });
    const clip = copySelection(store, ['vn_1', 'vn_2'], []);
    const plan = pastePlan(clip, { viewId: 'vw_1', offset: { x: 24, y: 24 }, mode: 'clone' });
    history.run({ type: 'batch', label: 'duplicar', commands: plan.commands });
    const els = store.list('elements');
    expect(els).toHaveLength(4);
    const clones = els.filter(e => !['el_alta', 'el_crm'].includes(e.id));
    expect(clones.map(e => e.name).sort()).toEqual(['CRM', 'Proceso de alta']);
    const crmClone = clones.find(e => e.name === 'CRM')!;
    expect(crmClone.templateId).toBe('tpl_x');
    expect(crmClone.fields).toEqual(store.get('elements', 'el_crm')!.fields);
    const rels = store.list('relations');
    expect(rels).toHaveLength(2);
    const rc = rels.find(r => r.id !== 'rel_1')!;
    expect(rc.from.elementId).toBe(clones.find(e => e.name === 'Proceso de alta')!.id);
    expect(rc.to.elementId).toBe(crmClone.id);
    expect(rc.name).toBe('usa');
    const nuevos = nodesOf(store, 'vw_1').filter(n => plan.newNodeIds.includes(n.id));
    expect(nuevos.every(n => clones.some(c => c.id === n.elementId))).toBe(true);
    expect(nuevos.every(n => n.detailViewId === undefined)).toBe(true);
    const ne = edgesOf(store, 'vw_1').find(e => e.id !== 've_1')!;
    expect(ne.relationId).toBe(rc.id);
    history.undo();
    expect(store.list('elements')).toHaveLength(2);
    expect(store.list('relations')).toHaveLength(1);
  });
  it('los ids generados son distintos entre pegados', () => {
    const { store } = setup();
    const clip = copySelection(store, ['vn_1'], []);
    const a = pastePlan(clip, { viewId: 'vw_1', offset: { x: 0, y: 0 }, mode: 'clone' });
    const b = pastePlan(clip, { viewId: 'vw_1', offset: { x: 0, y: 0 }, mode: 'clone' });
    expect(a.newNodeIds[0]).not.toBe(b.newNodeIds[0]);
    const ea = (a.commands[0] as { value: Element }).value, eb = (b.commands[0] as { value: Element }).value;
    expect(ea.id).not.toBe(eb.id);
    expect(ea.id).not.toBe('el_alta');
  });
  it('funciona con nodos y aristas puramente visuales', () => {
    const { store } = setup();
    const v = makeView('x'); store.set('views', v.id, v);
    const a = makeNode(v.id, undefined, { x: 0, y: 0 }, { visualType: 'core:note', text: 'hola' });
    const b = makeNode(v.id, undefined, { x: 100, y: 0 }, { visualType: 'core:note' });
    store.set('nodes', a.id, a); store.set('nodes', b.id, b);
    const e = makeEdge(v.id, undefined, a.id, b.id); store.set('edges', e.id, e);
    const plan = pastePlan(copySelection(store, [a.id, b.id], []), { viewId: v.id, offset: { x: 0, y: 0 }, mode: 'clone' });
    expect(plan.commands.filter(c => c.type === 'set' && (c.collection === 'elements' || c.collection === 'relations'))).toHaveLength(0);
    const ne = plan.commands.find(c => c.type === 'set' && c.collection === 'edges') as { value: ViewEdge };
    expect(ne.value.relationId).toBeUndefined();
    const nn = plan.commands.find(c => c.type === 'set' && c.collection === 'nodes') as { value: ViewNode };
    expect(nn.value.text).toBe('hola');
  });
  it('relaciones sobre relaciones se remapean si ambas están en el clip', () => {
    const { store } = setup();
    const r2 = makeRelation('core:link', { relationId: 'rel_1' }, { elementId: 'el_crm' });
    store.set('relations', r2.id, r2);
    const e2 = makeEdge('vw_1', r2.id, 'vn_1', 'vn_2'); store.set('edges', e2.id, e2);
    const plan = pastePlan(copySelection(store, ['vn_1', 'vn_2'], []), { viewId: 'vw_1', offset: { x: 0, y: 0 }, mode: 'clone' });
    const rels = plan.commands.filter(c => c.type === 'set' && c.collection === 'relations').map(c => (c as { value: Relation }).value);
    const link = rels.find(r => r.from.relationId)!;
    expect(rels.some(r => r.id === link.from.relationId)).toBe(true);
  });
});

describe('portapapeles', () => {
  beforeEach(() => _resetClipboard());
  it('memoria del módulo sin navigator', async () => {
    expect(await readClipboard()).toBeNull();
    const { store } = setup();
    const clip = copySelection(store, ['vn_1'], []);
    setClipboard(clip);
    expect(await readClipboard()).toEqual(clip);
  });
  it('parseClip acepta solo JSON marcado', () => {
    expect(parseClip('hola')).toBeNull();
    expect(parseClip(JSON.stringify({ nodes: [] }))).toBeNull();
    const c = parseClip(JSON.stringify({ format: CLIP_MIME, nodes: [makeNode('v', undefined, { x: 0, y: 0 })] }));
    expect(c?.nodes).toHaveLength(1);
    expect(c?.edges).toEqual([]);
  });
  it('makeElement no interfiere: el clip es serializable', () => {
    const el = makeElement('freeform:box', 'x');
    expect(JSON.parse(JSON.stringify({ format: CLIP_MIME, nodes: [], edges: [], elements: [el], relations: [] })).elements[0].name).toBe('x');
  });
});
