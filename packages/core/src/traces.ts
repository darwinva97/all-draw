/**
 * Correspondencia entre niveles: el mismo concepto modelado en dos notaciones (un proceso en
 * ArchiMate y su detalle en BPMN, un sistema C4 y su componente de aplicación ArchiMate, una
 * clase UML y su entidad ER). Las **relaciones puente** de `core` (`core:trace`, `core:realizes`,
 * `core:refines`) son las que unen esas parejas; aquí se proponen, se tabulan y se auditan.
 *
 * - `suggestTraces` propone parejas para un elemento por nombre, por vista de detalle, por
 *   palabras compartidas y por afinidad de tipos.
 * - `traceMatrix` cruza dos notaciones para un panel de matriz de trazabilidad.
 * - `traceGaps` / `traceCoverage` listan los elementos sin traza (diagnóstico `trace-missing`).
 */
import type { Element, Relation } from './model';
import type { NotationRegistry } from './notation';
import type { Store } from './store';
import type { Diagnostic, Validator } from './diagnostics';
import { makeRelation } from './commands';

export const BRIDGE_RELATIONS = ['core:trace', 'core:realizes', 'core:refines'] as const;
export type BridgeRelation = (typeof BRIDGE_RELATIONS)[number];

export interface TraceSuggestion {
  target: Element;
  relationTypeId: string;
  reason: string;
  score: number;
  /** `out` = origen → destino (por defecto); `in` = el destino es el origen de la relación propuesta. */
  direction: 'out' | 'in';
}

/** Afinidad de tipos entre notaciones. `relationTypeId` se propone en el sentido a → b. */
export interface TypeAffinity { a: string; b: string; relationTypeId: BridgeRelation; reason: string }

const pairs = (as: string[], bs: string[], relationTypeId: BridgeRelation, reason: string): TypeAffinity[] =>
  as.flatMap(a => bs.map(b => ({ a, b, relationTypeId, reason })));

export const TYPE_AFFINITIES: TypeAffinity[] = [
  ...pairs(['bpmn:Task', 'bpmn:SubProcess', 'bpmn:CallActivity'], ['archimate:BusinessProcess', 'archimate:ApplicationService'], 'core:realizes', 'una tarea BPMN realiza un proceso o servicio ArchiMate'),
  ...pairs(['bpmn:Pool', 'bpmn:Lane'], ['archimate:BusinessActor', 'archimate:BusinessRole'], 'core:trace', 'un pool/lane BPMN corresponde a un actor o rol ArchiMate'),
  ...pairs(['bpmn:DataObject', 'bpmn:DataStore'], ['archimate:BusinessObject', 'archimate:DataObject'], 'core:trace', 'un objeto de datos BPMN corresponde a un objeto ArchiMate'),
  ...pairs(['c4:SoftwareSystem', 'c4:Container'], ['archimate:ApplicationComponent'], 'core:realizes', 'un sistema/contenedor C4 realiza un componente de aplicación ArchiMate'),
  ...pairs(['c4:Person'], ['archimate:BusinessActor'], 'core:trace', 'una persona C4 corresponde a un actor ArchiMate'),
  ...pairs(['statechart:State'], ['archimate:BusinessObject'], 'core:refines', 'un estado describe el ciclo de vida de un objeto de negocio'),
  ...pairs(['uml:Class'], ['er:Entity'], 'core:trace', 'una clase UML corresponde a una entidad ER'),
  ...pairs(['uml:Class', 'er:Entity'], ['archimate:DataObject'], 'core:realizes', 'una clase/entidad realiza un objeto de datos ArchiMate'),
  ...pairs(['dfd:Process'], ['archimate:BusinessProcess', 'archimate:ApplicationProcess', 'bpmn:Task'], 'core:trace', 'un proceso DFD corresponde a un proceso'),
  ...pairs(['dfd:DataStore'], ['archimate:DataObject', 'er:Entity'], 'core:trace', 'un almacén DFD corresponde a un objeto de datos o entidad'),
  ...pairs(['dfd:External'], ['archimate:BusinessActor', 'c4:Person', 'c4:SoftwareSystem'], 'core:trace', 'una entidad externa DFD corresponde a un actor o sistema'),
  ...pairs(['sequence:Lifeline'], ['c4:Container', 'c4:Component', 'uml:Class', 'archimate:ApplicationComponent'], 'core:trace', 'una línea de vida corresponde a un componente o clase'),
  ...pairs(['flow:Process', 'flow:Subroutine'], ['bpmn:Task', 'archimate:BusinessProcess'], 'core:trace', 'un paso de flujo corresponde a una tarea o proceso'),
];

// ---------------------------------------------------------------- Nombres
const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'en', 'a', 'al', 'por', 'para', 'con', 'sin', 'sobre',
  'the', 'of', 'and', 'or', 'in', 'to', 'for', 'with', 'by', 'on', 'at', 'from',
]);

/** Nombre normalizado: minúsculas, sin acentos ni signos, espacios colapsados. */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Palabras significativas (≥ 3 letras y fuera de la lista de vacías). */
export function significantWords(name: string): Set<string> {
  return new Set(normalizeName(name).split(' ').filter(w => w.length >= 3 && !STOPWORDS.has(w)));
}

// ---------------------------------------------------------------- Ayudas
const isBridge = (typeId: string): boolean => (BRIDGE_RELATIONS as readonly string[]).includes(typeId);

function bridgeRelations(store: Store): Relation[] {
  return store.list('relations').filter(r => isBridge(r.typeId) && r.from.elementId && r.to.elementId);
}

/** Ids de elementos ya unidos a `elementId` por una relación puente (en cualquier sentido). */
export function tracedPartners(store: Store, elementId: string): Set<string> {
  const out = new Set<string>();
  for (const r of bridgeRelations(store)) {
    if (r.from.elementId === elementId) out.add(r.to.elementId!);
    else if (r.to.elementId === elementId) out.add(r.from.elementId!);
  }
  return out;
}

/** Notaciones con semántica: se ignoran `freeform` y `core`, y los tipos desconocidos. */
function semanticNotation(reg: NotationRegistry, e: Element): string | null {
  if (!reg.elementType(e.typeId)) return null;
  const n = reg.notationOf(e.typeId);
  return n === 'freeform' || n === 'core' ? null : n;
}

// ---------------------------------------------------------------- Sugerencias
/**
 * Propone relaciones puente entre `elementId` y elementos de **otras** notaciones.
 * Criterios (se queda el mejor por candidato; la afinidad de tipos suma +0.1 a los demás):
 *  (a) mismo nombre normalizado → 1
 *  (b) el elemento aparece en una vista cuya raíz es de otra notación (o al revés) → 0.8
 *  (c) ≥ 2 palabras significativas en común → 0.5
 *  (d) afinidad de tipos (`TYPE_AFFINITIES`) → 0.3
 * Se excluyen plantillas y parejas ya trazadas. Orden: score desc, nombre asc.
 */
export function suggestTraces(store: Store, reg: NotationRegistry, elementId: string): TraceSuggestion[] {
  const src = store.get('elements', elementId);
  if (!src) return [];
  const srcNotation = reg.notationOf(src.typeId);
  const already = tracedPartners(store, elementId);
  const srcName = normalizeName(src.name);
  const srcWords = significantWords(src.name);

  // (b) vistas de detalle: raíces de las vistas donde aparece el origen, y elementos que aparecen en vistas cuya raíz es el origen.
  const views = store.list('views');
  const nodes = store.list('nodes');
  const rootsOfSrc = new Set<string>();
  const detailedBySrc = new Set<string>();
  const viewsWithSrc = new Set(nodes.filter(n => n.elementId === elementId).map(n => n.viewId));
  const viewsRootedAtSrc = new Set(views.filter(v => v.rootElementId === elementId).map(v => v.id));
  for (const v of views) if (viewsWithSrc.has(v.id) && v.rootElementId && v.rootElementId !== elementId) rootsOfSrc.add(v.rootElementId);
  for (const n of nodes) if (viewsRootedAtSrc.has(n.viewId) && n.elementId && n.elementId !== elementId) detailedBySrc.add(n.elementId);

  const out: TraceSuggestion[] = [];
  for (const target of store.list('elements')) {
    if (target.id === elementId || target.template || already.has(target.id)) continue;
    if (reg.notationOf(target.typeId) === srcNotation) continue;

    let best: { score: number; reason: string; relationTypeId: string; direction: 'out' | 'in' } | null = null;
    const consider = (score: number, reason: string, relationTypeId: string, direction: 'out' | 'in' = 'out') => {
      if (!best || score > best.score) best = { score, reason, relationTypeId, direction };
    };

    if (srcName && srcName === normalizeName(target.name)) consider(1, `mismo nombre "${target.name}"`, 'core:trace');
    if (rootsOfSrc.has(target.id)) consider(0.8, `aparece en el detalle de "${target.name}"`, 'core:refines');
    if (detailedBySrc.has(target.id)) consider(0.8, `"${target.name}" aparece en el detalle de "${src.name}"`, 'core:refines', 'in');
    const shared = [...significantWords(target.name)].filter(w => srcWords.has(w));
    if (shared.length >= 2) consider(0.5, `comparten "${shared.join('", "')}"`, 'core:trace');

    const aff = TYPE_AFFINITIES.find(t => t.a === src.typeId && t.b === target.typeId);
    const affIn = aff ? undefined : TYPE_AFFINITIES.find(t => t.a === target.typeId && t.b === src.typeId);
    const affinity = aff ?? affIn;
    if (affinity) {
      const direction: 'out' | 'in' = aff ? 'out' : 'in';
      if (best) {
        const b: { score: number; reason: string; relationTypeId: string; direction: 'out' | 'in' } = best;
        best = { ...b, score: Math.min(1, b.score + 0.1), reason: `${b.reason}; ${affinity.reason}` };
        if (b.relationTypeId === 'core:trace') best = { ...best, relationTypeId: affinity.relationTypeId, direction };
      } else consider(0.3, affinity.reason, affinity.relationTypeId, direction);
    }

    if (best) {
      const b: { score: number; reason: string; relationTypeId: string; direction: 'out' | 'in' } = best;
      out.push({ target, ...b });
    }
  }
  return out.sort((x, y) => y.score - x.score || x.target.name.localeCompare(y.target.name));
}

/** Relación puente lista para `{ type: 'set', collection: 'relations' }` a partir de una sugerencia. */
export function relationFromSuggestion(sourceId: string, s: TraceSuggestion): Relation {
  const from = s.direction === 'in' ? s.target.id : sourceId;
  const to = s.direction === 'in' ? sourceId : s.target.id;
  return makeRelation(s.relationTypeId, { elementId: from }, { elementId: to }, { doc: s.reason });
}

// ---------------------------------------------------------------- Matriz
export interface TraceCell {
  /** Relaciones puente existentes entre fila y columna (cualquier sentido). */
  relations: Relation[];
  /** Mejor sugerencia si no hay relación (0 = ninguna). */
  suggested: number;
  suggestion?: TraceSuggestion;
}
export interface TraceMatrix {
  notationA: string;
  notationB: string;
  rows: Element[];
  cols: Element[];
  /** `cells[i][j]` cruza `rows[i]` con `cols[j]`. */
  cells: TraceCell[][];
}

function elementsOf(store: Store, reg: NotationRegistry, notationId: string): Element[] {
  return store.list('elements')
    .filter(e => !e.template && reg.notationOf(e.typeId) === notationId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Matriz de trazabilidad entre dos notaciones (filas = A, columnas = B). */
export function traceMatrix(store: Store, reg: NotationRegistry, notationA: string, notationB: string): TraceMatrix {
  const rows = elementsOf(store, reg, notationA);
  const cols = elementsOf(store, reg, notationB);
  const bridges = bridgeRelations(store);
  const byPair = new Map<string, Relation[]>();
  for (const r of bridges) {
    for (const k of [`${r.from.elementId}|${r.to.elementId}`, `${r.to.elementId}|${r.from.elementId}`]) byPair.set(k, [...(byPair.get(k) ?? []), r]);
  }
  const cells = rows.map(row => {
    const suggestions = new Map(suggestTraces(store, reg, row.id).map(s => [s.target.id, s] as const));
    return cols.map(col => {
      const relations = byPair.get(`${row.id}|${col.id}`) ?? [];
      const suggestion = relations.length ? undefined : suggestions.get(col.id);
      return { relations, suggested: suggestion?.score ?? 0, suggestion };
    });
  });
  return { notationA, notationB, rows, cols, cells };
}

// ---------------------------------------------------------------- Huecos
export interface TraceGap { element: Element; notationId: string; suggestions: TraceSuggestion[] }

/**
 * Elementos de una notación con semántica sin ninguna relación puente hacia otra notación.
 * Solo tiene sentido si el workspace mezcla ≥ 2 notaciones: con una sola devuelve `[]`.
 */
export function traceGaps(store: Store, reg: NotationRegistry): TraceGap[] {
  const elements = store.list('elements').filter(e => !e.template);
  const notations = new Set<string>();
  for (const e of elements) { const n = semanticNotation(reg, e); if (n) notations.add(n); }
  if (notations.size < 2) return [];
  const out: TraceGap[] = [];
  for (const e of elements) {
    const notationId = semanticNotation(reg, e);
    if (!notationId) continue;
    const partners = tracedPartners(store, e.id);
    const crossTraced = [...partners].some(id => { const p = store.get('elements', id); return p && reg.notationOf(p.typeId) !== notationId; });
    if (crossTraced) continue;
    out.push({ element: e, notationId, suggestions: suggestTraces(store, reg, e.id) });
  }
  return out;
}

/** Validador: `info` `trace-missing` por elemento sin traza; propone crear la mejor sugerencia. */
export const traceCoverage: Validator = {
  id: 'core.traces',
  run({ store, reg }) {
    const out: Diagnostic[] = [];
    for (const gap of traceGaps(store, reg)) {
      const top = gap.suggestions[0];
      const typeName = reg.elementType(gap.element.typeId)?.name ?? gap.element.typeId;
      const fixes: Diagnostic['supportedFixes'] = [];
      if (top) {
        const rel = relationFromSuggestion(gap.element.id, top);
        fixes.push({ label: `Trazar con "${top.target.name}" (${reg.relationType(top.relationTypeId)?.name ?? top.relationTypeId})`, command: { type: 'set', collection: 'relations', id: rel.id, value: rel } });
      }
      out.push({
        code: 'trace-missing', severity: 'info', subject: { collection: 'elements', id: gap.element.id },
        message: top
          ? `"${gap.element.name}" (${typeName}) no tiene traza a otra notación; ${top.reason}`
          : `"${gap.element.name}" (${typeName}) no tiene traza a otra notación`,
        evidence: { notationId: gap.notationId, suggestions: gap.suggestions.slice(0, 5).map(s => ({ targetId: s.target.id, relationTypeId: s.relationTypeId, score: s.score, direction: s.direction })) },
        supportedFixes: fixes,
      });
    }
    return out;
  },
};
