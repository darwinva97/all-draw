/**
 * Integración de las vistas de secuencia en `Canvas.tsx`, encapsulada para que el lienzo solo haga
 * llamadas condicionales: `decorateNode`/`decorateEdge` transforman los nodos y aristas React Flow
 * ya construidos, y `dragStop`/`connect`/`drop` interceptan las interacciones cuando toca.
 */
import { useCallback, useMemo } from 'react';
import type { Node, Edge, FinalConnectionState } from '@xyflow/react';
import { makeRelation, makeEdge, type Command, type ViewEdge, type ViewNode, type View } from '@all-draw/core';
import { useEditor } from '../context';
import { useCollection } from '../hooks';
import { LIFELINE_DRAG_HANDLE } from './SequenceNodes';
import {
  sequenceLayout, isLifelineNode, isActivationNode, isFragmentNode, lifelineOf, lifelineIndexAt, lifelineAtX, reorderLifeline,
  nextOrder, nextLifelineX, activationX, messageText,
  SEQ_LIFELINE, SEQ_ACTIVATION, SEQ_MESSAGE, SEQ_ACTIVATION_W, SEQ_HEADER_H, SEQ_LIFELINE_W, type SequenceLayout,
} from './sequence';

export interface SequenceCanvas {
  /** La vista actual es de secuencia (por `kind` o por el `viewKind` de su pack). */
  active: boolean;
  layout: SequenceLayout | null;
  /** Reemplaza tipo, posición y tamaño del nodo React Flow según su papel (línea de vida, activación, fragmento). */
  decorateNode(vn: ViewNode, base: Node): Node;
  /** Convierte en `sequenceMessage` las aristas entre líneas de vida; las demás quedan como están. */
  decorateEdge(ve: ViewEdge, base: Edge): Edge;
  /** Al soltar un nodo: comando propio, `null` si no hay que hacer nada, `undefined` para el comportamiento normal. */
  dragStop(node: Node, vn: ViewNode): Command | null | undefined;
  /** Conexión terminada entre dos líneas de vida: crea el mensaje. Devuelve `true` si la ha gestionado. */
  connect(state: FinalConnectionState): boolean;
  /** Colocación de un tipo soltado desde la paleta: posición (y tamaño/padre), `null` para cancelar, `undefined` para lo normal. */
  drop(typeId: string, pos: { x: number; y: number }): DropAt | null | undefined;
}

export interface DropAt { x: number; y: number; w?: number; h?: number; parentNodeId?: string }

export function isSequenceView(view: View | undefined, registry: ReturnType<typeof useEditor>['registry']): boolean {
  if (!view) return false;
  return view.kind === 'sequence' || registry.pack(view.notationId)?.viewKind === 'sequence';
}

export function useSequenceCanvas(view: View | undefined, versions: { nodes: unknown; edges: unknown }): SequenceCanvas {
  const { store, registry, viewId, run, readOnly } = useEditor();
  const relations = useCollection('relations');
  const elements = useCollection('elements');
  const active = isSequenceView(view, registry);
  const layout = useMemo(
    () => (active && viewId ? sequenceLayout(store, viewId) : null),
    [active, store, viewId, versions.nodes, versions.edges, relations, elements], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const messageById = useMemo(() => new Map((layout?.messages ?? []).map(m => [m.edgeId, m])), [layout]);

  const decorateNode = useCallback((vn: ViewNode, base: Node): Node => {
    if (!layout) return base;
    if (isLifelineNode(store, vn)) {
      const h = layout.height;
      return {
        ...base, type: 'lifeline', position: { x: base.position.x, y: 0 }, width: vn.w, height: h, style: { width: vn.w, height: h },
        parentId: undefined, extent: [[-Infinity, 0], [Infinity, h]], dragHandle: LIFELINE_DRAG_HANDLE, zIndex: 0,
        data: { node: vn, height: h, remoteColor: (base.data as { remoteColor?: string }).remoteColor },
      };
    }
    if (isActivationNode(store, vn)) {
      const parent = vn.parentNodeId ? store.get('nodes', vn.parentNodeId) : undefined;
      const x = parent && isLifelineNode(store, parent) ? activationX(parent.w) : base.position.x;
      return { ...base, type: 'activation', position: { x, y: base.position.y }, width: SEQ_ACTIVATION_W, style: { width: SEQ_ACTIVATION_W, height: base.height }, zIndex: 1 };
    }
    if (isFragmentNode(store, vn)) return { ...base, type: 'fragment', zIndex: -1 };
    return base;
  }, [layout, store]);

  const decorateEdge = useCallback((ve: ViewEdge, base: Edge): Edge => {
    const m = messageById.get(ve.id);
    if (!m) return base;
    return { ...base, type: 'sequenceMessage', sourceHandle: '', targetHandle: '', data: { edge: ve, y: m.y, kind: m.kind, order: m.order, text: messageText(store, ve), self: m.self } };
  }, [messageById, store]);

  const dragStop = useCallback((node: Node, vn: ViewNode): Command | null | undefined => {
    if (!layout || !viewId) return undefined;
    if (isLifelineNode(store, vn)) {
      const x = Math.round(node.position.x);
      const idx = lifelineIndexAt(layout, x + vn.w / 2, vn.id);
      const cur = layout.lifelines.findIndex(l => l.nodeId === vn.id);
      if (idx !== cur) return reorderLifeline(store, viewId, vn.id, idx);
      return x !== vn.x || vn.y !== 0 ? { type: 'moveNodes', moves: [{ id: vn.id, x, y: 0 }] } : null;
    }
    if (isActivationNode(store, vn)) {
      const parent = vn.parentNodeId ? store.get('nodes', vn.parentNodeId) : undefined;
      const x = parent && isLifelineNode(store, parent) ? activationX(parent.w) : Math.round(node.position.x);
      const y = Math.max(SEQ_HEADER_H, Math.round(node.position.y));
      return x !== vn.x || y !== vn.y ? { type: 'moveNodes', moves: [{ id: vn.id, x, y }] } : null;
    }
    return undefined;
  }, [layout, store, viewId]);

  const connect = useCallback((state: FinalConnectionState): boolean => {
    if (!layout || !viewId || readOnly || !state.fromNode || !state.toNode) return false;
    const a = store.get('nodes', state.fromNode.id), b = store.get('nodes', state.toNode.id);
    if (!a?.elementId || !b?.elementId || !lifelineOf(store, a.id) || !lifelineOf(store, b.id)) return false;
    const y = Math.max(SEQ_HEADER_H + 8, Math.round(state.to?.y ?? layout.height));
    const rel = makeRelation(SEQ_MESSAGE, { elementId: a.elementId }, { elementId: b.elementId }, { fields: { kind: 'sync', order: nextOrder(store, viewId), text: '' } });
    run({ type: 'connect', relation: rel, edge: makeEdge(viewId, undefined, a.id, b.id, { bendpoints: [{ x: 0, y }] }) });
    return true;
  }, [layout, viewId, readOnly, store, run]);

  const drop = useCallback((typeId: string, pos: { x: number; y: number }): DropAt | null | undefined => {
    if (!layout || !viewId) return undefined;
    if (typeId === SEQ_LIFELINE) return { x: nextLifelineX(store, viewId), y: 0, w: SEQ_LIFELINE_W, h: SEQ_HEADER_H };
    if (typeId === SEQ_ACTIVATION) {
      const l = lifelineAtX(layout, pos.x);
      if (!l) return null;
      return { x: activationX(l.w), y: Math.max(SEQ_HEADER_H, Math.round(pos.y)), w: SEQ_ACTIVATION_W, h: 80, parentNodeId: l.nodeId };
    }
    return undefined;
  }, [layout, store, viewId]);

  return useMemo(() => ({ active, layout, decorateNode, decorateEdge, dragStop, connect, drop }), [active, layout, decorateNode, decorateEdge, dragStop, connect, drop]);
}
