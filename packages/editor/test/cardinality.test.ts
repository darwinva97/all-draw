import { describe, it, expect } from 'vitest';
import type { FieldDef } from '@all-draw/core';
import { cardToHead, cardEnds, endDirection, endLabel } from '../src/edges/cardinality';
import * as io from '../../io/src/svg';

const ER: FieldDef[] = [{ key: 'sourceCard', label: 'o', kind: 'select', options: '1,1..1,0..1,*,1..*,0..*' }, { key: 'targetCard', label: 'd', kind: 'select', options: '1,1..1,0..1,*,1..*,0..*' }];
const UML: FieldDef[] = [{ key: 'sourceCard', label: 'o', kind: 'text' }, { key: 'targetCard', label: 'd', kind: 'text' }, { key: 'sourceRole', label: 'r', kind: 'text' }];

describe('cardinalidades en el editor', () => {
  it('cardToHead: las seis cardinalidades IE', () => {
    expect(['1', '1..1', '0..1', '*', '1..*', '0..*'].map(cardToHead)).toEqual(['one', 'only-one', 'zero-or-one', 'many', 'one-or-many', 'zero-or-many']);
    expect(cardToHead('0..N')).toBe('zero-or-many');
    expect(cardToHead('3')).toBeUndefined();
  });

  it('select → cabeza; texto → rótulo; roles aparte', () => {
    expect(cardEnds({ sourceCard: '1..1', targetCard: '0..*' }, ER)).toEqual({ sourceHead: 'only-one', targetHead: 'zero-or-many' });
    expect(cardEnds({ sourceCard: '1', targetCard: '0..*', sourceRole: 'dueño' }, UML)).toEqual({ sourceCard: '1', targetCard: '0..*', sourceRole: 'dueño' });
    expect(cardEnds({ sourceCard: '  ' }, UML)).toEqual({});
    expect(cardEnds(undefined, UML)).toEqual({});
  });

  it('dirección del extremo: lado del nodo (ortogonal) o cuerda (recta)', () => {
    expect(endDirection({ x: 0, y: 0 }, 'right', { x: 100, y: 50 }, 'smoothstep', false)).toEqual({ x: 1, y: 0 });
    expect(endDirection({ x: 0, y: 0 }, 'right', { x: 30, y: 40 }, 'straight', false)).toEqual({ x: 0.6, y: 0.8 });
    expect(endDirection({ x: 0, y: 0 }, 'bottom', { x: 80, y: 120 }, 'smoothstep', true)).toEqual({ x: 0, y: 1 });
  });

  it('rótulo a 14 px del extremo, multiplicidad y rol a lados opuestos', () => {
    expect(endLabel({ x: 100, y: 50 }, { x: 1, y: 0 }, 1)).toEqual({ x: 106, y: 40, anchor: 'start' });
    expect(endLabel({ x: 100, y: 50 }, { x: -1, y: 0 }, -1)).toEqual({ x: 94, y: 61, anchor: 'end' });
    expect(endLabel({ x: 100, y: 50 }, { x: 0, y: 1 }, 1)).toEqual({ x: 107, y: 64, anchor: 'start' });
  });

  it('la réplica de io/src/svg.ts se comporta igual', () => {
    for (const v of ['1', '1..1', '0..1', '*', '1..*', '0..*', 'n', '0..m', '2']) expect(io.cardToHead(v)).toEqual(cardToHead(v));
    for (const f of [{ sourceCard: '0..1', targetCard: '*' }, { sourceCard: '1', targetRole: 'x' }]) {
      expect(io.cardEnds(f, ER)).toEqual(cardEnds(f, ER));
      expect(io.cardEnds(f, UML)).toEqual(cardEnds(f, UML));
    }
  });
});
