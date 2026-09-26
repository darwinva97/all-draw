import { memo, useState, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useInternalNode, useReactFlow, type EdgeProps, type Edge } from '@xyflow/react';
import { floatingEndpoints } from './floating';
import { bendPath, type Pt } from './bendpath';
import type { ArrowHead, ViewEdge } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord } from '../hooks';

export type RelationEdgeData = { edge: ViewEdge };
export type RelationRFEdge = Edge<RelationEdgeData, 'relation'>;

export const RelationEdge = memo(function RelationEdge(p: EdgeProps<RelationRFEdge>) {
  const { registry, run, readOnly } = useEditor();
  const rf = useReactFlow();
  const ve = p.data!.edge;
  const rel = useRecord('relations', ve.relationId);
  const type = rel ? registry.relationType(rel.typeId) : undefined;
  const line = ve.style.line ?? type?.line ?? 'solid';
  const color = ve.style.color ?? type?.color ?? '#444';
  const width = ve.style.width ?? 1.5;
  const sh = ve.style.sourceHead ?? type?.sourceHead ?? 'none';
  const th = ve.style.targetHead ?? type?.targetHead ?? 'arrow';
  const router = ve.style.router ?? 'smoothstep';
  const sn = useInternalNode(p.source), tn = useInternalNode(p.target);
  const floating = !ve.fromPortId && !ve.toPortId && sn && tn;

  // Bendpoints: durante el arrastre de un manejador se usa una copia local; al soltar se aplica el patch.
  const [drag, setDrag] = useState<{ index: number; point: Pt } | null>(null);
  const bends: Pt[] = drag ? ve.bendpoints.map((b, i) => (i === drag.index ? drag.point : b)) : ve.bendpoints;
  const first = bends[0], last = bends[bends.length - 1];

  const args = floating
    ? floatingEndpoints(sn, tn, first, last)
    : { sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition };
  let path: string, lx: number, ly: number;
  if (bends.length > 0) {
    const pts: Pt[] = [{ x: args.sourceX, y: args.sourceY }, ...bends, { x: args.targetX, y: args.targetY }];
    ({ path, labelX: lx, labelY: ly } = bendPath(pts, router, args.sourcePosition, args.targetPosition));
  } else {
    [path, lx, ly] = router === 'straight' ? getStraightPath(args) : router === 'bezier' ? getBezierPath(args) : getSmoothStepPath({ ...args, borderRadius: 6 });
  }

  const onHandleDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (readOnly || e.button !== 0) return;
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    let current: Pt = ve.bendpoints[index]!;
    const move = (ev: PointerEvent) => {
      const f = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
      current = { x: Math.round(f.x), y: Math.round(f.y) };
      setDrag({ index, point: current });
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      setDrag(null);
      const orig = ve.bendpoints[index];
      if (orig && (orig.x !== current.x || orig.y !== current.y)) {
        run({ type: 'patch', collection: 'edges', id: ve.id, patch: { bendpoints: ve.bendpoints.map((b, i) => (i === index ? current : b)) } });
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }, [readOnly, rf, run, ve]);

  const removeBend = useCallback((index: number) => {
    if (readOnly) return;
    run({ type: 'patch', collection: 'edges', id: ve.id, patch: { bendpoints: ve.bendpoints.filter((_, i) => i !== index) } });
  }, [readOnly, run, ve]);

  const fieldLabel = rel && type ? type.fields.filter(f => ['text', 'select'].includes(f.kind)).map(f => rel.fields[f.key]).filter(v => typeof v === 'string' && v.trim()).join(' · ') : '';
  const label = ve.label ?? (rel?.name || fieldLabel);
  const dash = line === 'dashed' ? '8 5' : line === 'dotted' ? '2 4' : undefined;
  const ms = markerId(sh, color), mt = markerId(th, color);
  const mappings = rel?.mappings.length ? rel.mappings.map(m => `${m.fromPath} → ${m.toPath}`).join('\n') : '';
  return (
    <>
      <defs>{sh !== 'none' && <Marker id={ms} head={sh} color={color} start />}{th !== 'none' && <Marker id={mt} head={th} color={color} />}</defs>
      <BaseEdge id={p.id} path={path} style={{ stroke: color, strokeWidth: width, strokeDasharray: dash }} markerStart={sh !== 'none' ? `url(#${ms})` : undefined} markerEnd={th !== 'none' ? `url(#${mt})` : undefined} interactionWidth={14} />
      {(label || mappings || p.selected) && (
        <EdgeLabelRenderer>
          <div className={`ad-edge-label ${p.selected ? 'is-selected' : ''}`} style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }} title={mappings || undefined}>
            {label || (type?.name ?? '')}{mappings && <span className="ad-edge-label__pins">⇄</span>}
          </div>
        </EdgeLabelRenderer>
      )}
      {p.selected && !readOnly && bends.length > 0 && (
        <EdgeLabelRenderer>
          {bends.map((b, i) => (
            <div
              key={i}
              className={`ad-bend-handle nodrag nopan ${drag?.index === i ? 'is-dragging' : ''}`}
              style={{ transform: `translate(-50%,-50%) translate(${b.x}px,${b.y}px)` }}
              title="Arrastrar para mover · doble clic para quitar"
              onPointerDown={e => onHandleDown(e, i)}
              onDoubleClick={e => { e.stopPropagation(); removeBend(i); }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
});

function markerId(head: ArrowHead, color: string) { return `ad-m-${head}-${color.replace(/[^a-z0-9]/gi, '')}`; }

function Marker({ id, head, color, start }: { id: string; head: ArrowHead; color: string; start?: boolean }) {
  const o = start ? 'auto-start-reverse' : 'auto';
  const common = { id, orient: o, markerUnits: 'userSpaceOnUse' as const, markerWidth: 14, markerHeight: 14, refX: 12, refY: 7 };
  switch (head) {
    case 'arrow': return <marker {...common}><path d="M1,1 L12,7 L1,13 z" fill={color} stroke={color} /></marker>;
    case 'open': return <marker {...common}><path d="M1,1 L12,7 L1,13" fill="none" stroke={color} strokeWidth={1.5} /></marker>;
    case 'triangle': return <marker {...common}><path d="M1,1 L12,7 L1,13 z" fill="#fff" stroke={color} strokeWidth={1.5} /></marker>;
    case 'diamond': return <marker {...common} refX={13} markerWidth={16}><path d="M1,7 L7,1 L13,7 L7,13 z" fill="#fff" stroke={color} strokeWidth={1.5} /></marker>;
    case 'filled-diamond': return <marker {...common} refX={13} markerWidth={16}><path d="M1,7 L7,1 L13,7 L7,13 z" fill={color} stroke={color} /></marker>;
    case 'circle': return <marker {...common} refX={10}><circle cx="7" cy="7" r="4" fill="#fff" stroke={color} strokeWidth={1.5} /></marker>;
    case 'dot': return <marker {...common} refX={10}><circle cx="7" cy="7" r="4" fill={color} /></marker>;
    case 'half': return <marker {...common}><path d="M1,1 L12,7 L1,7" fill={color} stroke={color} /></marker>;
    default: return null;
  }
}
