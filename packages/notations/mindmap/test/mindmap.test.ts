import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { MINDMAP_PACK, BRANCH } from '../src';

const reg = () => new NotationRegistry().register(MINDMAP_PACK);

describe('pack mindmap', () => {
  it('3 tipos de elemento, 1 rama sin cabezas, sin anidamiento', () => {
    expect(MINDMAP_PACK.id).toBe('mindmap');
    expect(MINDMAP_PACK.elementTypes.map(t => t.id)).toEqual(['mindmap:Root', 'mindmap:Topic', 'mindmap:Subtopic']);
    expect(MINDMAP_PACK.relationTypes.map(t => t.id)).toEqual([BRANCH]);
    for (const t of MINDMAP_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of MINDMAP_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    expect(MINDMAP_PACK.relationTypes[0]).toMatchObject({ sourceHead: 'none', targetHead: 'none', line: 'solid' });
    expect(MINDMAP_PACK.nesting).toBeUndefined();
    expect(MINDMAP_PACK.defaultNestingRelation).toBeUndefined();
    expect(MINDMAP_PACK.defaultRelation).toBe(BRANCH);
    expect(MINDMAP_PACK.elementTypes.every(t => !t.container)).toBe(true);
  });

  it('matriz: ramas hacia fuera, nada apunta a la raíz', () => {
    const r = reg();
    expect(r.allowedRelations('mindmap:Root', 'mindmap:Topic')).toEqual([BRANCH]);
    expect(r.allowedRelations('mindmap:Topic', 'mindmap:Subtopic')).toEqual([BRANCH]);
    expect(r.allowedRelations('mindmap:Subtopic', 'mindmap:Subtopic')).toEqual([BRANCH]);
    expect(r.allowedRelations('mindmap:Topic', 'mindmap:Root')).toEqual([]);
    expect(r.allowedRelations('mindmap:Subtopic', 'mindmap:Topic')).toEqual([]);
    expect(r.allowedRelations('mindmap:Root', 'mindmap:Root')).toEqual([]);
    expect(r.nestingRelations('mindmap:Root', 'mindmap:Topic')).toEqual([]);
  });

  it('con CORE_PACK se añaden puentes', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(MINDMAP_PACK);
    expect(r.allowedRelations('mindmap:Topic', 'mindmap:Root')).toContain('core:trace');
  });
});
