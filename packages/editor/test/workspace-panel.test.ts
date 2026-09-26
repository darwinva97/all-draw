import { describe, it, expect } from 'vitest';
import { MemoryStore, NotationRegistry, CORE_PACK, makeElement, makeView, makeRelation, type Library, type Person } from '@all-draw/core';
import {
  nextTypeId, newFieldFromLabel, uniqueSlug, newElementType, newLibrary, newRule, duplicateRule, moveItem, withType, withoutType,
  typeUsage, libraryUsage, templateInstances, assignmentTargets, targetLabel, assignmentsTo, suggestedRoles, fieldKeys, clean, newTemplate,
  RULE_SOURCES, RULE_OPS, FIELD_KINDS, STYLE_PARTS, ROLES,
} from '../src/panels/workspace-helpers';

const lib = (extra: Partial<Library> = {}): Library => ({ id: 'acme', name: 'Acme', description: '', elementTypes: [], relationTypes: [], portTypes: [], notations: [], ...extra });

describe('ids de tipos y claves de campos', () => {
  it('nextTypeId usa lib:<libId>:<slug> y evita colisiones', () => {
    const l = lib();
    expect(nextTypeId(l, 'Microservicio')).toBe('lib:acme:microservicio');
    expect(nextTypeId(l, 'Base de datos (Postgres)')).toBe('lib:acme:base-de-datos-postgres');
    expect(nextTypeId(l, '')).toBe('lib:acme:tipo');
    const l2 = withType(l, newElementType(l, 'Microservicio'));
    expect(nextTypeId(l2, 'microservicio')).toBe('lib:acme:microservicio-2');
    const l3 = withType(l2, newElementType(l2, 'Microservicio'));
    expect(nextTypeId(l3, 'Microservicio')).toBe('lib:acme:microservicio-3');
  });
  it('newFieldFromLabel deriva la clave de la etiqueta y la hace única', () => {
    const f = newFieldFromLabel('Versión de la API');
    expect(f).toEqual({ key: 'version-de-la-api', label: 'Versión de la API', kind: 'text' });
    const g = newFieldFromLabel('Versión de la API', [f], 'number');
    expect(g.key).toBe('version-de-la-api-2');
    expect(g.kind).toBe('number');
    expect(newFieldFromLabel('   ').key).toBe('campo');
  });
  it('uniqueSlug y moveItem', () => {
    expect(uniqueSlug('a', ['a', 'a-2'])).toBe('a-3');
    expect(uniqueSlug('', [], 'x')).toBe('x');
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
  it('withType reemplaza o añade; withoutType quita; clean elimina undefined', () => {
    const l = withType(lib(), newElementType(lib(), 'A'));
    const t = { ...l.elementTypes[0]!, name: 'B' };
    expect(withType(l, t).elementTypes.map(x => x.name)).toEqual(['B']);
    expect(withoutType(l, t.id).elementTypes).toEqual([]);
    expect(clean({ a: 1, b: undefined })).toEqual({ a: 1 });
  });
  it('fábricas: librería, regla, persona, plantilla', () => {
    const l = newLibrary('Mi lib');
    expect(l.id.startsWith('mi-lib-')).toBe(true);
    expect(l.elementTypes).toEqual([]);
    const r = newRule();
    expect(r.enabled).toBe(true); expect(r.conditions).toEqual([]); expect(r.viewId).toBeNull();
    const d = duplicateRule({ ...r, name: 'X', style: { bg: '#fff' } });
    expect(d.id).not.toBe(r.id); expect(d.name).toBe('X (copia)'); expect(d.style).toEqual({ bg: '#fff' });
    const t = newTemplate(newElementType(l, 'Tipo'), l.id, 'Comp');
    expect(t.template).toBe(true); expect(t.libraryId).toBe(l.id); expect(t.name).toBe('Comp');
  });
});

describe('consultas sobre el store', () => {
  const setup = () => {
    const store = new MemoryStore();
    const reg = new NotationRegistry().register(CORE_PACK);
    const l = withType(lib(), { id: 'lib:acme:svc', name: 'Servicio', fields: [{ key: 'api', label: 'API', kind: 'json' }] });
    store.set('libraries', l.id, l);
    reg.registerLibraryTypes(l);
    const tpl = makeElement('lib:acme:svc', 'Plantilla', { id: 'tpl', template: true, libraryId: 'acme' });
    const a = makeElement('lib:acme:svc', 'Zeta', { id: 'a', templateId: 'tpl', libraryId: 'acme' });
    const b = makeElement('core:note', 'Alfa', { id: 'b' });
    for (const e of [tpl, a, b]) store.set('elements', e.id, e);
    const v = makeView('Tablero', { id: 'v1', kind: 'grid', grid: { layers: [{ id: 'L1', name: 'Capa 1' }], stages: [{ id: 'S1', name: 'Etapa 1' }], stageGroups: [] } });
    store.set('views', v.id, v);
    const rel = makeRelation('core:link', { elementId: 'a' }, { elementId: 'b' }, { id: 'r1' });
    store.set('relations', rel.id, rel);
    return { store, reg };
  };
  it('cuenta usos de tipos, librerías e instancias de plantillas', () => {
    const { store } = setup();
    expect(typeUsage(store, 'lib:acme:svc')).toBe(2);
    expect(libraryUsage(store, 'acme')).toBe(2);
    expect(templateInstances(store, 'tpl')).toBe(1);
    expect(templateInstances(store, 'a')).toBe(0);
  });
  it('assignmentTargets por clase', () => {
    const { store, reg } = setup();
    expect(assignmentTargets(store, reg, 'element').map(t => t.id)).toEqual(['b', 'a']); // ordenados por nombre, sin plantillas
    expect(assignmentTargets(store, reg, 'element')[1]?.hint).toBe('Servicio');
    expect(assignmentTargets(store, reg, 'view')).toEqual([{ id: 'v1', label: 'Tablero', hint: undefined }]);
    expect(assignmentTargets(store, reg, 'layer')).toEqual([{ id: 'L1', label: 'Tablero · Capa 1' }]);
    expect(assignmentTargets(store, reg, 'stage')).toEqual([{ id: 'S1', label: 'Tablero · Etapa 1' }]);
    const types = assignmentTargets(store, reg, 'type');
    expect(types.some(t => t.id === 'lib:acme:svc')).toBe(true);
    expect(new Set(types.map(t => t.id)).size).toBe(types.length);
    expect(assignmentTargets(store, reg, 'relation')).toEqual([{ id: 'r1', label: 'Zeta → Alfa', hint: 'Enlace' }]);
    expect(assignmentTargets(store, undefined, 'type').map(t => t.id)).toEqual(['lib:acme:svc']);
  });
  it('targetLabel, assignmentsTo, suggestedRoles y fieldKeys', () => {
    const { store, reg } = setup();
    expect(targetLabel(store, reg, { kind: 'element', targetId: 'a' })).toBe('Zeta');
    expect(targetLabel(store, reg, { kind: 'element', targetId: 'nope' })).toBe('(nope)');
    const people: Person[] = [
      { id: 'p1', name: 'Ana', assignments: [{ id: 'as1', kind: 'element', targetId: 'a', role: 'Owner' }, { id: 'as2', kind: 'view', targetId: 'v1', role: 'Cocinera' }] },
      { id: 'p2', name: 'Bea', assignments: [{ id: 'as3', kind: 'element', targetId: 'a', role: 'QA' }] },
    ];
    expect(assignmentsTo(people, 'element', 'a').map(x => `${x.person.name}:${x.assignment.role}`)).toEqual(['Ana:Owner', 'Bea:QA']);
    const roles = suggestedRoles(people);
    expect(roles.slice(0, ROLES.length)).toEqual(ROLES);
    expect(roles).toContain('Cocinera');
    expect(roles.filter(r => r === 'Owner')).toHaveLength(1);
    expect(fieldKeys(store, reg)).toContainEqual({ key: 'api', label: 'API' });
  });
});

describe('tablas de etiquetas', () => {
  it('cubren todos los valores del modelo', () => {
    expect(Object.keys(RULE_SOURCES).sort()).toEqual(['doc', 'field', 'library', 'name', 'notation', 'people', 'port', 'prop', 'role', 'tag', 'type', 'view']);
    expect(Object.keys(RULE_OPS)).toHaveLength(10);
    expect(FIELD_KINDS).toHaveLength(11);
    expect(STYLE_PARTS.map(s => s.key).sort()).toEqual(['accent', 'accentWidth', 'badge', 'badgeText', 'bg', 'bold', 'border', 'borderStyle', 'borderWidth', 'glow', 'icon', 'opacity', 'strike', 'text', 'top', 'topWidth']);
  });
});
