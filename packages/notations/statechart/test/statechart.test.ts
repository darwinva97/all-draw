import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { STATECHART_PACK } from '../src';

const T = 'statechart:Transition';
const reg = () => new NotationRegistry().register(STATECHART_PACK);

describe('pack statechart', () => {
  it('tiene 9 tipos de elemento y 1 de relación, todos válidos según el esquema', () => {
    expect(STATECHART_PACK.id).toBe('statechart');
    expect(STATECHART_PACK.elementTypes).toHaveLength(9);
    expect(STATECHART_PACK.relationTypes).toHaveLength(1);
    for (const t of STATECHART_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of STATECHART_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(STATECHART_PACK.defaultRelation).toBe(T);
    expect(STATECHART_PACK.viewpoints).toEqual([]);
    expect(STATECHART_PACK.categories.map(c => c.id)).toEqual(['states']);
    expect(new Set(STATECHART_PACK.elementTypes.map(t => t.category)).size).toBe(1);
  });

  it('se registra y resuelve tipos', () => {
    const r = reg();
    expect(r.pack('statechart')).toBe(STATECHART_PACK);
    expect(r.elementType('statechart:State')?.container).toBe(true);
    expect(r.elementType('statechart:Parallel')?.container).toBe(true);
    expect(r.elementType('statechart:Final')?.shape).toBe('double-circle');
    expect(r.relationType(T)?.notationId).toBe('statechart');
    expect(r.fieldsOf('statechart:State').map(f => f.key)).toEqual(['entry', 'exit', 'activities']);
    expect(r.fieldsOf('statechart:History').map(f => f.key)).toEqual(['deep']);
    expect(r.relationType(T)?.fields.map(f => f.key)).toEqual(['event', 'guard', 'actions', 'delay', 'internal']);
  });

  it('matriz: casos positivos', () => {
    const r = reg();
    expect(r.allowedRelations('statechart:Initial', 'statechart:State')).toContain(T);
    expect(r.allowedRelations('statechart:State', 'statechart:State')).toContain(T);
    expect(r.allowedRelations('statechart:State', 'statechart:Final')).toContain(T);
    expect(r.allowedRelations('statechart:Fork', 'statechart:State')).toContain(T);
    expect(r.allowedRelations('statechart:State', 'statechart:Join')).toContain(T);
    expect(r.allowedRelations('statechart:Join', 'statechart:State')).toContain(T);
    expect(r.allowedRelations('statechart:Choice', 'statechart:Final')).toContain(T);
    expect(r.allowedRelations('statechart:History', 'statechart:State')).toContain(T);
    expect(r.allowedRelations('statechart:State', 'statechart:Terminate')).toContain(T);
    expect(r.isValidRelation('statechart:Initial', 'statechart:Choice', T)).toBe(true);
  });

  it('matriz: casos negativos (pseudoestados solo origen / solo destino)', () => {
    const r = reg();
    expect(r.allowedRelations('statechart:State', 'statechart:Initial')).toEqual([]);
    expect(r.allowedRelations('statechart:Final', 'statechart:State')).toEqual([]);
    expect(r.allowedRelations('statechart:Terminate', 'statechart:State')).toEqual([]);
    expect(r.allowedRelations('statechart:Initial', 'statechart:Final')).toEqual([]);
    expect(r.allowedRelations('statechart:Initial', 'statechart:Initial')).toEqual([]);
    expect(r.allowedRelations('statechart:History', 'statechart:Final')).toEqual([]);
    expect(r.allowedRelations('statechart:Fork', 'statechart:Final')).toEqual([]);
    expect(r.isValidRelation('statechart:State', 'statechart:Initial', T)).toBe(false);
  });

  it('con CORE_PACK registrado los puentes se suman pero la Transition sigue restringida', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(STATECHART_PACK);
    const rels = r.allowedRelations('statechart:Final', 'statechart:State');
    expect(rels).not.toContain(T);
    expect(rels).toContain('core:trace');
  });

  it('anidamiento: State y Parallel aceptan hijos sin relación implícita', () => {
    const r = reg();
    const children = ['State', 'Initial', 'Final', 'History', 'Choice', 'Fork', 'Join'];
    for (const parent of ['statechart:State', 'statechart:Parallel']) {
      for (const c of children) {
        const rule = STATECHART_PACK.nesting!.find(n => n.parent === parent.slice('statechart:'.length) && n.child === c);
        expect(rule, `${parent} ⊃ ${c}`).toBeDefined();
        expect(rule!.relationTypes).toEqual([]);
        expect(r.nestingRelations(parent, `statechart:${c}`)).toEqual([]);
      }
    }
  });

  it('sin viewpoints todo tipo pertenece a cualquier vista', () => {
    const r = reg();
    expect(r.inViewpoint('statechart', undefined, 'statechart:State')).toBe(true);
    expect(r.inViewpoint('statechart', 'inexistente', 'statechart:Fork')).toBe(true);
  });
});
