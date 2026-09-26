/**
 * Trazado de aristas para el SVG exportado. Es una réplica (sin React Flow) de
 * `packages/editor/src/edges/bendpath.ts` y `floating.ts`, más una aproximación de los trazados
 * `straight`/`bezier`/`smoothstep` de React Flow para aristas sin bendpoints. Funciones puras en
 * coordenadas absolutas del lienzo. Si cambia el algoritmo del editor, cámbialo aquí también.
 */
export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Router = 'straight' | 'orthogonal' | 'bezier' | 'smoothstep';

export interface Endpoints { sourceX: number; sourceY: number; sourcePosition: Side; targetX: number; targetY: number; targetPosition: Side }
export interface EdgePath { path: string; labelX: number; labelY: number }

const isHorizontal = (s: Side) => s === 'left' || s === 'right';

// ---------------------------------------------------------------- Extremos flotantes (floating.ts)
/** Punto donde la línea centro→objetivo corta el borde de `a`, y el lado por el que sale. */
export function edgePoint(a: Box, target: Pt): { x: number; y: number; position: Side } {
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const dx = target.x - cx, dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: a.y, position: 'top' };
  const sx = a.w / 2 / Math.max(Math.abs(dx), 1e-6), sy = a.h / 2 / Math.max(Math.abs(dy), 1e-6);
  const s = Math.min(sx, sy);
  const x = cx + dx * s, y = cy + dy * s;
  const position: Side = sx < sy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
  return { x, y, position };
}

/** Extremos flotantes: cada extremo apunta al centro del otro nodo o al primer/último bendpoint. */
export function floatingEndpoints(a: Box, b: Box, towardSource?: Pt, towardTarget?: Pt): Endpoints {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const s = edgePoint(a, towardSource ?? cb), t = edgePoint(b, towardTarget ?? ca);
  return { sourceX: s.x, sourceY: s.y, sourcePosition: s.position, targetX: t.x, targetY: t.y, targetPosition: t.position };
}

// ---------------------------------------------------------------- Con bendpoints (bendpath.ts)
/** Trazado por los puntos según el router; el rótulo va a mitad de la longitud de la polilínea. */
export function bendPath(points: Pt[], router: Router, sourcePosition: Side, targetPosition: Side): EdgePath {
  if (points.length < 2) { const p = points[0] ?? { x: 0, y: 0 }; return { path: `M ${p.x},${p.y}`, labelX: p.x, labelY: p.y }; }
  if (router === 'bezier') {
    const [lx, ly] = midpoint(points);
    return { path: catmullRom(points), labelX: lx, labelY: ly };
  }
  if (router === 'straight') {
    const [lx, ly] = midpoint(points);
    return { path: polyline(points), labelX: lx, labelY: ly };
  }
  const ortho = orthogonalize(points, sourcePosition, targetPosition);
  const [lx, ly] = midpoint(ortho);
  return { path: roundedPolyline(ortho, 6), labelX: lx, labelY: ly };
}

function polyline(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)},${f(p.y)}`).join(' ');
}

/** Curva suave que pasa exactamente por los puntos (Catmull-Rom → Bézier cúbica). */
function catmullRom(pts: Pt[]): string {
  let d = `M ${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

/** Convierte la polilínea en tramos ortogonales insertando un codo por tramo. */
export function orthogonalize(pts: Pt[], sourcePosition: Side, targetPosition: Side): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx !== 0 && dy !== 0) {
      let horizFirst: boolean;
      if (i === 0) horizFirst = isHorizontal(sourcePosition);
      else if (i === pts.length - 2) horizFirst = !isHorizontal(targetPosition);
      else horizFirst = Math.abs(dx) >= Math.abs(dy);
      out.push(horizFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y });
    }
    out.push(b);
  }
  return dedupe(out);
}

function dedupe(pts: Pt[]): Pt[] {
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1]!.x || p.y !== pts[i - 1]!.y);
}

/** Polilínea con esquinas redondeadas (curvas cuadráticas en cada vértice interior). */
export function roundedPolyline(pts: Pt[], radius: number): string {
  if (pts.length < 3) return polyline(pts);
  let d = `M ${f(pts[0]!.x)},${f(pts[0]!.y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]!, v = pts[i]!, n = pts[i + 1]!;
    const l1 = Math.hypot(v.x - p.x, v.y - p.y), l2 = Math.hypot(n.x - v.x, n.y - v.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r <= 0) { d += ` L ${f(v.x)},${f(v.y)}`; continue; }
    const a = { x: v.x + ((p.x - v.x) / l1) * r, y: v.y + ((p.y - v.y) / l1) * r };
    const b = { x: v.x + ((n.x - v.x) / l2) * r, y: v.y + ((n.y - v.y) / l2) * r };
    d += ` L ${f(a.x)},${f(a.y)} Q ${f(v.x)},${f(v.y)} ${f(b.x)},${f(b.y)}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L ${f(last.x)},${f(last.y)}`;
}

/** Punto a mitad de la longitud de la polilínea. */
export function midpoint(pts: Pt[]): [number, number] {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y); lens.push(l); total += l; }
  let rest = total / 2;
  for (let i = 0; i < lens.length; i++) {
    const l = lens[i]!;
    if (rest <= l || i === lens.length - 1) {
      const t = l === 0 ? 0 : rest / l;
      return [pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * t, pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * t];
    }
    rest -= l;
  }
  return [pts[0]!.x, pts[0]!.y];
}

// ---------------------------------------------------------------- Sin bendpoints (aprox. React Flow)
const dir = (s: Side): Pt => (s === 'left' ? { x: -1, y: 0 } : s === 'right' ? { x: 1, y: 0 } : s === 'top' ? { x: 0, y: -1 } : { x: 0, y: 1 });

function controlOffset(distance: number, curvature = 0.25): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

function control(pos: Side, x1: number, y1: number, x2: number, y2: number): Pt {
  switch (pos) {
    case 'left': return { x: x1 - controlOffset(x1 - x2), y: y1 };
    case 'right': return { x: x1 + controlOffset(x2 - x1), y: y1 };
    case 'top': return { x: x1, y: y1 - controlOffset(y1 - y2) };
    case 'bottom': return { x: x1, y: y1 + controlOffset(y2 - y1) };
  }
}

/** Curva Bézier con el mismo criterio de puntos de control que `getBezierPath` de React Flow. */
export function bezierPath(e: Endpoints): EdgePath {
  const c1 = control(e.sourcePosition, e.sourceX, e.sourceY, e.targetX, e.targetY);
  const c2 = control(e.targetPosition, e.targetX, e.targetY, e.sourceX, e.sourceY);
  const labelX = e.sourceX * 0.125 + c1.x * 0.375 + c2.x * 0.375 + e.targetX * 0.125;
  const labelY = e.sourceY * 0.125 + c1.y * 0.375 + c2.y * 0.375 + e.targetY * 0.125;
  return { path: `M ${f(e.sourceX)},${f(e.sourceY)} C ${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(e.targetX)},${f(e.targetY)}`, labelX, labelY };
}

export function straightPath(e: Endpoints): EdgePath {
  return { path: `M ${f(e.sourceX)},${f(e.sourceY)} L ${f(e.targetX)},${f(e.targetY)}`, labelX: (e.sourceX + e.targetX) / 2, labelY: (e.sourceY + e.targetY) / 2 };
}

/** Escalones suaves: sale y entra por el lado de cada nodo con un tramo recto de `offset` y codos redondeados. */
export function smoothStepPath(e: Endpoints, offset = 20, radius = 6): EdgePath {
  const s = { x: e.sourceX, y: e.sourceY }, t = { x: e.targetX, y: e.targetY };
  const ds = dir(e.sourcePosition), dt = dir(e.targetPosition);
  const s1 = { x: s.x + ds.x * offset, y: s.y + ds.y * offset };
  const t1 = { x: t.x + dt.x * offset, y: t.y + dt.y * offset };
  const hs = isHorizontal(e.sourcePosition), ht = isHorizontal(e.targetPosition);
  let mid: Pt[];
  if (hs && ht) { const cx = (s1.x + t1.x) / 2; mid = [{ x: cx, y: s1.y }, { x: cx, y: t1.y }]; }
  else if (!hs && !ht) { const cy = (s1.y + t1.y) / 2; mid = [{ x: s1.x, y: cy }, { x: t1.x, y: cy }]; }
  else mid = [hs ? { x: t1.x, y: s1.y } : { x: s1.x, y: t1.y }];
  const pts = dedupeCollinear(dedupe([s, s1, ...mid, t1, t]));
  const [labelX, labelY] = midpoint(pts);
  return { path: roundedPolyline(pts, radius), labelX, labelY };
}

function dedupeCollinear(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const a = out[out.length - 2], b = out[out.length - 1];
    if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) out.pop();
    out.push(p);
  }
  return out;
}

/** Trazado completo de una arista: extremos, bendpoints opcionales y router. */
export function edgePath(e: Endpoints, bendpoints: Pt[], router: Router): EdgePath {
  if (bendpoints.length > 0) return bendPath([{ x: e.sourceX, y: e.sourceY }, ...bendpoints, { x: e.targetX, y: e.targetY }], router, e.sourcePosition, e.targetPosition);
  if (router === 'straight') return straightPath(e);
  if (router === 'bezier') return bezierPath(e);
  return smoothStepPath(e);
}

const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
