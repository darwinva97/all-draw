import { describe, it, expect } from 'vitest';
import { NotationRegistry, CORE_PACK, ElementType, RelationType, View } from '@all-draw/core';
import { GANTT_PACK, TASK, MILESTONE, GROUP, DEPENDENCY, DEPENDENCY_KINDS } from '../src';

const reg = () => new NotationRegistry().register(CORE_PACK).register(GANTT_PACK);

describe('pack gantt', () => {
  it('id = prefijo; vista propia de clase gantt', () => {
    expect(GANTT_PACK.id).toBe('gantt');
    expect(GANTT_PACK.viewKind).toBe('gantt');
    expect(() => View.parse({ id: 'v', kind: GANTT_PACK.viewKind, notationId: 'gantt' })).not.toThrow();
    expect(GANTT_PACK.elementTypes.map(t => t.id)).toEqual([TASK, MILESTONE, GROUP]);
    expect(GANTT_PACK.relationTypes.map(t => t.id)).toEqual([DEPENDENCY]);
    for (const t of [...GANTT_PACK.elementTypes, ...GANTT_PACK.relationTypes]) expect(t.doc, t.id).toBeTruthy();
    for (const t of GANTT_PACK.elementTypes) expect(() => ElementType.parse(t)).not.toThrow();
    for (const t of GANTT_PACK.relationTypes) expect(() => RelationType.parse(t)).not.toThrow();
  });

  it('campos de la tarea: inicio, fin, duración, progreso, responsable', () => {
    const r = reg();
    const f = r.fieldsOf(TASK);
    expect(f.map(x => x.key)).toEqual(['start', 'end', 'duration', 'progress', 'assignee', 'critical']);
    expect(f.find(x => x.key === 'start')?.kind).toBe('date');
    expect(f.find(x => x.key === 'end')?.kind).toBe('date');
    expect(f.find(x => x.key === 'duration')?.kind).toBe('number');
    expect(r.fieldsOf(MILESTONE).map(x => x.key)).toEqual(['start']);
    expect(r.elementType(GROUP)?.container).toBe(true);
  });

  it('dependencias FS/SS/FF/SF con nombre legible y desfase', () => {
    const dep = reg().relationType(DEPENDENCY)!;
    const kind = dep.fields.find(f => f.key === 'kind')!;
    expect(kind.kind).toBe('select');
    expect(kind.options!.split(',')).toEqual([...DEPENDENCY_KINDS]);
    for (const k of DEPENDENCY_KINDS) expect(kind.optionLabels?.[k]).toContain(`(${k})`);
    expect(dep.fields.find(f => f.key === 'lag')?.kind).toBe('number');
  });

  it('matriz y anidamiento', () => {
    const r = reg();
    for (const a of [TASK, MILESTONE, GROUP]) for (const b of [TASK, MILESTONE, GROUP]) expect(r.isValidRelation(a, b, DEPENDENCY)).toBe(true);
    expect(GANTT_PACK.nesting!.map(n => `${n.parent}>${n.child}`)).toEqual(['Group>Task', 'Group>Milestone', 'Group>Group']);
  });
});
