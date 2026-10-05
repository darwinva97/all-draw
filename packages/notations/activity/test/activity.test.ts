import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType } from '@all-draw/core';
import { ACTIVITY_PACK, CONTROL_FLOW, OBJECT_FLOW } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(ACTIVITY_PACK);
const T = (n: string) => `activity:${n}`;

describe('pack activity', () => {
  it('id = prefijo; tipos y relaciones válidos y documentados', () => {
    expect(ACTIVITY_PACK.id).toBe('activity');
    expect(ACTIVITY_PACK.elementTypes.map(t => t.id)).toEqual(['Action', 'Initial', 'ActivityFinal', 'FlowFinal', 'Decision', 'Fork', 'ObjectNode', 'SendSignal', 'AcceptEvent', 'Partition'].map(T));
    expect(ACTIVITY_PACK.relationTypes.map(t => t.id)).toEqual([CONTROL_FLOW, OBJECT_FLOW]);
    for (const t of [...ACTIVITY_PACK.elementTypes, ...ACTIVITY_PACK.relationTypes]) expect(t.doc, t.id).toBeTruthy();
    for (const t of ACTIVITY_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of ACTIVITY_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
  });

  it('figuras: inicial negro, diana, barra negra, rombo, calle', () => {
    const r = reg();
    expect(r.elementType(T('Initial'))).toMatchObject({ shape: 'circle', color: '#000000' });
    expect(r.elementType(T('ActivityFinal'))).toMatchObject({ shape: 'double-circle', color: '#000000' });
    expect(r.elementType(T('Fork'))).toMatchObject({ shape: 'bar', color: '#000000' });
    expect(r.elementType(T('Decision'))?.shape).toBe('diamond');
    expect(r.elementType(T('Partition'))).toMatchObject({ shape: 'lane', container: true });
    expect(r.relationType(CONTROL_FLOW)!.fields.map(f => f.key)).toContain('guard');
    expect(r.relationType(OBJECT_FLOW)!.fields.map(f => f.key)).toContain('guard');
  });

  it('matriz: el inicial no recibe, los finales no emiten, flujo de objeto solo con nodos objeto', () => {
    const r = reg();
    expect(r.allowedRelations(T('Initial'), T('Action'))).toContain(CONTROL_FLOW);
    expect(r.allowedRelations(T('Action'), T('Initial')).filter(x => x.startsWith('activity:'))).toEqual([]);
    expect(r.allowedRelations(T('ActivityFinal'), T('Action')).filter(x => x.startsWith('activity:'))).toEqual([]);
    expect(r.allowedRelations(T('FlowFinal'), T('Action')).filter(x => x.startsWith('activity:'))).toEqual([]);
    expect(r.allowedRelations(T('Action'), T('ObjectNode'))).toEqual([OBJECT_FLOW, ...r.allowedRelations(T('Action'), T('ObjectNode')).slice(1)]);
    expect(r.isValidRelation(T('Action'), T('ObjectNode'), CONTROL_FLOW)).toBe(false);
    expect(r.isValidRelation(T('ObjectNode'), T('Action'), OBJECT_FLOW)).toBe(true);
    expect(r.isValidRelation(T('Action'), T('Action'), OBJECT_FLOW)).toBe(false);
    expect(r.isValidRelation(T('Decision'), T('Fork'), CONTROL_FLOW)).toBe(true);
    expect(r.isValidRelation(T('SendSignal'), T('AcceptEvent'), CONTROL_FLOW)).toBe(true);
    expect(r.allowedRelations(T('Partition'), T('Action')).filter(x => x.startsWith('activity:'))).toEqual([]);
  });

  it('anidamiento: la partición contiene cualquier nodo', () => {
    expect(ACTIVITY_PACK.nesting).toEqual([{ parent: 'Partition', child: '*', relationTypes: [] }]);
  });
});
