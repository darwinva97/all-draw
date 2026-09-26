/**
 * Funciones puras y constantes del panel de espacio (librerías, reglas, personas).
 * Sin React ni DOM: se prueban en `test/workspace-panel.test.ts`.
 */
import { slugId, newId, makeElement } from '@all-draw/core';
import type {
  Library, ElementType, FieldDef, FieldKind, Shape, Store, NotationRegistry, StyleRule, RuleSource, RuleOp, RuleStyle,
  Person, Assignment, Element, Condition,
} from '@all-draw/core';
import { t } from '@all-draw/i18n';

export type AssignKind = Assignment['kind'];

// ---------------------------------------------------------------- etiquetas (español; se traducen con `t()` al pintarlas)
export const FIELD_KINDS: { id: FieldKind; label: string }[] = [
  { id: 'text', label: 'Texto' }, { id: 'textarea', label: 'Texto largo' }, { id: 'number', label: 'Número' },
  { id: 'select', label: 'Selección' }, { id: 'checkbox', label: 'Casilla' }, { id: 'url', label: 'URL' },
  { id: 'date', label: 'Fecha' }, { id: 'list', label: 'Lista' }, { id: 'keyvalue', label: 'Clave → valor' },
  { id: 'json', label: 'JSON' }, { id: 'ref', label: 'Referencia' },
];

export const SHAPES: { id: Shape; label: string }[] = [
  { id: 'rounded', label: 'Redondeado' }, { id: 'rect', label: 'Rectángulo' }, { id: 'ellipse', label: 'Elipse' },
  { id: 'diamond', label: 'Rombo' }, { id: 'hexagon', label: 'Hexágono' }, { id: 'parallelogram', label: 'Paralelogramo' },
  { id: 'cylinder', label: 'Cilindro' }, { id: 'note', label: 'Nota' }, { id: 'actor', label: 'Actor' },
  { id: 'circle', label: 'Círculo' }, { id: 'double-circle', label: 'Círculo doble' }, { id: 'bar', label: 'Barra' },
  { id: 'pool', label: 'Pool' }, { id: 'lane', label: 'Carril' }, { id: 'group', label: 'Grupo' },
  { id: 'label', label: 'Etiqueta' }, { id: 'container', label: 'Contenedor' },
];

export const RULE_SOURCES: Record<RuleSource, string> = {
  field: 'Campo', name: 'Nombre', doc: 'Documentación', type: 'Tipo', notation: 'Notación', library: 'Librería',
  tag: 'Etiqueta', prop: 'Propiedad', view: 'Vista', port: 'Pin', people: 'Persona asignada', role: 'Papel asignado',
};
/** Fuentes que necesitan una clave (`key`). */
export const SOURCES_CON_CLAVE: ReadonlySet<RuleSource> = new Set<RuleSource>(['field', 'prop']);

export const RULE_OPS: Record<RuleOp, string> = {
  eq: 'es igual a', ne: 'no es igual a', contains: 'contiene', notContains: 'no contiene', in: 'es alguno de',
  empty: 'está vacío', notEmpty: 'tiene algún valor', gt: 'es mayor que', lt: 'es menor que', regex: 'cumple la expresión regular',
};
export const OPS_SIN_VALOR: ReadonlySet<RuleOp> = new Set<RuleOp>(['empty', 'notEmpty']);

export type StylePartKind = 'color' | 'number' | 'text' | 'bool' | 'select';
export const STYLE_PARTS: { key: keyof RuleStyle; label: string; kind: StylePartKind }[] = [
  { key: 'bg', label: 'Fondo', kind: 'color' },
  { key: 'text', label: 'Color del texto', kind: 'color' },
  { key: 'border', label: 'Borde', kind: 'color' },
  { key: 'borderWidth', label: 'Grosor del borde', kind: 'number' },
  { key: 'borderStyle', label: 'Estilo del borde', kind: 'select' },
  { key: 'accent', label: 'Franja izquierda', kind: 'color' },
  { key: 'accentWidth', label: 'Ancho de la franja', kind: 'number' },
  { key: 'top', label: 'Franja superior', kind: 'color' },
  { key: 'topWidth', label: 'Alto de la franja superior', kind: 'number' },
  { key: 'opacity', label: 'Opacidad', kind: 'number' },
  { key: 'glow', label: 'Brillo', kind: 'color' },
  { key: 'badge', label: 'Punto', kind: 'color' },
  { key: 'badgeText', label: 'Texto del punto', kind: 'text' },
  { key: 'icon', label: 'Icono', kind: 'text' },
  { key: 'bold', label: 'Negrita', kind: 'bool' },
  { key: 'strike', label: 'Tachado', kind: 'bool' },
];
/** Valor con el que se activa cada parte del estilo. */
export const STYLE_DEFAULTS: Record<keyof RuleStyle, string | number | boolean> = {
  bg: '#dcfce7', text: '#0f172a', border: '#16a34a', borderWidth: 2, borderStyle: 'solid',
  accent: '#16a34a', accentWidth: 5, top: '#16a34a', topWidth: 4, opacity: 0.5,
  glow: '#16a34a', badge: '#dc2626', badgeText: '!', icon: '🔶', bold: true, strike: true,
};

export const ROLES = [
  'Owner', 'Stakeholder', 'Líder técnico', 'Product Owner', 'Arquitecto',
  'Analista funcional', 'Desarrollo', 'QA', 'Seguridad', 'Infraestructura', 'Contacto',
];

export const ASSIGN_KINDS: Record<AssignKind, string> = {
  element: 'Elemento', view: 'Vista', layer: 'Capa', stage: 'Etapa', type: 'Tipo', relation: 'Relación',
};

// ---------------------------------------------------------------- utilidades
/** Copia sin claves `undefined` (los registros se guardan como JSON plano). */
export function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** `base`, o `base-2`, `base-3`… hasta que no esté en `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>, fallback = 'item'): string {
  const set = new Set(taken);
  const b = base || fallback;
  if (!set.has(b)) return b;
  let n = 2;
  while (set.has(`${b}-${n}`)) n++;
  return `${b}-${n}`;
}

/** Id de un tipo nuevo dentro de una librería: `lib:<libId>:<slug>`, único en esa librería. */
export function nextTypeId(lib: Pick<Library, 'id' | 'elementTypes'>, name: string): string {
  const prefix = `lib:${lib.id}:`;
  const slug = slugId('', name) || 'tipo';
  const taken = lib.elementTypes.filter(t => t.id.startsWith(prefix)).map(t => t.id.slice(prefix.length));
  return prefix + uniqueSlug(slug, taken, 'tipo');
}

/** Campo nuevo a partir de su etiqueta: la clave se deriva con `slugId` y se hace única. */
export function newFieldFromLabel(label: string, existing: FieldDef[] = [], kind: FieldKind = 'text'): FieldDef {
  const key = uniqueSlug(slugId('', label), existing.map(f => f.key), 'campo');
  return { key, label: label.trim() || key, kind };
}

export function newElementType(lib: Pick<Library, 'id' | 'elementTypes'>, name: string): ElementType {
  return { id: nextTypeId(lib, name), name: name.trim() || t('Tipo'), category: t('Tipos de la librería'), color: '#e2e8f0', shape: 'rounded', fields: [] };
}

export function newLibrary(name: string): Library {
  return { id: uniqueSlug(slugId('', name), [], 'lib') + '-' + newId().slice(0, 6), name: name.trim() || t('Librería'), description: '', elementTypes: [], relationTypes: [], portTypes: [], notations: [] };
}

export function newRule(name = t('Regla nueva')): StyleRule {
  return { id: newId('rule'), name, enabled: true, priority: 0, match: 'all', target: 'element', conditions: [], style: {}, viewId: null };
}

export function duplicateRule(r: StyleRule): StyleRule {
  return { ...structuredClone(r), id: newId('rule'), name: t('{name} (copia)', { name: r.name }) };
}

export function newCondition(): Condition {
  return { source: 'name', op: 'contains', value: '' };
}

export function newPerson(name = t('Persona nueva')): Person {
  return { id: newId('p'), name, assignments: [] };
}

export function newAssignment(kind: AssignKind, targetId: string, role: string): Assignment {
  return { id: newId('as'), kind, targetId, role: role.trim() || t('Participante') };
}

/** Componente (plantilla) de una librería a partir de un tipo. */
export function newTemplate(type: ElementType, libraryId: string, name?: string): Element {
  return makeElement(type.id, name ?? type.name, { template: true, libraryId });
}

/** Mueve el elemento `i` una posición (`dir` = -1 sube, +1 baja). Devuelve una copia. */
export function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  const a = out[i] as T, b = out[j] as T;
  out[i] = b; out[j] = a;
  return out;
}

/** Reemplaza un tipo de una librería (o lo añade). Devuelve la librería nueva. */
export function withType(lib: Library, type: ElementType): Library {
  const has = lib.elementTypes.some(t => t.id === type.id);
  return { ...lib, elementTypes: has ? lib.elementTypes.map(t => t.id === type.id ? type : t) : [...lib.elementTypes, type] };
}
export function withoutType(lib: Library, typeId: string): Library {
  return { ...lib, elementTypes: lib.elementTypes.filter(t => t.id !== typeId) };
}

// ---------------------------------------------------------------- consultas sobre el store
/** Elementos (plantillas incluidas) que usan un tipo. */
export function typeUsage(store: Store, typeId: string): number {
  return store.list('elements').filter(e => e.typeId === typeId).length;
}

/** Elementos que dependen de la librería: por `libraryId` o por tipo `lib:<id>:…`. */
export function libraryUsage(store: Store, libId: string): number {
  const prefix = `lib:${libId}:`;
  return store.list('elements').filter(e => e.libraryId === libId || e.typeId.startsWith(prefix)).length;
}

/** Instancias creadas a partir de una plantilla. */
export function templateInstances(store: Store, templateId: string): number {
  return store.list('elements').filter(e => e.templateId === templateId && !e.template).length;
}

export interface TargetOption { id: string; label: string; hint?: string }

/** Candidatos a destino de una asignación según su clase. */
export function assignmentTargets(store: Store, reg: NotationRegistry | undefined, kind: AssignKind): TargetOption[] {
  const byName = (a: TargetOption, b: TargetOption) => a.label.localeCompare(b.label, 'es');
  switch (kind) {
    case 'element':
      return store.list('elements').filter(e => !e.template).map(e => ({ id: e.id, label: e.name || t('(sin nombre)'), hint: reg?.elementType(e.typeId)?.name ?? e.typeId })).sort(byName);
    case 'view':
      return store.list('views').map(v => ({ id: v.id, label: v.name || t('(sin nombre)'), hint: reg?.pack(v.notationId)?.name })).sort(byName);
    case 'layer':
      return store.list('views').flatMap(v => (v.grid?.layers ?? []).map(l => ({ id: l.id, label: `${v.name} · ${l.name}` }))).sort(byName);
    case 'stage':
      return store.list('views').flatMap(v => (v.grid?.stages ?? []).map(s => ({ id: s.id, label: `${v.name} · ${s.name}` }))).sort(byName);
    case 'type': {
      const seen = new Set<string>();
      const out: TargetOption[] = [];
      for (const t of reg?.allElementTypes() ?? []) if (!seen.has(t.id)) { seen.add(t.id); out.push({ id: t.id, label: t.name, hint: t.category ?? t.notationId }); }
      for (const lib of store.list('libraries')) for (const t of lib.elementTypes) if (!seen.has(t.id)) { seen.add(t.id); out.push({ id: t.id, label: t.name, hint: lib.name }); }
      return out.sort(byName);
    }
    case 'relation':
      return store.list('relations').map(r => {
        const a = r.from.elementId ? store.get('elements', r.from.elementId)?.name : undefined;
        const b = r.to.elementId ? store.get('elements', r.to.elementId)?.name : undefined;
        return { id: r.id, label: `${a ?? '?'} → ${b ?? '?'}`, hint: r.name || (reg?.relationType(r.typeId)?.name ?? r.typeId) };
      }).sort(byName);
  }
}

/** Nombre legible del destino de una asignación. */
export function targetLabel(store: Store, reg: NotationRegistry | undefined, a: Pick<Assignment, 'kind' | 'targetId'>): string {
  return assignmentTargets(store, reg, a.kind).find(t => t.id === a.targetId)?.label ?? `(${a.targetId})`;
}

/** Asignaciones de todas las personas a un destino concreto. */
export function assignmentsTo(people: Person[], kind: AssignKind, targetId: string): { person: Person; assignment: Assignment }[] {
  return people.flatMap(p => p.assignments.filter(a => a.kind === kind && a.targetId === targetId).map(assignment => ({ person: p, assignment })));
}

/** Papeles sugeridos: los fijos más los ya usados. */
export function suggestedRoles(people: Person[]): string[] {
  return [...new Set([...ROLES, ...people.flatMap(p => p.assignments.map(a => a.role)).filter(Boolean)])];
}

/** Claves de campo disponibles (de packs y librerías), para autocompletar condiciones. */
export function fieldKeys(store: Store, reg: NotationRegistry | undefined): { key: string; label: string }[] {
  const m = new Map<string, string>();
  for (const t of reg?.allElementTypes() ?? []) for (const f of t.fields) if (!m.has(f.key)) m.set(f.key, f.label);
  for (const l of store.list('libraries')) for (const t of l.elementTypes) for (const f of t.fields) if (!m.has(f.key)) m.set(f.key, f.label);
  return [...m.entries()].map(([key, label]) => ({ key, label }));
}
