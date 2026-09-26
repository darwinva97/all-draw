import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType, derivePorts } from '@all-draw/core';
import { SEQUENCE_PACK, MESSAGE, RETURN } from '../src';

const reg = () => new NotationRegistry().register(SEQUENCE_PACK);

describe('pack sequence', () => {
  it('tiene 4 tipos de elemento y 2 de relación válidos según el esquema', () => {
    expect(SEQUENCE_PACK.id).toBe('sequence');
    expect(SEQUENCE_PACK.viewKind).toBe('sequence');
    expect(SEQUENCE_PACK.elementTypes.map(t => t.id)).toEqual(['sequence:Lifeline', 'sequence:Activation', 'sequence:Fragment', 'sequence:Note']);
    expect(SEQUENCE_PACK.relationTypes.map(t => t.id)).toEqual([MESSAGE, RETURN]);
    for (const t of SEQUENCE_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of SEQUENCE_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(SEQUENCE_PACK.defaultRelation).toBe(MESSAGE);
  });

  it('campos: kind de Lifeline y Fragment, order/text del mensaje', () => {
    const r = reg();
    expect(r.fieldsOf('sequence:Lifeline').find(f => f.key === 'kind')?.options).toBe('actor,boundary,control,entity,database,participant');
    expect(r.fieldsOf('sequence:Fragment').map(f => f.key)).toEqual(['kind', 'condition']);
    expect(r.elementType('sequence:Fragment')?.container).toBe(true);
    expect(r.relationType(MESSAGE)?.fields.map(f => f.key)).toEqual(['kind', 'order', 'text']);
    expect(r.relationType(MESSAGE)?.fields.find(f => f.key === 'order')?.kind).toBe('number');
    expect(r.relationType(RETURN)).toMatchObject({ line: 'dashed', targetHead: 'open' });
    expect(r.relationType(MESSAGE)).toMatchObject({ line: 'solid', targetHead: 'arrow' });
    // Ningún campo genera puertos: la secuencia se conecta por extremos.
    expect(derivePorts({ id: 'x', fields: { kind: 'actor' } }, r.fieldsOf('sequence:Lifeline'))).toEqual([]);
  });

  it('matriz: mensajes entre líneas de vida y activaciones; notas y fragmentos no', () => {
    const r = reg();
    expect(r.allowedRelations('sequence:Lifeline', 'sequence:Lifeline')).toEqual([MESSAGE, RETURN]);
    expect(r.allowedRelations('sequence:Lifeline', 'sequence:Activation')).toContain(MESSAGE);
    expect(r.allowedRelations('sequence:Activation', 'sequence:Lifeline')).toContain(RETURN);
    expect(r.allowedRelations('sequence:Note', 'sequence:Lifeline')).toEqual([]);
    expect(r.allowedRelations('sequence:Lifeline', 'sequence:Fragment')).toEqual([]);
    expect(r.isValidRelation('sequence:Fragment', 'sequence:Lifeline', MESSAGE)).toBe(false);
  });

  it('con CORE_PACK una nota puede enlazarse por core:link', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(SEQUENCE_PACK);
    expect(r.allowedRelations('sequence:Note', 'sequence:Lifeline')).toContain('core:link');
    expect(r.allowedRelations('sequence:Note', 'sequence:Lifeline')).not.toContain(MESSAGE);
  });

  it('anidamiento sin relación implícita', () => {
    const r = reg();
    expect(r.nestingRelations('sequence:Lifeline', 'sequence:Activation')).toEqual([]);
    expect(SEQUENCE_PACK.nesting!.some(n => n.parent === 'Fragment' && n.child === '*')).toBe(true);
    expect(SEQUENCE_PACK.defaultNestingRelation).toBeUndefined();
  });
});
