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
import { renderSequenceSvg } from './svg-sequence';
import { tr, trn } from './i18n';

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
  /**
   * Marcadores numerados encima del dibujo (los usa el HTML exportado para los comentarios). Por defecto ninguno:
   * el SVG suelto no lleva comentarios.
   */
  markers?: SvgMarker[];
}

/** Marcador numerado sobre un nodo (esquina superior derecha), una arista (su punto medio) o un punto del lienzo. */
export interface SvgMarker {
  label: string;
  at: { node: string } | { edge: string } | { x: number; y: number };
  /** Atenuado (p. ej. hilo resuelto). */
  muted?: boolean;
  /** Texto emergente (`<title>`). */
  title?: string;
  /** Va en `data-marker` para enlazarlo desde fuera (p. ej. con el hilo del panel). */
  id?: string;
}

const MARKER_R = 10;
const MARKER_CSS = [
  '.ad-marker{cursor:pointer}',
  '.ad-marker circle{fill:var(--ad-accent);stroke:var(--ad-bg);stroke-width:2}',
  '.ad-marker text{fill:#fff;font-size:11px;font-weight:700}',
  '.ad-marker.is-muted circle{fill:var(--ad-muted)}',
  '.ad-marker.is-focus circle{stroke:var(--ad-text)}',
].join('\n');

// ---------------------------------------------------------------- Tema
export const THEME_VARS: Record<'light' | 'dark', Record<string, string>> = {
  light: {
    '--ad-bg': '#f6f7f9', '--ad-panel': '#ffffff', '--ad-border': '#e3e6ea', '--ad-text': '#1b1f24', '--ad-muted': '#6b7280', '--ad-accent': '#2563eb',
    '--ad-header': '#f3f4f6', '--ad-header-border': '#d1d5db', '--ad-cell': 'rgba(0,0,0,.02)', '--ad-cell-border': '#e5e7eb',
    '--ad-note': '#fff8c5', '--ad-visual-border': '#d4d4d8', '--ad-group': 'rgba(0,0,0,.02)',
    '--ad-node-fill': '#ffffff', '--ad-node-stroke': '#a6a6a6', '--ad-edge': '#444444', '--ad-ink': '#000000', '--ad-hdr-mix': '100%',
  },
  dark: {
    '--ad-bg': '#0f1115', '--ad-panel': '#1a1d23', '--ad-border': '#2b3039', '--ad-text': '#e6e8eb', '--ad-muted': '#9aa3b2', '--ad-accent': '#60a5fa',
    '--ad-header': '#20242c', '--ad-header-border': '#3a404b', '--ad-cell': 'rgba(255,255,255,.03)', '--ad-cell-border': '#2b3039',
    '--ad-note': '#3b3620', '--ad-visual-border': '#3f434b', '--ad-group': 'rgba(255,255,255,.03)',
    '--ad-node-fill': '#1c2230', '--ad-node-stroke': '#4a5568', '--ad-edge': '#9aa3b2', '--ad-ink': '#e6e8ec', '--ad-hdr-mix': '42%',
  },
};

const vars = (t: 'light' | 'dark') => Object.entries(THEME_VARS[t]).map(([k, v]) => `${k}:${v}`).join(';');

/**
 * Contenedores "papel" (tipo blanco o gris claro neutro: pool, lane, límite C4, paquete…; clase `ad-lc`) en tema oscuro:
 * relleno del panel y texto del tema, como en el editor. Sus hijos con la etiqueta debajo (eventos, compuertas) llevan
 * `ad-on-lc` para que esa etiqueta también siga al tema. En `dual` solo se aplica con el esquema oscuro.
 */
const lcRules = (scope: string) => [
  `${scope} .ad-lc>.ad-shape{fill:var(--ad-panel)}`,
  `${scope} .ad-lc-text>text{fill:var(--ad-text)}`,
  `${scope} .ad-on-lc>text.ad-node__label{fill:var(--ad-text)}`,
].join('');

export function svgStyle(theme: SvgTheme, fontFamily: string): string {
  const base = theme === 'dark' ? vars('dark') : vars('light');
  const themed = theme === 'dual'
    ? `svg.ad-svg{${vars('light')}}\n@media (prefers-color-scheme: dark){svg.ad-svg{${vars('dark')}}${lcRules('svg.ad-svg:not([data-theme="light"])')}}\nsvg.ad-svg[data-theme="light"]{${vars('light')}}\nsvg.ad-svg[data-theme="dark"]{${vars('dark')}}\n${lcRules('svg.ad-svg[data-theme="dark"]')}`
    : theme === 'dark' ? `svg.ad-svg{${base}}\n${lcRules('svg.ad-svg')}` : `svg.ad-svg{${base}}`;
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
    '.ad-cls__stereo{font-size:11px;opacity:.8}',
    '.ad-cls__name{font-weight:600}',
    '.ad-cls__row{font-size:12px}',
    '.ad-cls__detail{font-size:11px;opacity:.7}',
    '.ad-cls__pk{font-size:9px;font-weight:700}',
    '.ad-cls__row.is-pk .ad-cls__text{font-weight:600;text-decoration:underline}',
    '.ad-cls__row.is-dup .ad-cls__text{fill:#b91c1c}',
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
/** Blanco o gris muy claro sin apenas tinte (#fff, #f5f5f5, #f1f5f9…). Igual que `isNeutralLight` de `shapes.tsx`. */
export function isNeutralLight(hex: string | undefined): boolean {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null; if (!m) return false;
  const n = parseInt(m[1]!, 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
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

/**
 * Figura que se pinta: la del tipo, salvo la persona de C4 (`c4:Person`, tipo `actor`) y el almacén DFD
 * (`dfd:DataStore`: dos líneas paralelas). Igual que `figureFor` del editor.
 */
type Figure = Shape | 'person' | 'store';
export function figureFor(typeId: string | undefined, shape: Shape): Figure {
  if (shape === 'actor' && !!typeId && typeId.startsWith('c4:')) return 'person';
  if (shape === 'bar' && typeId === 'dfd:DataStore') return 'store';
  return shape;
}

/** Negro o casi negro (pseudoestados): en tema oscuro se pinta con la tinta clara (`--ad-ink`). Igual que `isInk` del editor. */
export function isInk(hex: string | undefined): boolean {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null; if (!m) return false;
  const n = parseInt(m[1]!, 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 40;
}

// ---------------------------------------------------------------- Compartimentos (réplica de editor/src/nodes/compartments.ts)
/*
 * Clase, interfaz, enumeración UML y entidad ER (`meta.compartments` del tipo): cabecera con «estereotipo» y nombre, y
 * una sección por campo con una fila por entrada; los pines de las filas quedan a la altura de su fila. Misma geometría
 * que el lienzo: si cambias algo aquí, cámbialo allí también.
 */
export interface CompartmentRow { text: string; detail?: string; portKey: string; pk?: boolean; dup?: boolean }
export interface Compartments { stereotype?: string; italic: boolean; sections: CompartmentRow[][] }
interface CompartmentSpec { sections: string[]; stereotype?: string; abstract?: string; pk?: string }
const CMP = { pad: 5, stereo: 14, name: 18, row: 18, secPad: 3, emptySec: 10, border: 1 } as const;
const strOf = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const memberName = (text: string) => text.replace(/^\s*[-+#~]\s*/, '').split(/[:(\s]/)[0]!.trim().toLowerCase();

export function compartmentsOf(el: Pick<Element, 'fields'>, type: ElementType | undefined): Compartments | undefined {
  const spec = type?.meta?.compartments as CompartmentSpec | undefined;
  if (!spec || !Array.isArray(spec.sections) || !spec.sections.length) return undefined;
  const f = el.fields ?? {};
  const stereotype = (spec.stereotype && strOf(f[spec.stereotype])) || strOf(type?.meta?.stereotypeDefault);
  const pk = new Set(spec.pk && Array.isArray(f[spec.pk]) ? (f[spec.pk] as unknown[]).map(String) : []);
  const sections = spec.sections.map(key => {
    const v = f[key];
    if (!Array.isArray(v)) return [];
    const rows: CompartmentRow[] = [];
    v.forEach((x, i) => {
      if (typeof x === 'string') { if (x.trim()) rows.push({ text: x.trim(), portKey: `${key}[${i}]` }); }
      else if (x && typeof x === 'object' && strOf((x as { key?: unknown }).key)) {
        const k = String((x as { key: unknown }).key);
        rows.push({ text: k, detail: strOf((x as { value?: unknown }).value), portKey: `${key}.${k}`, pk: pk.has(k) || undefined });
      }
    });
    const seen = new Map<string, number>();
    const names = rows.map(r => (r.text.includes('(') ? '' : memberName(r.text)));
    names.forEach(n => { if (n) seen.set(n, (seen.get(n) ?? 0) + 1); });
    rows.forEach((r, i) => { if (names[i] && seen.get(names[i]!)! > 1) r.dup = true; });
    return rows;
  });
  return { stereotype, italic: !!(spec.abstract && f[spec.abstract] === true), sections };
}

export interface CompartmentLayout { headerH: number; sections: { y: number; h: number; rows: (CompartmentRow & { cy: number })[] }[]; height: number }
export function compartmentLayout(c: Compartments): CompartmentLayout {
  const headerH = CMP.pad * 2 + CMP.name + (c.stereotype ? CMP.stereo : 0);
  let y = headerH;
  const sections = c.sections.map(rows => {
    const h = rows.length ? CMP.secPad * 2 + rows.length * CMP.row : CMP.emptySec;
    const sec = { y, h, rows: rows.map((r, i) => ({ ...r, cy: y + CMP.secPad + i * CMP.row + CMP.row / 2 })) };
    y += h;
    return sec;
  });
  return { headerH, sections, height: y + CMP.border * 2 };
}

/** Cabecera, separadores y filas de un clasificador en la caja `b` (las coordenadas del layout van dentro del borde). */
function renderCompartments(c: Compartments, l: CompartmentLayout, b: Box, label: string, textColor: string, stroke: string, strokeWidth: number): string {
  const out: string[] = [];
  const x0 = b.x + CMP.border, y0 = b.y + CMP.border, cx = b.x + b.w / 2;
  const maxChars = (w: number, fs: number) => Math.max(1, Math.floor(w / (fs * 0.55)));
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, Math.max(1, n - 1))}…` : t);
  const nameY = y0 + CMP.pad + (c.stereotype ? CMP.stereo : 0) + CMP.name / 2;
  if (c.stereotype) out.push(textBlock([`«${c.stereotype}»`], { x: cx, y: y0 + CMP.pad + CMP.stereo / 2, cls: 'ad-cls__stereo', fill: textColor, fontSize: 11, lineH: 14 }));
  out.push(textBlock([clip(label, maxChars(b.w - 16, 13))], { x: cx, y: nameY, cls: 'ad-cls__name ad-node__label', fill: textColor, extra: c.italic ? { 'font-style': 'italic' } : undefined }));
  for (const sec of l.sections) {
    const sy = y0 + sec.y;
    out.push(`<line${attrs({ x1: b.x, y1: sy, x2: b.x + b.w, y2: sy, stroke, 'stroke-width': strokeWidth })}/>`);
    for (const r of sec.rows) {
      const y = y0 + r.cy;
      let x = x0 + 7;
      const parts: string[] = [];
      if (r.pk) { parts.push(`<text class="ad-cls__pk"${attrs({ x, y, 'dominant-baseline': 'central', fill: textColor })}>PK</text>`); x += 20; }
      const detailW = r.detail ? Math.min(textW(r.detail, 11), (b.w - 16) * 0.45) : 0;
      const room = b.x + b.w - 8 - x - (detailW ? detailW + 6 : 0);
      parts.push(`<text class="ad-cls__text"${attrs({ x, y, 'dominant-baseline': 'central', fill: textColor })}>${escapeXml(clip(r.text, maxChars(room, 12)))}</text>`);
      if (r.detail) parts.push(`<text class="ad-cls__detail"${attrs({ x: b.x + b.w - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'central', fill: textColor })}>${escapeXml(clip(r.detail, maxChars(detailW, 11)))}</text>`);
      out.push(`<g${attrs({ class: `ad-cls__row${r.pk ? ' is-pk' : ''}${r.dup ? ' is-dup' : ''}` })}>${parts.join('')}</g>`);
    }
  }
  return out.join('');
}

/** Persona C4 (cabeza + cuerpo redondeado, texto dentro del cuerpo). Réplica de `personGeometry` de `shapes.tsx`. */
export function personGeometry(w: number, h: number): { cx: number; cy: number; r: number; bodyTop: number; bodyH: number; rx: number } {
  const r = Math.max(6, Math.min(w * 0.17, h * 0.19));
  const bodyTop = Math.round(2 * r + 3);
  const bodyH = Math.max(4, h - bodyTop - 1);
  return { cx: w / 2, cy: r + 1, r, bodyTop, bodyH, rx: Math.min(r * 1.3, bodyH / 2, (w - 2) / 2) };
}

/** Actor (monigote) sin deformar la cabeza. Réplica de `actorGeometry` de `shapes.tsx`. */
function actorGeometry(w: number, h: number): { cx: number; cy: number; r: number; path: string } {
  const r = Math.max(4, Math.min(w * 0.2, h * 0.12));
  const cx = w / 2, cy = r + 1, neck = cy + r, hip = h * 0.62, arm = neck + (hip - neck) * 0.3, dx = w * 0.32, leg = w * 0.25;
  const f = (n: number) => Math.round(n * 100) / 100;
  return { cx, cy, r, path: `M${f(cx)},${f(neck)} V${f(hip)} M${f(cx - dx)},${f(arm)} H${f(cx + dx)} M${f(cx)},${f(hip)} L${f(cx - leg)},${f(h - 1)} M${f(cx)},${f(hip)} L${f(cx + leg)},${f(h - 1)}` };
}

/**
 * Figura en un viewBox 0..100 escalada al rectángulo (como `ShapeSvg` con `preserveAspectRatio="none"`); el actor y la
 * persona C4 se dibujan en coordenadas del nodo para no deformar la cabeza.
 */
function shapeSvg(shape: Figure, b: Box, fill: string, stroke: string, strokeWidth: number): string {
  const f = fill === 'transparent' ? 'var(--ad-panel)' : fill;
  const c = attrs({ fill: f, stroke, 'stroke-width': strokeWidth, 'vector-effect': 'non-scaling-stroke' });
  if (shape === 'person' || shape === 'actor') {
    const move = attrs({ transform: `translate(${num(b.x)},${num(b.y)})` });
    if (shape === 'person') {
      const g = personGeometry(b.w, b.h);
      return `<g class="ad-shape"${move}><rect${attrs({ x: 1, y: g.bodyTop, width: b.w - 2, height: g.bodyH, rx: g.rx })}${c}/><circle${attrs({ cx: g.cx, cy: g.cy, r: g.r })}${c}/></g>`;
    }
    const g = actorGeometry(b.w, b.h);
    return `<g class="ad-shape"${move}><path${attrs({ d: g.path, fill: 'none', stroke, 'stroke-width': 2, 'stroke-linecap': 'round' })}/><circle${attrs({ cx: g.cx, cy: g.cy, r: g.r })}${c}/></g>`;
  }
  let body: string;
  switch (shape) {
    case 'ellipse': body = `<ellipse cx="50" cy="50" rx="49" ry="49"${c}/>`; break;
    case 'circle': body = `<circle cx="50" cy="50" r="48"${c}/>`; break;
    case 'double-circle':
      // Estado final (relleno de tinta): diana, anillo vacío y punto lleno, como el lienzo.
      body = isInk(fill) || fill === 'var(--ad-ink)'
        ? `<circle cx="50" cy="50" r="47"${attrs({ fill: 'var(--ad-node-fill)', stroke: f, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' })}/><circle cx="50" cy="50" r="30"${attrs({ fill: f, stroke: 'none' })}/>`
        : `<circle cx="50" cy="50" r="48"${c}/><circle cx="50" cy="50" r="38"${c}/>`;
      break;
    case 'diamond': body = `<polygon points="50,1 99,50 50,99 1,50"${c}/>`; break;
    case 'hexagon': body = `<polygon points="25,2 75,2 98,50 75,98 25,98 2,50"${c}/>`; break;
    case 'parallelogram': body = `<polygon points="20,2 98,2 80,98 2,98"${c}/>`; break;
    case 'bar': body = `<rect x="0" y="40" width="100" height="20"${attrs({ fill: stroke, stroke, 'vector-effect': 'non-scaling-stroke' })}/>`; break;
    case 'cylinder': body = `<path d="M2,15 v70 a48,12 0 0 0 96,0 v-70"${c}/><ellipse cx="50" cy="15" rx="48" ry="12"${c}/>`; break;
    case 'store': body = `<rect x="0" y="1" width="100" height="98"${attrs({ fill: f, stroke: 'none' })}/><path d="M0,1 H100 M0,99 H100"${attrs({ fill: 'none', stroke, 'stroke-width': strokeWidth, 'vector-effect': 'non-scaling-stroke' })}/>`; break;
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
  /** `row`: pin de una fila de compartimento (no se dibuja; solo fija dónde sale la arista). */
  portsOf: Map<string, { port: Port; y: number; row?: boolean }[]>;
  /** Cajas de rótulos que pueden salir de los nodos (cardinalidades y roles): entran en la caja envolvente. */
  extents: Box[];
  /** Color de las aristas sin color propio: el del editor en cada tema (`#444` claro, `#9aa3b2` oscuro). */
  edgeColor: string;
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

/** ¿El nodo es un contenedor "papel" (su tipo es blanco o gris neutro y nadie le ha puesto otro relleno)? */
function isPaperContainer(ctx: Ctx, vn: ViewNode): boolean {
  const el = vn.elementId ? ctx.store.get('elements', vn.elementId) : undefined;
  const type = el ? ctx.reg.elementType(el.typeId) : undefined;
  if (!el || !type?.container || !isNeutralLight(type.color) || vn.style.fill !== undefined) return false;
  return resolveStyle(ctx.store, ctx.reg, el, ctx.viewId).style.bg === undefined;
}

function renderElementNode(ctx: Ctx, vn: ViewNode, el: Element, type: ElementType | undefined, b: Box, dimmed: boolean, parentFill: string | undefined, onPaper = false): string {
  const rule = resolveStyle(ctx.store, ctx.reg, el, ctx.viewId).style as RuleStyle;
  const shape: Shape = type?.shape ?? 'rounded';
  const figure = figureFor(el.typeId, shape);
  const person = figure === 'person';
  const isContainer = !!type?.container;
  const explicit = rule.bg ?? vn.style.fill ?? type?.color;
  // Pseudoestados negros del tipo (inicial, final, bifurcación…): tinta del tema, clara en oscuro (negro sobre negro no se ve).
  const ink = rule.bg === undefined && vn.style.fill === undefined && isInk(type?.color);
  // Sin color propio, el relleno sigue al tema (blanco en claro, panel en oscuro), como el editor.
  const fill = ink ? 'var(--ad-ink)' : explicit ?? 'var(--ad-node-fill)';
  const stroke = rule.border ?? vn.style.stroke ?? (ink ? 'var(--ad-ink)' : explicit ? darken(explicit, 0.35) : 'var(--ad-node-stroke)');
  const svgShape = SVG_SHAPES.has(shape);
  const below = LABEL_BELOW.has(shape) && !person && figure !== 'store';
  const cmp = compartmentsOf(el, type);
  // Etiquetas bajo la figura (círculos, rombos…): color legible sobre el contenedor que las rodea, o el del tema.
  const onParent = parentFill ? readable(parentFill) : 'var(--ad-text)';
  const textColor = rule.text ?? vn.style.text ?? (svgShape && below ? onParent : !explicit ? 'var(--ad-text)' : readable(explicit));
  const opacity = rule.opacity ?? vn.style.opacity ?? 1;
  const fontSize = vn.style.fontSize ?? 13;
  const strokeWidth = rule.borderWidth ?? 1;
  const dash = rule.borderStyle === 'dashed' ? '6 4' : rule.borderStyle === 'dotted' ? '2 3' : (shape === 'group' || shape === 'container') ? '4 3' : undefined;
  // Sin nombre, una figura con la etiqueta debajo (evento, compuerta, inicial…) no repite el nombre del tipo.
  const label = vn.text ?? (el.name || (below ? '' : (type?.name ?? '')));
  // ArchiMate: figuras e iconos de Archi (mismas `FIGURES` que el editor).
  const archi = ctx.reg.notationOf(el.typeId) === 'archimate' ? figureEntry(el.typeId) : undefined;
  const archiDef = archi ? figureOf(el.typeId, vn.style.figure === 1 ? 1 : 0) : undefined;
  // Persona C4: el texto va en el cuerpo, bajo la cabeza.
  const inset = archiDef ? textInset(archiDef, b.w, b.h) : person ? { top: personGeometry(b.w, b.h).bodyTop - 2, right: 0, bottom: 0, left: 0 } : { top: 0, right: 0, bottom: 0, left: 0 };
  const icon = archi || LABEL_BELOW.has(shape) ? undefined : ((rule.icon ?? type?.icon) || undefined);
  // Contenedor "papel": en tema oscuro toma el panel y el texto del tema (reglas `lcRules`), si nadie fijó otros colores.
  const paper = isContainer && explicit !== undefined && rule.bg === undefined && vn.style.fill === undefined && isNeutralLight(type?.color);
  const autoText = rule.text === undefined && vn.style.text === undefined;
  const cls = ['ad-node', `ad-shape-${figure}`, archi ? 'ad-node--archimate' : '', isContainer ? 'is-container' : '', paper ? 'ad-lc' : '', paper && autoText ? 'ad-lc-text' : '',
    onPaper && below && autoText ? 'ad-on-lc' : '', dimmed ? 'is-dimmed' : '', rule.bold ? 'r-bold' : '', rule.strike ? 'r-strike' : ''].filter(Boolean).join(' ');

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
  else if (svgShape) parts.push(shapeSvg(figure, b, fill, stroke, 1.5));
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

  // Etiqueta (los clasificadores llevan cabecera y filas)
  if (cmp) parts.push(renderCompartments(cmp, compartmentLayout(cmp), b, label, textColor, stroke, strokeWidth));
  else if (shape !== 'pool' && shape !== 'lane') {
    const lineH = fontSize * 1.25;
    // `labelPosition` del nodo (importadores): `bottom` fuera, bajo la figura (datos BPMN); `top` arriba (contenedores de Archi).
    const pos = vn.style.labelPosition;
    if (below) {
      parts.push(textBlock([label], { x: b.x + b.w / 2, y: b.y + b.h + 2 + lineH / 2, cls: 'ad-node__label', fill: textColor, fontSize }));
    } else if (pos === 'bottom') {
      const lines = wrapText(label, Math.max(b.w + 40, 80), fontSize);
      parts.push(textBlock(lines, { x: b.x + b.w / 2, y: b.y + b.h + 2 + (lines.length * lineH) / 2, cls: 'ad-node__label', fill: rule.text ?? vn.style.text ?? onParent, fontSize, lineH }));
      if (icon) parts.push(textBlock([icon], { x: b.x + b.w / 2, y: b.y + b.h / 2, cls: 'ad-node__icon', fill: textColor, fontSize: 16, lineH: 17 }));
    } else {
      const padX = 10, padY = 4;
      // Zona útil (las figuras de Archi con cabecera o pestañas laterales reservan margen).
      const area = { x: b.x + inset.left, y: b.y + inset.top, w: Math.max(fontSize, b.w - inset.left - inset.right), h: Math.max(lineH, b.h - inset.top - inset.bottom) };
      const maxW = Math.max(fontSize, area.w - padX * 2);
      // Una palabra más ancha que la caja no se parte a mitad («Manageme nt»): se reduce la letra hasta que quepa (mín. 9 px).
      const longest = Math.max(0, ...label.split(/\s+/).map(w => w.length));
      const fs = longest ? Math.max(9, Math.min(fontSize, Math.floor((maxW / (longest * 0.55)) * 10) / 10)) : fontSize;
      const lh = fs * 1.25;
      const lines = wrapText(label, maxW, fs);
      const blocks: { lines: string[]; cls: string; fontSize: number; lineH: number }[] = [];
      if (icon) blocks.push({ lines: [icon], cls: 'ad-node__icon', fontSize: 16, lineH: 17 });
      blocks.push({ lines, cls: 'ad-node__label', fontSize: fs, lineH: lh });
      // El tipo, solo si cabe (en cajas pequeñas, como las de Archi, se salía por debajo).
      const used = blocks.reduce((t, k) => t + k.lines.length * k.lineH, 0) + padY * 2;
      // Sin nombre propio la etiqueta ya es el tipo: no se repite debajo (como el lienzo).
      if (type && label !== type.name && (isContainer || pos === 'top' || used + 14 <= area.h)) blocks.push({ lines: [type.name], cls: 'ad-node__type', fontSize: 10, lineH: 13 });
      const total = blocks.reduce((s, k) => s + k.lines.length * k.lineH, 0) + (blocks.length - 1);
      const left = isContainer;
      let y = left || pos === 'top' ? area.y + padY + 2 : area.y + (area.h - total) / 2;
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
  for (const { port, y, row } of ports) {
    if (row) continue;
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
  const color = e.style.color ?? type?.color ?? ctx.edgeColor;
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
  const ctx: Ctx = { store, reg, viewId, prefix, bare: !!opts.bare, markers: new Map(), abs: new Map(), portsOf: new Map(), extents: [],
    edgeColor: theme === 'dark' ? THEME_VARS.dark['--ad-edge']! : theme === 'dual' ? 'var(--ad-edge)' : '#444' };

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
    // Clasificadores: crecen hasta que caben todas sus filas (como el lienzo).
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    const cmp = el ? compartmentsOf(el, reg.elementType(el.typeId)) : undefined;
    const b = { x, y, w: n.w, h: cmp ? Math.max(n.h, compartmentLayout(cmp).height) : n.h };
    ctx.abs.set(n.id, b);
    return b;
  };
  nodes.forEach(n => resolve(n));
  // Secuencia: líneas de vida, activaciones, fragmentos y mensajes los pinta `svg-sequence.ts` (el resto, lo genérico).
  const seq = renderSequenceSvg(store, reg, view, { theme, bare: ctx.bare });
  if (seq) for (const [id, b] of seq.boxes) ctx.abs.set(id, b);

  // Pines visibles por nodo (posición absoluta en y)
  for (const n of nodes) {
    if (!n.elementId) continue;
    const el = store.get('elements', n.elementId); if (!el) continue;
    const all = allPorts(el, reg.fieldsOf(el.typeId));
    const b = ctx.abs.get(n.id)!;
    // Filas de compartimento: su pin está a la altura de la fila (siempre, aunque no se dibuje).
    const cmp = compartmentsOf(el, reg.elementType(el.typeId));
    const rowY = new Map<string, number>();
    if (cmp) for (const sec of compartmentLayout(cmp).sections) for (const r of sec.rows) rowY.set(r.portKey, b.y + CMP.border + r.cy);
    const rows = all.filter(p => rowY.has(p.key)).map(port => ({ port, y: rowY.get(port.key)!, row: true }));
    const vis = visiblePorts(all, n).filter(p => !rowY.has(p.key));
    if (!vis.length && !rows.length) continue;
    ctx.portsOf.set(n.id, [...rows, ...vis.map((port, i) => ({ port, y: b.y + ((i + 1) / (vis.length + 1)) * b.h }))]);
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
      // Cabecera con color de capa: el color tal cual en claro y mezclado con el panel en oscuro (`--ad-hdr-mix`), con texto
      // del tema (blanco si el color es oscuro). `style` porque la regla `.ad-header` ganaría a los atributos `fill`.
      const tint = fill ? `fill:color-mix(in srgb, ${fill} var(--ad-hdr-mix), var(--ad-panel))` : undefined;
      const ink = fill ? `fill:${readable(fill) === '#fff' ? '#fff' : 'var(--ad-text)'}` : undefined;
      g.push(`<g class="ad-header"><rect${attrs({ x: r.x, y: r.y, width: r.w, height: r.h, fill, style: tint })}/>${textBlock(lines, { x: cx, y: cy, fontSize: 12, lineH: 14, extra: { style: ink } })}</g>`);
    };
    for (const [id, r] of Object.entries(rects.layers)) { const l = grid.layers.find(x => x.id === id); header(r, l?.name ?? '', l?.color); }
    for (const [id, r] of Object.entries(rects.stages)) header(r, grid.stages.find(x => x.id === id)?.name ?? '');
    for (const [id, r] of Object.entries(rects.groups)) { const gr = grid.stageGroups.find(x => x.id === id); header(r, gr?.name ?? '', gr?.color); }
    body.push(`<g class="ad-grid">${g.join('')}</g>`);
  }

  const nodeSvg: string[] = [];
  for (const n of ordered) {
    if (seq?.nodeIds.has(n.id)) continue;
    const b = ctx.abs.get(n.id)!;
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    if (n.elementId && !el) { nodeSvg.push(`<g class="ad-node ad-node--missing"><rect${attrs({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 4, fill: '#fee2e2', stroke: '#dc2626' })}/>${textBlock(['?'], { x: b.x + b.w / 2, y: b.y + b.h / 2 })}</g>`); continue; }
    if (!el) { nodeSvg.push(renderVisualNode(ctx, n, b)); continue; }
    const type = reg.elementType(el.typeId);
    // Capas × etapas es un mapa de varias notaciones a la vez: no se atenúa nada (como en el lienzo).
    const dimmed = !isGrid && ((reg.notationOf(el.typeId) !== view.notationId && reg.notationOf(el.typeId) !== 'freeform' && !el.libraryId) || !reg.inViewpoint(view.notationId, view.viewpointId, el.typeId));
    let pf: string | undefined, anc = n.parentNodeId ? byId.get(n.parentNodeId) : undefined, guard = 0, onPaper = false;
    while (anc && pf === undefined && guard++ < 50) { pf = explicitFill(ctx, anc); if (pf !== undefined) onPaper = isPaperContainer(ctx, anc); anc = anc.parentNodeId ? byId.get(anc.parentNodeId) : undefined; }
    nodeSvg.push(renderElementNode(ctx, n, el, type, b, dimmed, pf, onPaper));
  }
  const edgeSvg = edges.filter(e => !seq?.edgeIds.has(e.id)).map(e => renderEdge(ctx, e)).filter(Boolean);
  if (seq) { body.push(seq.back); ctx.extents.push(...seq.extents); }
  body.push(`<g class="ad-nodes">${nodeSvg.join('')}</g>`);
  body.push(`<g class="ad-edges">${edgeSvg.join('')}</g>`);
  if (seq) body.push(seq.front);

  // Marcadores (comentarios del HTML): encima de todo; varios en el mismo sitio se ponen en fila.
  const markerBoxes: Box[] = [];
  if (opts.markers?.length) {
    const used = new Map<string, number>();
    const out: string[] = [];
    for (const m of opts.markers) {
      let p: Pt | undefined;
      if ('node' in m.at) { const b = ctx.abs.get(m.at.node); if (b) p = { x: b.x + b.w - 2, y: b.y + 2 }; }
      else if ('edge' in m.at) {
        const id = m.at.edge;
        const e = edges.find(x => x.id === id);
        const a = e ? ctx.abs.get(e.fromNodeId) : undefined, b = e ? ctx.abs.get(e.toNodeId) : undefined;
        if (e && a && b) {
          const bp = e.bendpoints, i = Math.floor(bp.length / 2);
          p = bp.length ? (bp.length % 2 ? bp[i]! : { x: (bp[i - 1]!.x + bp[i]!.x) / 2, y: (bp[i - 1]!.y + bp[i]!.y) / 2 }) : { x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2 };
        }
      } else p = { x: m.at.x, y: m.at.y };
      if (!p) continue;
      const key = `${Math.round(p.x)},${Math.round(p.y)}`;
      const k = used.get(key) ?? 0; used.set(key, k + 1);
      const x = p.x + k * (MARKER_R * 2 + 2), y = p.y;
      markerBoxes.push({ x: x - MARKER_R - 2, y: y - MARKER_R - 2, w: MARKER_R * 2 + 4, h: MARKER_R * 2 + 4 });
      // `(` escapado: un `url(https://…)` escrito por el usuario no debe parecer un recurso externo.
      const title = m.title ? `<title>${escapeXml(m.title).replace(/\(/g, '&#40;')}</title>` : '';
      out.push(`<g${attrs({ class: `ad-marker${m.muted ? ' is-muted' : ''}`, 'data-marker': m.id })}>${title}<circle${attrs({ cx: x, cy: y, r: MARKER_R })}/>${textBlock([m.label], { x, y, fontSize: 11, lineH: 12 })}</g>`);
    }
    if (out.length) body.push(`<g class="ad-markers">${out.join('')}</g>`);
  }

  // Caja envolvente
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x: number, y: number, w = 0, h = 0) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h); };
  if (rects) grow(0, 0, rects.width, rects.height);
  for (const n of nodes) {
    const b = ctx.abs.get(n.id)!;
    const el = n.elementId ? store.get('elements', n.elementId) : undefined;
    const shape = el ? reg.elementType(el.typeId)?.shape : undefined;
    const fig = shape ? figureFor(el?.typeId, shape) : undefined;
    const below = (shape && LABEL_BELOW.has(shape) && fig !== 'person' && fig !== 'store') || n.style.labelPosition === 'bottom' ? 22 : 0;
    const ports = (ctx.portsOf.get(n.id) ?? []).filter(p => !p.row);
    const portW = ports.length ? Math.max(...ports.map(p => textW(p.port.label ?? p.port.key, 10) + 14)) : 0;
    grow(b.x - portW, b.y - (rule_has_badge(ctx, el) ? 10 : 0), b.w + portW * 2, b.h + below);
  }
  for (const e of edges) for (const p of e.bendpoints) grow(p.x, p.y);
  for (const b of ctx.extents) grow(b.x, b.y, b.w, b.h);
  for (const b of markerBoxes) grow(b.x, b.y, b.w, b.h);
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 100; }
  const vx = Math.floor(minX - padding), vy = Math.floor(minY - padding);
  const vw = Math.ceil(maxX + padding) - vx, vh = Math.ceil(maxY + padding) - vy;

  const title = `${view.name || tr('Vista')}`;
  const elCount = nodes.filter(n => n.elementId).length;
  // Descripción accesible en el idioma inyectado (`setIoTranslator`): nombre de la notación y del tipo de vista, no sus ids.
  const kindName = ({ grid: 'Capas × etapas', sequence: 'Secuencia', tree: 'Árbol', matrix: 'Matriz' } as Record<string, string>)[view.kind];
  const notation = `${reg.pack(view.notationId)?.name ?? view.notationId}${kindName ? `, ${tr(kindName)}` : ''}`;
  const desc = tr('Vista "{name}" ({notation}) con {elements} y {relations}.', { name: view.name, notation, elements: trn('{n} elemento', '{n} elementos', elCount), relations: trn('{n} relación', '{n} relaciones', edges.length) }) + (view.doc ? ` ${view.doc}` : '');
  const tId = `${prefix}-title`, dId = `${prefix}-desc`;
  const bg = opts.background ?? 'var(--ad-bg)';
  const head = ctx.bare ? '' : `<title id="${tId}">${escapeXml(title)}</title><desc id="${dId}">${escapeXml(desc)}</desc>`;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ class: 'ad-svg', viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw, height: vh, role: 'img', 'aria-labelledby': ctx.bare ? undefined : `${tId} ${dId}`, 'data-view': ctx.bare ? undefined : viewId, 'data-theme': theme === 'dual' ? undefined : theme })}>`,
    head,
    `<style>${svgStyle(theme, fontFamily)}${seq ? `\n${seq.css}` : ''}${markerBoxes.length ? `\n${MARKER_CSS}` : ''}</style>`,
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
