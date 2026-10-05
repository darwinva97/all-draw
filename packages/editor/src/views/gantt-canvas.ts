/**
 * Integración de las vistas de Gantt en `Canvas.tsx` (`useGanttCanvas`), con el mismo patrón que `useSequenceCanvas`: el lienzo solo hace
 * llamadas condicionales. `synthetic` añade la rejilla de fondo, `decorateNode`/`decorateEdge` convierten los nodos y
 * aristas del pack `gantt` en barras y dependencias en codo, `dragStop`/`resizeEnd` traducen arrastrar y estirar una
 * barra a cambios de fechas, y `drop` da fechas y fila a lo que se suelta desde la paleta.
 */
import { useCallback, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { Command, View, ViewEdge, ViewNode } from '@all-draw/core';
import { useLang } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useCollection } from '../hooks';
import { GANTT_GRID_ID, GANTT_SCALE_ID, GANTT_SCALE_BOX, type GanttBarData, type GanttGridData, type GanttScaleData } from './GanttNodes';
import { GANTT, GANTT_GROUP, GANTT_TYPES, dayAtX, dayOf, dropFields, ganttLayout, moveCommand, resizeCommand, scaleOfView, type GanttLayout } from './gantt';

export interface GanttCanvas {
  /** La vista actual es de Gantt (por `kind` o por el `viewKind` de su pack). */
  active: boolean;
  layout: GanttLayout | null;
  /** Nodos sintéticos (la rejilla), antes que los del modelo. */
  synthetic(): Node[];
  /** Barra de la fila del nodo (posición y tamaño de las fechas; `live`: caja durante un redimensionado). */
  decorateNode(vn: ViewNode, base: Node, live?: { x?: number; w?: number }): Node;
  decorateEdge(ve: ViewEdge, base: Edge): Edge;
  /** Al soltar una barra: comando de fechas, `null` si no cambia nada, `undefined` si el nodo no es una fila. */
  dragStop(node: Node, vn: ViewNode): Command | null | undefined;
  /** Fin de un redimensionado: comando de fechas, `null` si no cambia, `undefined` si no es una tarea. */
  resizeEnd(nodeId: string, box: { x?: number; w?: number }): Command | null | undefined;
  /** Tipo soltado desde la paleta: fila (padre y orden), tamaño y campos con fechas; `undefined` para lo normal. */
  drop(typeId: string, pos: { x: number; y: number }): GanttDropAt | undefined;
}

export interface GanttDropAt { x: number; y: number; w: number; h: number; parentNodeId?: string; fields?: Record<string, unknown> }

export function isGanttView(view: View | undefined, registry: ReturnType<typeof useEditor>['registry']): boolean {
  if (!view) return false;
  return view.kind === 'gantt' || registry.pack(view.notationId)?.viewKind === 'gantt';
}

export function useGanttCanvas(view: View | undefined, versions: { nodes: unknown; edges: unknown }): GanttCanvas {
  const { store, registry, viewId } = useEditor();
  const [lang] = useLang();
  const relations = useCollection('relations');
  const elements = useCollection('elements');
  const active = isGanttView(view, registry);
  const scale = scaleOfView(view);
  const layout = useMemo(
    () => (active && viewId ? ganttLayout(store, viewId, { lang, today: dayOf(new Date().toISOString()) }) : null),
    [active, store, viewId, versions.nodes, versions.edges, relations, elements, scale, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const rowByNode = useMemo(() => new Map((layout?.rows ?? []).map(r => [r.nodeId, r] as const)), [layout]);
  const depIds = useMemo(() => new Set((layout?.deps ?? []).map(d => d.edgeId)), [layout]);

  const synthetic = useCallback((): Node[] => {
    if (!layout || !viewId) return [];
    const data: GanttGridData = { layout, viewId, scale };
    const sd: GanttScaleData = { viewId, scale };
    const b = GANTT_SCALE_BOX;
    return [
      { id: GANTT_GRID_ID, type: 'ganttGrid', position: { x: 0, y: 0 }, width: layout.width, height: layout.height, style: { width: layout.width, height: layout.height }, draggable: false, selectable: false, connectable: false, focusable: false, zIndex: -20, data },
      { id: GANTT_SCALE_ID, type: 'ganttScale', position: { x: b.x, y: b.y }, width: b.w, height: b.h, style: { width: b.w, height: b.h }, draggable: false, selectable: false, connectable: false, focusable: false, zIndex: 5, data: sd },
    ];
  }, [layout, viewId, scale]);

  const decorateNode = useCallback((vn: ViewNode, base: Node, live?: { x?: number; w?: number }): Node => {
    const row = rowByNode.get(vn.id);
    if (!row || !layout) return base;
    const x = live?.x ?? row.bar.x, w = live?.w ?? row.bar.w;
    const prev = base.data as { remoteColor?: string; dimmed?: boolean };
    const data: GanttBarData = { row, px: layout.px, fill: vn.style.fill, stroke: vn.style.stroke, text: vn.style.text, remoteColor: prev.remoteColor, dimmed: prev.dimmed };
    return {
      ...base, type: 'ganttBar', position: { x, y: row.bar.y }, width: w, height: row.bar.h, style: { width: w, height: row.bar.h },
      parentId: undefined, extent: [[-Infinity, row.bar.y], [Infinity, row.bar.y + row.bar.h]], zIndex: 2, data,
    };
  }, [rowByNode, layout]);

  const decorateEdge = useCallback((ve: ViewEdge, base: Edge): Edge => {
    if (!depIds.has(ve.id)) return base;
    return { ...base, type: 'ganttDep', sourceHandle: '', targetHandle: '', data: { edge: ve } };
  }, [depIds]);

  const dragStop = useCallback((node: Node, vn: ViewNode): Command | null | undefined => {
    const row = rowByNode.get(vn.id);
    if (!row || !layout) return undefined;
    const day = row.kind === 'milestone' ? dayAtX(layout, node.position.x + row.bar.w / 2) : dayAtX(layout, node.position.x);
    return moveCommand(store, layout, row, day - row.start);
  }, [rowByNode, layout, store]);

  const resizeEnd = useCallback((nodeId: string, box: { x?: number; w?: number }): Command | null | undefined => {
    const row = rowByNode.get(nodeId);
    if (!row || !layout || row.kind !== 'task') return undefined;
    return resizeCommand(store, layout, row, { x: box.x ?? row.bar.x, w: box.w ?? row.bar.w });
  }, [rowByNode, layout, store]);

  const drop = useCallback((typeId: string, pos: { x: number; y: number }): GanttDropAt | undefined => {
    if (!layout || !viewId || !GANTT_TYPES.has(typeId)) return undefined;
    // Fila bajo el puntero: soltar sobre una fase mete dentro (al final); sobre otra fila, justo detrás de ella.
    const idx = Math.floor((pos.y - GANTT.headerH) / GANTT.rowH);
    const at = layout.rows[idx];
    const nodeOf = (id: string) => store.get('nodes', id);
    let parentNodeId: string | undefined, y: number;
    const siblingsY = (parent: string | undefined) => store.list('nodes').filter(n => n.viewId === viewId && (n.parentNodeId ?? undefined) === parent).map(n => n.y);
    if (at && store.get('elements', at.elementId)?.typeId === GANTT_GROUP) { parentNodeId = at.nodeId; y = Math.max(0, ...siblingsY(parentNodeId)) + 40; }
    else if (at) { const n = nodeOf(at.nodeId)!; parentNodeId = n.parentNodeId; y = n.y + 1; }
    else y = Math.max(0, ...siblingsY(undefined)) + 40;
    return { x: parentNodeId ? 16 : 0, y, w: 200, h: 40, parentNodeId, fields: dropFields(layout, typeId, pos.x) };
  }, [layout, viewId, store]);

  return useMemo(() => ({ active, layout, synthetic, decorateNode, decorateEdge, dragStop, resizeEnd, drop }), [active, layout, synthetic, decorateNode, decorateEdge, dragStop, resizeEnd, drop]);
}
