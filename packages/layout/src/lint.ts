/**
 * Lint geométrico de vistas: solapes, hijos fuera del contenedor, aristas que atraviesan nodos,
 * etiquetas que no caben y nodos demasiado pequeños. Es un `Validator` del núcleo, así que sus
 * diagnósticos llevan `supportedFixes` como comandos.
 *
 * Los ayudantes de geometría (`rectsOverlap`, `segmentIntersectsRect`, `segmentRectClearance`,
 * `normalizeRoutePoints`…) están portados de `renderers/shared/geometry.mjs` de **Archify**:
 *
 *   MIT License
 *   Copyright (c) 2026 tt-a1i (Archify)
 *   Copyright (c) 2025 Cocoon AI
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 *   and associated documentation files (the "Software"), to deal in the Software without
 *   restriction, including without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions: The above copyright
 *   notice and this permission notice shall be included in all copies or substantial portions of
 *   the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */
import type { Command, Diagnostic, NotationRegistry, Store, Validator, ViewEdge, ViewNode } from '@all-draw/core';

// ---------------------------------------------------------------- Geometría (port de archify)
export interface Rect { x: number; y: number; width: number; height: number }
export type Point = [number, number];
export interface Segment { start: Point; end: Point }

/** Una coordenada calculada debe ser finita; NaN escribiría `<rect x="NaN">` sin avisar. */
export function isFinitePoint(...coords: number[]): boolean {
  return coords.every(c => Number.isFinite(c));
}

/** Geometría no finita significa "desconocida", no "solapada". */
export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  if (!isFinitePoint(a.x, a.y, a.width, a.height, b.x, b.y, b.width, b.height)) return false;
  return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y);
}

/** ¿`inner` está totalmente dentro de `outer`? */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

interface Box { x1: number; y1: number; x2: number; y2: number }

export function segmentIntersectsRect(segment: Segment, rect: Rect, gap = 0): boolean {
  const box: Box = { x1: rect.x - gap, y1: rect.y - gap, x2: rect.x + rect.width + gap, y2: rect.y + rect.height + gap };
  const a = segment.start, b = segment.end;
  if (pointInBox(a, box) || pointInBox(b, box)) return true;
  return (
    segmentsIntersect(a, b, [box.x1, box.y1], [box.x2, box.y1]) ||
    segmentsIntersect(a, b, [box.x2, box.y1], [box.x2, box.y2]) ||
    segmentsIntersect(a, b, [box.x2, box.y2], [box.x1, box.y2]) ||
    segmentsIntersect(a, b, [box.x1, box.y2], [box.x1, box.y1])
  );
}

/** Distancia mínima entre un segmento y un rectángulo (0 si se cortan; null si la entrada no vale). */
export function segmentRectClearance(segment: Segment, rect: Rect): number | null {
  const { start, end } = segment;
  if (!isFinitePoint(...start, ...end, rect.x, rect.y, rect.width, rect.height)) return null;
  if (rect.width < 0 || rect.height < 0) return null;
  if (segmentIntersectsRect(segment, rect)) return 0;
  const corners: Point[] = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]];
  return Math.min(pointRectDistance(start, rect), pointRectDistance(end, rect), ...corners.map(c => pointSegmentDistance(c, start, end)));
}

/** Longitud del tramo del segmento que queda dentro del rectángulo (recorte Liang–Barsky). */
export function segmentRectIntersectionLength(segment: Segment, rect: Rect): number | null {
  const { start, end } = segment;
  if (!isFinitePoint(...start, ...end, rect.x, rect.y, rect.width, rect.height)) return null;
  if (rect.width < 0 || rect.height < 0) return null;
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length <= 1e-7) return 0;
  const bounds: [number, number][] = [[-dx, start[0] - rect.x], [dx, rect.x + rect.width - start[0]], [-dy, start[1] - rect.y], [dy, rect.y + rect.height - start[1]]];
  let enter = 0, leave = 1;
  for (const [direction, distance] of bounds) {
    if (Math.abs(direction) <= 1e-7) { if (distance < -1e-7) return 0; continue; }
    const ratio = distance / direction;
    if (direction < 0) enter = Math.max(enter, ratio); else leave = Math.min(leave, ratio);
    if (enter > leave + 1e-7) return 0;
  }
  return length * Math.max(0, leave - enter);
}

/** Quita puntos no finitos, duplicados consecutivos y vértices colineales hacia delante. */
export function normalizeRoutePoints(points: Point[]): Point[] {
  const finite = points.filter(p => Array.isArray(p) && p.length === 2 && isFinitePoint(...p));
  const deduped: Point[] = [];
  for (const point of finite) {
    const previous = deduped[deduped.length - 1];
    if (!previous || Math.abs(point[0] - previous[0]) > 1e-4 || Math.abs(point[1] - previous[1]) > 1e-4) deduped.push(point);
  }
  const normalized: Point[] = [];
  for (const point of deduped) {
    while (normalized.length >= 2 && collinearForward(normalized[normalized.length - 2]!, normalized[normalized.length - 1]!, point)) normalized.pop();
    normalized.push(point);
  }
  return normalized;
}

function pointRectDistance(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point[0], 0, point[0] - (rect.x + rect.width));
  const dy = Math.max(rect.y - point[1], 0, point[1] - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-7) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const projection = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + projection * dx), point[1] - (start[1] + projection * dy));
}

function collinearForward(a: Point, b: Point, c: Point): boolean {
  if (Math.abs(crossProduct(a, b, c)) > 1e-4) return false;
  return (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= -1e-4;
}

function crossProduct(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInBox(point: Point, box: Box): boolean {
  return point[0] >= box.x1 && point[0] <= box.x2 && point[1] >= box.y1 && point[1] <= box.y2;
}

export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return o1 !== o2 && o3 !== o4;
}

function orientation(a: Point, b: Point, c: Point): 0 | 1 | 2 {
  const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
  if (Math.abs(value) < 1e-4) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return b[0] <= Math.max(a[0], c[0]) && b[0] >= Math.min(a[0], c[0]) && b[1] <= Math.max(a[1], c[1]) && b[1] >= Math.min(a[1], c[1]);
}

// ---------------------------------------------------------------- Estimaciones de texto
/** Píxeles por carácter a 13px (aprox. system-ui). */
export const CHAR_W = 7;
export const LINE_H = 16;
export const LABEL_PAD_X = 20;
export const LABEL_PAD_Y = 8;
export const MIN_W = 40;
export const MIN_H = 24;

/** Líneas que necesita un texto para caber en `width` (con el ancho de carácter estimado). */
export function linesNeeded(text: string, width: number, charW = CHAR_W): number {
  const usable = Math.max(charW, width - LABEL_PAD_X);
  const perLine = Math.max(1, Math.floor(usable / charW));
  let lines = 0;
  for (const para of text.split('\n')) {
    let cur = 0;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const len = word.length;
      if (cur === 0) { cur = len; continue; }
      if (cur + 1 + len <= perLine) cur += 1 + len; else { lines += 1; cur = len; }
    }
    lines += 1;
  }
  return Math.max(1, lines);
}

// ---------------------------------------------------------------- Lint
/** Comando marcador: la app lo sustituye por el layout automático real (`layoutView`). */
export const AUTO_LAYOUT_FIX: Command = { type: 'batch', label: 'layout', commands: [] };

const fix = (label: string, command: Command) => ({ label, command });
const rectOf = (n: ViewNode): Rect => ({ x: n.x, y: n.y, width: n.w, height: n.h });
const centerOf = (r: Rect): Point => [r.x + r.width / 2, r.y + r.height / 2];

/** Punto donde la recta centro→objetivo corta el borde del rectángulo (mismo criterio que las aristas flotantes del editor). */
function edgePoint(a: Rect, target: Point): Point {
  const [cx, cy] = centerOf(a);
  const dx = target[0] - cx, dy = target[1] - cy;
  if (dx === 0 && dy === 0) return [cx, a.y];
  const sx = a.width / 2 / Math.max(Math.abs(dx), 1e-6), sy = a.height / 2 / Math.max(Math.abs(dy), 1e-6);
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

interface Ctx {
  store: Store;
  reg: NotationRegistry | undefined;
  nodes: ViewNode[];
  edges: ViewEdge[];
  byId: Map<string, ViewNode>;
  parentOf: (n: ViewNode) => ViewNode | undefined;
  /** Rect absoluto dentro de su "sistema" (vista, o celda en grid). */
  abs: Map<string, Rect>;
  /** Clave del sistema de coordenadas: '' o `layer|stage`. */
  system: Map<string, string>;
  isContainer: (n: ViewNode) => boolean;
  labelOf: (n: ViewNode) => string;
  shapeOf: (n: ViewNode) => string | undefined;
}

function context(store: Store, reg: NotationRegistry | undefined, viewId: string): Ctx {
  const view = store.get('views', viewId);
  const nodes = store.list('nodes').filter(n => n.viewId === viewId);
  const edges = store.list('edges').filter(e => e.viewId === viewId);
  const byId = new Map(nodes.map(n => [n.id, n] as const));
  const parentOf = (n: ViewNode) => (n.parentNodeId ? byId.get(n.parentNodeId) : undefined);
  const hasKids = new Set(nodes.map(n => parentOf(n)?.id).filter((x): x is string => !!x));
  const typeOf = (n: ViewNode) => { const el = n.elementId ? store.get('elements', n.elementId) : undefined; return el && reg ? reg.elementType(el.typeId) : undefined; };
  const isContainer = (n: ViewNode) => hasKids.has(n.id) || n.visualType === 'core:group' || !!typeOf(n)?.container;
  const shapeOf = (n: ViewNode) => (n.elementId ? typeOf(n)?.shape : n.visualType === 'core:group' ? 'group' : 'note');
  const labelOf = (n: ViewNode) => { const el = n.elementId ? store.get('elements', n.elementId) : undefined; return n.text ?? (el ? el.name || (typeOf(n)?.name ?? '') : ''); };
  const abs = new Map<string, Rect>();
  const system = new Map<string, string>();
  const isGrid = view?.kind === 'grid';
  const resolve = (n: ViewNode, guard = 0): Rect => {
    const cached = abs.get(n.id); if (cached) return cached;
    const p = parentOf(n);
    const r = rectOf(n);
    if (p && guard < 50) { const pr = resolve(p, guard + 1); r.x += pr.x; r.y += pr.y; system.set(n.id, system.get(p.id) ?? ''); }
    else system.set(n.id, isGrid && n.cell ? `${n.cell.layerId}|${n.cell.stageId}` : '');
    abs.set(n.id, r);
    return r;
  };
  nodes.forEach(n => resolve(n));
  return { store, reg, nodes, edges, byId, parentOf, abs, system, isContainer, labelOf, shapeOf };
}

/** Diagnósticos geométricos de una vista. */
export function lintView(store: Store, reg: NotationRegistry | undefined, viewId: string): Diagnostic[] {
  const ctx = context(store, reg, viewId);
  return [...overlaps(ctx), ...outsideParent(ctx), ...edgesThroughNodes(ctx), ...labelOverflow(ctx), ...tooSmall(ctx)];
}

function overlaps(ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  const groups = new Map<string, ViewNode[]>();
  for (const n of ctx.nodes) {
    if (ctx.isContainer(n)) continue;
    const key = `${ctx.parentOf(n)?.id ?? ''}\u0000${ctx.system.get(n.id) ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), n]);
  }
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!, b = list[j]!;
      if (!rectsOverlap(rectOf(a), rectOf(b))) continue;
      const rightX = Math.round(a.x + a.w + 8), belowY = Math.round(a.y + a.h + 8);
      out.push({
        code: 'node-overlap', severity: 'warning', subject: { collection: 'nodes', id: b.id },
        message: `"${ctx.labelOf(b)}" se solapa con "${ctx.labelOf(a)}"`,
        evidence: { other: a.id, a: rectOf(a), b: rectOf(b) },
        supportedFixes: [
          fix(`Mover a la derecha de "${ctx.labelOf(a)}"`, { type: 'moveNodes', moves: [{ id: b.id, x: rightX, y: b.y }] }),
          fix(`Mover debajo de "${ctx.labelOf(a)}"`, { type: 'moveNodes', moves: [{ id: b.id, x: b.x, y: belowY }] }),
          fix('Layout automático', AUTO_LAYOUT_FIX),
        ],
      });
    }
  }
  return out;
}

function outsideParent(ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const n of ctx.nodes) {
    const p = ctx.parentOf(n); if (!p) continue;
    const inner = rectOf(n), outer: Rect = { x: 0, y: 0, width: p.w, height: p.h };
    if (rectContains(outer, inner)) continue;
    const x = Math.max(0, Math.min(n.x, p.w - n.w)), y = Math.max(0, Math.min(n.y, p.h - n.h));
    const w = Math.max(p.w, n.x + n.w + 12), h = Math.max(p.h, n.y + n.h + 12);
    out.push({
      code: 'node-outside-parent', severity: 'warning', subject: { collection: 'nodes', id: n.id },
      message: `"${ctx.labelOf(n)}" se sale de "${ctx.labelOf(p)}"`,
      evidence: { parent: p.id, child: inner, parentSize: { w: p.w, h: p.h } },
      supportedFixes: [
        ...(n.w <= p.w && n.h <= p.h ? [fix('Meter dentro del contenedor', { type: 'moveNodes', moves: [{ id: n.id, x, y }] } as Command)] : []),
        fix('Ampliar el contenedor', { type: 'patch', collection: 'nodes', id: p.id, patch: { w, h } }),
        fix('Layout automático', AUTO_LAYOUT_FIX),
      ],
    });
  }
  return out;
}

function ancestors(ctx: Ctx, n: ViewNode): Set<string> {
  const out = new Set<string>();
  let cur = ctx.parentOf(n), guard = 0;
  while (cur && guard++ < 50) { out.add(cur.id); cur = ctx.parentOf(cur); }
  return out;
}

function edgesThroughNodes(ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const e of ctx.edges) {
    const a = ctx.byId.get(e.fromNodeId), b = ctx.byId.get(e.toNodeId);
    if (!a || !b || a.id === b.id) continue;
    const sysA = ctx.system.get(a.id), sysB = ctx.system.get(b.id);
    if (sysA !== sysB) continue; // celdas distintas: coordenadas no comparables
    const ra = ctx.abs.get(a.id)!, rb = ctx.abs.get(b.id)!;
    const bends: Point[] = e.bendpoints.map(p => [p.x, p.y]);
    const start = edgePoint(ra, bends[0] ?? centerOf(rb));
    const end = edgePoint(rb, bends[bends.length - 1] ?? centerOf(ra));
    const pts = normalizeRoutePoints([start, ...bends, end]);
    const skip = new Set([a.id, b.id, ...ancestors(ctx, a), ...ancestors(ctx, b)]);
    const hit: string[] = [];
    for (const n of ctx.nodes) {
      if (skip.has(n.id) || ctx.isContainer(n) || ctx.system.get(n.id) !== sysA) continue;
      const r = ctx.abs.get(n.id)!;
      let crossed = 0;
      for (let i = 0; i < pts.length - 1; i++) crossed += segmentRectIntersectionLength({ start: pts[i]!, end: pts[i + 1]! }, r) ?? 0;
      if (crossed > 4) hit.push(n.id);
    }
    for (const id of hit) {
      const n = ctx.byId.get(id)!;
      out.push({
        code: 'edge-through-node', severity: 'info', subject: { collection: 'edges', id: e.id },
        message: `La arista ${ctx.labelOf(a)} → ${ctx.labelOf(b)} atraviesa "${ctx.labelOf(n)}"`,
        evidence: { node: id, route: pts },
        supportedFixes: [fix('Layout automático', AUTO_LAYOUT_FIX)],
      });
    }
  }
  return out;
}

const LABEL_BELOW = new Set(['circle', 'double-circle', 'diamond', 'bar', 'actor']);

function labelOverflow(ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const n of ctx.nodes) {
    const shape = ctx.shapeOf(n);
    if (shape && LABEL_BELOW.has(shape)) continue;
    if (shape === 'pool' || shape === 'lane' || shape === 'label') continue;
    if (n.w < MIN_W || n.h < MIN_H) continue; // ya lo cubre node-too-small
    const label = ctx.labelOf(n).trim(); if (!label) continue;
    const fontSize = n.style.fontSize ?? 13;
    const charW = CHAR_W * (fontSize / 13);
    const lines = linesNeeded(label, n.w, charW);
    const longest = Math.max(...label.split(/\s+/).map(w => w.length)) * charW + LABEL_PAD_X;
    const needH = lines * LINE_H * (fontSize / 13) + LABEL_PAD_Y + (ctx.isContainer(n) ? 0 : 12);
    const wordTooWide = longest > n.w;
    const tooTall = !ctx.isContainer(n) && needH > n.h;
    if (!wordTooWide && !tooTall) continue;
    const w = Math.max(n.w, Math.ceil(longest)), h = Math.max(n.h, Math.ceil(needH));
    const singleW = Math.ceil(label.length * charW + LABEL_PAD_X);
    out.push({
      code: 'label-overflow', severity: 'info', subject: { collection: 'nodes', id: n.id },
      message: `La etiqueta "${label}" no cabe en "${ctx.labelOf(n)}" (${n.w}×${n.h})`,
      evidence: { lines, needH, longestWord: longest },
      supportedFixes: [
        fix('Ampliar el nodo', { type: 'patch', collection: 'nodes', id: n.id, patch: { w, h } }),
        fix('Ensanchar a una línea', { type: 'patch', collection: 'nodes', id: n.id, patch: { w: Math.max(n.w, singleW) } }),
      ],
    });
  }
  return out;
}

function tooSmall(ctx: Ctx): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const n of ctx.nodes) {
    if (n.w >= MIN_W && n.h >= MIN_H) continue;
    out.push({
      code: 'node-too-small', severity: 'warning', subject: { collection: 'nodes', id: n.id },
      message: `"${ctx.labelOf(n)}" es demasiado pequeño (${n.w}×${n.h})`,
      evidence: { min: { w: MIN_W, h: MIN_H } },
      supportedFixes: [fix('Ampliar al mínimo', { type: 'patch', collection: 'nodes', id: n.id, patch: { w: Math.max(n.w, MIN_W), h: Math.max(n.h, MIN_H) } })],
    });
  }
  return out;
}

/** Validador: lint geométrico de todas las vistas del workspace. */
export const geometryLint: Validator = {
  id: 'layout.geometry',
  run({ store, reg }) {
    return store.list('views').flatMap(v => lintView(store, reg, v.id));
  },
};
