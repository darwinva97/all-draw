import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType, derivePorts } from '@all-draw/core';
import { UML_CLASS_PACK, UML_CLASS_PACK_ID, ASSOCIATION, AGGREGATION, COMPOSITION, GENERALIZATION, REALIZATION, DEPENDENCY } from '../src';

const reg = () => new NotationRegistry().register(UML_CLASS_PACK);

describe('pack uml-class', () => {
  it('id `uml` (prefijo de los tipos), 4 tipos de elemento y 6 de relación válidos', () => {
    expect(UML_CLASS_PACK.id).toBe('uml');
    expect(UML_CLASS_PACK_ID).toBe(UML_CLASS_PACK.id);
    expect(UML_CLASS_PACK.elementTypes.map(t => t.id)).toEqual(['uml:Class', 'uml:Interface', 'uml:Enum', 'uml:Package']);
    expect(UML_CLASS_PACK.relationTypes.map(t => t.id)).toEqual([ASSOCIATION, AGGREGATION, COMPOSITION, GENERALIZATION, REALIZATION, DEPENDENCY]);
    for (const t of UML_CLASS_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of UML_CLASS_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(reg().notationOf('uml:Class')).toBe(UML_CLASS_PACK.id);
  });

  it('campos y cabezas', () => {
    const r = reg();
    expect(r.fieldsOf('uml:Class').map(f => f.key)).toEqual(['stereotype', 'abstract', 'attributes', 'operations']);
    expect(r.fieldsOf('uml:Class').find(f => f.key === 'abstract')?.kind).toBe('checkbox');
    expect(r.fieldsOf('uml:Enum').map(f => f.key)).toEqual(['values']);
    expect(r.elementType('uml:Package')?.container).toBe(true);
    expect(r.relationType(AGGREGATION)?.sourceHead).toBe('diamond');
    expect(r.relationType(COMPOSITION)?.sourceHead).toBe('filled-diamond');
    expect(r.relationType(GENERALIZATION)).toMatchObject({ line: 'solid', targetHead: 'triangle' });
    expect(r.relationType(REALIZATION)).toMatchObject({ line: 'dashed', targetHead: 'triangle' });
    expect(r.relationType(DEPENDENCY)).toMatchObject({ line: 'dashed', targetHead: 'open' });
    // Atributos como pines; operaciones y valores no.
    const ports = derivePorts({ id: 'c', fields: { attributes: ['- id: UUID', '- nombre: String'], operations: ['+ guardar()'] } }, r.fieldsOf('uml:Class'));
    expect(ports.map(p => p.key)).toEqual(['attributes[0]', 'attributes[1]']);
  });

  it('matriz: generalización solo entre el mismo kind, realización Class→Interface', () => {
    const r = reg();
    expect(r.allowedRelations('uml:Class', 'uml:Class')).toContain(GENERALIZATION);
    expect(r.allowedRelations('uml:Interface', 'uml:Interface')).toContain(GENERALIZATION);
    expect(r.allowedRelations('uml:Class', 'uml:Interface')).not.toContain(GENERALIZATION);
    expect(r.allowedRelations('uml:Interface', 'uml:Class')).not.toContain(GENERALIZATION);
    expect(r.allowedRelations('uml:Enum', 'uml:Enum')).not.toContain(GENERALIZATION);
    expect(r.allowedRelations('uml:Class', 'uml:Interface')).toContain(REALIZATION);
    expect(r.allowedRelations('uml:Interface', 'uml:Class')).not.toContain(REALIZATION);
    expect(r.allowedRelations('uml:Class', 'uml:Class')).not.toContain(REALIZATION);
    expect(r.isValidRelation('uml:Class', 'uml:Enum', COMPOSITION)).toBe(true);
    expect(r.isValidRelation('uml:Enum', 'uml:Class', ASSOCIATION)).toBe(false);
    expect(r.allowedRelations('uml:Package', 'uml:Package')).toEqual([DEPENDENCY]);
    expect(r.allowedRelations('uml:Class', 'uml:Package')).toEqual([DEPENDENCY]);
  });

  it('puentes core y anidamiento en paquetes', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(UML_CLASS_PACK);
    expect(r.allowedRelations('uml:Enum', 'uml:Class')).toContain('core:trace');
    expect(r.nestingRelations('uml:Package', 'uml:Class')).toEqual([]);
    expect(UML_CLASS_PACK.nesting!.some(n => n.parent === 'Package' && n.child === '*')).toBe(true);
  });
});
