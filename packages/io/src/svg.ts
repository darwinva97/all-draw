/**
 * Exportación SVG **sin DOM**: genera una cadena con el mismo aspecto que el lienzo del editor
 * (figuras de `shapes.tsx`, colores por tipo y reglas de estilo, contenedores anidados, rejilla,
 * aristas flotantes o por puerto con bendpoints y marcadores, pines visibles).
 *
 * Tema: `light`, `dark` o `dual` (un solo SVG con variables CSS y `@media (prefers-color-scheme)`).
 * `svgToPng` rasteriza en el navegador (Image + canvas).
 */
import { allPorts, resolveStyle, type ArrowHead, type Element, type ElementType, type NotationRegistry, type Port, type RuleStyle, type Shape, type Store, type ViewEdge, type ViewNode } from '@all-draw/core';
import { cellRects, normalizeGrid, cellKey } from '@all-draw/notation-grid';
import { figureEntry, figureOf, figureParts, iconParts, showsIcon, textInset } from '@all-draw/notation-archimate';
import { edgePath, floatingEndpoints, type Box, type Endpoints, type Pt, type Router } from './bendpath-svg';

export type SvgTheme = 'light' | 'dark' | 'dual';

export interface SvgOptions {
  theme?: SvgTheme;
  /** Margen alrededor del contenido (px). */
  padding?: number;
  fontFamily?: string;
  /** Color de fondo; por defecto el del tema. `'transparent'` para ninguno. */
  background?: string;
  /** Prefijo de los ids internos (marcadores, título): necesario si se incrustan varios SVG en un mismo documento. */
  idPrefix?: string;
  /** Sin `<title>`/`<desc>` accesibles ni atributos `data-*` (más compacto). */
  bare?: boolean;
}

// ---------------------------------------------------------------- Tema
export const THEME_VARS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--ad-bg': '#f6f7f9', '--ad-panel': '#ffffff', '--ad-border': '#e3e6ea', '--ad-text': '#1b1f24', '--ad-muted': '#6b7280', '--ad-accent': '#2563eb',
    '--ad-header': '#f3f4f6', '--ad-header-border': '#d1d5db', '--ad-cell': 'rgba(0,0,0,.02)', '--ad-cell-border': '#e5e7eb',
    '--ad-note': '#fff8c5', '--ad-visual-border': '#d4d4d8', '--ad-group': 'rgba(0,0,0,.02)',
    '--ad-node-fill': '#ffffff', '--ad-node-stroke': '#a6a6a6',
  },
  dark: {
    '--ad-bg': '#0f1115', '--ad-panel': '#1a1d23', '--ad-border': '#2b3039', '--ad-text': '#e6e8eb', '--ad-muted': '#9aa3b2', '--ad-accent': '#60a5fa',
    '--ad-header': '#20242c', '--ad-header-border': '#3a404b', '--ad-cell': 'rgba(255,255,255,.03)', '--ad-cell-border': '#2b3039',
    '--ad-note': '#3b3620', '--ad-visual-border': '#3f434b', '--ad-group': 'rgba(255,255,255,.03)',
    '--ad-node-fill': '#1c2230', '--ad-node-stroke': '#4a5568',
  },
};

const vars = (t: 'light' | 'dark') => Object.entries(THEME_VARS[t]).map(([k, v]) => `${k}:${v}`).join(';');

export function svgStyle(theme: SvgTheme, fontFamily: string): string {
  const base = theme === 'dark' ? vars('dark') : vars('light');
  const themed = theme === 'dual'
    ? `svg.ad-svg{${vars('light')}}\n@media (prefers-color-scheme: dark){svg.ad-svg{${vars('dark')}}}\nsvg.ad-svg[data-theme="light"]{${vars('light')}}\nsvg.ad-svg[data-theme="dark"]{${vars('dark')}}`
    : `svg.ad-svg{${base}}`;
  return [
    themed,
    `svg.ad-svg{font-family:${fontFamily};font-size:13px;color:var(--ad-text)}`,
    '.ad-bg{fill:var(--ad-bg)}',
    '.ad-node__label{font-weight:500}',
    '.ad-node__type{font-size:10px;opacity:.6}',
    '.ad-node__icon{font-size:16px}',
    '.ad-node__drill{font-size:11px;opacity:.6}',
    '.ad-node__badge text{font-size:9px;fill:#fff}',
    '.is-dimmed{opacity:.45}',
    '.r-bold .ad-node__label{font-weight:700}',
    '.r-strike .ad-node__label{text-decoration:line-through}',
    '.ad-marker-hollow{fill:var(--ad-panel)}',
    '.ad-card-hollow{fill:var(--ad-bg)}',
    '.ad-card-label{font-size:11px;fill:var(--ad-text);paint-order:stroke;stroke:var(--ad-bg);stroke-width:3px;stroke-linejoin:round}',
    '.ad-card-label--role{fill:var(--ad-muted);font-style:italic}',
    '.ad-edge-label rect{fill:var(--ad-panel);stroke:var(--ad-border)}',
    '.ad-edge-label text{font-size:11px;fill:var(--ad-text)}',
    '.ad-edge-label .ad-edge-label__pins{fill:#f59e0b}',
    '.ad-port__handle{fill:#f59e0b}',
    '.ad-port__label rect{fill:var(--ad-panel);stroke:var(--ad-border)}',
    '.ad-port__label text{font-size:10px;fill:var(--ad-muted)}',
    '.ad-visual--note rect{fill:var(--ad-note);stroke:var(--ad-visual-border)}',
    '.ad-visual--group rect{fill:var(--ad-group);stroke:var(--ad-visual-border);stroke-dasharray:4 3}',
    '.ad-visual--label rect{fill:none;stroke:none}',
    '.ad-visual text{fill:var(--ad-text)}',
    '.ad-visual__title{font-size:11px;text-transform:uppercase;letter-spacing:.04em;fill:var(--ad-muted)}',
    '.ad-cell{fill:var(--ad-cell);stroke:var(--ad-cell-border)}',
    '.ad-header rect{fill:var(--ad-header);stroke:var(--ad-header-border)}',
    '.ad-header text{font-size:12px;font-weight:600;fill:var(--ad-text)}',
    '.ad-shape-group>.ad-shape,.ad-shape-container>.ad-shape{stroke-dasharray:4 3}',
    '[data-detail-view]{cursor:pointer}',
  ].join('\n');
}

// ---------------------------------------------------------------- Utilidades
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const attrs = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => ` ${k}="${typeof v === 'number' ? num(v) : escapeXml(String(v))}"`).join('');
const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');

export function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#555';
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
export function readable(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#111';
  const n = parseInt(m[1]!, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111' : '#fff';
}
/** Mezcla `hex` con blanco (equivale a `color-mix(in srgb, hex pct%, white)`). */
export function mixWithWhite(hex: string, pct: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (v: number) => Math.round(v * pct + 255 * (1 - pct)).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** Salto de línea aproximado: ~0.55em por carácter. */
export function wrapText(text: string, maxWidth: number, fontSize = 13): string[] {
  const charW = fontSize * 0.55;
  const perLine = Math.max(1, Math.floor(maxWidth / charW));
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (!cur) { cur = word; continue; }
      if (cur.length + 1 + word.length <= perLine) cur += ` ${word}`; else { out.push(cur); cur = word; }
    }
    out.push(cur);
  }
  // Palabras más largas que la línea: partir a lo bruto
  const chunk = new RegExp(`.{1,${perLine}}`, 'g');
  return out.flatMap(l => (l.length > perLine ? (l.match(chunk) ?? [l]) : [l]));
}

const textW = (s: string, fontSize: number) => s.length * fontSize * 0.55;

interface TextOpts { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; cls?: string; fill?: string; fontSize?: number; lineH?: number; weight?: string; extra?: Record<string, string | number | undefined> }
/** Texto multilínea con `tspan`; `y` es el centro vertical del bloque. */
function textBlock(lines: string[], o: TextOpts): string {
  const lineH = o.lineH ?? (o.fontSize ?? 13) * 1.25;
  const y0 = o.y - ((lines.length - 1) * lineH) / 2;
  const spans = lines.map((l, i) => `<tspan${attrs({ x: o.x, dy: i === 0 ? 0 : lineH })}>${escapeXml(l) || ' '}</tspan>`).join('');
  return `<text${attrs({ x: o.x, y: y0, 'text-anchor': o.anchor ?? 'middle', 'dominant-baseline': 'central', class: o.cls, fill: o.fill, 'font-size': o.fontSize, 'font-weight': o.weight, ...o.extra })}>${spans}</text>`;
}

// ---------------------------------------------------------------- Figuras (réplica de shapes.tsx)
const SVG_SHAPES = new Set<Shape>(['ellipse', 'diamond', 'hexagon', 'parallelogram', 'cylinder', 'actor', 'circle', 'double-circle', 'bar']);
const LABEL_BELOW = new Set<Shape>(['circle', 'double-circle', 'diamond', 'bar', 'actor']);

/** Figura en un viewBox 0..100 escalada al rectángulo (como `ShapeSvg` con `preserveAspectRatio="none"`). */
function shapeSvg(shape: Shape, b: Box, fill: string, stroke: string, strokeWidth: number): string {
  const f = fill === 'transparent' ? 'var(--ad-panel)' : fill;
  const c = attrs({ fill: f, stroke, 'stroke-width': strokeWidth, 'vector-effect': 'non-scaling-stroke' });
  let body: string;
  switch (shape) {
    case 'ellipse': body = `<ellipse cx="50" cy="50" rx="49" ry="49"${c}/>`; break;
    case 'circle': body = `<circle cx="50" cy="50" r="48"${c}/>`; break;
    case 'double-circle': body = `<circle cx="50" cy="50" r="48"${c}/><circle cx="50" cy="50" r="38"${c}/>`; break;
    case 'diamond': body = `<polygon points="50,1 99,50 50,99 1,50"${c}/>`; break;
    case 'hexagon': body = `<polygon points="25,2 75,2 98,50 75,98 25,98 2,50"${c}/>`; break;
    case 'parallelogram': body = `<polygon points="20,2 98,2 80,98 2,98"${c}/>`; break;
    case 'bar': body = `<rect x="0" y="40" width="100" height="20"${attrs({ fill: stroke, stroke, 'vector-effect': 'non-scaling-stroke' })}/>`; break;
    case 'cylinder': body = `<path d="M2,15 v70 a48,12 0 0 0 96,0 v-70"${c}/><ellipse cx="50" cy="15" rx="48" ry="12"${c}/>`; break;
    case 'actor': body = `<circle cx="50" cy="14" r="12"${c}/><path d="M50,26 v34 M20,40 h60 M50,60 l-22,38 M50,60 l22,38"${attrs({ fill: 'none', stroke, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' })}/>`; break;
    default: return '';
  }
  return `<g class="ad-shape"${attrs({ transform: `translate(${num(b.x)},${num(b.y)}) scale(${num(b.w / 100)},${num(b.h / 100)})` })}>${body}</g>`;
}

function notePath(b: Box): string {
  const { x, y, w, h } = b; const r = 12, s = 2;
  return `M ${num(x)},${num(y + s)} A${s},${s} 0 0 1 ${num(x + s)},${num(y)} H ${num(x + w - r)} A${r},${r} 0 0 1 ${num(x + w)},${num(y + r)} V ${num(y + h - s)} A${s},${s} 0 0 1 ${num(x + w - s)},${num(y + h)} H ${num(x + s)} A${s},${s} 0 0 1 ${num(x)},${num(y + h - s)} Z`;
}

/** Cuerpo CSS-like: rectángulo con borde y radio según la figura. */
function boxShape(shape: Shape, b: Box, fill: string, stroke: string, strokeWidth: number, dash?: string): string {
  const common = attrs({ fill, stroke, 'stroke-width': strokeWidth, 'stroke-dasharray': dash });
  if (shape === 'note') return `<path class="ad-shape"${attrs({ d: notePath(b) })}${common}/>`;
  if (shape === 'label') return '';
  const rx = shape === 'rounded' ? 10 : 4;
  return `<rect class="ad-shape"${attrs({ x: b.x, y: b.y, width: b.w, height: b.h, rx })}${common}/>`;
}

// ---------------------------------------------------------------- Cardinalidades (pata de gallo)
/*
 * Réplica de `packages/editor/src/edges/cardinality.ts` y de los marcadores IE de `RelationEdge.tsx`:
 * el SVG exportado debe coincidir con el lienzo. Si cambias algo aquí, cámbialo allí también.
 */
const IE_W = 24, IE_H = 16, IE_REF = 22;
const FOOT = 'M10,8 L22,2 M10,8 L22,14 M10,8 L22,8';
const bar = (x: number) => `M${x},2 L${x},14`;
const IE_MARKERS: Partial<Record<ArrowHead, { path: string; circle?: number }>> = {
  'one': { path: bar(14) },
  'only-one': { path: `${bar(16)} ${bar(11)}` },
  'zero-or-one': { path: bar(16), circle: 8 },
  'many': { path: FOOT },
  'one-or-many': { path: `${FOOT} ${bar(6)}` },
  'zero-or-many': { path: FOOT, circle: 5.5 },
};
/** Claves de extremo: no entran en el rótulo central de la arista. */
export const END_KEYS = new Set(['sourceCard', 'targetCard', 'sourceRole', 'targetRole']);
const CARD_HEAD: Record<string, ArrowHead> = {
  '1': 'one', 'one': 'one',
  '1..1': 'only-one', '||': 'only-one', 'only-one': 'only-one',
  '0..1': 'zero-or-one', '?': 'zero-or-one', 'zero-or-one': 'zero-or-one',
  '*': 'many', 'many': 'many',
  '1..*': 'one-or-many', '+': 'one-or-many', 'one-or-many': 'one-or-many',
  '0..*': 'zero-or-many', 'zero-or-many': 'zero-or-many',
};
/** "1", "1..1", "0..1", "*", "1..*", "0..*" (también `N`/`M` por `*` y los ids de `ArrowHead`) → cabeza IE. */
export function cardToHead(v: unknown): ArrowHead | undefined {
  if (typeof v !== 'string') return undefined;
  const k = v.trim().toLowerCase().replace(/\s+/g, '').replace(/^(n|m)$/, '*').replace(/\.\.(n|m)$/, '..*');
  return CARD_HEAD[k];
}
export interface CardEnds { sourceHead?: ArrowHead; targetHead?: ArrowHead; sourceCard?: string; targetCard?: string; sourceRole?: string; targetRole?: string }
/** Campos de extremo de una relación: un select `…Card` que se traduce a cabeza la sustituye; si no, es un rótulo. */
export function cardEnds(fields: Record<string, unknown> | undefined, defs: { key: string; kind: string }[] | undefined): CardEnds {
  const out: CardEnds = {};
  if (!fields) return out;
  const str = (k: string) => { const v = fields[k]; return typeof v === 'string' && v.trim() ? v.trim() : undefined; };
  for (const end of ['source', 'target'] as const) {
    const key = `${end}Card`, v = str(key);
    if (v) {
      const def = defs?.find(d => d.key === key);
      const head = def?.kind === 'select' ? cardToHead(v) : undefined;
      if (head) out[`${end}Head`] = head; else out[`${end}Card`] = v;
    }
    const role = str(`${end}Role`);
    if (role) out[`${end}Role`] = role;
  }
  return out;
}
const SIDE_VEC: Record<string, Pt> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
const unitVec = (x: number, y: number): Pt => { const l = Math.hypot(x, y); return l < 1e-6 ? { x: 1, y: 0 } : { x: x / l, y: y / l }; };
function endDirection(p: Pt, side: string, next: Pt, router: string, hasBends: boolean): Pt {
  if (router === 'straight' || (router === 'bezier' && hasBends)) return unitVec(next.x - p.x, next.y - p.y);
  if (hasBends) {
    const horizontal = side === 'left' || side === 'right';
    const dx = next.x - p.x, dy = next.y - p.y;
    if (horizontal && dx !== 0) return { x: Math.sign(dx), y: 0 };
    if (!horizontal && dy !== 0) return { x: 0, y: Math.sign(dy) };
  }
  return SIDE_VEC[side] ?? { x: 1, y: 0 };
}
function endLabel(p: Pt, u: Pt, side: 1 | -1): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  if (Math.abs(u.x) >= Math.abs(u.y)) return { x: p.x + u.x * 6, y: p.y + u.y * 14 + (side === 1 ? -10 : 11), anchor: u.x >= 0 ? 'start' : 'end' };
  return { x: p.x + u.x * 14 + (side === 1 ? 7 : -7), y: p.y + u.y * 14, anchor: side === 1 ? 'start' : 'end' };
}

// ---------------------------------------------------------------- Contexto de render
interface Ctx {
  store: Store; reg: NotationRegistry; viewId: string; prefix: string; bare: boolean;
  markers: Map<string, string>;
  abs: Map<string, Box>;
  portsOf: Map<string, { port: Port; y: number }[]>;
  /** Cajas de rótulos que pueden salir de los nodos (cardinalidades y roles): entran en la caja envolvente. */
  extents: Box[];
}

function markerId(ctx: Ctx, head: ArrowHead, color: string, start: boolean): string {
  const id = `${ctx.prefix}-m-${head}-${color.replace(/[^a-z0-9]/gi, '')}${start ? '-s' : ''}`;
  if (!ctx.markers.has(id)) {
    const o = start ? 'auto-start-reverse' : 'auto';
    const common = (extra: Record<string, string | number> = {}) => attrs({ id, orient: o, markerUnits: 'userSpaceOnUse', markerWidth: 14, markerHeight: 14, refX: 12, refY: 7, ...extra });
    const hollow = 'class="ad-marker-hollow" fill="#fff"';
    let m = '';
    switch (head) {
      case 'arrow': m = `<marker${common()}><path d="M1,1 L12,7 L1,13 z" fill="${color}" stroke="${color}"/></marker>`; break;
      case 'open': m = `<marker${common()}><path d="M1,1 L12,7 L1,13" fill="none" stroke="${color}" stroke-width="1.5"/></marker>`; break;
      case 'triangle': m = `<marker${common()}><path d="M1,1 L12,7 L1,13 z" ${hollow} stroke="${color}" stroke-width="1.5"/></marker>`; break;
      case 'diamond': m = `<marker${common({ refX: 13, markerWidth: 16 })}><path d="M1,7 L7,1 L13,7 L7,13 z" ${hollow} stroke="${color}" stroke-width="1.5"/></marker>`; break;
      case 'filled-diamond': m = `<marker${common({ refX: 13, markerWidth: 16 })}><path d="M1,7 L7,1 L13,7 L7,13 z" fill="${color}" stroke="${color}"/></marker>`; break;
      case 'circle': m = `<marker${common({ refX: 10 })}><circle cx="7" cy="7" r="4" ${hollow} stroke="${color}" stroke-width="1.5"/></marker>`; break;
      case 'dot': m = `<marker${common({ refX: 10 })}><circle cx="7" cy="7" r="4" fill="${color}"/></marker>`; break;
      case 'half': m = `<marker${common()}><path d="M1,1 L12,7 L1,7" fill="${color}" stroke="${color}"/></marker>`; break;
      default: {
        const ie = IE_MARKERS[head];
        if (!ie) return '';
        const circle = ie.circle !== undefined ? `<circle class="ad-card-hollow"${attrs({ cx: ie.circle, cy: IE_H / 2, r: 4 })} fill="#fff" stroke="${color}" stroke-width="1.5"/>` : '';
        m = `<marker${attrs({ id, orient: o, markerUnits: 'userSpaceOnUse', markerWidth: IE_W, markerHeight: IE_H, refX: IE_REF, refY: IE_H / 2 })}><path d="${ie.path}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>${circle}</marker>`;
      }
    }
    ctx.markers.set(id, m);
  }
  return id;
}

/** Puertos visibles: los elegidos en la vista, o todos si `showPorts`, o ninguno (igual que el editor). */
export function visiblePorts(ports: Port[], vn: ViewNode): Port[] {
  if (vn.style.showPorts === false) return [];
  if (vn.style.visiblePorts?.length) { const set = new Set(vn.style.visiblePorts); return ports.filter(p => set.has(p.key) || set.has(p.id)); }
  if (vn.style.showPorts) return ports;
  return [];
}

// ---------------------------------------------------------------- Nodos
/** Relleno explícito de un nodo (regla, estilo de vista o color de tipo), si lo tiene. */
function explicitFill(ctx: Ctx, vn: ViewNode): string | undefined {
  const el = vn.elementId ? ctx.store.get('elements', vn.elementId) : undefined;
  if (!el) return vn.style.fill;
  const rule = resolveStyle(ctx.store, ctx.reg, el, ctx.viewId).style;
  return rule.bg ?? vn.style.fill ?? ctx.reg.elementType(el.typeId)?.color;
}

function renderElementNode(ctx: Ctx, vn: ViewNode, el: Element, type: ElementType | undefined, b: Box, dimmed: boolean, parentFill: string | undefined): string {
  const rule = resolveStyle(ctx.store, ctx.reg, el, ctx.viewId).style as RuleStyle;
  const shape: Shape = type?.shape ?? 'rounded';
  const isContainer = !!type?.container;
  const explicit = rule.bg ?? vn.style.fill ?? type?.color;
  // Sin color propio, el relleno sigue al tema (blanco en claro, panel en oscuro), como el editor.
  const fill = explicit ?? 'var(--ad-node-fill)';
  const stroke = rule.border ?? vn.style.stroke ?? (explicit ? darken(explicit, 0.35) : 'var(--ad-node-stroke)');
  const svgShape = SVG_SHAPES.has(shape);
  // Etiquetas bajo la figura (círculos, rombos…): color legible sobre el contenedor que las rodea, o el del tema.
  const onParent = parentFill ? readable(parentFill) : 'var(--ad-text)';
  const textColor = rule.text ?? vn.style.text ?? (svgShape && LABEL_BELOW.has(shape) ? onParent : !explicit ? 'var(--ad-text)' : readable(explicit));
  const opacity = rule.opacity ?? vn.style.opacity ?? 1;
  const fontSize = vn.style.fontSize ?? 13;
  const strokeWidth = rule.borderWidth ?? 1;
  const dash = rule.borderStyle === 'dashed' ? '6 4' : rule.borderStyle === 'dotted' ? '2 3' : (shape === 'group' || shape === 'container') ? '4 3' : undefined;
  const label = vn.text ?? (el.name || (type?.name ?? ''));
  // ArchiMate: figuras e iconos de Archi (mismas `FIGURES` que el editor).
  const archi = ctx.reg.notationOf(el.typeId) === 'archimate' ? figureEntry(el.typeId) : undefined;
  const archiDef = archi ? figureOf(el.typeId, vn.style.figure === 1 ? 1 : 0) : undefined;
  const inset = archiDef ? textInset(archiDef, b.w, b.h) : { top: 0, right: 0, bottom: 0, left: 0 };
  const icon = archi || LABEL_BELOW.has(shape) ? undefined : ((rule.icon ?? type?.icon) || undefined);
  const cls = ['ad-node', `ad-shape-${shape}`, archi ? 'ad-node--archimate' : '', isContainer ? 'is-container' : '', dimmed ? 'is-dimmed' : '', rule.bold ? 'r-bold' : '', rule.strike ? 'r-strike' : ''].filter(Boolean).join(' ');

  const parts: string[] = [];
  // Cuerpo
  if (archi && archiDef) {
    const alt = vn.style.figure === 1 && !!archi.figure1;
    const fp = figureParts(archiDef, b.w, b.h, fill, stroke, strokeWidth, rule.borderStyle === 'dashed' ? '6 4' : rule.borderStyle === 'dotted' ? '2 3' : undefined);
    const paths = fp.map(p => `<path${attrs({ d: p.d, fill: p.fill, stroke: p.stroke, 'stroke-width': p.strokeWidth, 'stroke-dasharray': p.dash, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`).join('');
    parts.push(`<g class="ad-shape ad-archi"${attrs({ 'data-figure': ctx.bare ? undefined : alt ? 1 : 0, transform: `translate(${num(b.x)},${num(b.y)})` })}>${paths}</g>`);
    if (showsIcon(el.typeId, vn.style.figure)) {
      const ip = iconParts(el.typeId, stroke).map(p => `<path${attrs({ d: p.d, fill: p.fill, stroke: p.stroke, 'stroke-width': p.strokeWidth, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`).join('');
      parts.push(`<g class="ad-archi__icon"${attrs({ transform: `translate(${num(b.x + b.w - 20)},${num(b.y + 4)})` })}>${ip}</g>`);
      inset.right += 12;
    }
  }
  else if (svgShape) parts.push(shapeSvg(shape, b, fill, stroke, 1.5));
  else if (shape === 'pool' || shape === 'lane') {
    const band = shape === 'pool' ? 24 : 18;
    parts.push(`<rect class="ad-shape"${attrs({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, fill, stroke, 'stroke-width': strokeWidth })}/>`);
    parts.push(`<line${attrs({ x1: b.x + band, y1: b.y, x2: b.x + band, y2: b.y + b.h, stroke, 'stroke-width': strokeWidth })}/>`);
    const cx = b.x + band / 2, cy = b.y + b.h / 2;
    parts.push(`<text${attrs({ x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'ad-node__label', fill: textColor, 'font-size': shape === 'pool' ? fontSize : Math.min(fontSize, 11), transform: `rotate(-90 ${num(cx)} ${num(cy)})` })}>${escapeXml(label)}</text>`);
  } else parts.push(boxShape(shape, b, fill, stroke, strokeWidth, dash));
  // Reglas: acento, banda superior
  if (rule.accent) parts.push(`<rect${attrs({ x: b.x, y: b.y, width: rule.accentWidth ?? 4, height: b.h, fill: rule.accent })}/>`);
  if (rule.top) parts.push(`<rect${attrs({ x: b.x, y: b.y, width: b.w, height: rule.topWidth ?? 4, fill: rule.top })}/>`);

  // Etiqueta
  if (shape !== 'pool' && shape !== 'lane') {
    const lineH = fontSize * 1.25;
    if (LABEL_BELOW.has(shape)) {
      parts.push(textBlock([label], { x: b.x + b.w / 2, y: b.y + b.h + 2 + lineH / 2, cls: 'ad-node__label', fill: textColor, fontSize }));
    } else {
      const padX = 10, padY = 4;
      // Zona útil (las figuras de Archi con cabecera o pestañas laterales reservan margen).
      const area = { x: b.x + inset.left, y: b.y + inset.top, w: Math.max(fontSize, b.w - inset.left - inset.right), h: Math.max(lineH, b.h - inset.top - inset.bottom) };
      const maxW = Math.max(fontSize, area.w - padX * 2);
      const lines = wrapText(label, maxW, fontSize);
      const blocks: { lines: string[]; cls: string; fontSize: number; lineH: number }[] = [];
      if (icon) blocks.push({ lines: [icon], cls: 'ad-node__icon', fontSize: 16, lineH: 17 });
      blocks.push({ lines, cls: 'ad-node__label', fontSize, lineH });
      if (type) blocks.push({ lines: [type.name], cls: 'ad-node__type', fontSize: 10, lineH: 13 });
      const total = blocks.reduce((s, k) => s + k.lines.length * k.lineH, 0) + (blocks.length - 1);
      const left = isContainer;
      let y = left ? area.y + padY + 2 : area.y + (area.h - total) / 2;
      const x = left ? area.x + padX : area.x + area.w / 2;
      for (const k of blocks) {
        const h = k.lines.length * k.lineH;
        parts.push(textBlock(k.lines, { x, y: y + h / 2, anchor: left ? 'start' : 'middle', cls: k.cls, fill: textColor, fontSize: k.fontSize, lineH: k.lineH }));
        y += h + 1;
      }
    }
  }
  // Badge, drill
  if (rule.badge) {
    const txt = rule.badgeText ?? '';
    const w = Math.max(10, textW(txt, 9) + 6);
    parts.push(`<g class="ad-node__badge"><rect${attrs({ x: b.x + b.w + 8 - w, y: b.y - 8, width: w, height: 10, rx: 5, fill: rule.badge })}/>${txt ? textBlock([txt], { x: b.x + b.w + 8 - w / 2, y: b.y - 3, fontSize: 9, lineH: 10 }) : ''}</g>`);
  }
  if (vn.detailViewId) parts.push(`<text class="ad-node__drill"${attrs({ x: b.x + b.w - 3, y: b.y + b.h - 2, 'text-anchor': 'end', fill: textColor })}>⤵</text>`);
  // Pines
  const ports = ctx.portsOf.get(vn.id) ?? [];
  for (const { port, y } of ports) {
    const txt = port.label ?? port.key;
    const w = textW(txt, 10) + 8, h = 14;
    const out = port.direction === 'out';
    if (port.direction !== 'out') parts.push(`<rect class="ad-port__handle"${attrs({ x: b.x - 4.5, y: y - 4.5, width: 9, height: 9, rx: 2 })}/>`);
    if (port.direction !== 'in') parts.push(`<rect class="ad-port__handle"${attrs({ x: b.x + b.w - 4.5, y: y - 4.5, width: 9, height: 9, rx: 2 })}/>`);
    const lx = out ? b.x + b.w + 6 : b.x - 6 - w;
    parts.push(`<g class="ad-port__label"><rect${attrs({ x: lx, y: y - h / 2, width: w, height: h, rx: 3 })}/>${textBlock([txt], { x: lx + w / 2, y, fontSize: 10, lineH: 12 })}</g>`);
  }

  const data = ctx.bare ? {} : { 'data-node': vn.id, 'data-element': el.id, 'data-type': el.typeId, 'data-detail-view': vn.detailViewId };
  const title = !ctx.bare && el.doc ? `<title>${escapeXml(el.doc)}</title>` : '';
  return `<g${attrs({ class: cls, opacity: opacity === 1 ? undefined : opacity, ...data })}>${title}${parts.join('')}</g>`;
}

function renderVisualNode(ctx: Ctx, vn: ViewNode, b: Box): string {
  const kind = (vn.visualType ?? 'core:note').replace(/^core:/, '');
  const isGroup = kind === 'group';
  const fs = vn.style.fontSize ?? 13;
  const parts: string[] = [];
  const style = attrs({ fill: vn.style.fill, stroke: vn.style.stroke });
  parts.push(`<rect${attrs({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4 })}${style}/>`);
  const text = vn.text ?? '';
  if (text) {
    if (isGroup) parts.push(textBlock([text], { x: b.x + 6, y: b.y + 6 + 7, anchor: 'start', cls: 'ad-visual__title', fontSize: 11, lineH: 14, fill: vn.style.text }));
    else {
      const lines = wrapText(text, Math.max(fs, b.w - 12), fs);
      const lineH = fs * 1.4;
      parts.push(textBlock(lines, { x: b.x + 6, y: b.y + 6 + (lines.length * lineH) / 2, anchor: 'start', fontSize: fs, lineH, fill: vn.style.text }));
    }
  }
  const data = ctx.bare ? {} : { 'data-node': vn.id };
  return `<g${attrs({ class: `ad-visual ad-visual--${kind}`, ...data })}>${parts.join('')}</g>`;
}

// ---------------------------------------------------------------- Aristas
function renderEdge(ctx: Ctx, e: ViewEdge): string {
  const a = ctx.abs.get(e.fromNodeId), b = ctx.abs.get(e.toNodeId);
  if (!a || !b) return '';
  const rel = e.relationId ? ctx.store.get('relations', e.relationId) : undefined;
  const type = rel ? ctx.reg.relationType(rel.typeId) : undefined;
  const line = e.style.line ?? type?.line ?? 'solid';
  const color = e.style.color ?? type?.color ?? '#444';
  const width = e.style.width ?? 1.5;
  const ends = cardEnds(rel?.fields, type?.fields);
  const sh = e.style.sourceHead ?? ends.sourceHead ?? type?.sourceHead ?? 'none';
  const th = e.style.targetHead ?? ends.targetHead ?? type?.targetHead ?? 'arrow';
  const router: Router = e.style.router ?? 'smoothstep';
  const bends: Pt[] = e.bendpoints;
  const first = bends[0], last = bends[bends.length - 1];

  const portY = (nodeId: string, portId: string | undefined) => (portId ? ctx.portsOf.get(nodeId)?.find(p => p.port.id === portId)?.y : undefined);
  const py = portY(e.fromNodeId, e.fromPortId), qy = portY(e.toNodeId, e.toPortId);
  let ep: Endpoints;
  if (e.fromPortId || e.toPortId) {
    const fl = floatingEndpoints(a, b, first, last);
    ep = {
      sourceX: py !== undefined ? a.x + a.w : fl.sourceX, sourceY: py ?? fl.sourceY, sourcePosition: py !== undefined ? 'right' : fl.sourcePosition,
      targetX: qy !== undefined ? b.x : fl.targetX, targetY: qy ?? fl.targetY, targetPosition: qy !== undefined ? 'left' : fl.targetPosition,
    };
  } else ep = floatingEndpoints(a, b, first, last);

  const { path, labelX, labelY } = edgePath(ep, bends, router);
  const dash = line === 'dashed' ? '8 5' : line === 'dotted' ? '2 4' : undefined;
  const ms = sh !== 'none' ? markerId(ctx, sh, color, true) : '';
  const mt = th !== 'none' ? markerId(ctx, th, color, false) : '';
  const fieldLabel = rel && type ? type.fields.filter(f => ['text', 'select'].includes(f.kind) && !END_KEYS.has(f.key)).map(f => rel.fields[f.key]).filter((v): v is string => typeof v === 'string' && !!v.trim()).join(' · ') : '';
  const label = e.label ?? (rel?.name || fieldLabel);
  const mappings = rel?.mappings.length ? rel.mappings.map(m => `${m.fromPath} → ${m.toPath}`).join('\n') : '';
  const parts: string[] = [];
  parts.push(`<path${attrs({ d: path, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-dasharray': dash, 'marker-start': ms ? `url(#${ms})` : undefined, 'marker-end': mt ? `url(#${mt})` : undefined })}/>`);
  if (label || mappings) {
    const txt = label || (type?.name ?? '');
    const w = textW(txt, 11) + 12 + (mappings ? 14 : 0), h = 18;
    parts.push(`<g class="ad-edge-label">${mappings ? `<title>${escapeXml(mappings)}</title>` : ''}<rect${attrs({ x: labelX - w / 2, y: labelY - h / 2, width: w, height: h, rx: 4 })}/>${textBlock([txt], { x: labelX - (mappings ? 7 : 0), y: labelY, fontSize: 11, lineH: 13 })}${mappings ? `<text class="ad-edge-label__pins"${attrs({ x: labelX + w / 2 - 4, y: labelY, 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-size': 11 })}>⇄</text>` : ''}</g>`);
  }
  if (ends.sourceCard || ends.targetCard || ends.sourceRole || ends.targetRole) {
    const S = { x: ep.sourceX, y: ep.sourceY }, T = { x: ep.targetX, y: ep.targetY };
    const us = endDirection(S, ep.sourcePosition, first ?? T, router, bends.length > 0);
    const ut = endDirection(T, ep.targetPosition, last ?? S, router, bends.length > 0);
    const put = (text: string | undefined, p: Pt, u: Pt, side: 1 | -1) => {
      if (!text) return;
      const l = endLabel(p, u, side);
      const w = textW(text, 11);
      ctx.extents.push({ x: l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2, y: l.y - 7, w, h: 14 });
      parts.push(`<text${attrs({ class: side === 1 ? 'ad-card-label' : 'ad-card-label ad-card-label--role', x: l.x, y: l.y, 'text-anchor': l.anchor, 'dominant-baseline': 'central' })}>${escapeXml(text)}</text>`);
    };
    put(ends.sourceCard, S, us, 1); put(ends.sourceRole, S, us, -1);
    put(ends.targetCard, T, ut, 1); put(ends.targetRole, T, ut, -1);
  }
  const data = ctx.bare ? {} : { 'data-edge': e.id, 'data-relation': e.relationId };
  const title = !ctx.bare && rel?.doc ? `<title>${escapeXml(rel.doc)}</title>` : '';
  return `<g${attrs({ class: 'ad-edge', ...data })}>${title}${parts.join('')}</g>`;
}

// ---------------------------------------------------------------- Vista completa
export interface SvgResult { svg: string; width: number; height: number; viewBox: [number, number, number, number] }

export function renderSvg(store: Store, reg: NotationRegistry, viewId: string, opts: SvgOptions = {}): string {
  return renderSvgDetailed(store, reg, viewId, opts).svg;
}

export function renderSvgDetailed(store: Store, reg: NotationRegistry, viewId: string, opts: SvgOptions = {}): SvgResult {
  const view = store.get('views', viewId);
  if (!view) throw new Error(`renderSvg: no existe la vista ${viewId}`);
  const theme = opts.theme ?? 'light';
  const padding = opts.padding ?? 24;
  const fontFamily = opts.fontFamily ?? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const prefix = safeId(opts.idPrefix ?? `ad-${viewId}`);
  const ctx: Ctx = { store, reg, viewId, prefix, bare: !!opts.bare, markers: new Map(), abs: new Map(), portsOf: new Map(), extents: [] };

  const nodes = store.list('nodes').filter(n => n.viewId === viewId);
  const edges = store.list('edges').filter(e => e.viewId === viewId);
  const byId = new Map(nodes.map(n => [n.id, n] as const));

  // Rejilla
  const isGrid = view.kind === 'grid';
  const grid = isGrid ? normalizeGrid(view.grid) : undefined;
  const rects = grid ? cellRects(grid) : undefined;

  // Posiciones absolutas (padres antes que hijos)
  const resolve = (n: ViewNode, guard = 0): Box => {
    const cached = ctx.abs.get(n.id); if (cached) return cached;
    let x = n.x, y = n.y;
    const p = n.parentNodeId ? byId.get(n.parentNodeId) : undefined;
    if (p && guard < 50) { const pb = resolve(p, guard + 1); x += pb.x; y += pb.y; }
    else if (rects && n.cell) { const c = rects.cells[cellKey(n.cell.layerId, n.cell.stageId)]; if (c) { x += c.x; y += c.y; } }
    const b = { x, y, w: n.w, h: n.h };
    ctx.abs.set(n.id, b);
    return b;
  };
  nodes.forEach(n => resolve(n));

  // Pines visibles por nodo (posición absoluta en y)
  for (const n of nodes) {
    if (!n.elementId) continue;
    const el = store.get('elements', n.elementId); if (!el) continue;
    const vis = visiblePorts(allPorts(el, reg.fieldsOf(el.typeId)), n);
    if (!vis.length) continue;
    const b = ctx.abs.get(n.id)!;
    ctx.portsOf.set(n.id, vis.map((port, i) => ({ port, y: b.y + ((i + 1) / (vis.length + 1)) * b.h })));
  }

  // Orden de pintado: profundidad (padres primero), luego contenedores, luego z
  const depth = (n: ViewNode): number => { let d = 0, cur = n, guard = 0; while (cur.parentNodeId && byId.has(cur.parentNodeId) && guard++ < 50) { cur = byId.get(cur.parentNodeId)!; d++; } return d; };
  const zOf = (n: ViewNode): number => {
    if (n.visualType === 'core:group') return -1;
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    const t = el ? reg.elementType(el.typeId) : undefined;
    return t?.container ? -1 : n.z ?? 0;
  };
  const ordered = [...nodes].sort((a, b) => depth(a) - depth(b) || zOf(a) - zOf(b));

  const body: string[] = [];
  // Rejilla: celdas y cabeceras
  if (grid && rects) {
    const g: string[] = [];
    for (const c of Object.values(rects.cells)) {
      const color = grid.layers.find(l => l.id === c.layerId)?.color;
      const fill = color ? mixWithWhite(color, 0.25) : undefined;
      g.push(`<rect class="ad-cell"${attrs({ x: c.x, y: c.y, width: c.w, height: c.h, fill, style: color ? `fill:color-mix(in srgb, ${color} 25%, var(--ad-panel))` : undefined, 'data-cell': ctx.bare ? undefined : cellKey(c.layerId, c.stageId) })}/>`);
    }
    const header = (r: { x: number; y: number; w: number; h: number }, text: string, fill?: string, vertical = false) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const lines = vertical ? [text] : wrapText(text, r.w - 8, 12);
      g.push(`<g class="ad-header"><rect${attrs({ x: r.x, y: r.y, width: r.w, height: r.h, fill, style: fill ? `fill:${fill}` : undefined })}/>${textBlock(lines, { x: cx, y: cy, fontSize: 12, lineH: 14, fill: fill ? readable(fill) : undefined })}</g>`);
    };
    for (const [id, r] of Object.entries(rects.layers)) { const l = grid.layers.find(x => x.id === id); header(r, l?.name ?? '', l?.color); }
    for (const [id, r] of Object.entries(rects.stages)) header(r, grid.stages.find(x => x.id === id)?.name ?? '');
    for (const [id, r] of Object.entries(rects.groups)) { const gr = grid.stageGroups.find(x => x.id === id); header(r, gr?.name ?? '', gr?.color); }
    body.push(`<g class="ad-grid">${g.join('')}</g>`);
  }

  const nodeSvg: string[] = [];
  for (const n of ordered) {
    const b = ctx.abs.get(n.id)!;
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    if (n.elementId && !el) { nodeSvg.push(`<g class="ad-node ad-node--missing"><rect${attrs({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, fill: '#fee2e2', stroke: '#dc2626' })}/>${textBlock(['?'], { x: b.x + b.w / 2, y: b.y + b.h / 2 })}</g>`); continue; }
    if (!el) { nodeSvg.push(renderVisualNode(ctx, n, b)); continue; }
    const type = reg.elementType(el.typeId);
    const dimmed = (reg.notationOf(el.typeId) !== view.notationId && reg.notationOf(el.typeId) !== 'freeform' && !el.libraryId) || !reg.inViewpoint(view.notationId, view.viewpointId, el.typeId);
    let pf: string | undefined, anc = n.parentNodeId ? byId.get(n.parentNodeId) : undefined, guard = 0;
    while (anc && pf === undefined && guard++ < 50) { pf = explicitFill(ctx, anc); anc = anc.parentNodeId ? byId.get(anc.parentNodeId) : undefined; }
    nodeSvg.push(renderElementNode(ctx, n, el, type, b, dimmed, pf));
  }
  const edgeSvg = edges.map(e => renderEdge(ctx, e)).filter(Boolean);
  body.push(`<g class="ad-nodes">${nodeSvg.join('')}</g>`);
  body.push(`<g class="ad-edges">${edgeSvg.join('')}</g>`);

  // Caja envolvente
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number, w = 0, h = 0) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h); };
  if (rects) grow(0, 0, rects.width, rects.height);
  for (const n of nodes) {
    const b = ctx.abs.get(n.id)!;
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    const shape = el ? reg.elementType(el.typeId)?.shape : undefined;
    const below = shape && LABEL_BELOW.has(shape) ? 22 : 0;
    const ports = ctx.portsOf.get(n.id) ?? [];
    const portW = ports.length ? Math.max(...ports.map(p => textW(p.port.label ?? p.port.key, 10) + 14)) : 0;
    grow(b.x - portW, b.y - (rule_has_badge(ctx, el) ? 10 : 0), b.w + portW * 2, b.h + below);
  }
  for (const e of edges) for (const p of e.bendpoints) grow(p.x, p.y);
  for (const b of ctx.extents) grow(b.x, b.y, b.w, b.h);
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 100; }
  const vx = Math.floor(minX - padding), vy = Math.floor(minY - padding);
  const vw = Math.ceil(maxX + padding) - vx, vh = Math.ceil(maxY + padding) - vy;

  const title = `${view.name || 'Vista'}`;
  const elCount = nodes.filter(n => n.elementId).length;
  const desc = `Vista "${view.name}" (${view.notationId}${view.kind !== 'freeform' ? `, ${view.kind}` : ''}) con ${elCount} elementos y ${edges.length} relaciones.${view.doc ? ` ${view.doc}` : ''}`;
  const tId = `${prefix}-title`, dId = `${prefix}-desc`;
  const bg = opts.background ?? 'var(--ad-bg)';
  const head = ctx.bare ? '' : `<title id="${tId}">${escapeXml(title)}</title><desc id="${dId}">${escapeXml(desc)}</desc>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ class: 'ad-svg', viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw, height: vh, role: 'img', 'aria-labelledby': ctx.bare ? undefined : `${tId} ${dId}`, 'data-view': ctx.bare ? undefined : viewId, 'data-theme': theme === 'dual' ? undefined : theme })}>`,
    head,
    `<style>${svgStyle(theme, fontFamily)}</style>`,
    `<defs>${[...ctx.markers.values()].join('')}</defs>`,
    bg === 'transparent' || bg === 'none' ? '' : `<rect class="ad-bg"${attrs({ x: vx, y: vy, width: vw, height: vh, fill: bg })}/>`,
    ...body,
    '</svg>',
  ].filter(Boolean).join('\n');
  return { svg, width: vw, height: vh, viewBox: [vx, vy, vw, vh] };
}

function rule_has_badge(ctx: Ctx, el: Element | undefined): boolean {
  return !!el && !!resolveStyle(ctx.store, ctx.reg, el, ctx.viewId).style.badge;
}

// ---------------------------------------------------------------- PNG (navegador)
/** Rasteriza un SVG a PNG con `Image` + canvas. Solo en navegador. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') throw new Error('svgToPng solo funciona en el navegador');
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = m ? Number(m[3]) : 800, h = m ? Number(m[4]) : 600;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('No se pudo cargar el SVG')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * scale); canvas.height = Math.ceil(h * scale);
    const g = canvas.getContext('2d');
    if (!g) throw new Error('canvas sin contexto 2d');
    g.scale(scale, scale);
    g.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob falló'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
