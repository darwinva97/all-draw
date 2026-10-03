/**
 * Vistas de secuencia (`View.kind === 'sequence'` o pack con `viewKind: 'sequence'`) en el SVG exportado, igual que
 * las dibuja el lienzo (`packages/editor/src/views/Sequence*.tsx`):
 *
 * - **líneas de vida**: cabecera (caja, o figura de actor/boundary/control/entity/database) y línea discontinua hasta
 *   el final del diagrama, en la columna `x`/`w` del nodo;
 * - **activaciones**: barra estrecha centrada en su línea de vida, a la altura `y` del nodo;
 * - **fragmentos** (`alt`, `loop`…): marco con la pestaña del operador, la condición y el nombre;
 * - **mensajes**: flechas horizontales a la altura `bendpoints[0].y` o, sin ella, de 40 en 40 px por `order`
 *   (síncrono con punta llena; asíncrono, respuesta y creación con punta abierta; respuesta y creación discontinuas;
 *   `destroy` con aspa; a sí mismo, un escalón a la derecha), con la etiqueta «orden: texto» encima.
 *
 * La geometría replica `packages/editor/src/views/sequence.ts` (io no puede depender del editor ni de `@all-draw/layout`,
 * que arrastra ELK); las constantes son las mismas que `SEQ_LAYOUT` de `packages/layout/src/sequence.ts`.
 * Si cambias algo aquí, cámbialo también allí.
 */
import type { NotationRegistry, Store, View, ViewEdge, ViewNode } from '@all-draw/core';

export const SEQ_LIFELINE = 'sequence:Lifeline';
export const SEQ_ACTIVATION = 'sequence:Activation';
export const SEQ_FRAGMENT = 'sequence:Fragment';
export const SEQ_RETURN = 'sequence:Return';
/** Alto de la cabecera, separación entre mensajes sin altura propia y ancho de las activaciones (los del editor). */
export const SEQ_HEADER_H = 60, SEQ_GAP_Y = 40, SEQ_ACTIVATION_W = 12;
const SELF_W = 40, SELF_H = 24, HEAD = 11;

export type MessageKind = 'sync' | 'async' | 'return' | 'create' | 'destroy';
type Box = { x: number; y: number; w: number; h: number };

/** Store mínimo que necesita la geometría (un `MemoryStore` sobre un `Workspace` sirve). */
type Reader = Pick<Store, 'get' | 'list'>;

export function isSequenceView(view: View | undefined, reg?: NotationRegistry): boolean {
  return !!view && (view.kind === 'sequence' || reg?.pack(view.notationId)?.viewKind === 'sequence');
}

const typeOf = (s: Reader, n: ViewNode | undefined) => (n?.elementId ? s.get('elements', n.elementId)?.typeId : undefined);

/** Línea de vida de un nodo: él mismo o, para activaciones, su ancestro línea de vida. */
export function lifelineOf(s: Reader, nodeId: string): ViewNode | undefined {
  let n = s.get('nodes', nodeId);
  for (let i = 0; n && i < 16; i++) {
    if (typeOf(s, n) === SEQ_LIFELINE) return n;
    n = n.parentNodeId ? s.get('nodes', n.parentNodeId) : undefined;
  }
  return undefined;
}

export function messageKind(s: Reader, e: ViewEdge): MessageKind {
  const rel = e.relationId ? s.get('relations', e.relationId) : undefined;
  if (!rel) return 'sync';
  if (rel.typeId === SEQ_RETURN) return 'return';
  const k = rel.fields['kind'];
  return k === 'async' || k === 'return' || k === 'create' || k === 'destroy' ? k : 'sync';
}

export function messageOrder(s: Reader, e: ViewEdge): number | undefined {
  const o = e.relationId ? s.get('relations', e.relationId)?.fields['order'] : undefined;
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  if (typeof o === 'string' && o.trim() !== '' && Number.isFinite(Number(o))) return Number(o);
  return undefined;
}

export function messageText(s: Reader, e: ViewEdge): string {
  const rel = e.relationId ? s.get('relations', e.relationId) : undefined;
  const t = rel?.fields['text'];
  return e.label ?? (typeof t === 'string' && t.trim() ? t : rel?.name ?? '');
}

export interface SeqLifeline { node: ViewNode; x: number; w: number }
export interface SeqMessage { edge: ViewEdge; y: number; fromX: number; toX: number; self: boolean; from: ViewNode; to: ViewNode; kind: MessageKind; order: number | undefined; text: string }
export interface SequenceGeometry { lifelines: SeqLifeline[]; messages: SeqMessage[]; height: number }

/** Columnas, mensajes (en orden y con su altura) y alto total de una vista de secuencia. Réplica de `sequenceLayout`. */
export function sequenceGeometry(s: Reader, viewId: string): SequenceGeometry {
  const nodes = s.list('nodes').filter(n => n.viewId === viewId);
  const lifelines = nodes.filter(n => typeOf(s, n) === SEQ_LIFELINE).sort((a, b) => a.x - b.x || a.id.localeCompare(b.id)).map(node => ({ node, x: node.x, w: node.w }));
  const center = new Map(lifelines.map(l => [l.node.id, l.x + l.w / 2]));
  const edges = s.list('edges').filter(e => e.viewId === viewId && lifelineOf(s, e.fromNodeId) && lifelineOf(s, e.toNodeId))
    .map((e, i) => ({ e, i, order: messageOrder(s, e) }))
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.i - b.i);
  let cursor = SEQ_HEADER_H;
  const messages: SeqMessage[] = [];
  for (const { e, order } of edges) {
    const from = lifelineOf(s, e.fromNodeId)!, to = lifelineOf(s, e.toNodeId)!;
    const explicit = e.bendpoints[0]?.y;
    const y = explicit !== undefined ? explicit : cursor + SEQ_GAP_Y;
    cursor = Math.max(cursor, y);
    messages.push({ edge: e, y, fromX: center.get(from.id) ?? from.x + from.w / 2, toX: center.get(to.id) ?? to.x + to.w / 2, self: from.id === to.id, from, to, kind: messageKind(s, e), order, text: messageText(s, e) });
  }
  let bottom = messages.reduce((m, x) => Math.max(m, x.y + (x.self ? SELF_H : 0)), SEQ_HEADER_H);
  for (const n of nodes) {
    const t = typeOf(s, n);
    if (t === SEQ_FRAGMENT) bottom = Math.max(bottom, n.y + n.h);
    else if (t === SEQ_ACTIVATION) bottom = Math.max(bottom, activationBox(s, n).y + n.h);
  }
  return { lifelines, messages, height: Math.max(240, bottom + 40) };
}

/** Caja absoluta de una activación: centrada en su línea de vida (que siempre está en `y = 0`). */
function activationBox(s: Reader, n: ViewNode): Box {
  const p = n.parentNodeId ? s.get('nodes', n.parentNodeId) : undefined;
  if (p && typeOf(s, p) === SEQ_LIFELINE) return { x: p.x + Math.round((p.w - SEQ_ACTIVATION_W) / 2), y: n.y, w: SEQ_ACTIVATION_W, h: n.h };
  return { x: n.x, y: n.y, w: Math.max(n.w, SEQ_ACTIVATION_W), h: n.h };
}

// ---------------------------------------------------------------- SVG
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const at = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => ` ${k}="${typeof v === 'number' ? num(v) : esc(String(v))}"`).join('');
const textW = (s: string, fs: number) => s.length * fs * 0.55;

/** Reparte un texto en líneas de `maxW` px (aprox. 0.55em por carácter) sin partir palabras salvo que no quepan solas. */
function wrap(text: string, maxW: number, fs: number): string[] {
  const per = Math.max(1, Math.floor(maxW / (fs * 0.55)));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (!cur) cur = w; else if (cur.length + 1 + w.length <= per) cur += ` ${w}`; else { out.push(cur); cur = w; }
    }
    out.push(cur);
  }
  return out.flatMap(l => (l.length > per ? l.match(new RegExp(`.{1,${per}}`, 'g')) ?? [l] : [l]));
}

function lines(ls: string[], x: number, yCenter: number, o: { cls?: string; fs: number; lineH: number; anchor?: string; extra?: Record<string, string | number | undefined> }): string {
  const y0 = yCenter - ((ls.length - 1) * o.lineH) / 2;
  const spans = ls.map((l, i) => `<tspan${at({ x, dy: i === 0 ? 0 : o.lineH })}>${esc(l) || ' '}</tspan>`).join('');
  return `<text${at({ x, y: y0, 'text-anchor': o.anchor ?? 'middle', 'dominant-baseline': 'central', class: o.cls, 'font-size': o.fs, ...o.extra })}>${spans}</text>`;
}

const SEQ_VARS = {
  light: { '--ad-seq-head': '#dae8fc', '--ad-seq-head-border': '#6c8ebf', '--ad-seq-icon': '#3b5b8f', '--ad-seq-act': '#ffffff', '--ad-seq-msg': '#333333', '--ad-seq-frame': '#8a8a8a' },
  dark: { '--ad-seq-head': '#1f2c44', '--ad-seq-head-border': '#4b6a9c', '--ad-seq-icon': '#9fb6dc', '--ad-seq-act': '#1c2230', '--ad-seq-msg': '#c5cbd6', '--ad-seq-frame': '#555d6b' },
} as const;
const vars = (t: 'light' | 'dark') => Object.entries(SEQ_VARS[t]).map(([k, v]) => `${k}:${v}`).join(';');

/** CSS de las piezas de secuencia (se añade al `<style>` del SVG solo si la vista es de secuencia). */
export function sequenceStyle(theme: 'light' | 'dark' | 'dual'): string {
  const themed = theme === 'dual'
    ? `svg.ad-svg{${vars('light')}}\n@media (prefers-color-scheme: dark){svg.ad-svg:not([data-theme="light"]){${vars('dark')}}}\nsvg.ad-svg[data-theme="dark"]{${vars('dark')}}`
    : `svg.ad-svg{${vars(theme)}}`;
  return [
    themed,
    '.ad-seq-head{fill:var(--ad-seq-head);stroke:var(--ad-seq-head-border)}',
    '.ad-seq-icon{fill:none;stroke:var(--ad-seq-icon);stroke-width:1.5;stroke-linecap:round}',
    '.ad-seq-line{stroke:var(--ad-seq-head-border);stroke-width:1.5;stroke-dasharray:5 4}',
    '.ad-seq-name{font-weight:500;fill:var(--ad-text)}',
    '.ad-seq-act{fill:var(--ad-seq-act);stroke:var(--ad-seq-head-border)}',
    '.ad-seq-frame{fill:var(--ad-group);stroke:var(--ad-seq-frame)}',
    '.ad-seq-tab{fill:var(--ad-panel);stroke:var(--ad-seq-frame)}',
    '.ad-seq-op{font-size:12px;font-weight:600;fill:var(--ad-text)}',
    '.ad-seq-cond{font-size:12px;font-style:italic;fill:var(--ad-muted)}',
    '.ad-seq-msg-label rect{fill:var(--ad-bg)}',
    '.ad-seq-msg-label text{font-size:11px;fill:var(--ad-text)}',
  ].join('\n');
}

/** Figura de cabecera según `kind` (las de `LifelineIcon` del editor), en una caja de 28×30 con esquina en (x, y). */
function lifelineIcon(kind: string, x: number, y: number): string {
  const g = (body: string, vb: [number, number]) => `<g class="ad-seq-icon"${at({ transform: `translate(${num(x + (28 - vb[0]) / 2)},${num(y + (30 - vb[1]) / 2)})` })}>${body}</g>`;
  switch (kind) {
    case 'actor': return g('<circle cx="12" cy="5" r="4"/><path d="M12 9v11M3 13h18M12 20l-6 10M12 20l6 10"/>', [24, 32]);
    case 'boundary': return g('<path d="M3 4v20M3 14h8"/><circle cx="21" cy="14" r="10"/>', [34, 28]);
    case 'control': return g('<circle cx="14" cy="17" r="10"/><path d="M14 7l4-4M14 7l4 4"/>', [28, 30]);
    case 'entity': return g('<circle cx="14" cy="13" r="10"/><path d="M3 27h22"/>', [28, 30]);
    case 'database': return g('<ellipse cx="14" cy="6" rx="10" ry="4"/><path d="M4 6v18c0 2.2 4.5 4 10 4s10-1.8 10-4V6"/><path d="M4 14c0 2.2 4.5 4 10 4s10-1.8 10-4"/>', [28, 30]);
    default: return '';
  }
}

/** Punta de flecha en (x, y) hacia `dir` (1 → derecha, -1 → izquierda). Igual que `arrowPath` del editor. */
function arrowPath(x: number, y: number, dir: number, open: boolean): string {
  const tipX = open ? x : x + dir * (HEAD - 1);
  const bx = tipX - dir * HEAD;
  return open ? `M${num(bx)},${num(y - 6)} L${num(tipX)},${num(y)} L${num(bx)},${num(y + 6)}` : `M${num(bx)},${num(y - 6)} L${num(tipX)},${num(y)} L${num(bx)},${num(y + 6)} Z`;
}

export interface SequenceSvg {
  /** Fragmentos, líneas de vida y activaciones (debajo de todo lo demás). */
  back: string;
  /** Mensajes (encima de los nodos). */
  front: string;
  /** Nodos y aristas que ya pinta este módulo (el render genérico los salta). */
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  /** Caja absoluta de cada nodo pintado aquí (columna completa para las líneas de vida), para marcadores y caja envolvente. */
  boxes: Map<string, Box>;
  /** Rótulos de mensajes y escalones a sí mismo que salen de las columnas. */
  extents: Box[];
  css: string;
}

export interface SequenceSvgOptions { theme: 'light' | 'dark' | 'dual'; bare: boolean }

/** Piezas SVG de una vista de secuencia, o `null` si la vista no lo es. */
export function renderSequenceSvg(store: Store, reg: NotationRegistry, view: View, opts: SequenceSvgOptions): SequenceSvg | null {
  if (!isSequenceView(view, reg)) return null;
  const geo = sequenceGeometry(store, view.id);
  const nodeIds = new Set<string>(), edgeIds = new Set<string>();
  const boxes = new Map<string, Box>();
  const extents: Box[] = [];
  const back: string[] = [], front: string[] = [];
  const data = (o: Record<string, string | undefined>) => (opts.bare ? {} : o);

  // Fragmentos (debajo de las líneas de vida, como `zIndex: -1` en el lienzo)
  for (const n of store.list('nodes')) {
    if (n.viewId !== view.id || typeOf(store, n) !== SEQ_FRAGMENT) continue;
    const el = store.get('elements', n.elementId!)!;
    const kind = String(el.fields['kind'] ?? 'alt');
    const cond = typeof el.fields['condition'] === 'string' ? el.fields['condition'] : '';
    const b = { x: n.x, y: n.y, w: n.w, h: n.h };
    nodeIds.add(n.id); boxes.set(n.id, b);
    const tabW = textW(kind, 12) + 22, tabH = 20;
    const parts = [
      `<rect class="ad-seq-frame"${at({ x: b.x, y: b.y, width: b.w, height: b.h, fill: n.style.fill, stroke: n.style.stroke })}/>`,
      `<path class="ad-seq-tab"${at({ d: `M${num(b.x)},${num(b.y)} H${num(b.x + tabW)} V${num(b.y + tabH * 0.55)} L${num(b.x + tabW - 9)},${num(b.y + tabH)} H${num(b.x)} Z`, stroke: n.style.stroke })}/>`,
      lines([kind], b.x + 6, b.y + tabH / 2, { cls: 'ad-seq-op', fs: 12, lineH: 14, anchor: 'start' }),
    ];
    if (cond) parts.push(lines([cond], b.x + 8, b.y + 24 + 8, { cls: 'ad-seq-cond', fs: 12, lineH: 14, anchor: 'start' }));
    if (el.name && el.name !== kind) parts.push(lines([el.name], b.x + b.w - 6, b.y + 3 + 8, { cls: 'ad-seq-cond', fs: 12, lineH: 14, anchor: 'end', extra: { 'font-style': 'normal' } }));
    const title = !opts.bare && el.doc ? `<title>${esc(el.doc)}</title>` : '';
    back.push(`<g${at({ class: 'ad-node ad-seq-fragment', ...data({ 'data-node': n.id, 'data-element': el.id, 'data-type': el.typeId }) })}>${title}${parts.join('')}</g>`);
  }

  // Líneas de vida: cabecera + línea hasta el final
  for (const l of geo.lifelines) {
    const n = l.node, el = store.get('elements', n.elementId!)!;
    const kind = String(el.fields['kind'] ?? 'participant');
    const type = typeof el.fields['type'] === 'string' ? el.fields['type'] : '';
    const nm = n.text ?? el.name;
    const label = type ? `${nm}: ${type}` : nm;
    const iconic = kind !== 'participant' && !!lifelineIcon(kind, 0, 0);
    const cx = l.x + l.w / 2;
    nodeIds.add(n.id); boxes.set(n.id, { x: l.x, y: 0, w: l.w, h: geo.height });
    const parts: string[] = [];
    parts.push(`<line class="ad-seq-line"${at({ x1: cx, y1: SEQ_HEADER_H, x2: cx, y2: geo.height, stroke: n.style.stroke })}/>`);
    const textFill = n.style.text;
    if (iconic) {
      const ls = wrap(label, l.w - 8, 13);
      const textH = ls.length * 15;
      const top = Math.max(2, (SEQ_HEADER_H - (30 + 2 + textH)) / 2);
      parts.push(lifelineIcon(kind, cx - 14, top));
      parts.push(lines(ls, cx, top + 32 + textH / 2, { cls: 'ad-seq-name', fs: 13, lineH: 15, extra: { fill: textFill } }));
    } else {
      parts.push(`<rect class="ad-seq-head"${at({ x: l.x, y: 0, width: l.w, height: SEQ_HEADER_H, rx: 4, fill: n.style.fill, stroke: n.style.stroke })}/>`);
      const ls = wrap(label, l.w - 16, 13);
      parts.push(lines(ls, cx, SEQ_HEADER_H / 2, { cls: 'ad-seq-name', fs: 13, lineH: 15, extra: { fill: textFill } }));
    }
    const title = !opts.bare && el.doc ? `<title>${esc(el.doc)}</title>` : '';
    back.push(`<g${at({ class: `ad-node ad-seq-lifeline ad-seq-lifeline--${kind}`, ...data({ 'data-node': n.id, 'data-element': el.id, 'data-type': el.typeId }) })}>${title}${parts.join('')}</g>`);
  }

  // Activaciones (encima de la línea)
  for (const n of store.list('nodes')) {
    if (n.viewId !== view.id || typeOf(store, n) !== SEQ_ACTIVATION) continue;
    const el = store.get('elements', n.elementId!)!;
    const b = activationBox(store, n);
    nodeIds.add(n.id); boxes.set(n.id, b);
    const label = typeof el.fields['label'] === 'string' && el.fields['label'] ? el.fields['label'] : el.name;
    const title = !opts.bare && label ? `<title>${esc(label)}</title>` : '';
    back.push(`<g${at({ class: 'ad-node ad-seq-activation', ...data({ 'data-node': n.id, 'data-element': el.id, 'data-type': el.typeId }) })}>${title}<rect class="ad-seq-act"${at({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 2, fill: n.style.fill, stroke: n.style.stroke })}/></g>`);
  }

  // Mensajes
  for (const m of geo.messages) {
    const e = m.edge;
    edgeIds.add(e.id);
    const color = e.style.color ?? 'var(--ad-seq-msg)';
    const width = e.style.width ?? 1.5;
    const dashed = m.kind === 'return' || m.kind === 'create';
    const open = m.kind !== 'sync';
    let path: string, lx: number, ly: number, endX: number, endY = m.y, dir = 1, toX = m.toX;
    if (m.self) {
      endX = m.fromX + (open ? 0 : HEAD - 1); endY = m.y + SELF_H; dir = -1;
      path = `M${num(m.fromX)},${num(m.y)} H${num(m.fromX + SELF_W)} V${num(endY)} H${num(endX)}`;
      lx = m.fromX + SELF_W + 6; ly = m.y + SELF_H / 2;
    } else {
      dir = m.toX >= m.fromX ? 1 : -1;
      if (m.kind === 'create') toX = m.toX - dir * (m.to.w / 2);
      endX = toX - dir * (open ? 0 : HEAD - 1);
      path = `M${num(m.fromX)},${num(m.y)} L${num(endX)},${num(endY)}`;
      lx = (m.fromX + toX) / 2; ly = m.y - 9;
    }
    const label = m.order !== undefined ? (m.text ? `${m.order}: ${m.text}` : String(m.order)) : m.text;
    const parts = [
      `<path${at({ d: path, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-dasharray': dashed ? '7 5' : undefined })}/>`,
      `<path${at({ d: arrowPath(endX, endY, dir, open), fill: open ? 'none' : color, stroke: color, 'stroke-width': width, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`,
    ];
    if (m.kind === 'destroy') parts.push(`<path${at({ d: `M${num(toX - 8)},${num(m.y - 8)} L${num(toX + 8)},${num(m.y + 8)} M${num(toX + 8)},${num(m.y - 8)} L${num(toX - 8)},${num(m.y + 8)}`, stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round' })}/>`);
    if (label) {
      const w = textW(label, 11) + 12, h = 16;
      const x = m.self ? lx : lx - w / 2, y = m.self ? ly - h / 2 : ly - h / 2;
      parts.push(`<g class="ad-seq-msg-label"><rect${at({ x, y, width: w, height: h, rx: 3 })}/>${lines([label], x + w / 2, y + h / 2, { fs: 11, lineH: 13 })}</g>`);
      extents.push({ x, y, w, h });
    }
    if (m.self) extents.push({ x: m.fromX, y: m.y, w: SELF_W, h: SELF_H });
    const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
    const title = !opts.bare && rel?.doc ? `<title>${esc(rel.doc)}</title>` : '';
    front.push(`<g${at({ class: `ad-edge ad-seq-msg ad-seq-msg--${m.kind}`, ...data({ 'data-edge': e.id, 'data-relation': e.relationId }) })}>${title}${parts.join('')}</g>`);
  }

  return { back: `<g class="ad-seq">${back.join('')}</g>`, front: `<g class="ad-seq-msgs">${front.join('')}</g>`, nodeIds, edgeIds, boxes, extents, css: sequenceStyle(opts.theme) };
}
