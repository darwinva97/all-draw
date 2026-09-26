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

function compare(raw: string, cond: Condition): boolean {
  const cs = !!cond.caseSensitive;
  const a = cs ? raw.trim() : normText(raw);
  const b = cs ? (cond.value ?? '').trim() : normText(cond.value);
  switch (cond.op) {
    case 'eq': return a === b;
    case 'ne': return a !== b;
    case 'contains': return !!b && a.includes(b);
    case 'notContains': return !b || !a.includes(b);
    case 'in': return (cond.value ?? '').split(',').map(x => cs ? x.trim() : normText(x)).filter(Boolean).includes(a);
    case 'empty': return a === '';
    case 'notEmpty': return a !== '';
    case 'gt': return Number(raw) > Number(cond.value);
    case 'lt': return Number(raw) < Number(cond.value);
    case 'regex': try { return new RegExp(cond.value ?? '', cs ? '' : 'i').test(raw); } catch { return false; }
  }
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
  return rule.match === 'any' ? rule.conditions.some(c => condMatches(store, reg, e, c, viewId)) : rule.conditions.every(c => condMatches(store, reg, e, c, viewId));
}

export function matchingRules(store: Store, reg: NotationRegistry | undefined, e: Element, viewId?: string): StyleRule[] {
  return store.list('rules').filter(r => ruleMatches(store, reg, e, r, viewId)).sort((a, b) => a.priority - b.priority);
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

export function relationCondMatches(store: Store, reg: NotationRegistry | undefined, r: Relation, cond: Condition, viewId?: string): boolean {
  const vals = relationValuesOf(store, reg, r, cond, viewId);
  if (vals === null) return false;
  if (vals.length === 0) return OPS_SIN_VALOR.has(cond.op) ? compare('', cond) : cond.op === 'ne' || cond.op === 'notContains';
  return vals.some(v => compare(v, cond));
}

export function relationRuleMatches(store: Store, reg: NotationRegistry | undefined, r: Relation, rule: StyleRule, viewId?: string): boolean {
  if (!rule.enabled || rule.target !== 'relation') return false;
  if (rule.viewId && viewId && rule.viewId !== viewId) return false;
  if (rule.conditions.length === 0) return false;
  return rule.match === 'any' ? rule.conditions.some(c => relationCondMatches(store, reg, r, c, viewId)) : rule.conditions.every(c => relationCondMatches(store, reg, r, c, viewId));
}

/** Estilo resuelto de una relación: reglas con `target: 'relation'`, de menor a mayor prioridad. */
export function resolveRelationStyle(store: Store, reg: NotationRegistry | undefined, r: Relation, viewId?: string): { style: RuleStyle; rules: StyleRule[] } {
  const rules = store.list('rules').filter(x => relationRuleMatches(store, reg, r, x, viewId)).sort((a, b) => a.priority - b.priority);
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
