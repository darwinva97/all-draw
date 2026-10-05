/**
 * Vistas de Gantt (`View.kind === 'gantt'` o pack con `viewKind: 'gantt'`) en el SVG exportado, igual que las dibuja el
 * lienzo (`packages/editor/src/views/GanttNodes.tsx`): rejilla con la cabecera de la escala (meses/años arriba; días,
 * semanas o meses abajo), una fila por tarea, hito o fase con su nombre en la columna izquierda, fines de semana
 * sombreados, barras calculadas de los campos (`start`, `end` inclusivo, `duration`), progreso, tareas críticas en rojo,
 * hitos como rombos, fases como barra resumen y dependencias FS/SS/FF/SF en codo.
 *
 * La geometría replica `packages/editor/src/views/gantt.ts` (io no puede depender del editor): si cambias algo aquí,
 * cámbialo también allí. Sin línea de hoy, para que el SVG no dependa de la fecha en que se exporta.
 */
import type { Element, NotationRegistry, Store, View, ViewNode } from '@all-draw/core';
import type { SequenceSvg } from './svg-sequence';
import { ioLang } from './i18n';

export const GANTT_TASK = 'gantt:Task', GANTT_MILESTONE = 'gantt:Milestone', GANTT_GROUP = 'gantt:Group', GANTT_DEPENDENCY = 'gantt:Dependency';
const TYPES = new Set([GANTT_TASK, GANTT_MILESTONE, GANTT_GROUP]);
export type GanttScale = 'day' | 'week' | 'month';
type Kind = 'task' | 'milestone' | 'group';
type DepKind = 'FS' | 'SS' | 'FF' | 'SF';
type Box = { x: number; y: number; w: number; h: number };
type Reader = Pick<Store, 'get' | 'list'>;

/** Medidas y píxeles por día: los de `GANTT`/`SCALE_PX` del editor. */
export const GANTT = { headerH: 48, labelW: 220, rowH: 34, barH: 20, groupH: 10, padDays: 2 } as const;
const SCALE_PX: Record<GanttScale, number> = { day: 30, week: 9, month: 3 };
const DAY_MS = 86_400_000;

export function isGanttView(view: View | undefined, reg?: NotationRegistry): boolean {
  return !!view && (view.kind === 'gantt' || reg?.pack(view.notationId)?.viewKind === 'gantt');
}
export function dayOf(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim()); if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]), t = Date.UTC(y, mo - 1, d), b = new Date(t);
  return b.getUTCFullYear() === y && b.getUTCMonth() === mo - 1 && b.getUTCDate() === d ? Math.round(t / DAY_MS) : undefined;
}
export const isoOf = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
const numOf = (v: unknown): number | undefined => { const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; return Number.isFinite(n) ? n : undefined; };
const depKind = (v: unknown): DepKind => (v === 'SS' || v === 'FF' || v === 'SF' ? v : 'FS');
const kindOf = (el: Element): Kind => (el.typeId === GANTT_MILESTONE ? 'milestone' : el.typeId === GANTT_GROUP ? 'group' : 'task');

export interface GanttRowGeo { node: ViewNode; el: Element; kind: Kind; depth: number; start: number; end: number; index: number; bar: Box }
export interface GanttGeometry { scale: GanttScale; px: number; day0: number; days: number; rows: GanttRowGeo[]; width: number; height: number }

/** Filas (anidamiento y `y`), fechas resueltas (campos → dependencias → inicio del proyecto) y cajas. Réplica de `ganttLayout`. */
export function ganttGeometry(s: Reader, view: View): GanttGeometry {
  const nodes = s.list('nodes').filter(n => n.viewId === view.id && n.elementId && TYPES.has(s.get('elements', n.elementId)?.typeId ?? ''));
  const ids = new Set(nodes.map(n => n.id));
  const kids = new Map<string | undefined, ViewNode[]>();
  for (const n of nodes) { const p = n.parentNodeId && ids.has(n.parentNodeId) ? n.parentNodeId : undefined; kids.set(p, [...(kids.get(p) ?? []), n]); }
  const list: { node: ViewNode; el: Element; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (p: string | undefined, depth: number) => {
    for (const n of (kids.get(p) ?? []).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))) {
      if (seen.has(n.id)) continue; seen.add(n.id);
      list.push({ node: n, el: s.get('elements', n.elementId!)!, depth }); walk(n.id, depth + 1);
    }
  };
  walk(undefined, 0);
  // Fechas
  const byNode = new Map(list.map(r => [r.node.id, r] as const));
  const incoming = new Map<string, { from: string; kind: DepKind; lag: number }[]>();
  for (const e of s.list('edges')) {
    if (e.viewId !== view.id || !byNode.has(e.fromNodeId) || !byNode.has(e.toNodeId)) continue;
    const rel = e.relationId ? s.get('relations', e.relationId) : undefined;
    if (rel?.typeId !== GANTT_DEPENDENCY) continue;
    const to = byNode.get(e.toNodeId)!.el.id;
    incoming.set(to, [...(incoming.get(to) ?? []), { from: byNode.get(e.fromNodeId)!.el.id, kind: depKind(rel.fields['kind']), lag: Math.round(numOf(rel.fields['lag']) ?? 0) }]);
  }
  const dates = new Map<string, { start: number; end: number }>();
  const dur = (el: Element) => Math.max(1, Math.round(numOf(el.fields['duration']) ?? 1));
  for (const { el } of list) {
    const k = kindOf(el); if (k === 'group') continue;
    const s0 = dayOf(el.fields['start']), e0 = k === 'task' ? dayOf(el.fields['end']) : undefined;
    if (k === 'milestone') { if (s0 !== undefined) dates.set(el.id, { start: s0, end: s0 - 1 }); continue; }
    if (s0 !== undefined) dates.set(el.id, { start: s0, end: e0 !== undefined ? Math.max(s0, e0) : s0 + dur(el) - 1 });
    else if (e0 !== undefined && numOf(el.fields['duration']) !== undefined) dates.set(el.id, { start: e0 - dur(el) + 1, end: e0 });
  }
  const pending = list.map(r => r.el).filter(el => kindOf(el) !== 'group' && !dates.has(el.id));
  for (let pass = 0; pass <= pending.length && pending.some(el => !dates.has(el.id)); pass++) {
    for (const el of pending) {
      if (dates.has(el.id)) continue;
      const deps = incoming.get(el.id) ?? [];
      if (!deps.length || deps.some(d => !dates.has(d.from))) continue;
      const d = kindOf(el) === 'milestone' ? 0 : dur(el);
      let start = -Infinity;
      for (const dep of deps) {
        const p = dates.get(dep.from)!;
        start = Math.max(start, dep.kind === 'FS' ? p.end + 1 + dep.lag : dep.kind === 'SS' ? p.start + dep.lag : dep.kind === 'FF' ? p.end + dep.lag - d + 1 : p.start + dep.lag - d);
      }
      dates.set(el.id, { start, end: start + d - 1 });
    }
  }
  const known = [...dates.values()].map(v => v.start);
  const base = known.length ? Math.min(...known) : dayOf(new Date().toISOString())!;
  for (const el of pending) if (!dates.has(el.id)) { const d = kindOf(el) === 'milestone' ? 0 : dur(el); dates.set(el.id, { start: base, end: base + d - 1 }); }
  const span = (r: { node: ViewNode; el: Element }, guard = 0): { start: number; end: number } | undefined => {
    if (guard > 32) return undefined;
    let a = Infinity, b = -Infinity;
    for (const c of list.filter(x => x.node.parentNodeId === r.node.id)) { const v = kindOf(c.el) === 'group' ? span(c, guard + 1) : dates.get(c.el.id); if (v) { a = Math.min(a, v.start); b = Math.max(b, v.end); } }
    return Number.isFinite(a) ? { start: a, end: Math.max(a - 1, b) } : undefined;
  };
  for (const r of list) if (kindOf(r.el) === 'group') dates.set(r.el.id, span(r) ?? { start: base, end: base });
  // Escala y origen
  const all = [...dates.values()];
  const lo = all.length ? Math.min(...all.map(d => d.start)) : base, hi = all.length ? Math.max(...all.map(d => Math.max(d.start, d.end))) : lo + 13;
  const fixed = view.style?.['ganttScale'];
  const scale: GanttScale = fixed === 'day' || fixed === 'week' || fixed === 'month' ? fixed : hi - lo + 1 <= 45 ? 'day' : hi - lo + 1 <= 270 ? 'week' : 'month';
  const px = SCALE_PX[scale];
  let day0 = lo - GANTT.padDays;
  if (scale !== 'month') day0 -= (new Date(day0 * DAY_MS).getUTCDay() + 6) % 7;
  else { const t = new Date(day0 * DAY_MS); day0 = Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) / DAY_MS); }
  let last = hi + GANTT.padDays + (scale === 'day' ? 7 : scale === 'week' ? 14 : 31);
  if (scale === 'month') { const t = new Date(last * DAY_MS); last = Math.round(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1) / DAY_MS) - 1; }
  const days = Math.max(14, last - day0 + 1);
  const xOf = (day: number) => GANTT.labelW + (day - day0) * px;
  const rows: GanttRowGeo[] = list.map(({ node, el, depth }, index) => {
    const k = kindOf(el), d = dates.get(el.id)!;
    const cy = GANTT.headerH + index * GANTT.rowH + GANTT.rowH / 2;
    const bar = k === 'milestone' ? { x: xOf(d.start) - GANTT.barH / 2, y: cy - GANTT.barH / 2, w: GANTT.barH, h: GANTT.barH }
      : { x: xOf(d.start), y: cy - (k === 'group' ? GANTT.groupH : GANTT.barH) / 2, w: Math.max(px * 0.5, (d.end - d.start + 1) * px), h: k === 'group' ? GANTT.groupH : GANTT.barH };
    return { node, el, kind: k, depth, start: d.start, end: d.end, index, bar };
  });
  return { scale, px, day0, days, rows, width: GANTT.labelW + days * px, height: GANTT.headerH + Math.max(1, rows.length) * GANTT.rowH + 8 };
}

/** Ruta en codo (réplica de `elbowRoute` del editor). */
function elbow(a: { x: number; y: number }, aDir: number, b: { x: number; y: number }, bDir: number, gap = 10): { x: number; y: number }[] {
  const p1 = { x: a.x + aDir * gap, y: a.y }, q = { x: b.x - bDir * gap, y: b.y };
  if (a.y === b.y) return [a, b];
  if (bDir * (b.x - p1.x) >= gap * 0.5) return [a, p1, { x: p1.x, y: b.y }, b];
  const midY = a.y + Math.sign(b.y - a.y) * (GANTT.rowH / 2);
  return [a, p1, { x: p1.x, y: midY }, { x: q.x, y: midY }, q, b];
}

// ---------------------------------------------------------------- SVG
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const at = (o: Record<string, string | number | undefined>) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => ` ${k}="${typeof v === 'number' ? num(v) : esc(String(v))}"`).join('');
function darken(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex;
  const n = parseInt(m[1]!, 16); const ch = (v: number) => Math.max(0, Math.round(v * (1 - amount))).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const readable = (hex: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return '#111'; const n = parseInt(m[1]!, 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#111' : '#fff'; };
const MONTHS: Record<string, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** CSS de las piezas del Gantt (variables del tema del SVG). */
export function ganttStyle(): string {
  return [
    '.ad-gantt-bg{fill:var(--ad-panel);stroke:var(--ad-border)}',
    '.ad-gantt-head{fill:var(--ad-bg);stroke:var(--ad-border)}',
    '.ad-gantt-line{stroke:var(--ad-border);stroke-width:1}',
    '.ad-gantt-we{fill:var(--ad-bg)}',
    '.ad-gantt-stripe{fill:var(--ad-text);opacity:.025}',
    '.ad-gantt-major{font-size:12px;font-weight:600;fill:var(--ad-text)}',
    '.ad-gantt-minor{font-size:11px;fill:var(--ad-muted)}',
    '.ad-gantt-name{font-size:12px;fill:var(--ad-text)}',
    '.ad-gantt-who{font-size:11px;fill:var(--ad-muted)}',
    '.ad-gantt-ink{fill:var(--ad-text)}',
    '.ad-gantt-dep{fill:none;stroke:var(--ad-edge);stroke-width:1.4}',
    '.ad-gantt-head-arrow{fill:var(--ad-edge)}',
    '.ad-gantt-tag rect{fill:var(--ad-panel);stroke:var(--ad-border)}',
    '.ad-gantt-tag text{font-size:10px;fill:var(--ad-muted)}',
  ].join('\n');
}

/** Piezas SVG de una vista de Gantt (misma forma que las de secuencia), o `null` si la vista no lo es. */
export function renderGanttSvg(store: Store, reg: NotationRegistry, view: View, opts: { bare: boolean }): SequenceSvg | null {
  if (!isGanttView(view, reg)) return null;
  const g = ganttGeometry(store, view);
  const { headerH, labelW, rowH } = GANTT, mid = headerH / 2;
  const W = g.width, H = g.height, end = g.day0 + g.days;
  const months = MONTHS[ioLang()] ?? MONTHS.es!;
  const xOf = (day: number) => labelW + (day - g.day0) * g.px;
  const ymd = (day: number) => { const d = new Date(day * DAY_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() }; };
  const ms = (y: number, m: number) => Math.round(Date.UTC(y, m, 1) / DAY_MS);
  const majors: { x: number; w: number; label: string }[] = [], minors: { x: number; w: number; label: string }[] = [], weekends: number[] = [];
  if (g.scale === 'month') {
    const t0 = ymd(g.day0);
    for (let y = t0.y; ms(y, 0) < end; y++) { const a = Math.max(g.day0, ms(y, 0)), b = Math.min(end, ms(y + 1, 0)); majors.push({ x: xOf(a), w: (b - a) * g.px, label: String(y) }); }
    for (let m = ms(t0.y, t0.m); m < end;) { const t = ymd(m), next = ms(t.y, t.m + 1); minors.push({ x: xOf(m), w: (Math.min(next, end) - m) * g.px, label: months[t.m]! }); m = next; }
  } else {
    const t0 = ymd(g.day0);
    for (let m = ms(t0.y, t0.m); m < end;) { const t = ymd(m), next = ms(t.y, t.m + 1), a = Math.max(m, g.day0), b = Math.min(next, end); majors.push({ x: xOf(a), w: (b - a) * g.px, label: `${months[t.m]} ${t.y}` }); m = next; }
    if (g.scale === 'day') for (let d = g.day0; d < end; d++) { const k = ymd(d); minors.push({ x: xOf(d), w: g.px, label: String(k.d) }); if (k.wd === 0 || k.wd === 6) weekends.push(xOf(d)); }
    else for (let d = g.day0; d < end; d += 7) { const k = ymd(d); minors.push({ x: xOf(d), w: Math.min(7, end - d) * g.px, label: `${k.d} ${months[k.m]}` }); }
  }
  const back: string[] = [], front: string[] = [];
  const nodeIds = new Set<string>(), edgeIds = new Set<string>(), boxes = new Map<string, Box>();
  // Rejilla
  const grid: string[] = [`<rect class="ad-gantt-bg"${at({ x: 0.5, y: 0.5, width: W - 1, height: H - 1 })}/>`];
  for (const x of weekends) grid.push(`<rect class="ad-gantt-we"${at({ x, y: headerH, width: g.px, height: H - headerH })}/>`);
  for (const r of g.rows) if (r.index % 2) grid.push(`<rect class="ad-gantt-stripe"${at({ x: labelW, y: headerH + r.index * rowH, width: W - labelW, height: rowH })}/>`);
  for (const m of minors) grid.push(`<line class="ad-gantt-line"${at({ x1: m.x, y1: mid, x2: m.x, y2: H, opacity: 0.7 })}/>`);
  for (const m of majors) grid.push(`<line class="ad-gantt-line"${at({ x1: m.x, y1: 0, x2: m.x, y2: H })}/>`);
  grid.push(`<rect class="ad-gantt-head"${at({ x: 0.5, y: 0.5, width: W - 1, height: headerH })}/>`, `<line class="ad-gantt-line"${at({ x1: labelW, y1: mid, x2: W, y2: mid })}/>`);
  for (const m of majors) grid.push(`<line class="ad-gantt-line"${at({ x1: m.x, y1: 0, x2: m.x, y2: headerH })}/><text class="ad-gantt-major"${at({ x: m.x + 6, y: mid / 2 + 4 })}>${esc(m.label)}</text>`);
  for (const m of minors) if (m.w >= 18) grid.push(`<text class="ad-gantt-minor"${at({ x: m.x + m.w / 2, y: mid + mid / 2 + 4, 'text-anchor': 'middle' })}>${esc(m.label)}</text>`);
  grid.push(`<rect class="ad-gantt-bg"${at({ x: 0.5, y: 0.5, width: labelW, height: H - 1 })}/>`, `<line class="ad-gantt-line"${at({ x1: 0, y1: headerH, x2: W, y2: headerH })}/>`);
  for (const r of g.rows) {
    const x = 12 + r.depth * 14, name = r.node.text ?? r.el.name, mark = r.kind === 'group' ? '▾ ' : r.kind === 'milestone' ? '◆ ' : '';
    const max = Math.max(3, Math.floor((labelW - x - 8) / 7)), txt = `${mark}${name}`;
    grid.push(`<line class="ad-gantt-line"${at({ x1: 0, y1: headerH + (r.index + 1) * rowH, x2: labelW, y2: headerH + (r.index + 1) * rowH, opacity: 0.6 })}/>`);
    grid.push(`<text class="ad-gantt-name"${at({ x, y: headerH + r.index * rowH + rowH / 2 + 4, 'font-weight': r.kind === 'group' ? 600 : undefined })}>${esc(txt.length > max ? `${txt.slice(0, max - 1)}…` : txt)}</text>`);
  }
  back.push(`<g class="ad-gantt-grid">${grid.join('')}</g>`);
  // Barras
  const data = (o: Record<string, string | undefined>) => (opts.bare ? {} : o);
  for (const r of g.rows) {
    const b = r.bar, el = r.el;
    nodeIds.add(r.node.id); boxes.set(r.node.id, b);
    const parts: string[] = [];
    if (r.kind === 'milestone') {
      const fill = r.node.style.fill;
      parts.push(`<path${at({ class: fill ? undefined : 'ad-gantt-ink', d: `M${num(b.x + b.w / 2)},${num(b.y + 1)} L${num(b.x + b.w - 1)},${num(b.y + b.h / 2)} L${num(b.x + b.w / 2)},${num(b.y + b.h - 1)} L${num(b.x + 1)},${num(b.y + b.h / 2)} Z`, fill })}/>`);
    } else if (r.kind === 'group') {
      const h = GANTT.groupH;
      parts.push(`<path class="ad-gantt-ink"${at({ d: `M${num(b.x)},${num(b.y)} H${num(b.x + b.w)} V${num(b.y + h)} L${num(b.x + b.w - 7)},${num(b.y + h * 0.6)} H${num(b.x + 7)} L${num(b.x)},${num(b.y + h)} Z` })}/>`);
    } else {
      const critical = el.fields['critical'] === true;
      const typeColor = reg.elementType(el.typeId)?.color ?? '#DAE8FC';
      const fill = r.node.style.fill ?? (critical ? '#F8CECC' : typeColor);
      const stroke = r.node.style.stroke ?? (critical ? '#B85450' : darken(fill, 0.35));
      const done = critical ? '#E06666' : darken(fill, 0.22);
      const progress = Math.max(0, Math.min(100, numOf(el.fields['progress']) ?? 0));
      parts.push(`<rect${at({ x: b.x + 0.5, y: b.y + 0.5, width: b.w - 1, height: b.h - 1, rx: 4, fill, stroke })}/>`);
      if (progress > 0) parts.push(`<rect${at({ x: b.x + 1, y: b.y + 1, width: Math.max(0, (b.w - 2) * progress / 100), height: b.h - 2, rx: 3, fill: done })}/>`);
      if (progress > 0 && b.w >= 40) parts.push(`<text${at({ x: b.x + b.w / 2, y: b.y + b.h / 2 + 3.5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600, fill: readable(progress >= 50 ? done : fill) })}>${Math.round(progress)}%</text>`);
      const who = typeof el.fields['assignee'] === 'string' ? el.fields['assignee'] : '';
      if (who) parts.push(`<text class="ad-gantt-who"${at({ x: b.x + b.w + 16, y: b.y + b.h / 2 + 4 })}>${esc(who)}</text>`);
    }
    const title = !opts.bare && (el.doc || el.name) ? `<title>${esc(el.doc || el.name)}</title>` : '';
    back.push(`<g${at({ class: `ad-node ad-gantt-bar ad-gantt-bar--${r.kind}`, ...data({ 'data-node': r.node.id, 'data-element': el.id, 'data-type': el.typeId }) })}>${title}${parts.join('')}</g>`);
  }
  // Dependencias
  const rowOf = new Map(g.rows.map(r => [r.node.id, r] as const));
  for (const e of store.list('edges')) {
    if (e.viewId !== view.id) continue;
    const a = rowOf.get(e.fromNodeId), b = rowOf.get(e.toNodeId);
    const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
    if (!a || !b || rel?.typeId !== GANTT_DEPENDENCY) continue;
    edgeIds.add(e.id);
    const kind = depKind(rel.fields['kind']), lag = Math.round(numOf(rel.fields['lag']) ?? 0);
    const fromEnd = kind === 'FS' || kind === 'FF', toEnd = kind === 'FF' || kind === 'SF', dir = toEnd ? -1 : 1;
    const pts = elbow({ x: fromEnd ? a.bar.x + a.bar.w : a.bar.x, y: a.bar.y + a.bar.h / 2 }, fromEnd ? 1 : -1, { x: toEnd ? b.bar.x + b.bar.w : b.bar.x, y: b.bar.y + b.bar.h / 2 }, dir);
    const tip = pts[pts.length - 1]!;
    const body = [...pts.slice(0, -1), { x: tip.x - dir * 7, y: tip.y }];
    const parts = [
      `<path class="ad-gantt-dep"${at({ d: body.map((q, i) => `${i ? 'L' : 'M'}${num(q.x)},${num(q.y)}`).join(' '), stroke: e.style.color })}/>`,
      `<path class="ad-gantt-head-arrow"${at({ d: `M${num(tip.x - dir * 7)},${num(tip.y - 4.5)} L${num(tip.x)},${num(tip.y)} L${num(tip.x - dir * 7)},${num(tip.y + 4.5)} Z`, fill: e.style.color })}/>`,
    ];
    const label = kind !== 'FS' || lag ? `${kind}${lag ? `${lag > 0 ? '+' : ''}${lag}d` : ''}` : '';
    if (label) {
      const lp = pts.length > 2 ? pts[pts.length - 2]! : pts[0]!, w = label.length * 6 + 8;
      parts.push(`<g class="ad-gantt-tag"><rect${at({ x: lp.x - w / 2, y: (lp.y + tip.y) / 2 - 7, width: w, height: 14, rx: 3 })}/><text${at({ x: lp.x, y: (lp.y + tip.y) / 2 + 3.5, 'text-anchor': 'middle' })}>${esc(label)}</text></g>`);
    }
    front.push(`<g${at({ class: `ad-edge ad-gantt-dep-edge ad-gantt-dep--${kind}`, ...data({ 'data-edge': e.id, 'data-relation': e.relationId }) })}>${parts.join('')}</g>`);
  }
  return { back: `<g class="ad-gantt">${back.join('')}</g>`, front: `<g class="ad-gantt-deps">${front.join('')}</g>`, nodeIds, edgeIds, boxes, extents: [{ x: 0, y: 0, w: W, h: H }], css: ganttStyle() };
}
