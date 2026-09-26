import { describe, it, expect } from 'vitest';
import { Position } from '@xyflow/react';
import { bendPath, nearestSegment, orthogonalize, distToSegment } from '../src/edges/bendpath';

const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

describe('bendPath', () => {
  it('straight: polilínea por los puntos con el rótulo a mitad de longitud', () => {
    const r = bendPath(pts, 'straight', Position.Right, Position.Top);
    expect(r.path).toBe('M 0,0 L 100,0 L 100,100');
    expect([r.labelX, r.labelY]).toEqual([100, 0]);
  });
  it('bezier: pasa exactamente por los puntos', () => {
    const r = bendPath(pts, 'bezier', Position.Right, Position.Top);
    expect(r.path.startsWith('M 0,0 C')).toBe(true);
    expect(r.path.endsWith('100,100')).toBe(true);
    expect(r.path).toContain(' 100,0 ');
  });
  it('smoothstep: tramos ortogonales con esquinas redondeadas', () => {
    const r = bendPath([{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 200 }], 'smoothstep', Position.Right, Position.Top);
    expect(r.path).toContain('Q');
    expect(r.path.endsWith('L 200,200')).toBe(true);
  });
});

describe('orthogonalize', () => {
  it('primer tramo sale según el lado del origen, último entra según el destino', () => {
    const o = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 200 }], Position.Right, Position.Top);
    expect(o).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 200 }]);
    const v = orthogonalize([{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 200, y: 200 }], Position.Bottom, Position.Left);
    expect(v).toEqual([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 200 }, { x: 200, y: 200 }]);
  });
  it('no inserta codos en tramos ya alineados', () => {
    expect(orthogonalize(pts, Position.Right, Position.Top)).toEqual(pts);
  });
});

describe('nearestSegment', () => {
  it('elige el tramo más cercano al punto', () => {
    expect(nearestSegment(pts, { x: 50, y: 5 })).toBe(0);
    expect(nearestSegment(pts, { x: 95, y: 60 })).toBe(1);
    expect(distToSegment({ x: 50, y: 5 }, pts[0]!, pts[1]!)).toBe(5);
    expect(distToSegment({ x: -3, y: 4 }, pts[0]!, pts[1]!)).toBe(5);
  });
});
