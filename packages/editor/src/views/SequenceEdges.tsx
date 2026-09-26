/**
 * Arista de mensaje de una vista de secuencia: horizontal entre dos líneas de vida a la altura
 * `data.y` (o con un escalón si es a sí misma). La etiqueta se arrastra en vertical para cambiar
 * la altura (`bendpoints[0].y`).
 */
import { memo, useCallback, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, type EdgeProps, type Edge } from '@xyflow/react';
import type { ViewEdge } from '@all-draw/core';
import { useEditor } from '../context';
import { messageYCommand, SEQ_HEADER_H, type MessageKind } from './sequence';

export type SequenceMessageData = {
  edge: ViewEdge;
  y: number;
  kind: MessageKind;
  order?: number;
  text: string;
  self: boolean;
};
export type SequenceMessageRFEdge = Edge<SequenceMessageData, 'sequenceMessage'>;

const SELF_W = 40;
const SELF_H = 24;
const HEAD = 11;

export const SequenceMessageEdge = memo(function SequenceMessageEdge(p: EdgeProps<SequenceMessageRFEdge>) {
  const { run, readOnly, effectiveTheme } = useEditor();
  const rf = useReactFlow();
  const d = p.data!;
  const sn = useInternalNode(p.source), tn = useInternalNode(p.target);
  const [dragY, setDragY] = useState<number | null>(null);
  const y = dragY ?? d.y;
  const centerOf = (n: typeof sn) => (n ? n.internals.positionAbsolute.x + (n.measured.width ?? n.width ?? 0) / 2 : 0);
  const widthOf = (n: typeof sn) => (n ? n.measured.width ?? n.width ?? 0 : 0);
  const fromX = sn ? centerOf(sn) : p.sourceX;
  let toX = tn ? centerOf(tn) : p.targetX;
  const color = d.edge.style.color ?? (effectiveTheme === 'dark' ? '#c5cbd6' : '#333');
  const width = d.edge.style.width ?? 1.5;
  const dashed = d.kind === 'return' || d.kind === 'create';
  const open = d.kind !== 'sync';

  let path: string, lx: number, ly: number, endX: number, endY = y, dir = 1;
  if (d.self) {
    // Escalón a la derecha de la propia línea
    endX = fromX + (open ? 0 : HEAD - 1); endY = y + SELF_H; dir = -1;
    path = `M${fromX},${y} H${fromX + SELF_W} V${endY} H${endX}`;
    lx = fromX + SELF_W + 6; ly = y + SELF_H / 2;
  } else {
    dir = toX >= fromX ? 1 : -1;
    if (d.kind === 'create' && tn) {
      // Termina en el borde de la cabecera destino (la cabecera se queda arriba: la línea llega a su borde)
      toX = centerOf(tn) - dir * (widthOf(tn) / 2);
      if (y < SEQ_HEADER_H) endY = y;
    }
    endX = toX - dir * (open ? 0 : HEAD - 1);
    path = `M${fromX},${y} L${endX},${endY}`;
    lx = (fromX + toX) / 2; ly = y - 9;
  }
  const label = d.order !== undefined ? (d.text ? `${d.order}: ${d.text}` : String(d.order)) : d.text;

  const onLabelDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const start = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }).y;
    const base = d.y;
    let current = base;
    const move = (ev: PointerEvent) => {
      const f = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }).y;
      current = Math.max(SEQ_HEADER_H + 8, Math.round(base + f - start));
      setDragY(current);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDragY(null);
      if (current !== base) run(messageYCommand(d.edge.id, current));
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }, [readOnly, rf, run, d.y, d.edge.id]);

  const arrow = arrowPath(endX, endY, dir, open);
  return (
    <>
      <BaseEdge id={p.id} path={path} style={{ stroke: color, strokeWidth: width, strokeDasharray: dashed ? '7 5' : undefined }} interactionWidth={16} />
      <path d={arrow} fill={open ? 'none' : color} stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" className="ad-seq-msg__head" />
      {d.kind === 'destroy' && <path d={`M${toX - 8},${y - 8} L${toX + 8},${y + 8} M${toX + 8},${y - 8} L${toX - 8},${y + 8}`} stroke={color} strokeWidth={2} strokeLinecap="round" />}
      <EdgeLabelRenderer>
        <div
          className={`ad-seq-msg-label nodrag nopan ${p.selected ? 'is-selected' : ''} ${dragY !== null ? 'is-dragging' : ''} ${readOnly ? '' : 'is-draggable'}`}
          style={{ transform: `translate(${d.self ? '0' : '-50%'},-100%) translate(${lx}px,${ly + (d.self ? 9 : 0)}px)` }}
          title={readOnly ? undefined : 'Arrastrar para cambiar la altura'}
          onPointerDown={onLabelDown}
        >
          {label || <em>mensaje</em>}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

/** Punta de flecha en (x, y) apuntando en `dir` (1 → derecha, -1 → izquierda). */
function arrowPath(x: number, y: number, dir: number, open: boolean): string {
  const tipX = open ? x : x + dir * (HEAD - 1);
  const bx = tipX - dir * HEAD;
  return open
    ? `M${bx},${y - 6} L${tipX},${y} L${bx},${y + 6}`
    : `M${bx},${y - 6} L${tipX},${y} L${bx},${y + 6} Z`;
}
