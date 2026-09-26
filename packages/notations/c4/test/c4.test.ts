import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { C4_PACK, C4_COLORS } from '../src';

const REL = 'c4:Relationship', USES = 'c4:Uses';
const reg = () => new NotationRegistry().register(C4_PACK);
const ALL = C4_PACK.elementTypes.map(t => t.id);

describe('pack c4', () => {
  it('tiene 7 tipos de elemento y 2 de relación, válidos según el esquema', () => {
    expect(C4_PACK.id).toBe('c4');
    expect(C4_PACK.elementTypes).toHaveLength(7);
    expect(C4_PACK.relationTypes).toHaveLength(2);
    for (const t of C4_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of C4_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(C4_PACK.defaultRelation).toBe(REL);
    expect(C4_PACK.viewpoints.map(v => v.id)).toEqual(['context', 'container', 'component', 'code', 'deployment']);
  });

  it('colores oficiales C4 y formas', () => {
    const r = reg();
    expect(r.elementType('c4:Person')).toMatchObject({ shape: 'actor', color: '#08427B' });
    expect(r.elementType('c4:SoftwareSystem')).toMatchObject({ shape: 'rounded', container: true, color: '#1168BD' });
    expect(r.elementType('c4:Container')).toMatchObject({ shape: 'rounded', container: true, color: '#438DD5' });
    expect(r.elementType('c4:Component')).toMatchObject({ shape: 'rounded', color: '#85BBF0' });
    expect(r.elementType('c4:Code')?.shape).toBe('rect');
    expect(r.elementType('c4:DeploymentNode')?.container).toBe(true);
    expect(r.elementType('c4:Boundary')).toMatchObject({ shape: 'group', container: true });
    expect(C4_COLORS.external).toBe('#999999');
    expect(r.elementType('c4:Person')?.meta?.externalColor).toBe('#999999');
  });

  it('campos', () => {
    const r = reg();
    expect(r.fieldsOf('c4:Person').map(f => f.key)).toEqual(['external']);
    expect(r.fieldsOf('c4:SoftwareSystem').map(f => f.key)).toEqual(['external']);
    expect(r.fieldsOf('c4:Container').map(f => f.key)).toEqual(['technology', 'kind']);
    expect(r.fieldsOf('c4:Container').find(f => f.key === 'kind')?.options).toBe('app,database,queue,filesystem,browser,mobile,microservice');
    expect(r.fieldsOf('c4:Component').map(f => f.key)).toEqual(['technology']);
    expect(r.fieldsOf('c4:DeploymentNode').map(f => f.key)).toEqual(['technology', 'instances']);
    expect(r.fieldsOf('c4:DeploymentNode').find(f => f.key === 'instances')?.kind).toBe('number');
    expect(r.relationType(REL)?.fields.map(f => f.key)).toEqual(['technology', 'description']);
    const uses = r.relationType(USES)!;
    expect(uses.doc).toBeTruthy();
    expect([uses.line, uses.targetHead, uses.fields]).toEqual([r.relationType(REL)!.line, r.relationType(REL)!.targetHead, r.relationType(REL)!.fields]);
  });

  it('matriz: todo con todo salvo Person→Person y Code solo con Code/Component', () => {
    const r = reg();
    expect(r.allowedRelations('c4:Person', 'c4:SoftwareSystem')).toEqual([REL, USES]);
    expect(r.allowedRelations('c4:SoftwareSystem', 'c4:Person')).toEqual([REL, USES]);
    expect(r.allowedRelations('c4:Container', 'c4:Container')).toContain(REL);
    expect(r.allowedRelations('c4:Component', 'c4:Code')).toContain(REL);
    expect(r.allowedRelations('c4:Code', 'c4:Code')).toContain(USES);
    expect(r.allowedRelations('c4:DeploymentNode', 'c4:Container')).toContain(REL);

    expect(r.allowedRelations('c4:Person', 'c4:Person')).toEqual([]);
    expect(r.allowedRelations('c4:Code', 'c4:Person')).toEqual([]);
    expect(r.allowedRelations('c4:Code', 'c4:Container')).toEqual([]);
    expect(r.allowedRelations('c4:SoftwareSystem', 'c4:Code')).toEqual([]);
    expect(r.isValidRelation('c4:Person', 'c4:Person', REL)).toBe(false);

    let allowed = 0;
    for (const s of ALL) for (const t of ALL) if (r.allowedRelations(s, t).length) allowed++;
    // 49 pares - Person→Person - Code con 5 no-pares en cada sentido (10) = 38
    expect(allowed).toBe(38);
  });

  it('con CORE_PACK, Person→Person solo tiene puentes core', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(C4_PACK);
    const rels = r.allowedRelations('c4:Person', 'c4:Person');
    expect(rels).not.toContain(REL);
    expect(rels.every(id => id.startsWith('core:'))).toBe(true);
    expect(rels).toContain('core:trace');
  });

  it('anidamiento jerárquico sin relación implícita', () => {
    const r = reg();
    const has = (p: string, c: string) => C4_PACK.nesting!.some(n => n.parent === p && (n.child === c || n.child === '*'));
    expect(has('SoftwareSystem', 'Container')).toBe(true);
    expect(has('Container', 'Component')).toBe(true);
    expect(has('Component', 'Code')).toBe(true);
    expect(has('DeploymentNode', 'DeploymentNode')).toBe(true);
    expect(has('DeploymentNode', 'Container')).toBe(true);
    expect(has('Boundary', 'Person')).toBe(true);
    expect(has('SoftwareSystem', 'Component')).toBe(false);
    expect(has('Container', 'SoftwareSystem')).toBe(false);
    for (const n of C4_PACK.nesting!) expect(n.relationTypes).toEqual([]);
    expect(r.nestingRelations('c4:SoftwareSystem', 'c4:Container')).toEqual([]);
    expect(C4_PACK.defaultNestingRelation).toBeUndefined();
  });

  it('viewpoints filtran por nivel', () => {
    const r = reg();
    const vp = (id: string, type: string) => r.inViewpoint('c4', id, type);
    expect(vp('context', 'c4:Person')).toBe(true);
    expect(vp('context', 'c4:SoftwareSystem')).toBe(true);
    expect(vp('context', 'c4:Container')).toBe(false);
    expect(vp('container', 'c4:Container')).toBe(true);
    expect(vp('container', 'c4:Component')).toBe(false);
    expect(vp('component', 'c4:Component')).toBe(true);
    expect(vp('component', 'c4:Code')).toBe(false);
    expect(vp('code', 'c4:Code')).toBe(true);
    expect(vp('deployment', 'c4:DeploymentNode')).toBe(true);
    expect(vp('deployment', 'c4:Container')).toBe(true);
    expect(vp('deployment', 'c4:SoftwareSystem')).toBe(true);
    expect(vp('deployment', 'c4:Person')).toBe(false);
    expect(vp('context', 'c4:DeploymentNode')).toBe(false);
    expect(vp(undefined as unknown as string, 'c4:Code')).toBe(true);
  });
});
