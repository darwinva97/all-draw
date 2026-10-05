/**
 * **SVG → operadores PDF**, sin navegador. Traduce el subconjunto de SVG que genera `renderSvg` (y algo más):
 * `g` con `transform`/`opacity`, `rect` (con radio), `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path` (todos
 * los comandos, arcos incluidos), `text`/`tspan` (anclaje, línea base, negrita, cursiva, subrayado y tachado, contorno
 * con `paint-order`), marcadores de flecha (`marker-start`/`marker-end`, `orient="auto"` y `auto-start-reverse`) y
 * `vector-effect: non-scaling-stroke`.
 *
 * Los colores de `renderSvg` salen de su `<style>` (clases y variables CSS), así que aquí hay una cascada CSS mínima:
 * selectores de tipo, clase, atributo, descendiente y `>`, especificidad y orden, herencia, `var()` y `color-mix()`.
 * Las geometrías se transforman aquí (no con `cm`), de modo que el grosor de línea respeta `non-scaling-stroke`.
 */
import { parseXmlTree, type XNode } from './xml-tree';
import { encodeWinAnsi, pdfString, bytesWidth, n, FONT_RES, type FontKey } from './pdf-writer';

type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (A: M, B: M): M => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const ap = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m: M) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;

export function parseTransform(s: string | undefined): M {
  let m: M = I;
  if (!s) return m;
  for (const [, fn, args] of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const a = args!.split(/[\s,]+/).filter(Boolean).map(Number);
    let t: M = I;
    switch (fn) {
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break;
      case 'scale': t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const r = ((a[0] ?? 0) * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
        t = [c, sn, -sn, c, 0, 0];
        if (a.length >= 3) t = mul(mul([1, 0, 0, 1, a[1]!, a[2]!], t), [1, 0, 0, 1, -a[1]!, -a[2]!]);
        break;
      }
      case 'matrix': if (a.length === 6) t = a as M; break;
      case 'skewX': t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
    }
    m = mul(m, t);
  }
  return m;
}

// ---------------------------------------------------------------- Trazados
export type Seg = { op: 'M'; x: number; y: number } | { op: 'L'; x: number; y: number } | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number } | { op: 'Z' };

/** `d` de SVG → segmentos absolutos M/L/C/Z (cuadráticas y arcos pasados a cúbicas). */
export function parsePath(d: string): Seg[] {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: Seg[] = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, lqx = 0, lqy = 0, prev = '';
  const num = () => Number(toks[i++]);
  const isNum = () => i < toks.length && !/^[A-Za-z]$/.test(toks[i]!);
  while (i < toks.length) {
    if (/^[A-Za-z]$/.test(toks[i]!)) cmd = toks[i++]!;
    else if (!cmd) { i++; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': { x = ox + num(); y = oy + num(); sx = x; sy = y; out.push({ op: 'M', x, y }); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { x = ox + num(); y = oy + num(); out.push({ op: 'L', x, y }); break; }
      case 'H': { x = (rel ? x : 0) + num(); out.push({ op: 'L', x, y }); break; }
      case 'V': { y = (rel ? y : 0) + num(); out.push({ op: 'L', x, y }); break; }
      case 'C': { const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(); x = ox + num(); y = oy + num(); out.push({ op: 'C', x1, y1, x2, y2, x, y }); lcx = x2; lcy = y2; break; }
      case 'S': {
        const [x1, y1] = 'CS'.includes(prev) ? [2 * x - lcx, 2 * y - lcy] : [x, y];
        const x2 = ox + num(), y2 = oy + num(); x = ox + num(); y = oy + num();
        out.push({ op: 'C', x1, y1, x2, y2, x, y }); lcx = x2; lcy = y2; break;
      }
      case 'Q': case 'T': {
        let qx: number, qy: number;
        if (C === 'Q') { qx = ox + num(); qy = oy + num(); } else [qx, qy] = 'QT'.includes(prev) ? [2 * x - lqx, 2 * y - lqy] : [x, y];
        const ex = ox + num(), ey = oy + num();
        out.push({ op: 'C', x1: x + (2 / 3) * (qx - x), y1: y + (2 / 3) * (qy - y), x2: ex + (2 / 3) * (qx - ex), y2: ey + (2 / 3) * (qy - ey), x: ex, y: ey });
        lqx = qx; lqy = qy; x = ex; y = ey; break;
      }
      case 'A': {
        const rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), ex = ox + num(), ey = oy + num();
        out.push(...arcToBeziers(x, y, rx, ry, rot, !!large, !!sweep, ex, ey));
        x = ex; y = ey; break;
      }
      case 'Z': { out.push({ op: 'Z' }); x = sx; y = sy; break; }
      default: i++;
    }
    prev = C;
    if (C === 'Z') { if (isNum()) cmd = 'L'; continue; }
    if (!isNum() && i < toks.length && !/^[A-Za-z]$/.test(toks[i]!)) i++;
  }
  return out;
}

/** Arco elíptico de SVG → cúbicas (algoritmo de la especificación, apéndice F.6). */
function arcToBeziers(x1: number, y1: number, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, x2: number, y2: number): Seg[] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [{ op: 'L', x: x2, y: y2 }];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180, cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  let t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const d = dt / segs, k = (4 / 3) * Math.tan(d / 4);
  const out: Seg[] = [];
  const pt = (t: number): [number, number] => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t: number): [number, number] => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let s = 0; s < segs; s++) {
    const a = t1, b = t1 + d;
    const [ax, ay] = pt(a), [bx, by] = pt(b), [dax, day] = der(a), [dbx, dby] = der(b);
    out.push({ op: 'C', x1: ax + k * dax, y1: ay + k * day, x2: bx - k * dbx, y2: by - k * dby, x: bx, y: by });
    t1 = b;
  }
  const last = out[out.length - 1] as Extract<Seg, { op: 'C' }>; last.x = x2; last.y = y2;
  return out;
}

const K = 0.5522847498;
function rectPath(x: number, y: number, w: number, h: number, rx: number, ry: number): Seg[] {
  rx = Math.min(Math.max(0, rx), w / 2); ry = Math.min(Math.max(0, ry), h / 2);
  if (!rx || !ry) return [{ op: 'M', x, y }, { op: 'L', x: x + w, y }, { op: 'L', x: x + w, y: y + h }, { op: 'L', x, y: y + h }, { op: 'Z' }];
  const kx = rx * K, ky = ry * K;
  return [
    { op: 'M', x: x + rx, y }, { op: 'L', x: x + w - rx, y }, { op: 'C', x1: x + w - rx + kx, y1: y, x2: x + w, y2: y + ry - ky, x: x + w, y: y + ry },
    { op: 'L', x: x + w, y: y + h - ry }, { op: 'C', x1: x + w, y1: y + h - ry + ky, x2: x + w - rx + kx, y2: y + h, x: x + w - rx, y: y + h },
    { op: 'L', x: x + rx, y: y + h }, { op: 'C', x1: x + rx - kx, y1: y + h, x2: x, y2: y + h - ry + ky, x, y: y + h - ry },
    { op: 'L', x, y: y + ry }, { op: 'C', x1: x, y1: y + ry - ky, x2: x + rx - kx, y2: y, x: x + rx, y }, { op: 'Z' },
  ];
}
function ellipsePath(cx: number, cy: number, rx: number, ry: number): Seg[] {
  const kx = rx * K, ky = ry * K;
  return [
    { op: 'M', x: cx + rx, y: cy }, { op: 'C', x1: cx + rx, y1: cy + ky, x2: cx + kx, y2: cy + ry, x: cx, y: cy + ry },
    { op: 'C', x1: cx - kx, y1: cy + ry, x2: cx - rx, y2: cy + ky, x: cx - rx, y: cy }, { op: 'C', x1: cx - rx, y1: cy - ky, x2: cx - kx, y2: cy - ry, x: cx, y: cy - ry },
    { op: 'C', x1: cx + kx, y1: cy - ry, x2: cx + rx, y2: cy - ky, x: cx + rx, y: cy }, { op: 'Z' },
  ];
}

// ---------------------------------------------------------------- CSS mínimo
interface Compound { tag?: string; classes: string[]; attrs: { name: string; value?: string }[]; unsupported: boolean }
interface Rule { parts: Compound[]; combinators: (' ' | '>')[]; spec: number; order: number; decls: [string, string][] }

function parseSelector(sel: string): { parts: Compound[]; combinators: (' ' | '>')[]; spec: number } | null {
  const parts: Compound[] = [], combinators: (' ' | '>')[] = [];
  const toks = sel.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  let pending: ' ' | '>' = ' ';
  let spec = 0;
  for (const t of toks) {
    if (t === '>') { pending = '>'; continue; }
    const c: Compound = { classes: [], attrs: [], unsupported: false };
    const re = /([a-zA-Z][\w-]*)|\.([\w-]+)|\[([\w:-]+)(?:="?([^"\]]*)"?)?\]|(:[\w-]+(?:\([^)]*\))?)|(#[\w-]+)|(\*)/g;
    let m: RegExpExecArray | null; let consumed = 0;
    while ((m = re.exec(t))) {
      consumed += m[0].length;
      if (m[1]) { c.tag = m[1]; spec += 1; }
      else if (m[2]) { c.classes.push(m[2]); spec += 100; }
      else if (m[3]) { c.attrs.push({ name: m[3], value: m[4] }); spec += 100; }
      else if (m[5] || m[6]) { c.unsupported = true; spec += m[6] ? 10000 : 100; }
    }
    if (consumed !== t.length) return null;
    if (parts.length) combinators.push(pending);
    parts.push(c); pending = ' ';
  }
  return parts.length ? { parts, combinators, spec } : null;
}

function parseCss(css: string, startOrder = 0): Rule[] {
  const rules: Rule[] = [];
  let src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // @media y demás reglas «@»: fuera (el SVG de un tema fijo no las usa).
  for (;;) {
    const at = src.search(/@[\w-]+[^{]*\{/);
    if (at < 0) break;
    let i = src.indexOf('{', at) + 1, depth = 1;
    while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    src = src.slice(0, at) + src.slice(i);
  }
  let order = startOrder;
  for (const [, sels, body] of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls: [string, string][] = [];
    for (const d of body!.split(';')) { const k = d.indexOf(':'); if (k > 0) decls.push([d.slice(0, k).trim(), d.slice(k + 1).trim()]); }
    for (const s of sels!.split(',')) { const p = parseSelector(s); if (p) rules.push({ ...p, order: order++, decls }); }
  }
  return rules;
}

const matchCompound = (el: XNode, c: Compound): boolean => {
  if (c.unsupported) return false;
  if (c.tag && c.tag !== el.tag) return false;
  const cls = (el.attrs.class ?? '').split(/\s+/);
  for (const k of c.classes) if (!cls.includes(k)) return false;
  for (const a of c.attrs) { const v = el.attrs[a.name]; if (v === undefined || (a.value !== undefined && v !== a.value)) return false; }
  return true;
};
function matches(el: XNode, r: Rule, idx = r.parts.length - 1): boolean {
  if (!matchCompound(el, r.parts[idx]!)) return false;
  if (idx === 0) return true;
  const comb = r.combinators[idx - 1];
  if (comb === '>') return !!el.parent && matches(el.parent, r, idx - 1);
  for (let p = el.parent; p; p = p.parent) if (matches(p, r, idx - 1)) return true;
  return false;
}

const INHERITED = new Set(['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'fill-opacity', 'font-size', 'font-weight',
  'font-style', 'text-anchor', 'dominant-baseline', 'text-decoration', 'text-transform', 'letter-spacing', 'paint-order', 'visibility', 'color', 'fill-rule']);
const PRESENTATION = new Set([...INHERITED, 'opacity', 'display', 'vector-effect']);

type Style = Map<string, string>;
function cssNumber(v: string | undefined, def: number): number { if (v === undefined) return def; const x = parseFloat(v); return Number.isFinite(x) ? x : def; }

// ---------------------------------------------------------------- Colores
export interface RGBA { r: number; g: number; b: number; a: number }
const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff', gray: '#808080', grey: '#808080', yellow: '#ffff00', orange: '#ffa500', transparent: 'rgba(0,0,0,0)' };
export function parseColor(v: string | undefined): RGBA | null {
  if (!v) return null;
  let s = v.trim().toLowerCase();
  if (s === 'none' || s === '') return null;
  if (NAMED[s]) s = NAMED[s]!;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1]!;
    if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
    const num = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: num(0), g: num(2), b: num(4), a: h.length === 8 ? num(6) / 255 : 1 };
  }
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const p = m[1]!.split(/[\s,/]+/).filter(Boolean);
    const ch = (x: string) => (x.endsWith('%') ? (parseFloat(x) * 255) / 100 : parseFloat(x));
    return { r: ch(p[0] ?? '0'), g: ch(p[1] ?? '0'), b: ch(p[2] ?? '0'), a: p[3] === undefined ? 1 : p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3]) };
  }
  m = /^color-mix\(\s*in\s+srgb\s*,\s*(.+)\)$/.exec(s);
  if (m) {
    const parts = splitTop(m[1]!);
    const one = (x: string) => { const mm = /^(.*?)\s+(\d+(?:\.\d+)?)%$/.exec(x.trim()); return mm ? { c: parseColor(mm[1]), p: Number(mm[2]) / 100 } : { c: parseColor(x), p: undefined as number | undefined }; };
    const A = one(parts[0] ?? ''), B = one(parts[1] ?? '');
    if (!A.c || !B.c) return A.c ?? B.c;
    const pa = A.p ?? (B.p !== undefined ? 1 - B.p : 0.5), pb = B.p ?? 1 - pa;
    const t = pa + pb || 1;
    const mix = (a: number, b: number) => (a * pa + b * pb) / t;
    return { r: mix(A.c.r, B.c.r), g: mix(A.c.g, B.c.g), b: mix(A.c.b, B.c.b), a: mix(A.c.a, B.c.a) };
  }
  return null;
}
/** Divide por comas de primer nivel (fuera de paréntesis). */
function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const c of s) { if (c === '(') depth++; if (c === ')') depth--; if (c === ',' && !depth) { out.push(cur); cur = ''; } else cur += c; }
  out.push(cur);
  return out;
}

// ---------------------------------------------------------------- Conversión
export interface SvgToPdfResult { ops: string; missingChars: string[] }
export interface SvgToPdfOptions {
  /** Matriz que lleva coordenadas del SVG (viewBox) a la página (puntos PDF, Y hacia arriba). */
  base: M;
  /** Registro de transparencias del documento (`alpha` → nombre de recurso `/Gk`). */
  alpha: (a: number) => string;
}

/** Ventana del SVG: `viewBox` (o 0 0 width height). */
export function svgViewBox(svg: string): [number, number, number, number] {
  const m = /viewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  const w = /\swidth="([\d.]+)"/.exec(svg), h = /\sheight="([\d.]+)"/.exec(svg);
  return [0, 0, Number(w?.[1] ?? 300), Number(h?.[1] ?? 150)];
}

export function svgToPdfOps(svg: string, opts: SvgToPdfOptions): SvgToPdfResult {
  const root = parseXmlTree(svg);
  const styles: string[] = [];
  const collect = (nd: XNode) => { if (nd.tag === 'style') styles.push(nd.text); for (const c of nd.children) collect(c); };
  collect(root);
  const rules = parseCss(styles.join('\n'));
  const ids = new Map<string, XNode>();
  const index = (nd: XNode) => { if (nd.attrs.id) ids.set(nd.attrs.id, nd); for (const c of nd.children) index(c); };
  index(root);
  const out: string[] = [];
  const missing = new Set<string>();
  const cache = new Map<XNode, { style: Style; vars: Map<string, string> }>();

  const computed = (el: XNode): { style: Style; vars: Map<string, string> } => {
    const hit = cache.get(el); if (hit) return hit;
    const parent = el.parent ? computed(el.parent) : undefined;
    const style: Style = new Map(), vars = new Map(parent?.vars ?? []);
    if (parent) for (const [k, v] of parent.style) if (INHERITED.has(k)) style.set(k, v);
    for (const [k, v] of Object.entries(el.attrs)) if (PRESENTATION.has(k)) style.set(k, v);
    const matched = rules.filter(r => matches(el, r)).sort((a, b) => a.spec - b.spec || a.order - b.order);
    const apply = (k: string, v: string) => { if (k.startsWith('--')) vars.set(k, v); else style.set(k, v.replace(/\s*!important$/, '')); };
    for (const r of matched) for (const [k, v] of r.decls) apply(k, v);
    for (const d of (el.attrs.style ?? '').split(';')) { const i = d.indexOf(':'); if (i > 0) apply(d.slice(0, i).trim(), d.slice(i + 1).trim()); }
    // var() en las variables y en las propiedades
    const resolve = (v: string, depth = 0): string => (depth > 8 || !v.includes('var(') ? v : resolve(v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name: string, fb?: string) => vars.get(name) ?? fb ?? ''), depth + 1));
    for (const [k, v] of vars) vars.set(k, resolve(v));
    for (const [k, v] of style) style.set(k, resolve(v));
    const r = { style, vars };
    cache.set(el, r);
    return r;
  };
  const effectiveOpacity = (el: XNode): number => {
    let a = 1;
    for (let p: XNode | undefined = el; p; p = p.parent) a *= cssNumber(computed(p).style.get('opacity'), 1);
    return a;
  };
  const colorOf = (st: Style, prop: 'fill' | 'stroke'): RGBA | null => {
    let v = st.get(prop) ?? (prop === 'fill' ? '#000000' : 'none');
    if (v === 'currentColor' || v === 'currentcolor') v = st.get('color') ?? '#000000';
    if (v.startsWith('url(')) return null;
    return parseColor(v);
  };
  const rgb = (c: RGBA) => `${n(c.r / 255)} ${n(c.g / 255)} ${n(c.b / 255)}`;
  const emitPath = (segs: Seg[], m: M): string => {
    const o: string[] = [];
    for (const s of segs) {
      if (s.op === 'Z') { o.push('h'); continue; }
      if (s.op === 'C') { const [a, b] = ap(m, s.x1, s.y1), [c, d] = ap(m, s.x2, s.y2), [e, f] = ap(m, s.x, s.y); o.push(`${n(a)} ${n(b)} ${n(c)} ${n(d)} ${n(e)} ${n(f)} c`); continue; }
      const [x, y] = ap(m, s.x, s.y); o.push(`${n(x)} ${n(y)} ${s.op === 'M' ? 'm' : 'l'}`);
    }
    return o.join('\n');
  };

  /** Pinta una forma con su relleno y trazo. */
  const paint = (el: XNode, segs: Seg[], m: M, closedFill = true) => {
    if (!segs.length) return;
    const { style } = computed(el);
    const op = effectiveOpacity(el);
    const fill = closedFill ? colorOf(style, 'fill') : null;
    const stroke = colorOf(style, 'stroke');
    const fa = fill ? fill.a * cssNumber(style.get('fill-opacity'), 1) * op : 0;
    const sa = stroke ? stroke.a * cssNumber(style.get('stroke-opacity'), 1) * op : 0;
    const sw = cssNumber(style.get('stroke-width'), 1);
    const doFill = !!fill && fa > 0.001, doStroke = !!stroke && sa > 0.001 && sw > 0;
    if (!doFill && !doStroke) return;
    const nonScaling = style.get('vector-effect') === 'non-scaling-stroke';
    const k = nonScaling ? 1 : scaleOf(m);
    const g: string[] = ['q'];
    if (doFill) g.push(`${rgb(fill!)} rg`);
    if (doStroke) {
      g.push(`${rgb(stroke!)} RG`, `${n(sw * k)} w`);
      const dash = (style.get('stroke-dasharray') ?? 'none').split(/[\s,]+/).map(parseFloat).filter(x => Number.isFinite(x) && x >= 0);
      if (dash.length && dash.some(x => x > 0)) g.push(`[${(dash.length % 2 ? [...dash, ...dash] : dash).map(x => n(x * k)).join(' ')}] 0 d`);
      const cap = style.get('stroke-linecap'), join = style.get('stroke-linejoin');
      if (cap === 'round') g.push('1 J'); else if (cap === 'square') g.push('2 J');
      if (join === 'round') g.push('1 j'); else if (join === 'bevel') g.push('2 j');
    }
    const alphaF = doFill ? fa : 1, alphaS = doStroke ? sa : 1;
    if (Math.min(alphaF, alphaS) < 0.999) g.push(`/${opts.alpha(Math.round(Math.min(alphaF, alphaS) * 1000) / 1000)} gs`);
    g.push(emitPath(segs, m));
    const evenodd = style.get('fill-rule') === 'evenodd';
    g.push(doFill && doStroke ? (evenodd ? 'B*' : 'B') : doFill ? (evenodd ? 'f*' : 'f') : 'S', 'Q');
    out.push(g.join('\n'));
  };

  // ---- marcadores de flecha
  const endDirs = (segs: Seg[]) => {
    const pts: { x: number; y: number; inX: number; inY: number; outX: number; outY: number }[] = [];
    let cur = { x: 0, y: 0 };
    for (const s of segs) {
      if (s.op === 'Z') continue;
      if (s.op === 'M') { cur = { x: s.x, y: s.y }; pts.push({ x: s.x, y: s.y, inX: 0, inY: 0, outX: 0, outY: 0 }); continue; }
      const c1 = s.op === 'C' ? { x: s.x1, y: s.y1 } : { x: s.x, y: s.y };
      const c2 = s.op === 'C' ? { x: s.x2, y: s.y2 } : cur;
      const last = pts[pts.length - 1];
      if (last && !last.outX && !last.outY) { const ox = c1.x - cur.x || s.x - cur.x, oy = c1.y - cur.y || s.y - cur.y; last.outX = ox; last.outY = oy; }
      let ix = s.x - c2.x, iy = s.y - c2.y; if (!ix && !iy) { ix = s.x - cur.x; iy = s.y - cur.y; }
      pts.push({ x: s.x, y: s.y, inX: ix, inY: iy, outX: 0, outY: 0 });
      cur = { x: s.x, y: s.y };
    }
    return pts;
  };
  const drawMarker = (ref: string | undefined, at: { x: number; y: number }, angle: number, m: M) => {
    const id = /url\(\s*#([^)]+)\)/.exec(ref ?? '')?.[1];
    const mk = id ? ids.get(id) : undefined;
    if (!mk || mk.tag !== 'marker') return;
    const refX = cssNumber(mk.attrs.refX, 0), refY = cssNumber(mk.attrs.refY, 0);
    const c = Math.cos(angle), s = Math.sin(angle);
    const t = mul(mul(mul(m, [1, 0, 0, 1, at.x, at.y]), [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -refX, -refY]);
    for (const child of mk.children) draw(child, t);
  };

  // ---- texto
  const drawText = (el: XNode, m: M) => {
    let cx = cssNumber(el.attrs.x, 0), cy = cssNumber(el.attrs.y, 0);
    const runs: { node: XNode; text: string; x: number; y: number }[] = [];
    const visit = (nd: XNode, isRoot: boolean) => {
      if (!isRoot) {
        if (nd.attrs.x !== undefined) cx = cssNumber(nd.attrs.x, cx);
        if (nd.attrs.y !== undefined) cy = cssNumber(nd.attrs.y, cy);
        cx += cssNumber(nd.attrs.dx, 0); cy += cssNumber(nd.attrs.dy, 0);
      }
      const direct = nd.children.length ? nd.children.some(c => c.tag === 'tspan') ? '' : nd.text : nd.text;
      if (direct.trim()) runs.push({ node: nd, text: direct.replace(/\s+/g, ' ').trim(), x: cx, y: cy });
      for (const c of nd.children) if (c.tag === 'tspan') visit(c, false);
    };
    visit(el, true);
    for (const r of runs) {
      const st = computed(r.node).style;
      if (st.get('display') === 'none' || st.get('visibility') === 'hidden') continue;
      const fs = cssNumber(st.get('font-size'), 16);
      const weight = st.get('font-weight') ?? 'normal';
      const bold = weight === 'bold' || weight === 'bolder' || cssNumber(weight, 400) >= 600;
      const italic = /italic|oblique/.test(st.get('font-style') ?? '');
      const font: FontKey = bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'regular';
      let text = r.text;
      if (st.get('text-transform') === 'uppercase') text = text.toUpperCase();
      const enc = encodeWinAnsi(text);
      for (const c of enc.missing) missing.add(c);
      // Un carácter omitido al final (emoji) no debe dejar un espacio colgando que desplace el centrado.
      if (enc.missing.length) while (enc.bytes.length && enc.bytes[enc.bytes.length - 1] === 0x20) enc.bytes.pop();
      if (!enc.bytes.length) continue;
      const ls = cssNumber(st.get('letter-spacing'), 0) * (st.get('letter-spacing')?.endsWith('em') ? fs : 1);
      const w = bytesWidth(enc.bytes, fs, bold) + ls * enc.bytes.length;
      const anchor = st.get('text-anchor');
      const dx = anchor === 'middle' ? -w / 2 : anchor === 'end' ? -w : 0;
      const db = st.get('dominant-baseline') ?? '';
      const dy = db === 'central' || db === 'middle' ? fs * 0.35 : db === 'hanging' || db === 'text-before-edge' ? fs * 0.8 : 0;
      const tm = mul(m, [1, 0, 0, 1, r.x + dx, r.y + dy]);
      const fill = colorOf(st, 'fill'), stroke = colorOf(st, 'stroke');
      const op = effectiveOpacity(r.node);
      const fa = fill ? fill.a * cssNumber(st.get('fill-opacity'), 1) * op : 0;
      const sa = stroke ? stroke.a * op : 0;
      const sw = cssNumber(st.get('stroke-width'), 1);
      const show = (mode: number, color: RGBA, alpha: number) => {
        const g = ['q', mode === 1 ? `${rgb(color)} RG ${n(sw * scaleOf(m))} w 1 j` : `${rgb(color)} rg`];
        if (alpha < 0.999) g.push(`/${opts.alpha(Math.round(alpha * 1000) / 1000)} gs`);
        g.push('BT', `/${FONT_RES[font]} ${n(fs)} Tf`, `${n(tm[0])} ${n(tm[1])} ${n(-tm[2])} ${n(-tm[3])} ${n(tm[4])} ${n(tm[5])} Tm`);
        if (ls) g.push(`${n(ls)} Tc`);
        if (mode) g.push(`${mode} Tr`);
        g.push(`${pdfString(enc.bytes)} Tj`, 'ET', 'Q');
        out.push(g.join('\n'));
      };
      if (stroke && sa > 0.001 && (st.get('paint-order') ?? '').startsWith('stroke')) show(1, stroke, sa);
      if (fill && fa > 0.001) show(0, fill, fa);
      if (stroke && sa > 0.001 && !(st.get('paint-order') ?? '').startsWith('stroke')) show(1, stroke, sa);
      const deco = st.get('text-decoration') ?? '';
      if (fill && fa > 0.001 && /underline|line-through/.test(deco)) {
        const yOff = /underline/.test(deco) ? fs * 0.12 : -fs * 0.28;
        const [ax, ay] = ap(tm, 0, yOff), [bx, by] = ap(tm, w, yOff);
        out.push(['q', `${rgb(fill)} RG`, `${n(Math.max(0.5, fs * 0.06) * scaleOf(m))} w`, `${n(ax)} ${n(ay)} m ${n(bx)} ${n(by)} l S`, 'Q'].join('\n'));
      }
    }
  };

  const SKIP = new Set(['title', 'desc', 'style', 'defs', 'marker', 'metadata', 'script', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'pattern', 'symbol']);
  const draw = (el: XNode, parentM: M): void => {
    if (SKIP.has(el.tag)) return;
    const st = computed(el).style;
    if (st.get('display') === 'none') return;
    const m = el.attrs.transform ? mul(parentM, parseTransform(el.attrs.transform)) : parentM;
    const a = el.attrs, num = (k: string, d = 0) => cssNumber(a[k], d);
    const hidden = st.get('visibility') === 'hidden';
    switch (el.tag) {
      case 'svg': case 'g': case 'a': for (const c of el.children) draw(c, m); return;
      case 'rect': if (!hidden) paint(el, rectPath(num('x'), num('y'), num('width'), num('height'), num('rx', num('ry')), num('ry', num('rx'))), m); return;
      case 'circle': if (!hidden) paint(el, ellipsePath(num('cx'), num('cy'), num('r'), num('r')), m); return;
      case 'ellipse': if (!hidden) paint(el, ellipsePath(num('cx'), num('cy'), num('rx'), num('ry')), m); return;
      case 'line': if (!hidden) paint(el, [{ op: 'M', x: num('x1'), y: num('y1') }, { op: 'L', x: num('x2'), y: num('y2') }], m, false); return;
      case 'polyline': case 'polygon': {
        const p = (a.points ?? '').trim().split(/[\s,]+/).map(Number);
        const segs: Seg[] = [];
        for (let i = 0; i + 1 < p.length; i += 2) segs.push({ op: i ? 'L' : 'M', x: p[i]!, y: p[i + 1]! });
        if (el.tag === 'polygon' && segs.length) segs.push({ op: 'Z' });
        if (!hidden) paint(el, segs, m);
        return;
      }
      case 'path': {
        const segs = parsePath(a.d ?? '');
        if (!hidden) paint(el, segs, m);
        const ms = a['marker-start'] ?? st.get('marker-start'), me = a['marker-end'] ?? st.get('marker-end');
        if ((ms || me) && segs.length) {
          const pts = endDirs(segs);
          const first = pts[0], last = pts[pts.length - 1];
          const orient = (id: string | undefined) => ids.get(/#([^)]+)/.exec(id ?? '')?.[1] ?? '')?.attrs.orient ?? 'auto';
          if (ms && first) { const o = orient(ms); const ang = o === 'auto' || o === 'auto-start-reverse' ? Math.atan2(first.outY, first.outX) + (o === 'auto-start-reverse' ? Math.PI : 0) : (cssNumber(o, 0) * Math.PI) / 180; drawMarker(ms, first, ang, m); }
          if (me && last) { const o = orient(me); const ang = o === 'auto' || o === 'auto-start-reverse' ? Math.atan2(last.inY, last.inX) : (cssNumber(o, 0) * Math.PI) / 180; drawMarker(me, last, ang, m); }
        }
        return;
      }
      case 'text': if (!hidden) drawText(el, m); return;
      default: for (const c of el.children) draw(c, m);
    }
  };
  draw(root, opts.base);
  return { ops: out.join('\n'), missingChars: [...missing] };
}
