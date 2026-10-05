/**
 * Utilidades comunes de los generadores: nombres (sanitizado, PascalCase, camelCase, snake_case), selección del
 * ámbito (vista o espacio entero), herencia de campos desde plantillas y anidamiento.
 */
import type { Element, Relation, View, ViewNode, Workspace } from '@all-draw/core';
import { W, type Warnings } from './warnings';

// ---------------------------------------------------------------- Nombres
export const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Palabras de un nombre libre: sin tildes, separando por no alfanuméricos y por cambios de caja (`pedidoLinea`). */
export function words(s: string): string[] {
  return stripAccents(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

export function pascalCase(s: string): string {
  return words(s).map(w => (w === w.toUpperCase() && w.length > 1 ? cap(w.toLowerCase()) : cap(w))).join('');
}

export function camelCase(s: string): string {
  const ws = words(s);
  if (!ws.length) return '';
  return ws.map((w, i) => (i === 0 ? w.toLowerCase() : w === w.toUpperCase() && w.length > 1 ? cap(w.toLowerCase()) : cap(w))).join('');
}

export function snakeCase(s: string): string {
  return words(s).map(w => w.toLowerCase()).join('_');
}

/** `Mi API de Pedidos` → `mi-api-de-pedidos`. */
export function slug(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Palabras reservadas de TypeScript/JavaScript que no pueden ser nombres de tipo ni de miembro sin problemas. */
export const TS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null', 'return', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'implements', 'interface', 'let',
  'package', 'private', 'protected', 'public', 'static', 'yield', 'await', 'any', 'boolean', 'number', 'string', 'symbol',
  'unknown', 'never', 'object', 'undefined', 'constructor',
]);
export const JAVA_RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do',
  'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof',
  'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null', 'var', 'record', 'yield', 'sealed', 'permits',
]);

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
export const isIdentifier = (s: string): boolean => IDENT.test(s);

/**
 * Nombre de código para un nombre libre. Si ya es un identificador válido (y no reservado) se respeta tal cual;
 * si no, se sanea (sin tildes ni espacios; PascalCase para tipos, camelCase para miembros) y se avisa.
 */
export function codeName(raw: string, style: 'type' | 'member' | 'constant', reserved: Set<string>, warnings: Warnings, fallback: string): string {
  const name = raw.trim();
  if (isIdentifier(name) && !reserved.has(name)) return name;
  let id = style === 'type' ? pascalCase(name) : style === 'member' ? camelCase(name) : words(name).join('_').toUpperCase();
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = '_' + id;
  if (reserved.has(id)) id = id + '_';
  if (id !== name) warnings.add(W.renamed, { name: raw, id });
  return id;
}

/** Hace único `base` frente a `used` añadiendo 2, 3… (y lo registra en `used`). */
export function uniqueName(base: string, used: Set<string>, sep = ''): string {
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}${sep}${i}`;
  used.add(id);
  return id;
}

/** Comparador estable: por nombre (sin tildes, sin mayúsculas) y, a igualdad, por id. */
export function byNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  const na = stripAccents(a.name).toLowerCase(), nb = stripAccents(b.name).toLowerCase();
  return na < nb ? -1 : na > nb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
export const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------------------------------------------------------------- Valores de campos
/** Lista de líneas de un campo `list` (array) o de texto multilínea. */
export function lines(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.map(x => (typeof x === 'string' ? x : x == null ? '' : String(x))) : typeof v === 'string' ? [v] : [];
  return raw.flatMap(s => s.split('\n')).map(s => s.trim()).filter(Boolean);
}

export interface KV { key: string; value: string }
/** Pares de un campo `keyvalue`. */
export function keyValues(v: unknown): KV[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is { key: unknown; value: unknown } => !!x && typeof x === 'object' && 'key' in x)
    .map(x => ({ key: String(x.key ?? '').trim(), value: String(x.value ?? '').trim() }))
    .filter(x => x.key);
}

export const str = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'string' ? v : String(v));

// ---------------------------------------------------------------- Plantillas y ámbito
/** Elemento con los campos heredados de su plantilla (`templateId`); los propios no vacíos sobrescriben. */
export function resolveElement(ws: Workspace, el: Element): Element {
  const tpl = el.templateId ? ws.elements[el.templateId] : undefined;
  if (!tpl || tpl.id === el.id) return el;
  const fields: Record<string, unknown> = { ...tpl.fields };
  for (const [k, v] of Object.entries(el.fields)) if (v !== undefined && v !== null && v !== '') fields[k] = v;
  return { ...el, name: el.name || tpl.name, doc: el.doc || tpl.doc, tags: el.tags.length ? el.tags : tpl.tags, fields };
}

/** Tipo efectivo: el propio o, si no lo tiene reconocible, el de su plantilla. */
export function effectiveType(ws: Workspace, el: Element): string {
  return el.typeId || (el.templateId ? ws.elements[el.templateId]?.typeId ?? '' : '');
}

export interface Scope {
  view?: View;
  /** Elementos (resueltos con su plantilla) ordenados por nombre e id. */
  elements: Element[];
  ids: Set<string>;
  relations: Relation[];
  /** Nodos de la vista (o de todas las vistas si no hay vista), ordenados por id. */
  nodes: ViewNode[];
  /** Título del ámbito: nombre de la vista o del espacio. */
  title: string;
}

export interface ScopeSpec {
  element: (el: Element) => boolean;
  relation: (r: Relation) => boolean;
  /** Sin vista, ¿incluir plantillas? (solo OpenAPI). */
  templates?: boolean;
}

/**
 * Elementos y relaciones del ámbito. Con vista: los elementos de sus nodos y las relaciones de sus aristas
 * (con ambos extremos en el ámbito). Sin vista: todos los del espacio que acepte `spec` (sin plantillas salvo
 * `spec.templates`). Devuelve `null` si la vista pedida no existe.
 */
export function selectScope(ws: Workspace, viewId: string | null | undefined, spec: ScopeSpec): Scope | null {
  if (viewId) {
    const view = ws.views[viewId];
    if (!view) return null;
    const nodes = Object.values(ws.nodes).filter(n => n.viewId === viewId).sort(byId);
    const seen = new Set<string>();
    const elements: Element[] = [];
    for (const n of nodes) {
      if (!n.elementId || seen.has(n.elementId)) continue;
      const raw = ws.elements[n.elementId];
      if (!raw) continue;
      const el = resolveElement(ws, raw);
      if (!spec.element(el)) continue;
      seen.add(el.id);
      elements.push(el);
    }
    elements.sort(byNameThenId);
    const relIds = new Set<string>();
    const relations: Relation[] = [];
    for (const e of Object.values(ws.edges)) {
      if (e.viewId !== viewId || !e.relationId || relIds.has(e.relationId)) continue;
      const r = ws.relations[e.relationId];
      if (!r || !spec.relation(r)) continue;
      if (!r.from.elementId || !r.to.elementId || !seen.has(r.from.elementId) || !seen.has(r.to.elementId)) continue;
      relIds.add(r.id);
      relations.push(r);
    }
    relations.sort(byId);
    return { view, elements, ids: seen, relations, nodes, title: view.name || view.id };
  }
  const elements = Object.values(ws.elements)
    .filter(el => spec.templates || !el.template)
    .map(el => resolveElement(ws, el))
    .filter(spec.element)
    .sort(byNameThenId);
  const ids = new Set(elements.map(e => e.id));
  const relations = Object.values(ws.relations)
    .filter(r => spec.relation(r) && !!r.from.elementId && !!r.to.elementId && ids.has(r.from.elementId) && ids.has(r.to.elementId))
    .sort(byId);
  return { elements, ids, relations, nodes: Object.values(ws.nodes).sort(byId), title: ws.meta.name || 'Sin nombre' };
}

/**
 * Elemento contenedor de `elId` que cumple `accept`: `features.parentId` si lo cumple; si no, el primer
 * ancestro por anidamiento de nodos (en la vista del ámbito o, sin vista, en cualquier vista).
 */
export function containerOf(ws: Workspace, nodes: ViewNode[], elId: string, accept: (el: Element) => boolean): Element | undefined {
  const declared = ws.elements[elId]?.features.parentId;
  if (typeof declared === 'string') {
    const p = ws.elements[declared];
    if (p && accept(p)) return p;
  }
  const byNode = new Map(nodes.map(n => [n.id, n] as const));
  for (const n of nodes) {
    if (n.elementId !== elId) continue;
    let cur = n.parentNodeId ? byNode.get(n.parentNodeId) : undefined;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      const pe = cur.elementId ? ws.elements[cur.elementId] : undefined;
      if (pe && accept(pe)) return pe;
      cur = cur.parentNodeId ? byNode.get(cur.parentNodeId) : undefined;
    }
  }
  return undefined;
}

/** Cabecera común (sin marcas de tiempo, para que la salida sea determinista). */
export const generatedBy = (title: string): string => `Generado por all-draw a partir de «${title.replace(/\s+/g, ' ').trim()}».`;
