import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { USECASE_PACK, USECASE_PACK_ID, ASSOCIATION, INCLUDE, EXTEND, GENERALIZATION, DEPENDENCY } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(USECASE_PACK);

describe('pack usecase', () => {
  it('id = prefijo de los tipos; tipos y relaciones válidos y documentados', () => {
    expect(USECASE_PACK.id).toBe('usecase');
    expect(USECASE_PACK_ID).toBe(USECASE_PACK.id);
    expect(USECASE_PACK.elementTypes.map(t => t.id)).toEqual(['usecase:Actor', 'usecase:UseCase', 'usecase:System', 'usecase:Package']);
    expect(USECASE_PACK.relationTypes.map(t => t.id)).toEqual([ASSOCIATION, INCLUDE, EXTEND, GENERALIZATION, DEPENDENCY]);
    for (const t of USECASE_PACK.elementTypes) { expect(() => ElementType.parse(t)).not.toThrow(); expect(t.doc).toBeTruthy(); expect(t.id.startsWith('usecase:')).toBe(true); }
    for (const t of USECASE_PACK.relationTypes) { expect(() => RelationType.parse(t)).not.toThrow(); expect(t.doc).toBeTruthy(); }
    expect(reg().notationOf('usecase:Actor')).toBe('usecase');
  });

  it('figuras fieles: actor monigote, caso de uso elipse, límite y paquete contenedores', () => {
    const r = reg();
    expect(r.elementType('usecase:Actor')?.shape).toBe('actor');
    expect(r.elementType('usecase:UseCase')?.shape).toBe('ellipse');
    expect(r.elementType('usecase:System')).toMatchObject({ container: true, shape: 'rect' });
    expect(r.elementType('usecase:Package')).toMatchObject({ container: true, shape: 'group' });
    expect(r.relationType(INCLUDE)).toMatchObject({ line: 'dashed', targetHead: 'open', meta: { keyword: '«include»' } });
    expect(r.relationType(EXTEND)).toMatchObject({ line: 'dashed', targetHead: 'open', meta: { keyword: '«extend»' } });
    expect(r.relationType(EXTEND)!.fields.map(f => f.key)).toEqual(['extensionPoint', 'condition']);
    expect(r.relationType(GENERALIZATION)?.targetHead).toBe('triangle');
    expect(r.relationType(ASSOCIATION)).toMatchObject({ line: 'solid', targetHead: 'none' });
  });

  it('matriz: asociación actor ↔ caso de uso, include/extend entre casos de uso, generalización del mismo tipo', () => {
    const r = reg();
    expect(r.allowedRelations('usecase:Actor', 'usecase:UseCase')).toContain(ASSOCIATION);
    expect(r.allowedRelations('usecase:UseCase', 'usecase:Actor')).toContain(ASSOCIATION);
    expect(r.allowedRelations('usecase:UseCase', 'usecase:UseCase')).toEqual(expect.arrayContaining([INCLUDE, EXTEND, GENERALIZATION]));
    expect(r.allowedRelations('usecase:Actor', 'usecase:Actor')).toContain(GENERALIZATION);
    expect(r.isValidRelation('usecase:Actor', 'usecase:UseCase', INCLUDE)).toBe(false);
    expect(r.isValidRelation('usecase:Actor', 'usecase:Actor', ASSOCIATION)).toBe(false);
    expect(r.isValidRelation('usecase:Actor', 'usecase:UseCase', GENERALIZATION)).toBe(false);
    expect(r.allowedRelations('usecase:Package', 'usecase:Package')).toContain(DEPENDENCY);
    expect(r.allowedRelations('usecase:System', 'usecase:UseCase').filter(x => x.startsWith('usecase:'))).toEqual([]);
  });

  it('anidamiento: el sistema contiene casos de uso; el paquete, cualquier cosa', () => {
    expect(USECASE_PACK.nesting).toEqual(expect.arrayContaining([{ parent: 'System', child: 'UseCase', relationTypes: [] }, { parent: 'Package', child: '*', relationTypes: [] }]));
    expect(reg().nestingRelations('usecase:System', 'usecase:UseCase')).toEqual([]);
  });

  it('todo select tiene nombre legible por opción', () => {
    for (const t of [...USECASE_PACK.elementTypes, ...USECASE_PACK.relationTypes]) for (const f of t.fields) if (f.kind === 'select')
      for (const o of f.options!.split(',')) expect(f.optionLabels?.[o], `${t.id}.${f.key}=${o}`).toBeTruthy();
  });
});
