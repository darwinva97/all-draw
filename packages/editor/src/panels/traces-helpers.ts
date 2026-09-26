/**
 * Funciones puras de la trazabilidad entre dimensiones (inspector, menú del nodo, pestaña
 * Trazabilidad del Espacio). Sin React ni DOM: se prueban en `test/traces-ui.test.ts`.
 */
import {
  BRIDGE_RELATIONS, suggestTraces, traceMatrix, traceGaps, relationFromSuggestion,
  type Command, type Element, type NotationRegistry, type Relation, type Store, type TraceGap, type TraceSuggestion,
} from '@all-draw/core';
import { t } from '@all-draw/i18n';

const isBridge = (typeId: string): boolean => (BRIDGE_RELATIONS as readonly string[]).includes(typeId);

/** Notación con semántica de un elemento (`null` para `freeform`, `core` o tipos desconocidos). */
export function semanticNotationOf(reg: NotationRegistry, e: Element): string | null {
  if (!reg.elementType(e.typeId)) return null;
  const n = reg.notationOf(e.typeId);
  return n === 'freeform' || n === 'core' ? null : n;
}

/** Notaciones con semántica presentes en el modelo (sin plantillas), ordenadas por nombre del pack. */
export function notationsInModel(store: Store, reg: NotationRegistry): string[] {
  const set = new Set<string>();
  for (const e of store.list('elements')) { if (e.template) continue; const n = semanticNotationOf(reg, e); if (n) set.add(n); }
  return [...set].sort((a, b) => (reg.pack(a)?.name ?? a).localeCompare(reg.pack(b)?.name ?? b));
}

export interface ElementTrace { relation: Relation; partner: Element; direction: 'out' | 'in' }

/** Relaciones puente del elemento con el otro extremo resuelto (se omiten las de extremo perdido). */
export function elementTraces(store: Store, elementId: string): ElementTrace[] {
  const out: ElementTrace[] = [];
  for (const r of store.list('relations')) {
    if (!isBridge(r.typeId) || !r.from.elementId || !r.to.elementId) continue;
    const direction: 'out' | 'in' | null = r.from.elementId === elementId ? 'out' : r.to.elementId === elementId ? 'in' : null;
    if (!direction) continue;
    const partner = store.get('elements', direction === 'out' ? r.to.elementId : r.from.elementId);
    if (partner) out.push({ relation: r, partner, direction });
  }
  return out.sort((x, y) => x.partner.name.localeCompare(y.partner.name));
}

/** Nº de relaciones puente cuyos extremos son de notaciones distintas. */
export function crossTraceCount(store: Store, reg: NotationRegistry): number {
  let n = 0;
  for (const r of store.list('relations')) {
    if (!isBridge(r.typeId) || !r.from.elementId || !r.to.elementId) continue;
    const a = store.get('elements', r.from.elementId), b = store.get('elements', r.to.elementId);
    if (a && b && reg.notationOf(a.typeId) !== reg.notationOf(b.typeId)) n++;
  }
  return n;
}

/** Primer nodo donde aparece el elemento (para saltar a una vista y seleccionarlo). */
export function firstNodeOf(store: Store, elementId: string): { viewId: string; nodeId: string } | null {
  const n = store.list('nodes').find(x => x.elementId === elementId);
  return n ? { viewId: n.viewId, nodeId: n.id } : null;
}

/** Las `n` mejores sugerencias del elemento. */
export function topSuggestions(store: Store, reg: NotationRegistry, elementId: string, n = 3): TraceSuggestion[] {
  return suggestTraces(store, reg, elementId).slice(0, n);
}

/** Comando que crea la relación puente de una sugerencia. */
export function linkCommand(sourceId: string, s: TraceSuggestion): Command {
  const rel = relationFromSuggestion(sourceId, s);
  return { type: 'set', collection: 'relations', id: rel.id, value: rel };
}

// ---------------------------------------------------------------- matriz
export interface MatrixCell { col: Element; relations: Relation[]; suggestion?: TraceSuggestion }
export interface MatrixRow { element: Element; cells: MatrixCell[] }
export interface MatrixView { rows: MatrixRow[]; cols: Element[]; totalRows: number; totalCols: number }

const matches = (e: Element, q: string): boolean => !q || e.name.toLowerCase().includes(q);

/**
 * Filas/columnas de `traceMatrix(a, b)` filtradas por texto (nombre, sin distinguir mayúsculas).
 * El filtro se aplica a cada eje por separado; si en un eje no coincide nada se muestra entero
 * (así "alta" enseña la fila "Alta de cliente" cruzada con todas las columnas).
 */
export function matrixRows(store: Store, reg: NotationRegistry, a: string, b: string, filter = ''): MatrixView {
  const m = traceMatrix(store, reg, a, b);
  const q = filter.trim().toLowerCase();
  const rowIdx = m.rows.map((e, i) => [e, i] as const).filter(([e]) => matches(e, q));
  const colIdx = m.cols.map((e, j) => [e, j] as const).filter(([e]) => matches(e, q));
  const rowsSel = rowIdx.length ? rowIdx : m.rows.map((e, i) => [e, i] as const);
  const colsSel = colIdx.length ? colIdx : m.cols.map((e, j) => [e, j] as const);
  const rows: MatrixRow[] = rowsSel.map(([element, i]) => ({
    element,
    cells: colsSel.map(([col, j]) => { const c = m.cells[i]![j]!; return { col, relations: c.relations, suggestion: c.suggestion }; }),
  }));
  return { rows, cols: colsSel.map(([e]) => e), totalRows: m.rows.length, totalCols: m.cols.length };
}

/** Cuántos elementos de `a` tienen alguna relación puente con un elemento de `b`. */
export function coverage(store: Store, reg: NotationRegistry, a: string, b: string): { traced: number; total: number } {
  const m = traceMatrix(store, reg, a, b);
  const traced = m.cells.filter(row => row.some(c => c.relations.length > 0)).length;
  return { traced, total: m.rows.length };
}

// ---------------------------------------------------------------- huecos
/**
 * Huecos (`traceGaps`) restringidos a la pareja de notaciones: elementos de `a` o `b` sin traza,
 * con sus sugerencias limitadas a la otra notación de la pareja.
 */
export function gapsBetween(store: Store, reg: NotationRegistry, a: string, b: string): TraceGap[] {
  return traceGaps(store, reg)
    .filter(g => g.notationId === a || g.notationId === b)
    .map(g => ({ ...g, suggestions: g.suggestions.filter(s => reg.notationOf(s.target.typeId) === (g.notationId === a ? b : a)) }))
    .sort((x, y) => x.notationId.localeCompare(y.notationId) || x.element.name.localeCompare(y.element.name));
}

/** Comando que enlaza la mejor sugerencia de un hueco, o `null` si no la hay. */
export function bestSuggestionCommand(gap: TraceGap): Command | null {
  const top = gap.suggestions[0];
  return top ? linkCommand(gap.element.id, top) : null;
}

const pairKey = (r: Relation): string => [r.from.elementId, r.to.elementId].sort().join('|');

/**
 * Un solo `batch` con la mejor sugerencia (score ≥ `minScore`) de cada hueco. Si dos huecos se
 * proponen mutuamente (A→B y B→A) solo entra una relación. `null` si no hay nada que enlazar.
 */
export function bestSuggestionsBatch(store: Store, reg: NotationRegistry, minScore = 0.8, gaps: TraceGap[] = traceGaps(store, reg)): Command | null {
  const seen = new Set<string>();
  const commands: Command[] = [];
  for (const g of gaps) {
    const top = g.suggestions[0];
    if (!top || top.score < minScore) continue;
    const rel = relationFromSuggestion(g.element.id, top);
    const k = pairKey(rel);
    if (seen.has(k)) continue;
    seen.add(k);
    commands.push({ type: 'set', collection: 'relations', id: rel.id, value: rel });
  }
  return commands.length ? { type: 'batch', label: t('enlazar {n} trazas sugeridas', { n: commands.length }), commands } : null;
}

/** Etiqueta corta de score: "100 %", "80 %"… */
export const scoreLabel = (s: number): string => `${Math.round(s * 100)} %`;
