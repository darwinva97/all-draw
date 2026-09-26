import { describe, it, expect } from 'vitest';
import { NotationRegistry, ElementType, RelationType } from '@all-draw/core';
import { ARCHIMATE_PACK, ELEMENTS, RELATIONS, VALIDITY, VIEWPOINTS, CONCEPTS, LAYERS, allowedBetween, isValid } from '../src/index';

const A = (n: string) => `archimate:${n}`;

describe('ArchiMate pack: datos generados', () => {
  it('tiene 61 elementos (60 + Junction), 11 relaciones y 25 viewpoints', () => {
    expect(ELEMENTS).toHaveLength(61);
    expect(RELATIONS).toHaveLength(11);
    expect(VIEWPOINTS).toHaveLength(25);
    expect(ARCHIMATE_PACK.id).toBe('archimate');
    expect(ARCHIMATE_PACK.name).toBe('ArchiMate 3.2');
    expect(ARCHIMATE_PACK.viewKind).toBe('freeform');
    expect(ARCHIMATE_PACK.defaultRelation).toBe(A('Association'));
    expect(ARCHIMATE_PACK.portTypes).toEqual([]);
  });

  it('elementos y relaciones validan contra los esquemas del núcleo y tienen ids únicos', () => {
    for (const e of ELEMENTS) expect(() => ElementType.parse(e)).not.toThrow();
    for (const r of RELATIONS) expect(() => RelationType.parse(r)).not.toThrow();
    expect(new Set(ELEMENTS.map((e) => e.id)).size).toBe(61);
    expect(new Set(RELATIONS.map((r) => r.id)).size).toBe(11);
    for (const e of ELEMENTS) {
      expect(e.id).toMatch(/^archimate:[A-Z]\w+$/);
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(e.meta).toMatchObject({ spec: 'ArchiMate 3.2' });
      expect(typeof e.meta?.alternateFigure).toBe('boolean');
    }
  });

  it('capas: colores de Archi y contenedores', () => {
    const by = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
    expect(by[A('BusinessActor')]?.color).toBe('#ffffb5');
    expect(by[A('ApplicationComponent')]?.color).toBe('#b5ffff');
    expect(by[A('Node')]?.color).toBe('#c9e7b7');
    expect(by[A('Goal')]?.color).toBe('#ccccff');
    expect(by[A('Capability')]?.color).toBe('#f5deaa');
    expect(by[A('WorkPackage')]?.color).toBe('#ffe0e0');
    expect(by[A('Location')]?.color).toBe('#edcfe2');
    expect(by[A('Grouping')]?.container).toBe(true);
    expect(by[A('Location')]?.container).toBe(true);
    expect(by[A('Grouping')]?.shape).toBe('group');
    expect(by[A('Junction')]?.shape).toBe('circle');
    expect(by[A('Junction')]?.meta?.alternateFigure).toBe(false);
    expect(by[A('BusinessActor')]?.meta?.alternateFigure).toBe(true);
    expect(by[A('BusinessProcess')]?.meta).toMatchObject({ layer: 'Business', aspect: 'behavior' });
    expect(by[A('BusinessObject')]?.meta).toMatchObject({ aspect: 'passive-structure' });
    expect(by[A('Stakeholder')]?.category).toBe('motivation');
    expect(by[A('Material')]?.category).toBe('physical');
    expect(by[A('Junction')]?.fields.find((f) => f.key === 'junctionType')).toMatchObject({ kind: 'select', options: 'and,or' });
    expect(LAYERS.map((l) => l.id)).toEqual(['strategy', 'business', 'application', 'technology', 'physical', 'motivation', 'implementation-migration', 'other', 'connector']);
    expect(ARCHIMATE_PACK.categories.map((c) => c.id)).toEqual(LAYERS.map((l) => l.id));
    const catIds = new Set(ARCHIMATE_PACK.categories.map((c) => c.id));
    for (const e of ELEMENTS) expect(catIds.has(e.category!)).toBe(true);
  });

  it('relaciones: notación, campos y relación sobre relación', () => {
    const by = Object.fromEntries(RELATIONS.map((r) => [r.id, r]));
    expect(RELATIONS.map((r) => r.id)).toEqual(['Composition', 'Aggregation', 'Assignment', 'Realization', 'Serving', 'Access', 'Influence', 'Triggering', 'Flow', 'Specialization', 'Association'].map(A));
    expect(by[A('Composition')]).toMatchObject({ category: 'structural', line: 'solid', sourceHead: 'filled-diamond' });
    expect(by[A('Aggregation')]).toMatchObject({ sourceHead: 'diamond' });
    expect(by[A('Assignment')]).toMatchObject({ sourceHead: 'dot', targetHead: 'arrow' });
    expect(by[A('Realization')]).toMatchObject({ line: 'dotted', targetHead: 'triangle' });
    expect(by[A('Serving')]).toMatchObject({ category: 'dependency', line: 'solid', targetHead: 'open' });
    expect(by[A('Access')]).toMatchObject({ line: 'dotted', targetHead: 'open' });
    expect(by[A('Access')]?.fields.find((f) => f.key === 'accessType')).toMatchObject({ kind: 'select', options: 'write,read,access,readwrite' });
    expect(by[A('Influence')]).toMatchObject({ line: 'dashed' });
    expect(by[A('Influence')]?.fields.find((f) => f.key === 'strength')?.kind).toBe('text');
    expect(by[A('Triggering')]).toMatchObject({ category: 'dynamic', line: 'solid', targetHead: 'arrow' });
    expect(by[A('Flow')]).toMatchObject({ category: 'dynamic', line: 'dashed', targetHead: 'arrow' });
    expect(by[A('Specialization')]).toMatchObject({ category: 'other', targetHead: 'triangle' });
    expect(by[A('Association')]?.fields.find((f) => f.key === 'directed')?.kind).toBe('checkbox');
    // Archi permite Association, Composition y Aggregation con una relación como destino.
    expect(by[A('Association')]?.relationEnds).toBe(true);
    expect(by[A('Composition')]?.relationEnds).toBe(true);
    expect(by[A('Aggregation')]?.relationEnds).toBe(true);
    expect(by[A('Serving')]?.relationEnds).toBeUndefined();
  });

  it('matriz: 62 filas x 62 columnas con ids de relación conocidos', () => {
    const rows = Object.keys(VALIDITY);
    expect(rows).toHaveLength(62);
    expect(CONCEPTS).toHaveLength(62);
    expect(rows).toContain('Junction');
    expect(rows).toContain('Relationship');
    const relIds = new Set(RELATIONS.map((r) => r.id));
    for (const s of rows) {
      const row = VALIDITY[s]!;
      expect(Object.keys(row)).toHaveLength(62);
      for (const t of rows) {
        expect(row[t]).toBeDefined();
        for (const r of row[t]!) expect(relIds.has(r)).toBe(true);
      }
    }
    // Cada elemento del pack tiene fila y columna.
    for (const e of ELEMENTS) expect(VALIDITY[e.id.slice('archimate:'.length)]).toBeDefined();
  });

  it('ejemplos concretos de validez', () => {
    expect(allowedBetween('BusinessActor', 'BusinessRole')).toContain(A('Assignment'));
    expect(allowedBetween(A('BusinessActor'), A('BusinessRole'))).toContain(A('Assignment'));
    expect(allowedBetween('BusinessObject', 'BusinessProcess')).not.toContain(A('Serving'));
    expect(isValid('BusinessObject', 'BusinessProcess', 'Serving')).toBe(false);
    expect(isValid('ApplicationComponent', 'DataObject', 'Access')).toBe(true);
    expect(isValid('ApplicationComponent', 'DataObject', A('Access'))).toBe(true);
    expect(isValid('BusinessProcess', 'BusinessProcess', 'Triggering')).toBe(true);
    expect(isValid('BusinessObject', 'BusinessObject', 'Triggering')).toBe(false);
    // Cualquier elemento → Junction admite las 11 relaciones.
    const all = RELATIONS.map((r) => r.id).sort();
    for (const e of ELEMENTS) expect([...allowedBetween(e.id, 'Junction')].sort()).toEqual(all);
    expect(allowedBetween('Relationship', 'Junction')).toEqual([]);
    // Grouping → X incluye Composition y Aggregation; Location también.
    for (const e of ELEMENTS) {
      expect(allowedBetween('Grouping', e.id)).toEqual(expect.arrayContaining([A('Composition'), A('Aggregation')]));
      expect(allowedBetween('Location', e.id)).toEqual(expect.arrayContaining([A('Composition'), A('Aggregation')]));
    }
    // Relación como destino: solo Association desde un elemento corriente.
    expect(allowedBetween('BusinessActor', 'Relationship')).toEqual([A('Association')]);
    expect(allowedBetween('Grouping', 'Relationship')).toEqual(expect.arrayContaining([A('Composition'), A('Aggregation'), A('Association')]));
  });

  it('viewpoints: macros expandidas a ids completos, Layered = todos', () => {
    const ids = new Set(ELEMENTS.map((e) => e.id));
    for (const vp of VIEWPOINTS) for (const t of vp.elementTypes) expect(ids.has(t)).toBe(true);
    const by = Object.fromEntries(VIEWPOINTS.map((v) => [v.id, v]));
    expect(by.organization?.elementTypes).toEqual(expect.arrayContaining([A('BusinessActor'), A('BusinessRole'), A('Location'), A('Junction'), A('Grouping')]));
    expect(by.organization?.elementTypes).toHaveLength(7);
    expect(by.application_cooperation?.elementTypes).toEqual(expect.arrayContaining([A('ApplicationComponent'), A('DataObject'), A('Location')]));
    expect(by.application_cooperation?.elementTypes).not.toContain(A('BusinessActor'));
    expect(by.motivation?.elementTypes).toEqual(expect.arrayContaining([A('Stakeholder'), A('Value'), A('Meaning')]));
    expect(by.layered?.elementTypes).toEqual([]);
    expect(by.layered?.name).toBe('Layered');
    expect(by.capability?.name).toBe('Capability Map');
  });
});

describe('ArchiMate pack: en el registro del núcleo', () => {
  const reg = new NotationRegistry().register(ARCHIMATE_PACK);

  it('BusinessActor → BusinessRole permite Assignment', () => {
    expect(reg.allowedRelations(A('BusinessActor'), A('BusinessRole'))).toContain(A('Assignment'));
    expect(reg.isValidRelation(A('BusinessObject'), A('BusinessProcess'), A('Serving'))).toBe(false);
    expect(reg.isValidRelation(A('ApplicationComponent'), A('DataObject'), A('Access'))).toBe(true);
  });

  it('anidamiento como Archi', () => {
    expect(reg.nestingRelations(A('Grouping'), A('BusinessActor'))).toEqual([A('Composition'), A('Aggregation')]);
    expect(reg.nestingRelations(A('Location'), A('Node'))).toEqual([A('Composition'), A('Aggregation')]);
    expect(reg.nestingRelations(A('BusinessActor'), A('BusinessRole'))).toEqual([A('Assignment')]);
    expect(reg.nestingRelations(A('BusinessProcess'), A('BusinessObject'))).toEqual([A('Access')]);
    expect(reg.nestingRelations(A('ApplicationComponent'), A('ApplicationService'))).toEqual([A('Assignment'), A('Realization')]);
    expect(reg.nestingRelations(A('BusinessActor'), A('BusinessActor'))).toEqual([A('Composition'), A('Aggregation'), A('Specialization')]);
  });

  it('viewpoints en el registro', () => {
    expect(reg.inViewpoint('archimate', 'organization', A('BusinessActor'))).toBe(true);
    expect(reg.inViewpoint('archimate', 'organization', A('Node'))).toBe(false);
    expect(reg.inViewpoint('archimate', 'layered', A('Node'))).toBe(true);
    expect(reg.elementType(A('Junction'))?.notationId).toBe('archimate');
  });
});
