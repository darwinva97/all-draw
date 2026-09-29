import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType, ArrowHead, derivePorts, compatibleRelationTypes } from '@all-draw/core';
import { ER_PACK, ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY, INHERITS, HAS, CARDINALITIES } from '../src';

const reg = () => new NotationRegistry().register(ER_PACK);

describe('pack er', () => {
  it('tiene 3 tipos de elemento y 5 de relación válidos según el esquema', () => {
    expect(ER_PACK.id).toBe('er');
    expect(ER_PACK.elementTypes.map(t => t.id)).toEqual(['er:Entity', 'er:Attribute', 'er:View']);
    expect(ER_PACK.relationTypes.map(t => t.id)).toEqual([ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY, INHERITS, HAS]);
    for (const t of ER_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of ER_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(ER_PACK.defaultRelation).toBe(ONE_TO_MANY);
    expect(ER_PACK.viewpoints.map(v => v.id)).toEqual(['conceptual', 'logical', 'physical']);
  });

  it('cada atributo de una entidad es un pin', () => {
    const r = reg();
    const entity = r.elementType('er:Entity')!;
    expect(entity.container).toBe(false);
    const attrs = entity.fields.find(f => f.key === 'attributes')!;
    expect(attrs).toMatchObject({ kind: 'keyvalue', options: 'Atributo|Tipo', port: true });
    expect(entity.fields.find(f => f.key === 'pk')).toMatchObject({ kind: 'list', port: false });
    const ports = derivePorts({ id: 'cliente', fields: { attributes: [{ key: 'id', value: 'uuid' }, { key: 'email', value: 'text' }], pk: ['id'] } }, r.fieldsOf('er:Entity'));
    expect(ports.map(p => p.id)).toEqual(['cliente#attributes.id', 'cliente#attributes.email']);
    expect(ports.every(p => p.portTypeId === 'er:attribute')).toBe(true);
    expect(compatibleRelationTypes(ER_PACK.portRules!, 'er:attribute', 'er:attribute')).toEqual([ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY]);
  });

  it('cabezas de pata de gallo por tipo, triangle para herencia', () => {
    const r = reg();
    expect(r.relationType(ONE_TO_ONE)).toMatchObject({ sourceHead: 'only-one', targetHead: 'only-one' });
    expect(r.relationType(ONE_TO_MANY)).toMatchObject({ sourceHead: 'only-one', targetHead: 'one-or-many' });
    expect(r.relationType(MANY_TO_MANY)).toMatchObject({ sourceHead: 'one-or-many', targetHead: 'one-or-many' });
    expect(r.relationType(INHERITS)).toMatchObject({ targetHead: 'triangle' });
    expect(r.relationType(ONE_TO_MANY)?.fields.map(f => f.key)).toEqual(['sourceCard', 'targetCard', 'identifying', 'onDelete']);
    expect(ER_PACK.doc).not.toMatch(/falta/);
  });

  it('sourceCard/targetCard: select con las seis cardinalidades, cada una una cabeza IE válida', () => {
    const f = reg().relationType(ONE_TO_MANY)!.fields;
    for (const key of ['sourceCard', 'targetCard']) {
      const def = f.find(d => d.key === key)!;
      expect(def.kind).toBe('select');
      expect(def.options!.split(',')).toEqual(['1', '1..1', '0..1', '*', '1..*', '0..*']);
    }
    expect(Object.values(CARDINALITIES)).toEqual(['one', 'only-one', 'zero-or-one', 'many', 'one-or-many', 'zero-or-many']);
    for (const h of Object.values(CARDINALITIES)) expect(ArrowHead.safeParse(h).success).toBe(true);
  });

  it('matriz: entidad con entidad; atributos y vistas por Has', () => {
    const r = reg();
    expect(r.allowedRelations('er:Entity', 'er:Entity')).toEqual([ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY, INHERITS]);
    expect(r.allowedRelations('er:Entity', 'er:Attribute')).toEqual([HAS]);
    expect(r.allowedRelations('er:View', 'er:Entity')).toEqual([HAS]);
    expect(r.allowedRelations('er:Attribute', 'er:Entity')).toEqual([]);
    expect(r.allowedRelations('er:Entity', 'er:View')).toEqual([]);
    expect(r.isValidRelation('er:View', 'er:Entity', ONE_TO_MANY)).toBe(false);
  });

  it('viewpoints y puentes core', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(ER_PACK);
    expect(r.inViewpoint('er', 'physical', 'er:View')).toBe(true);
    expect(r.inViewpoint('er', 'conceptual', 'er:View')).toBe(false);
    expect(r.allowedRelations('er:Attribute', 'er:Entity')).toContain('core:trace');
  });
});
