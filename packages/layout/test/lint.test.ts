import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, execute, makeElement, makeView, makeNode, makeRelation, makeEdge, validate, type NotationPack, type ViewNode } from '@all-draw/core';
import {
  geometryLint, lintView, rectsOverlap, rectContains, segmentIntersectsRect, segmentRectClearance, segmentRectIntersectionLength, normalizeRoutePoints, segmentsIntersect, linesNeeded, AUTO_LAYOUT_FIX,
} from '../src';

const PACK: NotationPack = {
  id: 'freeform', name: 'Libre', categories: [], portTypes: [], viewpoints: [],
  elementTypes: [
    { id: 'freeform:box', name: 'Caja', shape: 'rounded', fields: [] },
    { id: 'freeform:group', name: 'Grupo', shape: 'group', container: true, fields: [] },
    { id: 'freeform:start', name: 'Inicio', shape: 'circle', fields: [] },
  ],
  relationTypes: [{ id: 'freeform:arrow', name: 'Flecha', fields: [] }],
};
const reg = () => new NotationRegistry().register(CORE_PACK).register(PACK);

function scene() {
  const store = new MemoryStore();
  const view = makeView('Lint', { id: 'v' }); store.set('views', view.id, view);
  const mk = (id: string, typeId: string, name: string, pos: { x: number; y: number; w?: number; h?: number }, extra: Partial<ViewNode> = {}) => {
    const el = makeElement(typeId, name, { id: `el_${id}` }); store.set('elements', el.id, el);
    const n = makeNode('v', el.id, pos, { id, ...extra }); store.set('nodes', n.id, n);
    return n;
  };
  const link = (id: string, from: string, to: string, extra: Partial<ReturnType<typeof makeEdge>> = {}) => {
    const rel = makeRelation('freeform:arrow', { elementId: `el_${from}` }, { elementId: `el_${to}` }, { id: `rel_${id}` }); store.set('relations', rel.id, rel);
    const e = makeEdge('v', rel.id, from, to, { id, ...extra }); store.set('edges', e.id, e);
  };
  return { store, mk, link };
}

describe('geometría (port de archify)', () => {
  it('rectsOverlap y rectContains', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 12, y: 0, width: 10, height: 10 }, 4)).toBe(true);
    expect(rectsOverlap({ x: NaN, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
    expect(rectContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
    expect(rectContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 90, y: 10, width: 20, height: 20 })).toBe(false);
  });
  it('segmentos y rectángulos', () => {
    const r = { x: 10, y: 10, width: 20, height: 20 };
    expect(segmentIntersectsRect({ start: [0, 20], end: [40, 20] }, r)).toBe(true);
    expect(segmentIntersectsRect({ start: [0, 0], end: [40, 0] }, r)).toBe(false);
    expect(segmentIntersectsRect({ start: [0, 5], end: [40, 5] }, r, 6)).toBe(true);
    expect(segmentRectClearance({ start: [0, 20], end: [40, 20] }, r)).toBe(0);
    expect(segmentRectClearance({ start: [0, 0], end: [40, 0] }, r)).toBeCloseTo(10);
    expect(segmentRectIntersectionLength({ start: [0, 20], end: [40, 20] }, r)).toBeCloseTo(20);
    expect(segmentRectIntersectionLength({ start: [0, 0], end: [40, 0] }, r)).toBe(0);
    expect(segmentsIntersect([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsIntersect([0, 0], [10, 0], [0, 1], [10, 1])).toBe(false);
  });
  it('normalizeRoutePoints quita duplicados y colineales', () => {
    expect(normalizeRoutePoints([[0, 0], [0, 0], [5, 0], [10, 0], [10, 10]])).toEqual([[0, 0], [10, 0], [10, 10]]);
    expect(normalizeRoutePoints([[0, 0], [NaN, 1], [3, 4]])).toEqual([[0, 0], [3, 4]]);
  });
  it('linesNeeded estima 7px por carácter', () => {
    expect(linesNeeded('hola', 160)).toBe(1);
    expect(linesNeeded('una etiqueta bastante larga que no cabe en una línea', 160)).toBeGreaterThan(1);
    expect(linesNeeded('a\nb\nc', 160)).toBe(3);
  });
});

describe('geometryLint', () => {
  it('detecta solapes y ofrece mover o layout automático', () => {
    const { store, mk } = scene();
    mk('a', 'freeform:box', 'A', { x: 0, y: 0 });
    mk('b', 'freeform:box', 'B', { x: 50, y: 10 });
    mk('c', 'freeform:box', 'C', { x: 400, y: 400 });
    const diags = lintView(store, reg(), 'v').filter(d => d.code === 'node-overlap');
    expect(diags).toHaveLength(1);
    expect(diags[0]!.subject).toEqual({ collection: 'nodes', id: 'b' });
    expect(diags[0]!.supportedFixes.map(f => f.command)).toContainEqual(AUTO_LAYOUT_FIX);
    execute(store, diags[0]!.supportedFixes[0]!.command);
    expect(lintView(store, reg(), 'v').filter(d => d.code === 'node-overlap')).toHaveLength(0);
  });

  it('no cuenta como solape un nodo dentro de un contenedor ni dos hermanos de padres distintos', () => {
    const { store, mk } = scene();
    mk('g', 'freeform:group', 'G', { x: 0, y: 0, w: 400, h: 300 });
    mk('a', 'freeform:box', 'A', { x: 20, y: 40 }, { parentNodeId: 'g' });
    mk('b', 'freeform:box', 'B', { x: 20, y: 40 });
    // b (raíz, en 20,40) y a (hija de g, 20,40 relativos) no son hermanos
    expect(lintView(store, reg(), 'v').filter(d => d.code === 'node-overlap')).toHaveLength(0);
  });

  it('detecta un hijo fuera de su contenedor', () => {
    const { store, mk } = scene();
    mk('g', 'freeform:group', 'G', { x: 0, y: 0, w: 200, h: 120 });
    mk('a', 'freeform:box', 'A', { x: 100, y: 40 }, { parentNodeId: 'g' });
    const d = lintView(store, reg(), 'v').find(x => x.code === 'node-outside-parent');
    expect(d).toBeDefined();
    expect(d!.subject.id).toBe('a');
    const enlarge = d!.supportedFixes.find(f => f.label.startsWith('Ampliar'))!;
    execute(store, enlarge.command);
    expect(lintView(store, reg(), 'v').filter(x => x.code === 'node-outside-parent')).toHaveLength(0);
  });

  it('detecta una arista que atraviesa un nodo ajeno', () => {
    const { store, mk, link } = scene();
    mk('a', 'freeform:box', 'A', { x: 0, y: 100 });
    mk('m', 'freeform:box', 'Medio', { x: 300, y: 100 });
    mk('b', 'freeform:box', 'B', { x: 600, y: 100 });
    link('e', 'a', 'b');
    const d = lintView(store, reg(), 'v').filter(x => x.code === 'edge-through-node');
    expect(d).toHaveLength(1);
    expect(d[0]!.subject).toEqual({ collection: 'edges', id: 'e' });
    expect(d[0]!.evidence?.node).toBe('m');
    // Con un bendpoint que la rodea deja de atravesarlo
    store.set('edges', 'e', { ...store.get('edges', 'e')!, bendpoints: [{ x: 380, y: 300 }] });
    expect(lintView(store, reg(), 'v').filter(x => x.code === 'edge-through-node')).toHaveLength(0);
  });

  it('detecta etiquetas que no caben y nodos pequeños', () => {
    const { store, mk } = scene();
    mk('a', 'freeform:box', 'Supercalifragilisticoespialidoso', { x: 0, y: 0, w: 100, h: 40 });
    mk('s', 'freeform:box', 'S', { x: 300, y: 0, w: 20, h: 10 });
    mk('c', 'freeform:start', 'Nombre larguísimo debajo del círculo', { x: 600, y: 0, w: 40, h: 40 });
    const diags = lintView(store, reg(), 'v');
    const overflow = diags.filter(x => x.code === 'label-overflow');
    expect(overflow.map(x => x.subject.id)).toEqual(['a']);
    execute(store, overflow[0]!.supportedFixes[0]!.command);
    expect(lintView(store, reg(), 'v').filter(x => x.code === 'label-overflow')).toHaveLength(0);
    const small = diags.filter(x => x.code === 'node-too-small');
    expect(small.map(x => x.subject.id)).toEqual(['s']);
    execute(store, small[0]!.supportedFixes[0]!.command);
    expect(store.get('nodes', 's')).toMatchObject({ w: 40, h: 24 });
  });

  it('se integra con validate() del núcleo', () => {
    const { store, mk } = scene();
    mk('a', 'freeform:box', 'A', { x: 0, y: 0 });
    mk('b', 'freeform:box', 'B', { x: 10, y: 10 });
    const diags = validate(store, reg(), [geometryLint]);
    expect(diags.some(d => d.code === 'node-overlap')).toBe(true);
  });
});
