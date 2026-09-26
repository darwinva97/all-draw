/**
 * Trazado de aristas con puntos de quiebre (bendpoints). Funciones puras: reciben la lista de
 * puntos (extremo origen, quiebres, extremo destino) en coordenadas absolutas del lienzo.
 */
import { Position } from '@xyflow/react';

export interface Pt { x: number; y: number }
export type Router = 'straight' | 'orthogonal' | 'bezier' | 'smoothstep';

export interface BendPath { path: string; labelX: number; labelY: number }

/** Trazado por los puntos según el router; el rótulo va a mitad de la longitud de la polilínea. */
export function bendPath(points: Pt[], router: Router, sourcePosition: Position, targetPosition: Position): BendPath {
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

/** Índice del tramo (entre `points[i]` y `points[i+1]`) más cercano al punto. */
export function nearestSegment(points: Pt[], p: Pt): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(p, points[i]!, points[i + 1]!);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  const qx = a.x + t * dx, qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

// ---------------------------------------------------------------- internos
function polyline(pts: Pt[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
}

/** Curva suave que pasa exactamente por los puntos (Catmull-Rom → Bézier cúbica). */
function catmullRom(pts: Pt[]): string {
  let d = `M ${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

const isHorizontal = (pos: Position) => pos === Position.Left || pos === Position.Right;

/**
 * Convierte la polilínea en tramos ortogonales insertando un codo por tramo. El primer tramo sale
 * del nodo según su lado; el último entra al destino según el suyo; los intermedios siguen el eje
 * dominante.
 */
export function orthogonalize(pts: Pt[], sourcePosition: Position, targetPosition: Position): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx !== 0 && dy !== 0) {
      let horizFirst: boolean;
      if (i === 0) horizFirst = isHorizontal(sourcePosition);
      else if (i === pts.length - 2) horizFirst = !isHorizontal(targetPosition); // llegar en horizontal ⇒ vertical primero
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
function roundedPolyline(pts: Pt[], radius: number): string {
  if (pts.length < 3) return polyline(pts);
  let d = `M ${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]!, v = pts[i]!, n = pts[i + 1]!;
    const l1 = Math.hypot(v.x - p.x, v.y - p.y), l2 = Math.hypot(n.x - v.x, n.y - v.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    if (r <= 0) { d += ` L ${v.x},${v.y}`; continue; }
    const a = { x: v.x + ((p.x - v.x) / l1) * r, y: v.y + ((p.y - v.y) / l1) * r };
    const b = { x: v.x + ((n.x - v.x) / l2) * r, y: v.y + ((n.y - v.y) / l2) * r };
    d += ` L ${a.x},${a.y} Q ${v.x},${v.y} ${b.x},${b.y}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L ${last.x},${last.y}`;
}

/** Punto a mitad de la longitud de la polilínea. */
function midpoint(pts: Pt[]): [number, number] {
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
