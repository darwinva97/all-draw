import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { FLOWCHART_PACK, ARROW } from '../src';

const reg = () => new NotationRegistry().register(FLOWCHART_PACK);
const ALL = FLOWCHART_PACK.elementTypes.map(t => t.id);

describe('pack flowchart', () => {
  it('9 tipos de elemento con prefijo flow:, 1 flecha con label', () => {
    expect(FLOWCHART_PACK.id).toBe('flow');
    expect(ALL).toEqual(['flow:Start', 'flow:End', 'flow:Process', 'flow:Decision', 'flow:IO', 'flow:Document', 'flow:Database', 'flow:Connector', 'flow:Subroutine']);
    expect(FLOWCHART_PACK.relationTypes.map(t => t.id)).toEqual([ARROW]);
    for (const t of FLOWCHART_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of FLOWCHART_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(FLOWCHART_PACK.relationTypes[0]!.fields.map(f => f.key)).toEqual(['label']);
    expect(FLOWCHART_PACK.defaultRelation).toBe(ARROW);
  });

  it('formas', () => {
    const r = reg();
    const shape = (id: string) => r.elementType(id)?.shape;
    expect(shape('flow:Start')).toBe('rounded');
    expect(shape('flow:End')).toBe('rounded');
    expect(shape('flow:Process')).toBe('rect');
    expect(shape('flow:Decision')).toBe('diamond');
    expect(shape('flow:IO')).toBe('parallelogram');
    expect(shape('flow:Document')).toBe('note');
    expect(shape('flow:Database')).toBe('cylinder');
    expect(shape('flow:Connector')).toBe('circle');
    expect(r.elementType('flow:Subroutine')?.meta?.doubleBorder).toBe(true);
  });

  it('matriz: End no es origen, Start no es destino, el resto todo con todo', () => {
    const r = reg();
    for (const t of ALL) expect(r.allowedRelations('flow:End', t)).toEqual([]);
    for (const s of ALL) expect(r.allowedRelations(s, 'flow:Start')).toEqual([]);
    expect(r.allowedRelations('flow:Start', 'flow:Process')).toEqual([ARROW]);
    expect(r.allowedRelations('flow:Decision', 'flow:End')).toEqual([ARROW]);
    expect(r.allowedRelations('flow:Process', 'flow:Process')).toEqual([ARROW]);
    expect(r.allowedRelations('flow:Connector', 'flow:Connector')).toEqual([ARROW]);
    let allowed = 0;
    for (const s of ALL) for (const t of ALL) if (r.allowedRelations(s, t).length) allowed++;
    // 9×9 = 81, menos la fila End (9) y la columna Start (9), más End→Start contado dos veces (1) = 64
    expect(allowed).toBe(64);
  });

  it('con CORE_PACK End→Start solo tiene puentes', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(FLOWCHART_PACK);
    const rels = r.allowedRelations('flow:End', 'flow:Start');
    expect(rels).not.toContain(ARROW);
    expect(rels).toContain('core:trace');
  });
});
