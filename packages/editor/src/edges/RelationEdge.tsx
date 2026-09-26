import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useInternalNode, type EdgeProps, type Edge } from '@xyflow/react';
import { floatingEndpoints } from './floating';
import type { ArrowHead, ViewEdge } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord } from '../hooks';

export type RelationEdgeData = { edge: ViewEdge };
export type RelationRFEdge = Edge<RelationEdgeData, 'relation'>;

export const RelationEdge = memo(function RelationEdge(p: EdgeProps<RelationRFEdge>) {
  const { registry } = useEditor();
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
  const args = floating ? floatingEndpoints(sn, tn) : { sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY, sourcePosition: p.sourcePosition, targetPosition: p.targetPosition };
  const [path, lx, ly] = router === 'straight' ? getStraightPath(args) : router === 'bezier' ? getBezierPath(args) : getSmoothStepPath({ ...args, borderRadius: 6 });
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
