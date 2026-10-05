/**
 * Geometría de las vistas de Gantt (`View.kind === 'gantt'` o pack con `viewKind: 'gantt'`), como funciones puras.
 *
 * - Cada **tarea**, **hito** o **fase** del pack `gantt` presente en la vista es una fila. El orden de las filas sale del
 *   anidamiento (las fases antes que su contenido) y, entre hermanos, de la `y` del nodo (luego `x` e id).
 * - La barra se calcula de los **campos** (`start`, `end` inclusivo, `duration` en días), no de `x`/`y`: si falta el
 *   inicio, sale del fin y la duración o de las dependencias que llegan (FS, SS, FF, SF con `lag`). Un hito es un rombo
 *   al principio de su día; una fase abarca su contenido.
 * - La escala (días, semanas o meses) se elige por la duración del proyecto o la fija `View.style.ganttScale`.
 * - Las dependencias son flechas en codo entre los extremos que dice su tipo.
 *
 * Fechas: días naturales en UTC (`dayOf('2026-03-02')` = días desde 1970-01-01). Nada de aquí depende de React ni del
 * pack (los ids de tipo se repiten como constantes). La réplica para el SVG exportado está en `packages/io/src/svg-gantt.ts`.
 */
import type { Command, Element, Store, View, ViewNode } from '@all-draw/core';

export const GANTT_TASK = 'gantt:Task';
export const GANTT_MILESTONE = 'gantt:Milestone';
export const GANTT_GROUP = 'gantt:Group';
export const GANTT_DEPENDENCY = 'gantt:Dependency';
export const GANTT_TYPES: ReadonlySet<string> = new Set([GANTT_TASK, GANTT_MILESTONE, GANTT_GROUP]);

export type GanttScale = 'day' | 'week' | 'month';
export type GanttRowKind = 'task' | 'milestone' | 'group';
export type DependencyKind = 'FS' | 'SS' | 'FF' | 'SF';

/** Medidas en px: cabecera (dos bandas), columna de nombres, alto de fila y de barra. */
export const GANTT = { headerH: 48, labelW: 220, rowH: 34, barH: 20, groupH: 10, padDays: 2 } as const;
/** Píxeles por día de cada escala. */
export const SCALE_PX: Readonly<Record<GanttScale, number>> = { day: 30, week: 9, month: 3 };

const DAY_MS = 86_400_000;
/** `AAAA-MM-DD` (también con hora detrás) → día UTC; `undefined` si no es una fecha válida. */
export function dayOf(v: unknown): number | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (!m) return undefined;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return undefined;
  return Math.round(t / DAY_MS);
}
/** Día UTC → `AAAA-MM-DD`. */
export function isoOf(day: number): string { return new Date(day * DAY_MS).toISOString().slice(0, 10); }
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export interface GanttRow {
  nodeId: string;
  elementId: string;
  kind: GanttRowKind;
  depth: number;
  name: string;
  /** Primer día y último día (inclusivo). En un hito, `end = start - 1` (no ocupa días). */
  start: number;
  end: number;
  progress: number;
  critical: boolean;
  assignee: string;
  /** Las fechas vienen de los campos (no de dependencias ni del inicio del proyecto). */
  dated: boolean;
  /** Índice de fila. */
  index: number;
  /** Caja de la barra en coordenadas del lienzo. */
  bar: { x: number; y: number; w: number; h: number };
}

export interface GanttDep {
  edgeId: string;
  from: number;
  to: number;
  kind: DependencyKind;
  lag: number;
  /** Ruta en codo (el último punto es la punta de la flecha) y sentido de la punta (1 → derecha). */
  points: { x: number; y: number }[];
  dir: 1 | -1;
}

export interface GanttTick { x: number; w: number; label: string }

export interface GanttLayout {
  scale: GanttScale;
  px: number;
  /** Día en `x = labelW`. */
  day0: number;
  /** Días visibles. */
  days: number;
  rows: GanttRow[];
  deps: GanttDep[];
  /** Banda superior (meses o años) e inferior (días, semanas o meses) de la cabecera. */
  majors: GanttTick[];
  minors: GanttTick[];
  /** Fines de semana (escala de días), para sombrearlos. */
  weekends: GanttTick[];
  /** `x` de hoy si cae dentro. */
  todayX?: number;
  width: number;
  height: number;
}

type Reader = Pick<Store, 'get' | 'list'>;

export interface GanttOpts {
  /** Escala fija (si no, la de `View.style.ganttScale` o la automática). */
  scale?: GanttScale;
  /** Idioma de los meses de la cabecera (`es`, `en`, `pt`, `fr`…; los que no tienen tabla propia salen de `Intl`). */
  lang?: string;
  /** Hoy (día UTC) para la línea vertical; `undefined` = sin línea. */
  today?: number;
}

/** Escala automática según los días que abarca el proyecto. */
export function autoScale(spanDays: number): GanttScale {
  return spanDays <= 45 ? 'day' : spanDays <= 270 ? 'week' : 'month';
}
export function scaleOfView(view: Pick<View, 'style'> | undefined): GanttScale | undefined {
  const s = view?.style?.['ganttScale'];
  return s === 'day' || s === 'week' || s === 'month' ? s : undefined;
}

const typeOfNode = (s: Reader, n: ViewNode) => (n.elementId ? s.get('elements', n.elementId)?.typeId : undefined);
export function isGanttNode(s: Reader, n: ViewNode | undefined): boolean { return !!n && GANTT_TYPES.has(typeOfNode(s, n) ?? ''); }

/** Filas en orden: recorrido en profundidad por anidamiento, hermanos por `y`, `x` e id. */
export function ganttRowNodes(s: Reader, viewId: string): { node: ViewNode; el: Element; depth: number }[] {
  const nodes = s.list('nodes').filter(n => n.viewId === viewId && isGanttNode(s, n));
  const ids = new Set(nodes.map(n => n.id));
  const kids = new Map<string | undefined, ViewNode[]>();
  for (const n of nodes) {
    const p = n.parentNodeId && ids.has(n.parentNodeId) ? n.parentNodeId : undefined;
    kids.set(p, [...(kids.get(p) ?? []), n]);
  }
  const out: { node: ViewNode; el: Element; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (p: string | undefined, depth: number) => {
    for (const n of (kids.get(p) ?? []).sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({ node: n, el: s.get('elements', n.elementId!)!, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

export function dependencyKind(v: unknown): DependencyKind {
  return v === 'SS' || v === 'FF' || v === 'SF' ? v : 'FS';
}

/** Fechas resueltas de cada fila (por id de elemento): campos, luego dependencias, luego el inicio del proyecto. */
export function resolveDates(s: Reader, viewId: string, rows: { node: ViewNode; el: Element }[]): Map<string, { start: number; end: number; dated: boolean }> {
  const byNode = new Map(rows.map(r => [r.node.id, r] as const));
  const incoming = new Map<string, { from: string; kind: DependencyKind; lag: number }[]>();
  for (const e of s.list('edges')) {
    if (e.viewId !== viewId || !byNode.has(e.fromNodeId) || !byNode.has(e.toNodeId)) continue;
    const rel = e.relationId ? s.get('relations', e.relationId) : undefined;
    if (rel?.typeId !== GANTT_DEPENDENCY) continue;
    const to = byNode.get(e.toNodeId)!.el.id, from = byNode.get(e.fromNodeId)!.el.id;
    incoming.set(to, [...(incoming.get(to) ?? []), { from, kind: dependencyKind(rel.fields['kind']), lag: Math.round(num(rel.fields['lag']) ?? 0) }]);
  }
  const out = new Map<string, { start: number; end: number; dated: boolean }>();
  const kindOf = (el: Element): GanttRowKind => (el.typeId === GANTT_MILESTONE ? 'milestone' : el.typeId === GANTT_GROUP ? 'group' : 'task');
  const durOf = (el: Element) => Math.max(1, Math.round(num(el.fields['duration']) ?? 1));
  // 1) Fechas de los campos
  for (const { el } of rows) {
    const k = kindOf(el);
    if (k === 'group') continue;
    const s0 = dayOf(el.fields['start']), e0 = k === 'task' ? dayOf(el.fields['end']) : undefined;
    if (k === 'milestone') { if (s0 !== undefined) out.set(el.id, { start: s0, end: s0 - 1, dated: true }); continue; }
    const d = durOf(el);
    if (s0 !== undefined) out.set(el.id, { start: s0, end: e0 !== undefined ? Math.max(s0, e0) : s0 + d - 1, dated: true });
    else if (e0 !== undefined && num(el.fields['duration']) !== undefined) out.set(el.id, { start: e0 - d + 1, end: e0, dated: true });
  }
  // 2) Dependencias (varias pasadas; los ciclos se quedan sin resolver)
  const pending = rows.map(r => r.el).filter(el => kindOf(el) !== 'group' && !out.has(el.id));
  for (let pass = 0; pass <= pending.length && pending.some(el => !out.has(el.id)); pass++) {
    for (const el of pending) {
      if (out.has(el.id)) continue;
      const deps = incoming.get(el.id) ?? [];
      if (!deps.length || deps.some(d => !out.has(d.from))) continue;
      const k = kindOf(el), d = k === 'milestone' ? 0 : durOf(el);
      let start = -Infinity;
      for (const dep of deps) {
        const p = out.get(dep.from)!;
        const pEnd = p.end, pStart = p.start;
        // Restricción sobre el inicio (FS/SS) o el fin (FF/SF) del sucesor
        const st = dep.kind === 'FS' ? pEnd + 1 + dep.lag : dep.kind === 'SS' ? pStart + dep.lag : dep.kind === 'FF' ? pEnd + dep.lag - d + 1 : pStart + dep.lag - d;
        start = Math.max(start, st);
      }
      out.set(el.id, { start, end: start + d - 1, dated: false });
    }
  }
  // 3) El resto, al inicio del proyecto
  const known = [...out.values()].map(v => v.start);
  const base = known.length ? Math.min(...known) : dayOf(new Date().toISOString())!;
  for (const el of pending) if (!out.has(el.id)) { const d = kindOf(el) === 'milestone' ? 0 : durOf(el); out.set(el.id, { start: base, end: base + d - 1, dated: false }); }
  // 4) Fases: de su primer a su último día (de dentro hacia fuera)
  const childrenOf = (nodeId: string) => rows.filter(r => r.node.parentNodeId === nodeId);
  const groupSpan = (r: { node: ViewNode; el: Element }, guard = 0): { start: number; end: number } | undefined => {
    if (guard > 32) return undefined;
    let a = Infinity, b = -Infinity;
    for (const c of childrenOf(r.node.id)) {
      const v = kindOf(c.el) === 'group' ? groupSpan(c, guard + 1) : out.get(c.el.id);
      if (!v) continue;
      a = Math.min(a, v.start); b = Math.max(b, v.end);
    }
    return Number.isFinite(a) ? { start: a, end: Math.max(a - 1, b) } : undefined;
  };
  for (const r of rows) if (kindOf(r.el) === 'group') { const v = groupSpan(r); out.set(r.el.id, v ? { ...v, dated: true } : { start: base, end: base, dated: false }); }
  return out;
}

const MONTHS: Record<string, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
/** Meses abreviados del idioma: tabla propia (es, en) o `Intl.DateTimeFormat` (pt: «jan», fr: «janv.»). */
export function monthLabels(lang: string): string[] {
  let m = MONTHS[lang];
  if (!m) {
    try {
      const f = new Intl.DateTimeFormat(lang, { month: 'short', timeZone: 'UTC' });
      m = Array.from({ length: 12 }, (_, i) => { const x = f.format(Date.UTC(2024, i, 15)); return lang.startsWith('pt') ? x.replace(/\.$/, '') : x; });
    } catch { m = MONTHS.es!; }
    MONTHS[lang] = m;
  }
  return m;
}
const ymd = (day: number) => { const d = new Date(day * DAY_MS); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() }; };
const monthStart = (y: number, m: number) => Math.round(Date.UTC(y, m, 1) / DAY_MS);

/** `x` del principio de un día. */
export function xOfDay(l: Pick<GanttLayout, 'day0' | 'px'>, day: number): number { return GANTT.labelW + (day - l.day0) * l.px; }
/** Día (entero) más cercano a una `x` del lienzo. */
export function dayAtX(l: Pick<GanttLayout, 'day0' | 'px'>, x: number): number { return l.day0 + Math.round((x - GANTT.labelW) / l.px); }

/** Caja de la barra de una fila (tarea: de su primer día al final del último; hito: rombo; fase: barra resumen fina). */
export function barBox(l: Pick<GanttLayout, 'day0' | 'px'>, kind: GanttRowKind, start: number, end: number, index: number): GanttRow['bar'] {
  const cy = GANTT.headerH + index * GANTT.rowH + GANTT.rowH / 2;
  if (kind === 'milestone') { const s = GANTT.barH; return { x: xOfDay(l, start) - s / 2, y: cy - s / 2, w: s, h: s }; }
  const h = kind === 'group' ? GANTT.groupH : GANTT.barH;
  return { x: xOfDay(l, start), y: cy - h / 2, w: Math.max(l.px * 0.5, (end - start + 1) * l.px), h };
}

/** Ruta en codo de `a` (sale hacia `aDir`) a `b` (entra con la punta hacia `bDir`), rodeando si hace falta. */
export function elbowRoute(a: { x: number; y: number }, aDir: 1 | -1, b: { x: number; y: number }, bDir: 1 | -1, gap = 10): { x: number; y: number }[] {
  const p1 = { x: a.x + aDir * gap, y: a.y };
  const q = { x: b.x - bDir * gap, y: b.y };
  if (a.y === b.y) return [a, b];
  // Cabe sin volver atrás: baja (o sube) por p1.x y entra en horizontal.
  if (bDir * (b.x - p1.x) >= gap * 0.5) return [a, p1, { x: p1.x, y: b.y }, b];
  const midY = a.y + Math.sign(b.y - a.y) * (GANTT.rowH / 2);
  return [a, p1, { x: p1.x, y: midY }, { x: q.x, y: midY }, q, b];
}

/** Geometría completa de una vista de Gantt. */
export function ganttLayout(s: Reader, viewId: string, opts: GanttOpts = {}): GanttLayout {
  const view = s.get('views', viewId);
  const list = ganttRowNodes(s, viewId);
  const dates = resolveDates(s, viewId, list);
  const starts = [...dates.values()].map(d => d.start), ends = [...dates.values()].map(d => Math.max(d.start, d.end));
  const today = opts.today;
  const lo = starts.length ? Math.min(...starts) : today ?? dayOf(new Date().toISOString())!;
  const hi = ends.length ? Math.max(...ends) : lo + 13;
  const scale = opts.scale ?? scaleOfView(view) ?? autoScale(hi - lo + 1);
  const px = SCALE_PX[scale];
  // Inicio alineado: lunes (días y semanas) o día 1 del mes (meses), con un poco de margen.
  let day0 = lo - GANTT.padDays;
  if (scale !== 'month') { const wd = ymd(day0).wd; day0 -= (wd + 6) % 7; }
  else { const t = ymd(day0); day0 = monthStart(t.y, t.m); }
  let last = hi + GANTT.padDays + (scale === 'day' ? 7 : scale === 'week' ? 14 : 31);
  if (scale === 'month') { const t = ymd(last); last = monthStart(t.y, t.m + 1) - 1; }
  const days = Math.max(14, last - day0 + 1);
  const L = { day0, px };
  const rows: GanttRow[] = list.map(({ node, el, depth }, index) => {
    const kind: GanttRowKind = el.typeId === GANTT_MILESTONE ? 'milestone' : el.typeId === GANTT_GROUP ? 'group' : 'task';
    const d = dates.get(el.id)!;
    const progress = Math.max(0, Math.min(100, num(el.fields['progress']) ?? 0));
    return {
      nodeId: node.id, elementId: el.id, kind, depth, name: node.text ?? el.name, start: d.start, end: d.end, progress,
      critical: el.fields['critical'] === true, assignee: typeof el.fields['assignee'] === 'string' ? el.fields['assignee'] : '',
      dated: d.dated, index, bar: barBox(L, kind, d.start, d.end, index),
    };
  });
  // Dependencias
  const rowByNode = new Map(rows.map(r => [r.nodeId, r] as const));
  const deps: GanttDep[] = [];
  for (const e of s.list('edges')) {
    if (e.viewId !== viewId) continue;
    const a = rowByNode.get(e.fromNodeId), b = rowByNode.get(e.toNodeId);
    const rel = e.relationId ? s.get('relations', e.relationId) : undefined;
    if (!a || !b || rel?.typeId !== GANTT_DEPENDENCY) continue;
    const kind = dependencyKind(rel.fields['kind']);
    const fromEnd = kind === 'FS' || kind === 'FF', toEnd = kind === 'FF' || kind === 'SF';
    const ay = a.bar.y + a.bar.h / 2, by = b.bar.y + b.bar.h / 2;
    const pa = { x: fromEnd ? a.bar.x + a.bar.w : a.bar.x, y: ay };
    const pb = { x: toEnd ? b.bar.x + b.bar.w : b.bar.x, y: by };
    const aDir: 1 | -1 = fromEnd ? 1 : -1, dir: 1 | -1 = toEnd ? -1 : 1;
    deps.push({ edgeId: e.id, from: a.index, to: b.index, kind, lag: Math.round(num(rel.fields['lag']) ?? 0), points: elbowRoute(pa, aDir, pb, dir), dir });
  }
  // Cabecera
  const months = monthLabels(opts.lang ?? 'es');
  const majors: GanttTick[] = [], minors: GanttTick[] = [], weekends: GanttTick[] = [];
  const end = day0 + days;
  if (scale === 'month') {
    let t = ymd(day0);
    for (let y = t.y; monthStart(y, 0) < end; y++) {
      const a = Math.max(day0, monthStart(y, 0)), b = Math.min(end, monthStart(y + 1, 0));
      majors.push({ x: xOfDay(L, a), w: (b - a) * px, label: String(y) });
    }
    for (let m = monthStart(t.y, t.m); m < end;) {
      t = ymd(m); const next = monthStart(t.y, t.m + 1);
      minors.push({ x: xOfDay(L, m), w: (Math.min(next, end) - m) * px, label: months[t.m]! });
      m = next;
    }
  } else {
    let t = ymd(day0);
    for (let m = monthStart(t.y, t.m); m < end;) {
      t = ymd(m); const next = monthStart(t.y, t.m + 1);
      const a = Math.max(m, day0), b = Math.min(next, end);
      majors.push({ x: xOfDay(L, a), w: (b - a) * px, label: `${months[t.m]} ${t.y}` });
      m = next;
    }
    if (scale === 'day') {
      for (let d = day0; d < end; d++) {
        const k = ymd(d);
        minors.push({ x: xOfDay(L, d), w: px, label: String(k.d) });
        if (k.wd === 0 || k.wd === 6) weekends.push({ x: xOfDay(L, d), w: px, label: '' });
      }
    } else {
      for (let d = day0; d < end; d += 7) { const k = ymd(d); minors.push({ x: xOfDay(L, d), w: Math.min(7, end - d) * px, label: `${k.d} ${months[k.m]}` }); }
    }
  }
  const todayX = today !== undefined && today >= day0 && today < end ? xOfDay(L, today) : undefined;
  return {
    scale, px, day0, days, rows, deps, majors, minors, weekends, todayX,
    width: GANTT.labelW + days * px, height: GANTT.headerH + Math.max(1, rows.length) * GANTT.rowH + 8,
  };
}

// ---------------------------------------------------------------- Edición (comandos)
/** Patch de las fechas de una tarea o hito desplazado `delta` días (respeta si usaba fin o duración). */
function shiftFields(el: Element, start: number, end: number, delta: number): Record<string, unknown> {
  if (el.typeId === GANTT_MILESTONE) return { start: isoOf(start + delta) };
  const f: Record<string, unknown> = { start: isoOf(start + delta) };
  if (dayOf(el.fields['end']) !== undefined || num(el.fields['duration']) === undefined) f.end = isoOf(end + delta);
  return f;
}

/** Comando al soltar la barra de `row` desplazada `delta` días: mueve la tarea o el hito, o todo lo que contiene la fase. */
export function moveCommand(s: Reader, layout: GanttLayout, row: GanttRow, delta: number): Command | null {
  if (!delta) return null;
  const targets = row.kind === 'group' ? descendants(layout, row) : [row];
  const cmds: Command[] = [];
  for (const r of targets) {
    if (r.kind === 'group') continue;
    const el = s.get('elements', r.elementId); if (!el) continue;
    cmds.push({ type: 'patch', collection: 'elements', id: el.id, patch: { fields: shiftFields(el, r.start, r.end, delta) } });
  }
  return cmds.length ? { type: 'batch', label: 'mover en el Gantt', commands: cmds } : null;
}

/** Filas dentro de una fase (por anidamiento de nodos, a cualquier profundidad). */
export function descendants(layout: GanttLayout, row: GanttRow): GanttRow[] {
  const start = row.index + 1;
  const out: GanttRow[] = [];
  for (let i = start; i < layout.rows.length && layout.rows[i]!.depth > row.depth; i++) out.push(layout.rows[i]!);
  return out;
}

/**
 * Comando al redimensionar la barra de una tarea: el borde derecho cambia el fin (y la duración, si la usa) y el izquierdo
 * el inicio. `x`/`w` son la nueva caja de la barra en el lienzo; se redondea a días enteros y nunca baja de un día.
 */
export function resizeCommand(s: Reader, layout: GanttLayout, row: GanttRow, box: { x: number; w: number }): Command | null {
  if (row.kind !== 'task') return null;
  const el = s.get('elements', row.elementId); if (!el) return null;
  const start = dayAtX(layout, box.x);
  const end = Math.max(start, dayAtX(layout, box.x + box.w) - 1);
  if (start === row.start && end === row.end) return null;
  const f: Record<string, unknown> = { start: isoOf(start) };
  if (dayOf(el.fields['end']) !== undefined || num(el.fields['duration']) === undefined) f.end = isoOf(end);
  if (num(el.fields['duration']) !== undefined) f.duration = end - start + 1;
  return { type: 'patch', collection: 'elements', id: el.id, patch: { fields: f } };
}

/** Campos de una tarea o hito soltado en `x` (desde la paleta): empieza ese día; una tarea dura 5 días. */
export function dropFields(layout: GanttLayout, typeId: string, x: number): Record<string, unknown> | undefined {
  if (!GANTT_TYPES.has(typeId) || typeId === GANTT_GROUP) return undefined;
  const day = dayAtX(layout, x);
  return typeId === GANTT_MILESTONE ? { start: isoOf(day) } : { start: isoOf(day), duration: 5 };
}
