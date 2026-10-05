import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { DDD_PACK, CONTEXT_RELATION, IMPLEMENTS, REFERENCE, PUBLISHES, TRIGGERS, CONTEXT_PATTERNS } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(DDD_PACK);
const T = (n: string) => `ddd:${n}`;

describe('pack ddd', () => {
  it('id = prefijo; tipos y relaciones válidos y documentados', () => {
    expect(DDD_PACK.id).toBe('ddd');
    expect(DDD_PACK.elementTypes.map(t => t.id)).toEqual(['Domain', 'Subdomain', 'BoundedContext', 'Aggregate', 'Entity', 'ValueObject', 'DomainEvent', 'Service'].map(T));
    expect(DDD_PACK.relationTypes.map(t => t.id)).toEqual([CONTEXT_RELATION, IMPLEMENTS, REFERENCE, PUBLISHES, TRIGGERS]);
    for (const t of [...DDD_PACK.elementTypes, ...DDD_PACK.relationTypes, ...DDD_PACK.viewpoints]) expect(t.doc, t.id).toBeTruthy();
    for (const t of DDD_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of DDD_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
  });

  it('subdominio core/supporting/generic; contexto y agregado contenedores; tácticos con compartimentos', () => {
    const r = reg();
    const kind = r.fieldsOf(T('Subdomain')).find(f => f.key === 'kind')!;
    expect(kind.options).toBe('core,supporting,generic');
    expect(Object.keys(kind.optionLabels!)).toEqual(['core', 'supporting', 'generic']);
    expect(r.elementType(T('BoundedContext'))?.container).toBe(true);
    expect(r.elementType(T('Aggregate'))?.container).toBe(true);
    for (const n of ['Entity', 'ValueObject', 'DomainEvent', 'Service']) expect(r.elementType(T(n))?.meta?.compartments, n).toBeTruthy();
    expect(r.elementType(T('ValueObject'))?.meta?.stereotypeDefault).toBe('Value Object');
  });

  it('patrón de relación entre contextos como select con nombre legible; extremos U/D', () => {
    const rel = reg().relationType(CONTEXT_RELATION)!;
    const pattern = rel.fields.find(f => f.key === 'pattern')!;
    expect(pattern.kind).toBe('select');
    expect(pattern.options!.split(',')).toEqual(['Partnership', 'Shared Kernel', 'Customer/Supplier', 'Conformist', 'Anticorruption Layer', 'Open Host Service', 'Published Language', 'Separate Ways']);
    expect(pattern.optionLabels).toEqual(CONTEXT_PATTERNS);
    for (const k of ['sourceRole', 'targetRole']) expect(rel.fields.find(f => f.key === k)).toMatchObject({ kind: 'select', options: 'U,D' });
  });

  it('matriz: contextos entre sí, contexto → subdominio, eventos publicados y que desencadenan', () => {
    const r = reg();
    expect(r.allowedRelations(T('BoundedContext'), T('BoundedContext'))).toContain(CONTEXT_RELATION);
    expect(r.allowedRelations(T('BoundedContext'), T('Subdomain'))).toContain(IMPLEMENTS);
    expect(r.isValidRelation(T('Subdomain'), T('BoundedContext'), IMPLEMENTS)).toBe(false);
    expect(r.isValidRelation(T('Entity'), T('BoundedContext'), CONTEXT_RELATION)).toBe(false);
    expect(r.allowedRelations(T('Aggregate'), T('DomainEvent'))).toContain(PUBLISHES);
    expect(r.allowedRelations(T('DomainEvent'), T('Service'))).toContain(TRIGGERS);
    expect(r.allowedRelations(T('Entity'), T('ValueObject'))).toContain(REFERENCE);
    expect(r.isValidRelation(T('ValueObject'), T('Entity'), REFERENCE)).toBe(false);
  });

  it('anidamiento y viewpoints estratégico/táctico', () => {
    const nest = DDD_PACK.nesting!;
    expect(nest.some(n => n.parent === 'Domain' && n.child === 'BoundedContext')).toBe(true);
    expect(nest.some(n => n.parent === 'BoundedContext' && n.child === 'Aggregate')).toBe(true);
    expect(nest.some(n => n.parent === 'Aggregate' && n.child === 'Entity')).toBe(true);
    const r = reg();
    expect(r.inViewpoint('ddd', 'contextMap', T('BoundedContext'))).toBe(true);
    expect(r.inViewpoint('ddd', 'contextMap', T('Entity'))).toBe(false);
    expect(r.inViewpoint('ddd', 'tactical', T('Entity'))).toBe(true);
  });
});
