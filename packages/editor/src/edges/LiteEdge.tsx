import { memo } from 'react';
import { BaseEdge, useInternalNode, type Edge, type EdgeProps } from '@xyflow/react';
import type { ViewEdge } from '@all-draw/core';
import { floatingEndpoints } from './floating';

/** Lo que la arista simplificada necesita, resuelto una vez en `Canvas` (sin suscribirse al store ni a las reglas). */
export type LiteEdgeData = { edge: ViewEdge; color: string; dash?: string };
export type LiteRFEdge = Edge<LiteEdgeData, 'relationLite'>;

/** Polilínea recta del origen al destino por los bendpoints, en «d» de SVG. */
export function litePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(' ');
}

/**
 * Arista con zoom bajo (`LOW_DETAIL_ZOOM`): una línea recta (o por sus bendpoints) del color del tipo, sin puntas,
 * rótulos, cardinalidades ni manejadores. A ese zoom las puntas medirían 2–3 px y los rótulos serían ilegibles; sin
 * ellos cada arista es un solo trazo y no lee el contexto del editor (que cambia con cada selección) ni el store.
 * Sigue siendo seleccionable (zona de clic ancha); al acercarse vuelve la arista completa (`RelationEdge`).
 */
export const LiteEdge = memo(function LiteEdge(p: EdgeProps<LiteRFEdge>) {
  const sn = useInternalNode(p.source), tn = useInternalNode(p.target);
  const d = p.data!;
  const bends = d.edge.bendpoints;
  const ends = sn && tn && !d.edge.fromPortId && !d.edge.toPortId
    ? floatingEndpoints(sn, tn, bends[0], bends[bends.length - 1])
    : { sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY };
  const path = litePath([{ x: ends.sourceX, y: ends.sourceY }, ...bends, { x: ends.targetX, y: ends.targetY }]);
  return <BaseEdge id={p.id} path={path} className="ad-edge-lite" interactionWidth={12}
    style={{ stroke: p.selected ? 'var(--ad-accent)' : d.color, strokeWidth: p.selected ? 3 : 1.5, strokeDasharray: d.dash }} />;
});
