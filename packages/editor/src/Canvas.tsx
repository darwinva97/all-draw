import { useCallback, useMemo, useState, useRef, type DragEvent, type MouseEvent } from 'react';
type DragEv = globalThis.MouseEvent | globalThis.TouchEvent;
import {
  ReactFlow, Background, Controls, MiniMap, useReactFlow, ReactFlowProvider,
  type Node, type Edge, type NodeChange, type Connection, type IsValidConnection, type OnConnectEnd, type FinalConnectionState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  makeElement, makeNode, makeRelation, makeEdge, allPorts, compatibleRelationTypes, type ViewNode, type Command, type Element,
} from '@all-draw/core';
import { useEditor } from './context';
import { useCollection, useRecord } from './hooks';
import { ElementNode } from './nodes/ElementNode';
import { VisualNode } from './nodes/VisualNode';
import { RelationEdge } from './edges/RelationEdge';
import { NodeMenu } from './panels/NodeMenu';
import { cellRects, normalizeGrid, cellKey } from '@all-draw/notation-grid';

export const CELL_PREFIX = 'cell:';
const isCellId = (id: string | undefined | null) => !!id && id.startsWith(CELL_PREFIX);

const nodeTypes = { element: ElementNode, visual: VisualNode };
const edgeTypes = { relation: RelationEdge };

export const DND_TYPE = 'application/x-all-draw-type';
export const DND_TEMPLATE = 'application/x-all-draw-template';
export const DND_ELEMENT = 'application/x-all-draw-element';

export function Canvas() {
  return <ReactFlowProvider><CanvasInner /></ReactFlowProvider>;
}

interface Picker { x: number; y: number; options: string[]; onPick: (typeId: string) => void }

function CanvasInner() {
  const ed = useEditor();
  const { store, registry, viewId, run, selection, select, readOnly } = ed;
  const view = useRecord('views', viewId);
  const allNodes = useCollection('nodes');
  const allEdges = useCollection('edges');
  const elementsVersion = useCollection('elements');
  const rf = useReactFlow();
  const [picker, setPicker] = useState<Picker | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const dragStart = useRef<Map<string, { x: number; y: number }>>(new Map());

  // ---------------------------------------------------------------- modelo → React Flow
  const rfNodes = useMemo<Node[]>(() => {
    if (!viewId) return [];
    const mine = allNodes.filter(n => n.viewId === viewId);
    const byId = new Map(mine.map(n => [n.id, n]));
    // Padres antes que hijos (React Flow lo exige)
    const ordered: ViewNode[] = [];
    const seen = new Set<string>();
    const visit = (n: ViewNode) => { if (seen.has(n.id)) return; if (n.parentNodeId && byId.has(n.parentNodeId)) visit(byId.get(n.parentNodeId)!); seen.add(n.id); ordered.push(n); };
    mine.forEach(visit);
    const synthetic: Node[] = [];
    if (view?.kind === 'grid') {
      const grid = normalizeGrid(view.grid);
      const rects = cellRects(grid);
      const mk = (id: string, text: string, r: { x: number; y: number; w: number; h: number }, visualType: string, fill?: string): Node => ({
        id, type: 'visual', position: { x: r.x, y: r.y }, width: r.w, height: r.h, draggable: false, selectable: false, connectable: false, zIndex: -20,
        data: { node: { id, viewId: view.id, visualType, text, x: r.x, y: r.y, w: r.w, h: r.h, style: { fill } } as ViewNode }, style: { width: r.w, height: r.h },
      });
      for (const [id, r] of Object.entries(rects.layers)) { const l = grid.layers.find(x => x.id === id); synthetic.push(mk(`hdr:layer:${id}`, l?.name ?? '', r, 'core:header', l?.color)); }
      for (const [id, r] of Object.entries(rects.stages)) synthetic.push(mk(`hdr:stage:${id}`, grid.stages.find(x => x.id === id)?.name ?? '', r, 'core:header'));
      for (const [id, r] of Object.entries(rects.groups)) { const g = grid.stageGroups.find(x => x.id === id); synthetic.push(mk(`hdr:group:${id}`, g?.name ?? '', r, 'core:header', g?.color)); }
      for (const c of Object.values(rects.cells)) { const color = grid.layers.find(x => x.id === c.layerId)?.color; synthetic.push(mk(`${CELL_PREFIX}${cellKey(c.layerId, c.stageId)}`, '', c, 'core:cell', color ? `color-mix(in srgb, ${color} 25%, white)` : undefined)); }
    }
    const cellIds = new Set(synthetic.map(n => n.id));
    return [...synthetic, ...ordered.map(n => {
      const el = n.elementId ? store.get('elements', n.elementId) : undefined;
      const type = el ? registry.elementType(el.typeId) : undefined;
      const dimmed = !!(el && view && registry.notationOf(el.typeId) !== view.notationId && registry.notationOf(el.typeId) !== 'freeform' && !el.libraryId)
        || !!(el && view && !registry.inViewpoint(view.notationId, view.viewpointId, el.typeId));
      const isCell = n.visualType === 'core:cell';
      return {
        id: n.id,
        type: n.elementId ? 'element' : 'visual',
        position: { x: n.x, y: n.y },
        width: n.w, height: n.h,
        data: { node: n, dimmed },
        parentId: n.parentNodeId && byId.has(n.parentNodeId) ? n.parentNodeId : (n.cell && cellIds.has(`${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}`) ? `${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}` : undefined),
        extent: n.parentNodeId && byId.has(n.parentNodeId) ? ('parent' as const) : undefined,
        selected: selection.nodes.includes(n.id),
        draggable: !readOnly && !isCell,
        selectable: !isCell,
        connectable: !readOnly && !!n.elementId,
        zIndex: isCell ? -10 : (type?.container || n.visualType === 'core:group') ? -1 : n.z ?? 0,
        style: { width: n.w, height: n.h },
      } satisfies Node;
    })];
  }, [allNodes, viewId, view, store, registry, selection.nodes, readOnly, elementsVersion]);

  const rfEdges = useMemo<Edge[]>(() => {
    if (!viewId) return [];
    const ids = new Set(rfNodes.map(n => n.id));
    return allEdges.filter(e => e.viewId === viewId && ids.has(e.fromNodeId) && ids.has(e.toNodeId)).map(e => ({
      id: e.id, type: 'relation', source: e.fromNodeId, target: e.toNodeId,
      sourceHandle: e.fromPortId ?? '', targetHandle: e.toPortId ?? '',
      data: { edge: e }, selected: selection.edges.includes(e.id),
    }));
  }, [allEdges, viewId, rfNodes, selection.edges]);

  // ---------------------------------------------------------------- React Flow → comandos
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const sel = new Set(selection.nodes);
    let selChanged = false;
    const moves: { id: string; x: number; y: number }[] = [];
    const resizes: Command[] = [];
    for (const ch of changes) {
      if (ch.type === 'select') { selChanged = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); }
      else if (ch.type === 'position' && ch.position && !ch.dragging) moves.push({ id: ch.id, x: Math.round(ch.position.x), y: Math.round(ch.position.y) });
      else if (ch.type === 'dimensions' && ch.dimensions && ch.resizing === false) resizes.push({ type: 'patch', collection: 'nodes', id: ch.id, patch: { w: Math.round(ch.dimensions.width), h: Math.round(ch.dimensions.height) } });
      else if (ch.type === 'remove') { /* se gestiona con la tecla Supr */ }
    }
    if (selChanged) select({ nodes: [...sel], edges: selection.edges });
    // Los movimientos durante el arrastre se aplican solo visualmente; al soltar, un comando por arrastre (ver onNodeDragStop)
    if (resizes.length) run({ type: 'batch', label: 'redimensionar', commands: resizes });
    void moves;
  }, [selection, select, run]);

  const onNodeDragStart = useCallback((_: DragEv, __: Node, nodes: Node[]) => {
    dragStart.current = new Map(nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }]));
  }, []);

  const onNodeDragStop = useCallback((_: DragEv, node: Node, nodes: Node[]) => {
    if (readOnly) return;
    const moves: NonNullable<Extract<Command, { type: 'moveNodes' }>['moves']> = [];
    for (const n of nodes) {
      const vn = store.get('nodes', n.id); if (!vn) continue;
      const start = dragStart.current.get(n.id);
      if (start && start.x === n.position.x && start.y === n.position.y && nodes.length > 1) continue;
      // ¿Se ha soltado dentro de un contenedor?
      const abs = rf.getInternalNode(n.id)?.internals.positionAbsolute ?? n.position;
      const target = findContainer(rf, store, registry, n, abs, vn);
      const targetIsCell = isCellId(target?.id);
      const newParent = targetIsCell ? null : (target?.id ?? null);
      const newCell = targetIsCell ? cellOf(target!.id) : null;
      const cur = vn.parentNodeId ?? null;
      const curCell = vn.cell ? cellKey(vn.cell.layerId, vn.cell.stageId) : null;
      if (newParent !== cur || (newCell ? cellKey(newCell.layerId, newCell.stageId) : null) !== curCell) {
        const parentAbs = target ? (rf.getInternalNode(target.id)?.internals.positionAbsolute ?? target.position) : { x: 0, y: 0 };
        moves.push({ id: n.id, x: Math.round(abs.x - parentAbs.x), y: Math.round(abs.y - parentAbs.y), parentNodeId: newParent, cell: newCell });
      } else moves.push({ id: n.id, x: Math.round(n.position.x), y: Math.round(n.position.y) });
    }
    if (moves.length) {
      const cmds: Command[] = [{ type: 'moveNodes', moves }];
      // Relación implícita al anidar (propuesta del pack), solo si no existe ya
      for (const m of moves) {
        if (!m.parentNodeId) continue;
        const child = store.get('nodes', m.id), parent = store.get('nodes', m.parentNodeId);
        const ce = child?.elementId ? store.get('elements', child.elementId) : undefined;
        const pe = parent?.elementId ? store.get('elements', parent.elementId) : undefined;
        if (!ce || !pe) continue;
        const rels = registry.nestingRelations(pe.typeId, ce.typeId);
        if (rels.length !== 1) continue;
        const exists = store.list('relations').some(r => r.typeId === rels[0] && r.from.elementId === pe.id && r.to.elementId === ce.id);
        if (!exists) cmds.push({ type: 'set', collection: 'relations', id: `rel_${m.id}_${m.parentNodeId}`, value: makeRelation(rels[0]!, { elementId: pe.id }, { elementId: ce.id }, { id: `rel_${m.id}_${m.parentNodeId}`, features: { implicit: true } }) });
      }
      run({ type: 'batch', label: 'mover', commands: cmds });
    }
    void node;
  }, [store, registry, rf, run, readOnly]);

  const isValidConnection = useCallback<IsValidConnection>((c) => {
    const opts = relationOptions(c);
    return opts.length > 0;
  }, [store, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  function relationOptions(c: Connection | Edge): string[] {
    const a = store.get('nodes', c.source), b = store.get('nodes', c.target);
    const ea = a?.elementId ? store.get('elements', a.elementId) : undefined;
    const eb = b?.elementId ? store.get('elements', b.elementId) : undefined;
    if (!ea || !eb) return [];
    let opts = registry.allowedRelations(ea.typeId, eb.typeId);
    if (c.sourceHandle || c.targetHandle) {
      const pa = c.sourceHandle ? allPorts(ea, registry.fieldsOf(ea.typeId)).find(p => p.id === c.sourceHandle) : undefined;
      const pb = c.targetHandle ? allPorts(eb, registry.fieldsOf(eb.typeId)).find(p => p.id === c.targetHandle) : undefined;
      const compat = compatibleRelationTypes(registry.allPacks().flatMap(p => p.portRules ?? []), pa?.portTypeId, pb?.portTypeId);
      if (compat) { const set = new Set(compat); const filtered = opts.filter(o => set.has(o)); opts = filtered.length ? filtered : compat; }
    }
    return opts;
  }

  const onConnectEnd = useCallback<OnConnectEnd>((event, state: FinalConnectionState) => {
    if (readOnly || !state.isValid || !state.fromNode || !state.toNode || !viewId) return;
    const c: Connection = { source: state.fromNode.id, target: state.toNode.id, sourceHandle: state.fromHandle?.id ?? null, targetHandle: state.toHandle?.id ?? null };
    const opts = relationOptions(c);
    if (!opts.length) return;
    const create = (typeId: string) => {
      const a = store.get('nodes', c.source)!, b = store.get('nodes', c.target)!;
      const rel = makeRelation(typeId, { elementId: a.elementId!, portId: c.sourceHandle || undefined }, { elementId: b.elementId!, portId: c.targetHandle || undefined });
      if (c.sourceHandle && c.targetHandle) rel.mappings.push({ fromPath: c.sourceHandle.split('#')[1] ?? c.sourceHandle, toPath: c.targetHandle.split('#')[1] ?? c.targetHandle });
      run({ type: 'connect', relation: rel, edge: makeEdge(viewId, undefined, a.id, b.id, { fromPortId: c.sourceHandle || undefined, toPortId: c.targetHandle || undefined }) });
      setPicker(null);
    };
    const def = view ? registry.pack(view.notationId)?.defaultRelation : undefined;
    if (opts.length === 1) create(opts[0]!);
    else {
      const me = event as globalThis.MouseEvent;
      setPicker({ x: me.clientX, y: me.clientY, options: def && opts.includes(def) ? [def, ...opts.filter(o => o !== def)] : opts, onPick: create });
    }
  }, [store, registry, run, viewId, view, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- soltar desde la paleta
  const onDragOver = useCallback((e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (readOnly || !viewId) return;
    const typeId = e.dataTransfer.getData(DND_TYPE);
    const templateId = e.dataTransfer.getData(DND_TEMPLATE);
    const elementId = e.dataTransfer.getData(DND_ELEMENT);
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let element: Element | undefined;
    let isNew = true;
    if (elementId) { element = store.get('elements', elementId); isNew = false; }
    else if (templateId) {
      const t = store.get('elements', templateId); if (!t) return;
      element = makeElement(t.typeId, t.name, { doc: t.doc, fields: structuredClone(t.fields), libraryId: t.libraryId, templateId: t.id, tags: [...t.tags] });
    } else if (typeId) {
      const type = registry.elementType(typeId); if (!type) return;
      element = makeElement(typeId, type.name, { libraryId: type.notationId ? undefined : findLibraryOfType(typeId) });
    }
    if (!element) return;
    const type = registry.elementType(element.typeId);
    const size = defaultSize(type?.shape, !!type?.container);
    const container = findContainerAt(rf, store, registry, pos, undefined);
    let x = pos.x - size.w / 2, y = pos.y - size.h / 2, parentNodeId: string | undefined, cell: ViewNode['cell'] | undefined;
    if (container) {
      const pAbs = rf.getInternalNode(container.id)?.internals.positionAbsolute ?? container.position;
      x -= pAbs.x; y -= pAbs.y;
      if (isCellId(container.id)) cell = cellOf(container.id); else parentNodeId = container.id;
    } else if (view?.kind === 'grid') return; // en una rejilla, solo dentro de una celda
    const node = makeNode(viewId, undefined, { x: Math.round(x), y: Math.round(y), w: size.w, h: size.h }, { parentNodeId, cell, style: { showPorts: false } });
    if (isNew) run({ type: 'addElementToView', element, node });
    else run({ type: 'set', collection: 'nodes', id: node.id, value: { ...node, elementId: element.id } });
    select({ nodes: [node.id], edges: [] });
  }, [rf, run, select, store, registry, viewId, readOnly]);

  function findLibraryOfType(typeId: string): string | undefined {
    return store.list('libraries').find(l => l.elementTypes.some(t => t.id === typeId))?.id;
  }

  // ---------------------------------------------------------------- teclado y menú
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (readOnly) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const cmds: Command[] = [
        ...selection.edges.map(id => ({ type: 'deleteRelation', id: store.get('edges', id)?.relationId ?? '' }) as Command).filter(c => c.type === 'deleteRelation' && c.id),
        ...selection.nodes.map(id => ({ type: 'deleteNode', id }) as Command),
      ];
      if (cmds.length) { run({ type: 'batch', label: 'quitar de la vista', commands: cmds }); select({ nodes: [], edges: [] }); }
      e.preventDefault();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ed.history.redo(); else ed.history.undo(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); ed.history.redo(); }
    if (e.key === 'Escape') { setPicker(null); setMenu(null); }
  }, [selection, store, run, select, readOnly, ed.history]);

  const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node) => {
    const vn = store.get('nodes', node.id);
    if (vn?.detailViewId && store.get('views', vn.detailViewId)) ed.openView(vn.detailViewId, true);
  }, [store, ed]);

  const onNodeContextMenu = useCallback((e: MouseEvent, node: Node) => {
    e.preventDefault();
    if ((node.data as { node?: ViewNode }).node?.visualType === 'core:cell') return;
    setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  if (!viewId || !view) return <div className="ad-canvas ad-canvas--empty">Elige o crea una vista</div>;

  return (
    <div className="ad-canvas" onKeyDown={onKeyDown} tabIndex={0}>
      <ReactFlow
        nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(chs) => { const sel = new Set(selection.edges); let c = false; for (const ch of chs) if (ch.type === 'select') { c = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); } if (c) select({ nodes: selection.nodes, edges: [...sel] }); }}
        onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection} onConnectEnd={onConnectEnd}
        onDrop={onDrop} onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu}
        onPaneClick={() => { setPicker(null); setMenu(null); }}
        fitView minZoom={0.05} maxZoom={4} deleteKeyCode={null} multiSelectionKeyCode="Shift" selectionKeyCode="Shift"
        nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable
        proOptions={{ hideAttribution: true }}
        connectionRadius={24}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => { const vn = (n.data as { node?: ViewNode }).node; const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined; return (el && registry.elementType(el.typeId)?.color) || '#ddd'; }} />
      </ReactFlow>
      {picker && (
        <div className="ad-popover" style={{ left: picker.x, top: picker.y }}>
          <div className="ad-popover__title">Tipo de relación</div>
          {picker.options.map(o => <button key={o} className="ad-popover__item" onClick={() => picker.onPick(o)}>{registry.relationType(o)?.name ?? o} <small>{registry.notationOf(o)}</small></button>)}
        </div>
      )}
      {menu && <NodeMenu x={menu.x} y={menu.y} nodeId={menu.nodeId} onClose={() => setMenu(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- utilidades
function cellOf(cellNodeId: string): { layerId: string; stageId: string } {
  const [layerId, stageId] = cellNodeId.slice(CELL_PREFIX.length).split('|');
  return { layerId: layerId ?? '', stageId: stageId ?? '' };
}
export function defaultSize(shape: string | undefined, container: boolean): { w: number; h: number } {
  if (container) return { w: 320, h: 220 };
  switch (shape) {
    case 'circle': case 'double-circle': return { w: 40, h: 40 };
    case 'diamond': return { w: 60, h: 60 };
    case 'bar': return { w: 120, h: 12 };
    case 'actor': return { w: 60, h: 90 };
    case 'ellipse': return { w: 140, h: 70 };
    case 'note': return { w: 180, h: 90 };
    default: return { w: 160, h: 56 };
  }
}

type RF = ReturnType<typeof useReactFlow>;

function isContainerNode(n: Node, store: StoreT, reg: RegT): boolean {
  const vn = (n.data as { node?: ViewNode }).node; if (!vn) return false;
  if (vn.visualType === 'core:group' || vn.visualType === 'core:cell') return true;
  if (vn.visualType === 'core:header') return false;
  const el = vn.elementId ? store.get('elements', vn.elementId) : undefined;
  return !!(el && reg.elementType(el.typeId)?.container);
}

/** Contenedor más profundo (más pequeño) que contiene el punto, excluyendo el propio nodo y sus descendientes. */
type StoreT = ReturnType<typeof useEditor>['store'];
type RegT = ReturnType<typeof useEditor>['registry'];
function findContainerAt(rf: RF, store: StoreT, reg: RegT, p: { x: number; y: number }, exclude: Node | undefined): Node | undefined {
  const excluded = new Set<string>();
  if (exclude) { excluded.add(exclude.id); let grew = true; while (grew) { grew = false; for (const n of rf.getNodes()) if (n.parentId && excluded.has(n.parentId) && !excluded.has(n.id)) { excluded.add(n.id); grew = true; } } }
  let best: Node | undefined; let bestArea = Infinity;
  for (const n of rf.getNodes()) {
    if (excluded.has(n.id) || !isContainerNode(n, store, reg)) continue;
    const abs = rf.getInternalNode(n.id)?.internals.positionAbsolute ?? n.position;
    const w = n.measured?.width ?? n.width ?? 0, h = n.measured?.height ?? n.height ?? 0;
    if (p.x >= abs.x && p.y >= abs.y && p.x <= abs.x + w && p.y <= abs.y + h) { const area = w * h; if (area < bestArea) { bestArea = area; best = n; } }
  }
  return best;
}

function findContainer(rf: RF, store: StoreT, reg: RegT, n: Node, abs: { x: number; y: number }, vn: ViewNode): Node | undefined {
  const w = n.measured?.width ?? vn.w, h = n.measured?.height ?? vn.h;
  return findContainerAt(rf, store, reg, { x: abs.x + w / 2, y: abs.y + Math.min(h / 2, 20) }, n);
}
