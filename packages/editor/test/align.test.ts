import { describe, it, expect } from 'vitest';
import { MemoryStore, exampleWorkspace, parseWorkspace, History } from '@all-draw/core';
import { alignBoxes, distributeBoxes, equalizeSize, type Box } from '../src/align';

const boxes: Box[] = [
  { id: 'a', x: 0, y: 0, w: 100, h: 50 },
  { id: 'b', x: 200, y: 30, w: 60, h: 80 },
  { id: 'c', x: 500, y: 10, w: 40, h: 20 },
];

describe('alignBoxes', () => {
  it('izquierda / derecha / centro horizontal', () => {
    expect(alignBoxes(boxes, 'left')).toEqual([{ id: 'b', x: 0, y: 30 }, { id: 'c', x: 0, y: 10 }]);
    expect(alignBoxes(boxes, 'right')).toEqual([{ id: 'a', x: 440, y: 0 }, { id: 'b', x: 480, y: 30 }]);
    // centro del bloque = (0 + 540) / 2 = 270
    expect(alignBoxes(boxes, 'centerX')).toEqual([{ id: 'a', x: 220, y: 0 }, { id: 'b', x: 240, y: 30 }, { id: 'c', x: 250, y: 10 }]);
  });
  it('arriba / abajo / medio', () => {
    expect(alignBoxes(boxes, 'top')).toEqual([{ id: 'b', x: 200, y: 0 }, { id: 'c', x: 500, y: 0 }]);
    // abajo del bloque = 110
    expect(alignBoxes(boxes, 'bottom')).toEqual([{ id: 'a', x: 0, y: 60 }, { id: 'c', x: 500, y: 90 }]);
    // medio = 55
    expect(alignBoxes(boxes, 'centerY')).toEqual([{ id: 'a', x: 0, y: 30 }, { id: 'b', x: 200, y: 15 }, { id: 'c', x: 500, y: 45 }]);
  });
  it('no hace nada con menos de dos cajas ni con cajas ya alineadas', () => {
    expect(alignBoxes([boxes[0]!], 'left')).toEqual([]);
    expect(alignBoxes([{ id: 'a', x: 0, y: 0, w: 10, h: 10 }, { id: 'b', x: 0, y: 50, w: 20, h: 10 }], 'left')).toEqual([]);
  });
});

describe('distributeBoxes', () => {
  it('reparte huecos iguales sin mover la primera ni la última', () => {
    // span 0..540, anchos 200 → hueco (540-200)/2 = 170 → b.x = 100 + 170 = 270
    expect(distributeBoxes(boxes, 'x')).toEqual([{ id: 'b', x: 270, y: 30 }]);
    // y: orden por centro: a(25), c(20)… c centro 20 < a 25 → c primero, luego a, luego b(70)
    // span desde c.y=10 hasta b.y+h=110 = 100; altos 150 → hueco negativo -25 → a.y = 30 - 25 = 5
    expect(distributeBoxes(boxes, 'y')).toEqual([{ id: 'a', x: 0, y: 5 }]);
  });
  it('necesita al menos tres cajas', () => {
    expect(distributeBoxes(boxes.slice(0, 2), 'x')).toEqual([]);
  });
  it('resultado idempotente', () => {
    const moved = distributeBoxes(boxes, 'x');
    const next = boxes.map(b => { const m = moved.find(x => x.id === b.id); return m ? { ...b, x: m.x, y: m.y } : b; });
    expect(distributeBoxes(next, 'x')).toEqual([]);
  });
});

describe('equalizeSize', () => {
  it('iguala al mayor', () => {
    expect(equalizeSize(boxes, 'w')).toEqual([{ id: 'b', w: 100, h: 80 }, { id: 'c', w: 100, h: 20 }]);
    expect(equalizeSize(boxes, 'h')).toEqual([{ id: 'a', w: 100, h: 80 }, { id: 'c', w: 40, h: 80 }]);
    expect(equalizeSize([boxes[0]!], 'w')).toEqual([]);
  });
});

describe('integración con el store', () => {
  it('alinear produce un moveNodes deshacible en un paso', () => {
    const store = new MemoryStore(parseWorkspace(exampleWorkspace()));
    const history = new History(store);
    const bx = store.list('nodes').filter(n => n.viewId === 'vw_1').map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
    store.set('nodes', 'vn_2', { ...store.get('nodes', 'vn_2')!, y: 90 });
    bx.find(b => b.id === 'vn_2')!.y = 90;
    const moves = alignBoxes(bx, 'top');
    expect(moves).toEqual([{ id: 'vn_2', x: 320, y: 40 }]);
    history.run({ type: 'moveNodes', moves });
    expect(store.get('nodes', 'vn_2')!.y).toBe(40);
    history.undo();
    expect(store.get('nodes', 'vn_2')!.y).toBe(90);
  });
});
