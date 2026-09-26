import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType, derivePorts } from '@all-draw/core';
import { DFD_PACK, FLOW } from '../src';

const reg = () => new NotationRegistry().register(DFD_PACK);

describe('pack dfd', () => {
  it('3 tipos de elemento y 1 flujo con campo data (sin puerto)', () => {
    expect(DFD_PACK.id).toBe('dfd');
    expect(DFD_PACK.elementTypes.map(t => t.id)).toEqual(['dfd:Process', 'dfd:DataStore', 'dfd:External']);
    expect(DFD_PACK.relationTypes.map(t => t.id)).toEqual([FLOW]);
    for (const t of DFD_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of DFD_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
    const data = DFD_PACK.relationTypes[0]!.fields.find(f => f.key === 'data')!;
    expect(data).toMatchObject({ kind: 'text', port: false });
    expect(DFD_PACK.nesting).toBeUndefined();
    expect(DFD_PACK.defaultRelation).toBe(FLOW);
  });

  it('formas y campos', () => {
    const r = reg();
    expect(r.elementType('dfd:Process')?.shape).toBe('circle');
    expect(r.elementType('dfd:DataStore')?.shape).toBe('bar');
    expect(r.elementType('dfd:External')?.shape).toBe('rect');
    expect(r.fieldsOf('dfd:Process').map(f => f.key)).toEqual(['number', 'description']);
    expect(derivePorts({ id: 'p', fields: { number: '1.2' } }, r.fieldsOf('dfd:Process'))).toEqual([]);
  });

  it('matriz: todo flujo toca un proceso', () => {
    const r = reg();
    expect(r.allowedRelations('dfd:External', 'dfd:Process')).toEqual([FLOW]);
    expect(r.allowedRelations('dfd:Process', 'dfd:External')).toEqual([FLOW]);
    expect(r.allowedRelations('dfd:Process', 'dfd:DataStore')).toEqual([FLOW]);
    expect(r.allowedRelations('dfd:DataStore', 'dfd:Process')).toEqual([FLOW]);
    expect(r.allowedRelations('dfd:Process', 'dfd:Process')).toEqual([FLOW]);
    expect(r.allowedRelations('dfd:External', 'dfd:External')).toEqual([]);
    expect(r.allowedRelations('dfd:DataStore', 'dfd:DataStore')).toEqual([]);
    expect(r.allowedRelations('dfd:External', 'dfd:DataStore')).toEqual([]);
    expect(r.allowedRelations('dfd:DataStore', 'dfd:External')).toEqual([]);
  });

  it('viewpoint de contexto y puentes core', () => {
    const r = new NotationRegistry().register(CORE_PACK).register(DFD_PACK);
    expect(r.inViewpoint('dfd', 'context', 'dfd:DataStore')).toBe(false);
    expect(r.inViewpoint('dfd', 'context', 'dfd:External')).toBe(true);
    expect(r.allowedRelations('dfd:External', 'dfd:External')).toContain('core:trace');
  });
});
