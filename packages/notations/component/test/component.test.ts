import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { COMPONENT_PACK, PROVIDES, REQUIRES, ASSEMBLY, DELEGATION, REALIZATION, DEPENDENCY } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(COMPONENT_PACK);
const T = (n: string) => `component:${n}`;

describe('pack component', () => {
  it('id = prefijo; tipos y relaciones válidos y documentados', () => {
    expect(COMPONENT_PACK.id).toBe('component');
    expect(COMPONENT_PACK.elementTypes.map(t => t.id)).toEqual(['Component', 'ProvidedInterface', 'RequiredInterface', 'Port', 'Artifact', 'Package'].map(T));
    expect(COMPONENT_PACK.relationTypes.map(t => t.id)).toEqual([PROVIDES, REQUIRES, ASSEMBLY, DELEGATION, REALIZATION, DEPENDENCY]);
    for (const t of [...COMPONENT_PACK.elementTypes, ...COMPONENT_PACK.relationTypes]) expect(t.doc, t.id).toBeTruthy();
    for (const t of COMPONENT_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of COMPONENT_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
  });

  it('figuras: interfaces y puerto pequeños (rótulo debajo), componente contenedor', () => {
    const r = reg();
    for (const n of ['ProvidedInterface', 'RequiredInterface', 'Port']) expect(r.elementType(T(n))?.shape).toBe('circle');
    expect(r.elementType(T('Component'))).toMatchObject({ container: true, shape: 'rect' });
    expect(r.relationType(DELEGATION)).toMatchObject({ line: 'solid', targetHead: 'open', meta: { keyword: '«delegate»' } });
    expect(r.relationType(REALIZATION)).toMatchObject({ line: 'dashed', targetHead: 'triangle' });
    expect(r.relationType(DEPENDENCY)).toMatchObject({ line: 'dashed', targetHead: 'open' });
  });

  it('matriz: proporciona/requiere desde componente o puerto, ensamblaje requerida → proporcionada, delegación desde puertos', () => {
    const r = reg();
    expect(r.allowedRelations(T('Component'), T('ProvidedInterface'))).toEqual(expect.arrayContaining([PROVIDES, REALIZATION]));
    expect(r.allowedRelations(T('Port'), T('RequiredInterface'))).toContain(REQUIRES);
    expect(r.isValidRelation(T('Component'), T('RequiredInterface'), PROVIDES)).toBe(false);
    expect(r.allowedRelations(T('RequiredInterface'), T('ProvidedInterface'))).toContain(ASSEMBLY);
    expect(r.isValidRelation(T('ProvidedInterface'), T('RequiredInterface'), ASSEMBLY)).toBe(false);
    expect(r.allowedRelations(T('Port'), T('Component'))).toContain(DELEGATION);
    expect(r.allowedRelations(T('Port'), T('Port'))).toEqual(expect.arrayContaining([ASSEMBLY, DELEGATION]));
    expect(r.allowedRelations(T('Package'), T('Package'))).toContain(DEPENDENCY);
  });

  it('anidamiento: el componente contiene partes, puertos e interfaces', () => {
    const nest = COMPONENT_PACK.nesting!;
    for (const c of ['Component', 'Port', 'ProvidedInterface', 'RequiredInterface']) expect(nest.some(n => n.parent === 'Component' && n.child === c)).toBe(true);
    expect(reg().nestingRelations(T('Component'), T('Port'))).toEqual([]);
  });
});
