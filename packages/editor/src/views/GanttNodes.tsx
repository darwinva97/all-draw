/**
 * Nodos y arista React Flow de las vistas de Gantt: la rejilla de fondo (cabecera de la escala, filas, columna de
 * nombres, fines de semana, hoy y el selector de escala), la barra de cada fila (tarea, hito o fase) y la dependencia
 * en codo. La geometría sale de `gantt.ts`; aquí solo se pinta. Los colores usan las variables del tema del editor.
 */
import { memo, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, Handle, NodeResizeControl, Position, ResizeControlVariant, useInternalNode, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import type { ViewEdge } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useRecord } from '../hooks';
import { darken, readable } from '../nodes/shapes';
import { GANTT, dependencyKind, elbowRoute, type GanttLayout, type GanttRow, type GanttScale } from './gantt';

export type GanttGridData = { layout: GanttLayout; viewId: string; scale?: GanttScale };
export type GanttGridRFNode = Node<GanttGridData, 'ganttGrid'>;
export type GanttScaleData = { viewId: string; scale?: GanttScale };
export type GanttScaleRFNode = Node<GanttScaleData, 'ganttScale'>;
export type GanttBarData = { row: GanttRow; px: number; fill?: string; stroke?: string; text?: string; remoteColor?: string; dimmed?: boolean };
export type GanttBarRFNode = Node<GanttBarData, 'ganttBar'>;
export type GanttDepData = { edge: ViewEdge };
export type GanttDepRFEdge = Edge<GanttDepData, 'ganttDep'>;

/** Texto solo para lectores de pantalla. */
const SR_ONLY: CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** Ids de los nodos sintéticos (prefijo `hdr:`: el lienzo no los cuenta como contenido ni como destino). */
export const GANTT_GRID_ID = 'hdr:gantt';
export const GANTT_SCALE_ID = 'hdr:gantt-scale';
/** Caja del selector de escala, en la esquina de la columna de nombres. */
export const GANTT_SCALE_BOX = { x: 8, y: (GANTT.headerH - 26) / 2, w: 204, h: 26 } as const;

const SCALES: { id: GanttScale | undefined; label: string }[] = [
  { id: undefined, label: 'Auto' }, { id: 'day', label: 'Días' }, { id: 'week', label: 'Semanas' }, { id: 'month', label: 'Meses' },
];

/**
 * Rejilla de fondo: cabecera, filas, nombres (sangrados por anidamiento), fines de semana y hoy. Va detrás del panel de
 * React Flow (`zIndex` negativo): arrastrar sobre ella mueve el lienzo o selecciona, como sobre el fondo.
 */
export const GanttGridNode = memo(function GanttGridNode({ data }: NodeProps<GanttGridRFNode>) {
  const l = data.layout;
  const { headerH, labelW, rowH } = GANTT;
  const W = l.width, H = l.height, mid = headerH / 2;
  const muted = { fill: 'var(--ad-muted)' } as const;
  const line = { stroke: 'var(--ad-border)', strokeWidth: 1 } as const;
  const maxChars = (x: number) => Math.max(3, Math.floor((labelW - x - 8) / 7));
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
  return (
    <div className="ad-gantt-grid" style={{ width: W, height: H, position: 'relative', fontSize: 12, color: 'var(--ad-text)' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="var(--ad-panel)" {...line} />
        {l.weekends.map((w, i) => <rect key={`we${i}`} x={w.x} y={headerH} width={w.w} height={H - headerH} fill="var(--ad-bg)" />)}
        {l.rows.map(r => (r.index % 2 ? <rect key={`st${r.index}`} x={labelW} y={headerH + r.index * rowH} width={W - labelW} height={rowH} fill="var(--ad-text)" opacity={0.025} /> : null))}
        {l.minors.map((m, i) => <line key={`gl${i}`} x1={m.x} y1={mid} x2={m.x} y2={H} {...line} opacity={0.7} />)}
        {l.majors.map((m, i) => <line key={`gm${i}`} x1={m.x} y1={0} x2={m.x} y2={H} {...line} />)}
        <rect x={0.5} y={0.5} width={W - 1} height={headerH} fill="var(--ad-bg)" {...line} />
        <line x1={labelW} y1={mid} x2={W} y2={mid} {...line} />
        {l.majors.map((m, i) => <g key={`mj${i}`}><line x1={m.x} y1={0} x2={m.x} y2={headerH} {...line} /><text x={m.x + 6} y={mid / 2 + 4} fontWeight={600} fill="var(--ad-text)">{m.label}</text></g>)}
        {l.minors.map((m, i) => (m.w >= 18 ? <text key={`mn${i}`} x={m.x + m.w / 2} y={mid + mid / 2 + 4} textAnchor="middle" fontSize={11} {...muted}>{m.label}</text> : null))}
        <rect x={0.5} y={0.5} width={labelW} height={H - 1} fill="var(--ad-panel)" {...line} />
        <line x1={0} y1={headerH} x2={W} y2={headerH} {...line} />
        {l.rows.map(r => {
          const x = 12 + r.depth * 14, y = headerH + r.index * rowH + rowH / 2 + 4;
          const mark = r.kind === 'group' ? '▾ ' : r.kind === 'milestone' ? '◆ ' : '';
          return <g key={`nm${r.index}`}><line x1={0} y1={headerH + (r.index + 1) * rowH} x2={labelW} y2={headerH + (r.index + 1) * rowH} {...line} opacity={0.6} /><text x={x} y={y} fontWeight={r.kind === 'group' ? 600 : 400} fill="var(--ad-text)"><title>{r.name}</title>{clip(`${mark}${r.name}`, maxChars(x))}</text></g>;
        })}
        {l.todayX !== undefined && <line x1={l.todayX} y1={headerH} x2={l.todayX} y2={H} stroke="var(--ad-accent)" strokeWidth={1.5} strokeDasharray="4 3" />}
      </svg>
    </div>
  );
});

/**
 * Selector de escala (automática, días, semanas, meses): nodo propio encima del panel para que reciba los clics (React Flow
 * quita los eventos a los nodos que no se seleccionan ni se arrastran: el selector los vuelve a activar).
 */
export const GanttScaleNode = memo(function GanttScaleNode({ data }: NodeProps<GanttScaleRFNode>) {
  const { run, readOnly } = useEditor();
  const t = useT();
  const setScale = (s: GanttScale | undefined) => { if (!readOnly) run({ type: 'patch', collection: 'views', id: data.viewId, patch: { style: { ganttScale: s } } }); };
  return (
    <div className="ad-gantt-scale nodrag nopan" role="group" aria-label={t('Escala')} style={{ pointerEvents: 'all', width: '100%', height: '100%', boxSizing: 'border-box', display: 'flex', gap: 2, padding: 2, borderRadius: 6, background: 'var(--ad-panel)', border: '1px solid var(--ad-border)', fontSize: 12 }}>
      {SCALES.map(s => {
        const on = s.id === data.scale;
        return (
          <button key={s.label} type="button" aria-pressed={on} disabled={readOnly} onClick={() => setScale(s.id)}
            style={{ flex: 1, font: 'inherit', fontSize: 11, lineHeight: '18px', padding: '1px 4px', border: 'none', borderRadius: 4, cursor: readOnly ? 'default' : 'pointer', background: on ? 'var(--ad-accent)' : 'transparent', color: on ? '#fff' : 'var(--ad-text)' }}>
            {t(s.label)}
          </button>
        );
      })}
    </div>
  );
});

/** Barra de una fila: tarea (con progreso; roja si es crítica), hito (rombo) o fase (barra resumen con remates). */
export const GanttBarNode = memo(function GanttBarNode({ data, selected, width }: NodeProps<GanttBarRFNode>) {
  const { readOnly, effectiveTheme } = useEditor();
  const t = useT();
  const { row, px } = data;
  const dark = effectiveTheme === 'dark';
  const ring: CSSProperties = selected ? { outline: '2px solid var(--ad-accent)', outlineOffset: 2 } : data.remoteColor ? { outline: `2px solid ${data.remoteColor}`, outlineOffset: 2 } : {};
  // Manejadores de conexión un poco fuera de la barra: los bordes quedan libres para estirarla.
  const handles = <><Handle type="target" position={Position.Left} id="" className="ad-handle" style={{ left: -9 }} /><Handle type="source" position={Position.Right} id="" className="ad-handle" style={{ right: -9 }} /></>;
  const opacity = data.dimmed ? 0.45 : undefined;
  const title = `${row.name}${row.assignee ? ` · ${row.assignee}` : ''}`;
  if (row.kind === 'milestone') {
    const ink = data.fill && !/^#0{3,6}$/i.test(data.fill) ? data.fill : dark ? '#e6e8ec' : '#1b1f24';
    return (
      <div className="ad-gantt-bar ad-gantt-bar--milestone" title={title} style={{ width: '100%', height: '100%', position: 'relative', opacity }}>
        <div style={{ position: 'absolute', inset: 2, transform: 'rotate(45deg)', background: ink, borderRadius: 2, ...ring }} />
        {handles}
      </div>
    );
  }
  if (row.kind === 'group') {
    const ink = dark ? '#cbd5e1' : '#334155';
    return (
      <div className="ad-gantt-bar ad-gantt-bar--group" title={title} style={{ width: '100%', height: '100%', position: 'relative', opacity, ...ring }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <rect x={0} y={0} width="100%" height={GANTT.groupH * 0.6} fill={ink} />
          <path d={`M0,0 L7,0 L0,${GANTT.groupH} Z`} fill={ink} />
          <path d={`M${width ?? 0},0 L${(width ?? 0) - 7},0 L${width ?? 0},${GANTT.groupH} Z`} fill={ink} />
        </svg>
        {handles}
      </div>
    );
  }
  const fill = row.critical && !data.fill ? '#F8CECC' : data.fill ?? '#DAE8FC';
  const stroke = data.stroke ?? (row.critical ? '#B85450' : darken(fill, 0.35));
  const done = row.critical ? '#E06666' : darken(fill, 0.22);
  const text = data.text ?? readable(fill);
  const w = width ?? row.bar.w;
  return (
    <div className="ad-gantt-bar ad-gantt-bar--task" title={title} style={{ width: '100%', height: '100%', position: 'relative', boxSizing: 'border-box', background: fill, border: `1px solid ${stroke}`, borderRadius: 4, color: text, opacity, ...ring }}>
      {row.progress > 0 && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${row.progress}%`, background: done, borderRadius: row.progress >= 100 ? 3 : '3px 0 0 3px' }} />}
      {row.progress > 0 && w >= 40 && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: readable(row.progress >= 50 ? done : fill) }}>{Math.round(row.progress)}%</span>}
      {row.assignee && <span style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 16, whiteSpace: 'nowrap', fontSize: 11, color: 'var(--ad-muted)', pointerEvents: 'none' }}>{row.assignee}</span>}
      {!readOnly && selected && <>
        <NodeResizeControl position="right" variant={ResizeControlVariant.Line} minWidth={px} minHeight={row.bar.h} maxHeight={row.bar.h} style={{ borderColor: 'var(--ad-accent)', borderWidth: 3 }}><span style={SR_ONLY}>{t('Cambiar la duración')}</span></NodeResizeControl>
        <NodeResizeControl position="left" variant={ResizeControlVariant.Line} minWidth={px} minHeight={row.bar.h} maxHeight={row.bar.h} style={{ borderColor: 'var(--ad-accent)', borderWidth: 3 }}><span style={SR_ONLY}>{t('Cambiar el inicio')}</span></NodeResizeControl>
      </>}
      {handles}
    </div>
  );
});

const HEAD = 7;
/** Dependencia en codo entre los extremos que fija su tipo (FS, SS, FF, SF); sigue a las barras mientras se arrastran. */
export const GanttDependencyEdge = memo(function GanttDependencyEdge(p: EdgeProps<GanttDepRFEdge>) {
  const { effectiveTheme } = useEditor();
  const ve = p.data!.edge;
  const rel = useRecord('relations', ve.relationId);
  const sn = useInternalNode(p.source), tn = useInternalNode(p.target);
  if (!sn || !tn) return null;
  const kind = dependencyKind(rel?.fields['kind']);
  const lag = Number(rel?.fields['lag'] ?? 0) || 0;
  const box = (n: NonNullable<typeof sn>) => ({ x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w: n.measured.width ?? n.width ?? 0, h: n.measured.height ?? n.height ?? 0 });
  const a = box(sn), b = box(tn);
  const fromEnd = kind === 'FS' || kind === 'FF', toEnd = kind === 'FF' || kind === 'SF';
  const pa = { x: fromEnd ? a.x + a.w : a.x, y: a.y + a.h / 2 }, pb = { x: toEnd ? b.x + b.w : b.x, y: b.y + b.h / 2 };
  const dir: 1 | -1 = toEnd ? -1 : 1;
  const pts = elbowRoute(pa, fromEnd ? 1 : -1, pb, dir);
  const end = pts[pts.length - 1]!;
  const tip = { x: end.x, y: end.y };
  const body = [...pts.slice(0, -1), { x: end.x - dir * HEAD, y: end.y }];
  const path = body.map((q, i) => `${i ? 'L' : 'M'}${q.x},${q.y}`).join(' ');
  const color = ve.style.color ?? (p.selected ? 'var(--ad-accent)' : effectiveTheme === 'dark' ? '#9aa3b2' : '#555');
  const label = kind !== 'FS' || lag ? `${kind}${lag ? `${lag > 0 ? '+' : ''}${lag}d` : ''}` : '';
  const lp = pts.length > 2 ? pts[pts.length - 2]! : pa;
  return (
    <>
      <BaseEdge id={p.id} path={path} style={{ stroke: color, strokeWidth: p.selected ? 2 : 1.4 }} interactionWidth={14} />
      <path d={`M${tip.x - dir * HEAD},${tip.y - 4.5} L${tip.x},${tip.y} L${tip.x - dir * HEAD},${tip.y + 4.5} Z`} fill={color} stroke={color} strokeLinejoin="round" />
      {label && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan" style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${lp.x}px,${(lp.y + tip.y) / 2}px)`, fontSize: 10, padding: '0 4px', borderRadius: 3, background: 'var(--ad-panel)', border: '1px solid var(--ad-border)', color: 'var(--ad-muted)', pointerEvents: 'all' }}>{label}</div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
