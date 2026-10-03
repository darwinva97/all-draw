import { memo, useState, useCallback, useMemo, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useInternalNode, useReactFlow, useStoreApi, type EdgeProps, type Edge, type InternalNode } from '@xyflow/react';
import { labelSize, pathStops, placeLabel, rectAround, type Rect } from './label-place';
import { floatingEndpoints } from './floating';
import { bendPath, type Pt } from './bendpath';
import { cardEnds, endDirection, endLabel, END_KEYS, type EndLabel, type Side } from './cardinality';
import { resolveRelationStyle, type ArrowHead, type RuleStyle, type ViewEdge } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord, useCollection } from '../hooks';
import { useT } from '@all-draw/i18n';
import { Icon } from '../icons';

export type RelationEdgeData = { edge: ViewEdge };
export type RelationRFEdge = Edge<RelationEdgeData, 'relation'>;

export const RelationEdge = memo(function RelationEdge(p: EdgeProps<RelationRFEdge>) {
  const { registry, run, readOnly, store, viewId, effectiveTheme } = useEditor();
  const t = useT();
  const rf = useReactFlow();
  const ve = p.data!.edge;
  const rel = useRecord('relations', ve.relationId);
  const type = rel ? registry.relationType(rel.typeId) : undefined;
  // Reglas con destino "relación": la lista de reglas cambia de identidad al editarlas.
  const rules = useCollection('rules');
  const rule: RuleStyle = useMemo(() => (rel ? resolveRelationStyle(store, registry, rel, viewId ?? undefined).style : {}), [store, registry, rel, viewId, rules]);
  const line = rule.borderStyle ?? ve.style.line ?? type?.line ?? 'solid';
  const color = rule.border ?? rule.bg ?? ve.style.color ?? type?.color ?? (effectiveTheme === 'dark' ? '#9aa3b2' : '#444');
  const width = rule.borderWidth ?? ve.style.width ?? 1.5;
  // Cardinalidades: un campo select `sourceCard`/`targetCard` (ER) sustituye la cabeza del tipo; uno de texto (UML) se rotula.
  const ends = useMemo(() => cardEnds(rel?.fields, type?.fields), [rel?.fields, type?.fields]);
  const sh = ve.style.sourceHead ?? ends.sourceHead ?? type?.sourceHead ?? 'none';
  const th = ve.style.targetHead ?? ends.targetHead ?? type?.targetHead ?? 'arrow';
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

  const fieldLabel = rel && type ? type.fields.filter(f => ['text', 'select'].includes(f.kind) && !END_KEYS.has(f.key)).map(f => rel.fields[f.key]).filter(v => typeof v === 'string' && v.trim()).join(' · ') : '';
  const label = ve.label ?? (rel?.name || fieldLabel);
  // Etiqueta en el recorrido, sin tapar nodos ni otras etiquetas (las de aristas con id menor ya están colocadas).
  const storeApi = useStoreApi();
  // `useStoreApi` da un objeto por componente; `getState` es el mismo para todo el lienzo.
  const boxes = labelBoxesOf(storeApi.getState);
  const lowerSeen = useRef(0);
  const myBox = useRef<Rect | null>(null);
  const [, recheck] = useState(0);
  const showLabel = !!(label || mappings0(rel) || p.selected || rule.badge || rule.icon);
  if (showLabel) {
    const stops = pathStops(path);
    if (stops) {
      const size = labelSize(`${label || (type?.name ?? '')}${rel?.mappings.length ? '  ' : ''}${rule.icon ? '  ' : ''}`);
      const lookup = storeApi.getState().nodeLookup;
      const lower: Rect[] = [];
      for (const [id, r] of boxes) if (id < p.id) lower.push(r);
      lowerSeen.current = lower.length;
      const at = placeLabel(stops, size, lookup.size <= LABEL_AVOID_MAX_NODES ? obstacles(lookup, p.source, p.target) : [], lower);
      lx = at.x; ly = at.y;
      myBox.current = rectAround(at, size);
      boxes.set(p.id, myBox.current);
    }
  } else { myBox.current = null; boxes.delete(p.id); }
  useEffect(() => { if (myBox.current) boxes.set(p.id, myBox.current); return () => { boxes.delete(p.id); }; }, [boxes, p.id]);
  // Al montar todas a la vez, una con id menor puede colocarse después: se recoloca una vez.
  useEffect(() => { let n = 0; for (const id of boxes.keys()) if (id < p.id) n++; if (n !== lowerSeen.current) recheck(x => x + 1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dash = line === 'dashed' ? '8 5' : line === 'dotted' ? '2 4' : undefined;
  const ms = markerId(sh, color, true), mt = markerId(th, color, false);
  const mappings = rel?.mappings.length ? rel.mappings.map(m => `${m.fromPath} → ${m.toPath}`).join('\n') : '';
  const labelStyle: React.CSSProperties = { transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` };
  if (rule.bg) labelStyle.background = rule.bg;
  if (rule.text) labelStyle.color = rule.text;
  if (rule.border) labelStyle.borderColor = rule.border;
  if (rule.bold) labelStyle.fontWeight = 700;
  if (rule.strike) labelStyle.textDecoration = 'line-through';
  const glow = rule.glow ? `drop-shadow(0 0 4px ${rule.glow})` : undefined;
  const endTexts: (EndLabel & { key: string; text: string; cls: string })[] = [];
  if (ends.sourceCard || ends.targetCard || ends.sourceRole || ends.targetRole) {
    const S = { x: args.sourceX, y: args.sourceY }, T = { x: args.targetX, y: args.targetY };
    const us = endDirection(S, args.sourcePosition as Side, first ?? T, router, bends.length > 0);
    const ut = endDirection(T, args.targetPosition as Side, last ?? S, router, bends.length > 0);
    const push = (key: string, text: string | undefined, p: Pt, u: Pt, side: 1 | -1) => { if (text) endTexts.push({ key, text, ...endLabel(p, u, side), cls: side === 1 ? 'ad-card-label' : 'ad-card-label ad-card-label--role' }); };
    push('sc', ends.sourceCard, S, us, 1); push('sr', ends.sourceRole, S, us, -1);
    push('tc', ends.targetCard, T, ut, 1); push('tr', ends.targetRole, T, ut, -1);
  }
  return (
    <>
      <defs>{sh !== 'none' && <Marker id={ms} head={sh} color={color} start />}{th !== 'none' && <Marker id={mt} head={th} color={color} />}</defs>
      <BaseEdge id={p.id} path={path} style={{ stroke: color, strokeWidth: width, strokeDasharray: dash, opacity: rule.opacity, filter: glow }} markerStart={sh !== 'none' ? `url(#${ms})` : undefined} markerEnd={th !== 'none' ? `url(#${mt})` : undefined} interactionWidth={14} />
      {endTexts.map(l => <text key={l.key} className={l.cls} x={l.x} y={l.y} textAnchor={l.anchor} dominantBaseline="central" style={{ opacity: rule.opacity }}>{l.text}</text>)}
      {(label || mappings || p.selected || rule.badge || rule.icon) && (
        <EdgeLabelRenderer>
          <div className={`ad-edge-label ${p.selected ? 'is-selected' : ''}`} style={labelStyle} title={mappings || undefined}>
            {rule.icon && <span className="ad-edge-label__icon">{rule.icon}</span>}
            {label || (type?.name ?? '')}{mappings && <span className="ad-edge-label__pins"><Icon name="swap" size={11} /></span>}
            {rule.badge && <span className="ad-node__badge" style={{ background: rule.badge }}>{rule.badgeText}</span>}
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
              title={t('Arrastrar para mover · doble clic para quitar')}
              onPointerDown={e => onHandleDown(e, i)}
              onDoubleClick={e => { e.stopPropagation(); removeBend(i); }}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
});

/** A partir de tantos nodos, la etiqueta no esquiva nodos (sería recorrerlos todos en cada arista): va en el punto medio. */
const LABEL_AVOID_MAX_NODES = 400;
const mappings0 = (rel: { mappings: unknown[] } | undefined) => !!rel?.mappings.length;
/** Cajas de las etiquetas colocadas, por lienzo (almacén de React Flow) y arista. */
const LABEL_BOXES = new WeakMap<object, Map<string, Rect>>();
function labelBoxesOf(key: object): Map<string, Rect> {
  let m = LABEL_BOXES.get(key); if (!m) { m = new Map(); LABEL_BOXES.set(key, m); }
  return m;
}
/**
 * Cajas de los nodos que una etiqueta no debe tapar: todos menos los que contienen a los extremos de la arista (la
 * etiqueta de una arista dentro de una pool o de un estado compuesto va dentro de él), grupos, celdas y cabeceras.
 */
function obstacles(lookup: Map<string, InternalNode>, source: string, target: string): Rect[] {
  const skip = new Set<string>();
  for (const end of [source, target]) { let cur = lookup.get(end)?.parentId, guard = 0; while (cur && guard++ < 50) { skip.add(cur); cur = lookup.get(cur)?.parentId; } }
  const out: Rect[] = [];
  for (const n of lookup.values()) {
    if (n.hidden || skip.has(n.id) || (n.type !== 'element' && n.type !== 'visual')) continue;
    const d = n.data as { node?: { visualType?: string } };
    if (d.node?.visualType && d.node.visualType !== 'core:note' && d.node.visualType !== 'core:label' && d.node.visualType !== 'core:image') continue;
    const a = n.internals.positionAbsolute;
    out.push({ x: a.x, y: a.y, w: n.measured.width ?? n.width ?? 0, h: n.measured.height ?? n.height ?? 0 });
  }
  return out;
}

/** Id del marcador. El de origen lleva `-s`: su `orient` (`auto-start-reverse`) difiere del de destino y los ids son globales en el documento. */
function markerId(head: ArrowHead, color: string, start: boolean) { return `ad-m-${head}-${color.replace(/[^a-z0-9]/gi, '')}${start ? '-s' : ''}`; }

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
    default: {
      const ie = IE_MARKERS[head];
      if (!ie) return null;
      return (
        <marker id={id} orient={o} markerUnits="userSpaceOnUse" markerWidth={IE_W} markerHeight={IE_H} refX={IE_REF} refY={IE_H / 2}>
          <path d={ie.path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
          {ie.circle !== undefined && <circle className="ad-card-hollow" cx={ie.circle} cy={IE_H / 2} r={4} fill="#fff" stroke={color} strokeWidth={1.5} />}
        </marker>
      );
    }
  }
}

/**
 * Pata de gallo (Information Engineering). Coordenadas del marcador: el borde del nodo está en
 * x = IE_REF y la arista llega desde x = 0. Pata: 12 px de largo y ±6 px de abertura; barras a 8 y
 * 14 px del borde; círculo (hueco, tapa la línea) más alejado. Mismos trazos en `io/src/svg.ts`.
 */
const IE_W = 24, IE_H = 16, IE_REF = 22;
const FOOT = 'M10,8 L22,2 M10,8 L22,14 M10,8 L22,8';
const bar = (x: number) => `M${x},2 L${x},14`;
const IE_MARKERS: Partial<Record<ArrowHead, { path: string; circle?: number }>> = {
  'one': { path: bar(14) },
  'only-one': { path: `${bar(16)} ${bar(11)}` },
  'zero-or-one': { path: bar(16), circle: 8 },
  'many': { path: FOOT },
  'one-or-many': { path: `${FOOT} ${bar(6)}` },
  'zero-or-many': { path: FOOT, circle: 5.5 },
};
