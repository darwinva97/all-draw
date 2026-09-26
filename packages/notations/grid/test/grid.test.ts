import { describe, it, expect } from 'vitest';
import { GridLayout } from '@all-draw/core';
import {
  DEFAULT_GRID, GRID_PACK, cellRects, cellAt, hitTest, cellKey, stageSpans,
  addLayer, addStage, addStageGroup, removeLayer, removeStage, removeStageGroup,
  updateLayer, moveStage, setStageGroup, normalizeGrid,
} from '../src';

const OPTS = { headerW: 100, headerH: 40, groupH: 20, defaultLayerH: 150, defaultStageW: 200 };

describe('GRID_PACK', () => {
  it('es una clase de vista sin tipos propios', () => {
    expect(GRID_PACK.id).toBe('grid');
    expect(GRID_PACK.viewKind).toBe('grid');
    expect(GRID_PACK.elementTypes).toEqual([]);
  });
  it('DEFAULT_GRID es 3 capas × 4 etapas y pasa el esquema', () => {
    expect(DEFAULT_GRID.layers.map(l => l.name)).toEqual(['Negocio', 'Aplicación', 'Tecnología']);
    expect(DEFAULT_GRID.stages).toHaveLength(4);
    expect(() => GridLayout.parse(DEFAULT_GRID)).not.toThrow();
  });
});

describe('cellRects', () => {
  it('coloca celdas tras las cabeceras y respeta tamaños fijos', () => {
    const grid = updateLayer(DEFAULT_GRID, 'layer:aplicacion', { size: 300 });
    const r = cellRects(grid, OPTS);
    expect(r.top).toBe(40);
    expect(r.left).toBe(100);
    expect(r.width).toBe(100 + 4 * 200);
    expect(r.height).toBe(40 + 150 + 300 + 150);
    expect(r.cells[cellKey('layer:negocio', 'stage:1')]).toMatchObject({ x: 100, y: 40, w: 200, h: 150 });
    expect(r.cells[cellKey('layer:tecnologia', 'stage:3')]).toMatchObject({ x: 500, y: 40 + 150 + 300, w: 200, h: 150 });
    expect(r.layers['layer:aplicacion']).toMatchObject({ x: 0, y: 190, w: 100, h: 300 });
    expect(r.stages['stage:2']).toMatchObject({ x: 300, y: 0, w: 200, h: 40 });
    expect(r.spans).toEqual([]);
  });
  it('con grupos añade la banda superior y abarca etapas contiguas', () => {
    const grid = addStageGroup(DEFAULT_GRID, { id: 'g1', name: 'Rápido' }, ['stage:2', 'stage:3']);
    const r = cellRects(grid, OPTS);
    expect(r.top).toBe(60);
    expect(r.stages['stage:1']!.y).toBe(20);
    expect(r.cells[cellKey('layer:negocio', 'stage:1')]!.y).toBe(60);
    expect(r.spans).toEqual([{ groupId: 'g1', stageIds: ['stage:2', 'stage:3'], rect: { x: 300, y: 0, w: 400, h: 20 } }]);
    expect(r.groups['g1']).toEqual({ x: 300, y: 0, w: 400, h: 20 });
    expect(stageSpans(grid).map(s => s.stageIds)).toEqual([['stage:1'], ['stage:2', 'stage:3'], ['stage:4']]);
  });
});

describe('cellAt / hitTest', () => {
  const r = cellRects(DEFAULT_GRID, OPTS);
  it('devuelve la celda bajo el punto', () => {
    expect(cellAt(DEFAULT_GRID, r, 350, 250)).toEqual({ layerId: 'layer:aplicacion', stageId: 'stage:2' });
    expect(cellAt(DEFAULT_GRID, r, 100, 40)).toEqual({ layerId: 'layer:negocio', stageId: 'stage:1' });
  });
  it('null en cabeceras y fuera', () => {
    expect(cellAt(DEFAULT_GRID, r, 50, 250)).toBeNull();
    expect(cellAt(DEFAULT_GRID, r, 350, 10)).toBeNull();
    expect(cellAt(DEFAULT_GRID, r, 5000, 250)).toBeNull();
    expect(hitTest(DEFAULT_GRID, r, 50, 250)).toEqual({ kind: 'layer', layerId: 'layer:aplicacion' });
    expect(hitTest(DEFAULT_GRID, r, 350, 10)).toEqual({ kind: 'stage', stageId: 'stage:2' });
    expect(hitTest(DEFAULT_GRID, r, -1, -1)).toBeNull();
  });
});

describe('operaciones inmutables', () => {
  it('no mutan el original', () => {
    const before = structuredClone(DEFAULT_GRID);
    const g2 = addLayer(DEFAULT_GRID, { name: 'Datos' });
    const g3 = removeStage(g2, 'stage:1');
    expect(DEFAULT_GRID).toEqual(before);
    expect(g2.layers).toHaveLength(4);
    expect(g2.layers[3]!.name).toBe('Datos');
    expect(g3.stages.map(s => s.id)).toEqual(['stage:2', 'stage:3', 'stage:4']);
  });
  it('inserta en posición, mueve y borra', () => {
    const g = addStage(DEFAULT_GRID, { id: 'stage:0', name: 'Cero' }, 0);
    expect(g.stages[0]!.id).toBe('stage:0');
    expect(moveStage(g, 'stage:0', 2).stages.map(s => s.id)).toEqual(['stage:1', 'stage:2', 'stage:0', 'stage:3', 'stage:4']);
    expect(removeLayer(g, 'layer:negocio').layers).toHaveLength(2);
    expect(() => addStage(g, { id: 'stage:0' })).toThrow();
  });
  it('grupos: crear, asignar, quitar deja etapas sueltas', () => {
    let g = addStageGroup(DEFAULT_GRID, { id: 'g', name: 'G' }, ['stage:1']);
    g = setStageGroup(g, 'stage:2', 'g');
    expect(g.stages.filter(s => s.groupId === 'g').map(s => s.id)).toEqual(['stage:1', 'stage:2']);
    expect(() => setStageGroup(g, 'stage:3', 'nope')).toThrow();
    const g2 = removeStageGroup(g, 'g');
    expect(g2.stageGroups).toEqual([]);
    expect(g2.stages.every(s => s.groupId === null)).toBe(true);
  });
  it('normalizeGrid sanea grupos rotos y duplicados', () => {
    const g = normalizeGrid({ layers: [{ id: 'a', name: 'A' }, { id: 'a', name: 'A2' }], stages: [{ id: 's', name: 'S', groupId: 'zz' }] });
    expect(g.layers).toHaveLength(1);
    expect(g.stages[0]!.groupId).toBeNull();
    expect(g.stageGroups).toEqual([]);
  });
});
