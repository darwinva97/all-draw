/**
 * Reglas de estilo condicional (portadas de Drawer). Las que casan se aplican de menor a mayor
 * prioridad; la de mayor prioridad manda propiedad a propiedad.
 */
import { fieldText, normText } from './fields';
import type { Condition, Element, Relation, RuleStyle, StyleRule } from './model';
import type { NotationRegistry } from './notation';
import type { Store } from './store';

const OPS_SIN_VALOR = new Set(['empty', 'notEmpty']);

function valuesOf(store: Store, reg: NotationRegistry | undefined, e: Element, cond: Condition, viewId?: string): string[] {
  switch (cond.source) {
    case 'field': return [fieldText(e.fields[cond.key ?? ''])];
    case 'name': return [e.name];
    case 'doc': return [e.doc ?? ''];
    case 'type': return [reg?.elementType(e.typeId)?.name ?? e.typeId];
    case 'notation': return [reg?.notationOf(e.typeId) ?? ''];
    case 'library': return [e.libraryId ? (store.get('libraries', e.libraryId)?.name ?? '') : ''];
    case 'tag': return e.tags;
    case 'prop': return [e.props[cond.key ?? ''] ?? ''];
    case 'view': return viewId ? [store.get('views', viewId)?.name ?? ''] : [];
    case 'port': return e.ports.map(p => p.key);
    case 'people': return store.list('people').filter(p => p.assignments.some(a => a.kind === 'element' && a.targetId === e.id)).map(p => p.name);
    case 'role': return store.list('people').flatMap(p => p.assignments.filter(a => a.kind === 'element' && a.targetId === e.id).map(a => a.role));
  }
}

/** Condición precompilada: valor normalizado, expresión regular compilada y lista `in` como conjunto. */
interface CompiledCondition {
  cond: Condition;
  cs: boolean;
  /** Valor de comparación ya normalizado (o recortado si distingue mayúsculas). */
  value: string;
  inSet?: Set<string>;
  regex?: RegExp | null;
  num?: number;
}
interface CompiledRule { rule: StyleRule; conds: CompiledCondition[] }

function compileCondition(cond: Condition): CompiledCondition {
  const cs = !!cond.caseSensitive;
  const value = cs ? (cond.value ?? '').trim() : normText(cond.value);
  const out: CompiledCondition = { cond, cs, value };
  if (cond.op === 'in') out.inSet = new Set((cond.value ?? '').split(',').map(x => cs ? x.trim() : normText(x)).filter(Boolean));
  else if (cond.op === 'regex') { try { out.regex = new RegExp(cond.value ?? '', cs ? '' : 'i'); } catch { out.regex = null; } }
  else if (cond.op === 'gt' || cond.op === 'lt') out.num = Number(cond.value);
  return out;
}

function compareCompiled(raw: string, c: CompiledCondition): boolean {
  const a = c.cs ? raw.trim() : normText(raw);
  const b = c.value;
  switch (c.cond.op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'contains': return !!b && a.includes(b);
    case 'notContains': return !b || !a.includes(b);
    case 'in': return c.inSet!.has(a);
    case 'empty': return a === '';
    case 'notEmpty': return a !== '';
    case 'gt': return Number(raw) > c.num!;
    case 'lt': return Number(raw) < c.num!;
    case 'regex': return c.regex ? c.regex.test(raw) : false;
  }
}

function compare(raw: string, cond: Condition): boolean { return compareCompiled(raw, compileCondition(cond)); }

/**
 * Reglas compiladas por versión de `store.list('rules')`: la lista conserva su identidad hasta que
 * la colección cambia (MemoryStore y YjsStore la cachean), así que sirve de clave.
 */
const COMPILED = new WeakMap<StyleRule[], { elements: CompiledRule[]; relations: CompiledRule[] }>();
function compiledRules(store: Store): { elements: CompiledRule[]; relations: CompiledRule[] } {
  const list = store.list('rules');
  let c = COMPILED.get(list);
  if (!c) {
    const enabled = list.filter(r => r.enabled && r.conditions.length > 0).sort((a, b) => a.priority - b.priority);
    const compile = (r: StyleRule): CompiledRule => ({ rule: r, conds: r.conditions.map(compileCondition) });
    c = { elements: enabled.filter(r => r.target === 'element').map(compile), relations: enabled.filter(r => r.target === 'relation').map(compile) };
    COMPILED.set(list, c);
  }
  return c;
}

/** Personas por elemento (fuentes `people`/`role`), por versión de `store.list('people')`. */
const PEOPLE_BY_ELEMENT = new WeakMap<object, Map<string, { name: string; roles: string[] }[]>>();
function peopleOf(store: Store, elementId: string): { name: string; roles: string[] }[] {
  const list = store.list('people');
  let m = PEOPLE_BY_ELEMENT.get(list);
  if (!m) {
    m = new Map();
    for (const p of list) {
      const byEl = new Map<string, string[]>();
      for (const a of p.assignments) if (a.kind === 'element') byEl.set(a.targetId, [...(byEl.get(a.targetId) ?? []), a.role]);
      for (const [id, roles] of byEl) m.set(id, [...(m.get(id) ?? []), { name: p.name, roles }]);
    }
    PEOPLE_BY_ELEMENT.set(list, m);
  }
  return m.get(elementId) ?? [];
}

function valuesOfFast(store: Store, reg: NotationRegistry | undefined, e: Element, cond: Condition, viewId?: string): string[] {
  if (cond.source === 'people') return peopleOf(store, e.id).map(p => p.name);
  if (cond.source === 'role') return peopleOf(store, e.id).flatMap(p => p.roles);
  return valuesOf(store, reg, e, cond, viewId);
}

function condMatchesCompiled(store: Store, reg: NotationRegistry | undefined, e: Element, c: CompiledCondition, viewId?: string): boolean {
  const vals = valuesOfFast(store, reg, e, c.cond, viewId);
  if (vals.length === 0) return OPS_SIN_VALOR.has(c.cond.op) ? compareCompiled('', c) : c.cond.op === 'ne' || c.cond.op === 'notContains';
  return vals.some(v => compareCompiled(v, c));
}

function compiledRuleMatches(store: Store, reg: NotationRegistry | undefined, e: Element, cr: CompiledRule, viewId?: string): boolean {
  const { rule } = cr;
  if (rule.viewId && viewId && rule.viewId !== viewId) return false;
  return rule.match === 'any' ? cr.conds.some(c => condMatchesCompiled(store, reg, e, c, viewId)) : cr.conds.every(c => condMatchesCompiled(store, reg, e, c, viewId));
}

export function condMatches(store: Store, reg: NotationRegistry | undefined, e: Element, cond: Condition, viewId?: string): boolean {
  const vals = valuesOf(store, reg, e, cond, viewId);
  if (vals.length === 0) return OPS_SIN_VALOR.has(cond.op) ? compare('', cond) : cond.op === 'ne' || cond.op === 'notContains';
  return vals.some(v => compare(v, cond));
}

export function ruleMatches(store: Store, reg: NotationRegistry | undefined, e: Element, rule: StyleRule, viewId?: string): boolean {
  if (!rule.enabled || rule.target !== 'element') return false;
  if (rule.viewId && viewId && rule.viewId !== viewId) return false;
  if (rule.conditions.length === 0) return false;
  return compiledRuleMatches(store, reg, e, { rule, conds: rule.conditions.map(compileCondition) }, viewId);
}

/** Reglas (activas, sobre elementos) que casan con el elemento, de menor a mayor prioridad. Usa las reglas precompiladas del store. */
export function matchingRules(store: Store, reg: NotationRegistry | undefined, e: Element, viewId?: string): StyleRule[] {
  const out: StyleRule[] = [];
  for (const cr of compiledRules(store).elements) if (compiledRuleMatches(store, reg, e, cr, viewId)) out.push(cr.rule);
  return out;
}

export function resolveStyle(store: Store, reg: NotationRegistry | undefined, e: Element, viewId?: string): { style: RuleStyle; rules: StyleRule[] } {
  const rules = matchingRules(store, reg, e, viewId);
  const style: Record<string, unknown> = {};
  for (const r of rules) for (const [k, v] of Object.entries(r.style)) if (v !== undefined && v !== '') style[k] = v;
  return { style: style as RuleStyle, rules };
}

export function ruleImpact(store: Store, reg: NotationRegistry | undefined, rule: StyleRule): number {
  if (rule.target === 'relation') return store.list('relations').filter(r => relationRuleMatches(store, reg, r, rule)).length;
  return store.list('elements').filter(e => ruleMatches(store, reg, e, rule)).length;
}

// ---------------------------------------------------------------- reglas sobre relaciones
/** Fuentes que tienen sentido para una relación: nombre, documentación, tipo, notación, propiedad y campo. */
const RELATION_SOURCES = new Set<Condition['source']>(['name', 'doc', 'type', 'notation', 'prop', 'field']);

function relationValuesOf(store: Store, reg: NotationRegistry | undefined, r: Relation, cond: Condition, viewId?: string): string[] | null {
  switch (cond.source) {
    case 'field': return [fieldText(r.fields[cond.key ?? ''])];
    case 'name': return [r.name];
    case 'doc': return [r.doc ?? ''];
    case 'type': return [reg?.relationType(r.typeId)?.name ?? r.typeId];
    case 'notation': return [reg?.notationOf(r.typeId) ?? ''];
    case 'prop': return [r.props[cond.key ?? ''] ?? ''];
    case 'view': return viewId ? [store.get('views', viewId)?.name ?? ''] : [];
    default: return null; // fuente sin sentido para relaciones: la condición no casa
  }
}

function relationCondMatchesCompiled(store: Store, reg: NotationRegistry | undefined, r: Relation, c: CompiledCondition, viewId?: string): boolean {
  const vals = relationValuesOf(store, reg, r, c.cond, viewId);
  if (vals === null) return false;
  if (vals.length === 0) return OPS_SIN_VALOR.has(c.cond.op) ? compareCompiled('', c) : c.cond.op === 'ne' || c.cond.op === 'notContains';
  return vals.some(v => compareCompiled(v, c));
}

export function relationCondMatches(store: Store, reg: NotationRegistry | undefined, r: Relation, cond: Condition, viewId?: string): boolean {
  return relationCondMatchesCompiled(store, reg, r, compileCondition(cond), viewId);
}

export function relationRuleMatches(store: Store, reg: NotationRegistry | undefined, r: Relation, rule: StyleRule, viewId?: string): boolean {
  if (!rule.enabled || rule.target !== 'relation') return false;
  if (rule.viewId && viewId && rule.viewId !== viewId) return false;
  if (rule.conditions.length === 0) return false;
  return rule.match === 'any' ? rule.conditions.some(c => relationCondMatches(store, reg, r, c, viewId)) : rule.conditions.every(c => relationCondMatches(store, reg, r, c, viewId));
}

/** Estilo resuelto de una relación: reglas con `target: 'relation'`, de menor a mayor prioridad. */
export function resolveRelationStyle(store: Store, reg: NotationRegistry | undefined, r: Relation, viewId?: string): { style: RuleStyle; rules: StyleRule[] } {
  const rules: StyleRule[] = [];
  for (const cr of compiledRules(store).relations) {
    if (cr.rule.viewId && viewId && cr.rule.viewId !== viewId) continue;
    const ok = cr.rule.match === 'any' ? cr.conds.some(c => relationCondMatchesCompiled(store, reg, r, c, viewId)) : cr.conds.every(c => relationCondMatchesCompiled(store, reg, r, c, viewId));
    if (ok) rules.push(cr.rule);
  }
  const style: Record<string, unknown> = {};
  for (const x of rules) for (const [k, v] of Object.entries(x.style)) if (v !== undefined && v !== '') style[k] = v;
  return { style: style as RuleStyle, rules };
}

/** ¿La fuente de condición se puede evaluar sobre relaciones? (para la interfaz). */
export function isRelationSource(source: Condition['source']): boolean { return RELATION_SOURCES.has(source); }

export function overriddenBy(store: Store, rule: StyleRule): { rule: StyleRule; props: string[] }[] {
  const mine = Object.keys(rule.style).filter(k => (rule.style as Record<string, unknown>)[k] !== undefined);
  return store.list('rules')
    .filter(r => r.id !== rule.id && r.enabled && r.priority > rule.priority)
    .map(r => ({ rule: r, props: mine.filter(k => (r.style as Record<string, unknown>)[k] !== undefined) }))
    .filter(x => x.props.length > 0);
}

export type { Relation };
