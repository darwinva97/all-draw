/** Aristas flotantes: el extremo se calcula en el borde del rectángulo del nodo, hacia el centro del otro. */
import { Position, type InternalNode } from '@xyflow/react';

interface Box { x: number; y: number; w: number; h: number }

function boxOf(n: InternalNode): Box {
  const p = n.internals.positionAbsolute;
  return { x: p.x, y: p.y, w: n.measured.width ?? n.width ?? 0, h: n.measured.height ?? n.height ?? 0 };
}

/** Punto donde la línea centro→centro corta el borde de `a`, y el lado por el que sale. */
function edgePoint(a: Box, target: { x: number; y: number }): { x: number; y: number; position: Position } {
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const dx = target.x - cx, dy = target.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: a.y, position: Position.Top };
  const sx = a.w / 2 / Math.max(Math.abs(dx), 1e-6), sy = a.h / 2 / Math.max(Math.abs(dy), 1e-6);
  const s = Math.min(sx, sy);
  const x = cx + dx * s, y = cy + dy * s;
  const position = sx < sy ? (dx > 0 ? Position.Right : Position.Left) : (dy > 0 ? Position.Bottom : Position.Top);
  return { x, y, position };
}

export function floatingEndpoints(source: InternalNode, target: InternalNode) {
  const a = boxOf(source), b = boxOf(target);
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const s = edgePoint(a, cb), t = edgePoint(b, ca);
  return { sourceX: s.x, sourceY: s.y, sourcePosition: s.position, targetX: t.x, targetY: t.y, targetPosition: t.position };
}
