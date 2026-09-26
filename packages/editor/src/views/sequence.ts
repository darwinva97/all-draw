/**
 * Geometría de las vistas de secuencia (`View.kind === 'sequence'`), como funciones puras.
 *
 * - Las **líneas de vida** son columnas: del `ViewNode` solo cuentan `x` (orden horizontal) y `w`;
 *   la cabecera va arriba y la línea baja hasta el final del diagrama.
 * - Los **mensajes** son aristas entre líneas de vida (o sus activaciones). Su altura sale de
 *   `bendpoints[0].y`; si falta, se reparten de 40 en 40 px por `Relation.fields.order` y, a
 *   igualdad, por orden de creación.
 *
 * Nada de aquí depende de React ni del pack `sequence` (los ids de tipo se repiten como constantes
 * para no arrastrar la dependencia).
 */
import type { Command, Store, ViewEdge, ViewNode } from '@all-draw/core';

export const SEQ_LIFELINE = 'sequence:Lifeline';
export const SEQ_ACTIVATION = 'sequence:Activation';
export const SEQ_FRAGMENT = 'sequence:Fragment';
export const SEQ_MESSAGE = 'sequence:Message';
export const SEQ_RETURN = 'sequence:Return';

/** Alto de la cabecera de una línea de vida. */
export const SEQ_HEADER_H = 60;
/** Ancho de una activación. */
export const SEQ_ACTIVATION_W = 12;
/** Separación vertical entre mensajes sin altura explícita. */
export const SEQ_GAP_Y = 40;
/** Separación horizontal al añadir una línea de vida al final. */
export const SEQ_GAP_X = 200;
export const SEQ_LIFELINE_W = 140;

export type MessageKind = 'sync' | 'async' | 'return' | 'create' | 'destroy';

export interface SequenceLayoutOpts {
  headerH?: number;
  gapY?: number;
  /** Margen bajo el último mensaje. */
  bottomPad?: number;
  /** Alto mínimo del diagrama. */
  minHeight?: number;
}

export interface LifelineSlot { nodeId: string; x: number; w: number; order: number }
export interface MessageSlot {
  edgeId: string;
  y: number;
  fromX: number;
  toX: number;
  /** Mensaje a sí mismo (misma línea de vida). */
  self: boolean;
  /** Línea de vida origen/destino (resuelta a través de la activación si la arista sale de una). */
  fromLifelineId: string;
  toLifelineId: string;
  kind: MessageKind;
  order: number | undefined;
  /** Verdadero si la altura viene de `bendpoints[0].y`. */
  explicit: boolean;
}
export interface SequenceLayout {
  lifelines: LifelineSlot[];
  messages: MessageSlot[];
  height: number;
  width: number;
}

const typeOf = (store: Store, n: ViewNode | undefined): string | undefined =>
  n?.elementId ? store.get('elements', n.elementId)?.typeId : undefined;

export function isLifelineNode(store: Store, n: ViewNode | undefined): boolean { return typeOf(store, n) === SEQ_LIFELINE; }
export function isActivationNode(store: Store, n: ViewNode | undefined): boolean { return typeOf(store, n) === SEQ_ACTIVATION; }
export function isFragmentNode(store: Store, n: ViewNode | undefined): boolean { return typeOf(store, n) === SEQ_FRAGMENT; }

/** Línea de vida a la que pertenece un nodo (él mismo o, para activaciones, su ancestro). */
export function lifelineOf(store: Store, nodeId: string): ViewNode | undefined {
  let n = store.get('nodes', nodeId);
  for (let i = 0; n && i < 16; i++) {
    if (isLifelineNode(store, n)) return n;
    n = n.parentNodeId ? store.get('nodes', n.parentNodeId) : undefined;
  }
  return undefined;
}

/** Clase del mensaje: `kind` de la relación, o `return` si es `sequence:Return`. */
export function messageKind(store: Store, e: ViewEdge): MessageKind {
  const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
  if (!rel) return 'sync';
  if (rel.typeId === SEQ_RETURN) return 'return';
  const k = rel.fields['kind'];
  return k === 'async' || k === 'return' || k === 'create' || k === 'destroy' ? k : 'sync';
}

export function messageOrder(store: Store, e: ViewEdge): number | undefined {
  const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
  const o = rel?.fields['order'];
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  if (typeof o === 'string' && o.trim() !== '' && Number.isFinite(Number(o))) return Number(o);
  return undefined;
}

export function messageText(store: Store, e: ViewEdge): string {
  const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
  const t = rel?.fields['text'];
  return e.label ?? (typeof t === 'string' && t.trim() ? t : rel?.name ?? '');
}

/** Aristas de la vista que son mensajes (entre líneas de vida o activaciones). */
export function messageEdges(store: Store, viewId: string): ViewEdge[] {
  return store.list('edges').filter(e => e.viewId === viewId && lifelineOf(store, e.fromNodeId) && lifelineOf(store, e.toNodeId));
}

export function lifelineNodes(store: Store, viewId: string): ViewNode[] {
  return store.list('nodes').filter(n => n.viewId === viewId && isLifelineNode(store, n)).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
}

export function sequenceLayout(store: Store, viewId: string, opts: SequenceLayoutOpts = {}): SequenceLayout {
  const headerH = opts.headerH ?? SEQ_HEADER_H;
  const gapY = opts.gapY ?? SEQ_GAP_Y;
  const bottomPad = opts.bottomPad ?? 40;
  const minHeight = opts.minHeight ?? 240;

  const lifelines: LifelineSlot[] = lifelineNodes(store, viewId).map((n, i) => ({ nodeId: n.id, x: n.x, w: n.w, order: i }));
  const center = new Map(lifelines.map(l => [l.nodeId, l.x + l.w / 2]));

  // Orden de resolución: `order` de la relación y, a igualdad, orden de creación (el del store).
  const edges = messageEdges(store, viewId).map((e, i) => ({ e, i, order: messageOrder(store, e) }));
  edges.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.i - b.i);

  let cursor = headerH;
  const messages: MessageSlot[] = [];
  for (const { e, order } of edges) {
    const from = lifelineOf(store, e.fromNodeId)!, to = lifelineOf(store, e.toNodeId)!;
    const explicit = e.bendpoints[0]?.y;
    const y = explicit !== undefined ? explicit : cursor + gapY;
    cursor = Math.max(cursor, y);
    messages.push({
      edgeId: e.id, y, fromX: center.get(from.id) ?? from.x + from.w / 2, toX: center.get(to.id) ?? to.x + to.w / 2,
      self: from.id === to.id, fromLifelineId: from.id, toLifelineId: to.id,
      kind: messageKind(store, e), order, explicit: explicit !== undefined,
    });
  }

  // Alto: último mensaje, activaciones y fragmentos, con margen.
  let bottom = messages.reduce((m, s) => Math.max(m, s.y + (s.self ? 24 : 0)), headerH);
  for (const n of store.list('nodes')) {
    if (n.viewId !== viewId) continue;
    if (isFragmentNode(store, n)) bottom = Math.max(bottom, n.y + n.h);
    else if (isActivationNode(store, n)) bottom = Math.max(bottom, n.y + n.h);
  }
  const height = Math.max(minHeight, bottom + bottomPad);
  const width = lifelines.reduce((m, l) => Math.max(m, l.x + l.w), 0) + 40;
  return { lifelines, messages, height, width };
}

/** Siguiente `order` libre para un mensaje de la vista (1 si no hay ninguno). */
export function nextOrder(store: Store, viewId: string): number {
  let max = 0;
  for (const e of messageEdges(store, viewId)) { const o = messageOrder(store, e); if (o !== undefined && o > max) max = o; }
  return Math.floor(max) + 1;
}

/** Comando que fija la altura de un mensaje (`bendpoints[0].y`). */
export function messageYCommand(edgeId: string, y: number): Command {
  return { type: 'patch', collection: 'edges', id: edgeId, patch: { bendpoints: [{ x: 0, y: Math.round(y) }] } };
}

/**
 * Orden que corresponde a un mensaje nuevo soltado a la altura `y`, y los comandos que desplazan
 * (+1) los mensajes que quedan por debajo para que la numeración siga siendo consecutiva.
 */
export function insertMessageAt(store: Store, viewId: string, y: number): { order: number; commands: Command[] } {
  const { messages } = sequenceLayout(store, viewId);
  const above = messages.filter(m => m.y <= y);
  const order = above.reduce((m, s) => Math.max(m, s.order ?? 0), 0) + 1;
  const commands: Command[] = [];
  for (const m of messages) {
    if (m.y <= y || m.order === undefined || m.order < order) continue;
    const e = store.get('edges', m.edgeId);
    if (!e?.relationId) continue;
    const rel = store.get('relations', e.relationId);
    if (!rel) continue;
    commands.push({ type: 'patch', collection: 'relations', id: rel.id, patch: { fields: { ...rel.fields, order: m.order + 1 } } });
  }
  return { order, commands };
}

/**
 * Coloca la línea de vida `nodeId` en la posición `toIndex` (0..n-1) y reparte las demás sobre las
 * columnas existentes (las `x` actuales, ordenadas). Devuelve `moveNodes` con `y = 0` para todas
 * las que cambian.
 */
export function reorderLifeline(store: Store, viewId: string, nodeId: string, toIndex: number): Command {
  const lines = lifelineNodes(store, viewId);
  const slots = lines.map(l => l.x);
  const rest = lines.filter(l => l.id !== nodeId);
  const me = lines.find(l => l.id === nodeId);
  const moves: Extract<Command, { type: 'moveNodes' }>['moves'] = [];
  if (!me) return { type: 'moveNodes', moves };
  const i = Math.max(0, Math.min(rest.length, Math.round(toIndex)));
  const order = [...rest.slice(0, i), me, ...rest.slice(i)];
  order.forEach((l, k) => { const x = slots[k] ?? l.x; if (x !== l.x || l.y !== 0) moves.push({ id: l.id, x, y: 0 }); });
  return { type: 'moveNodes', moves };
}

/** Índice de columna en el que cae una `x` (centro de la cabecera arrastrada). */
export function lifelineIndexAt(layout: SequenceLayout, centerX: number, exclude?: string): number {
  const others = layout.lifelines.filter(l => l.nodeId !== exclude);
  let i = 0;
  for (const l of others) if (centerX > l.x + l.w / 2) i++;
  return i;
}

/** Línea de vida cuya columna (cabecera ± medio hueco) contiene `x`. */
export function lifelineAtX(layout: SequenceLayout, x: number): LifelineSlot | undefined {
  let best: LifelineSlot | undefined; let dist = Infinity;
  for (const l of layout.lifelines) { const d = Math.abs(l.x + l.w / 2 - x); if (d < dist && d <= Math.max(l.w, SEQ_GAP_X / 2)) { dist = d; best = l; } }
  return best;
}

/** `x` del siguiente hueco libre para una línea de vida nueva. */
export function nextLifelineX(store: Store, viewId: string): number {
  const lines = lifelineNodes(store, viewId);
  const last = lines[lines.length - 1];
  return last ? last.x + Math.max(SEQ_GAP_X, last.w + 60) : 40;
}

/** `x` local de una activación dentro de su línea de vida (centrada). */
export function activationX(lifelineW: number): number { return Math.round((lifelineW - SEQ_ACTIVATION_W) / 2); }
