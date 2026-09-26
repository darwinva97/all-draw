import { useCallback, useEffect, useMemo, useState, useRef, type DragEvent, type MouseEvent } from 'react';
type DragEv = globalThis.MouseEvent | globalThis.TouchEvent;
import {
  ReactFlow, Background, Controls, MiniMap, useReactFlow, ReactFlowProvider, ViewportPortal, useViewport,
  type Node, type Edge, type NodeChange, type Connection, type IsValidConnection, type OnConnectEnd, type FinalConnectionState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  makeElement, makeNode, makeRelation, makeEdge, allPorts, compatibleRelationTypes, indexOf, type ViewNode, type Command, type Element,
} from '@all-draw/core';
import { useEditor } from './context';
import { useCollection, useRecord } from './hooks';
import { ElementNode } from './nodes/ElementNode';
import { VisualNode } from './nodes/VisualNode';
import { RelationEdge } from './edges/RelationEdge';
import { nearestSegment } from './edges/bendpath';
import { NodeMenu } from './panels/NodeMenu';
import { PaneMenu, type PaneMenuItem } from './panels/PaneMenu';
import { AlignBar } from './panels/AlignBar';
import { copySelection, pastePlan, setClipboard, readClipboard, type Clip, type PasteMode, type PasteOptions } from './clipboard';
import { usePeers, remoteSelection, selectionSignature, throttle, type Peer } from './presence';
import { cellRects, normalizeGrid, cellKey, cellAt } from '@all-draw/notation-grid';

export const CELL_PREFIX = 'cell:';
const isCellId = (id: string | undefined | null) => !!id && id.startsWith(CELL_PREFIX);

const nodeTypes = { element: ElementNode, visual: VisualNode };
const edgeTypes = { relation: RelationEdge };

export const DND_TYPE = 'application/x-all-draw-type';
export const DND_TEMPLATE = 'application/x-all-draw-template';
export const DND_ELEMENT = 'application/x-all-draw-element';
/** Nodo visual (nota, grupo, etiqueta, imagen): JSON `{ visualType, text?, src? }`. */
export const DND_VISUAL = 'application/x-all-draw-visual';

export const SNAP_GRID: [number, number] = [8, 8];

export interface CanvasProps {
  /** La app conecta aquí su layout automático (menú del lienzo y paleta de comandos). */
  onRequestLayout?: () => void;
}

export function Canvas(props: CanvasProps) {
  return <ReactFlowProvider><CanvasInner {...props} /></ReactFlowProvider>;
}

interface Picker { x: number; y: number; options: string[]; onPick: (typeId: string) => void }
interface LiveBox { x?: number; y?: number; w?: number; h?: number }

function CanvasInner({ onRequestLayout }: CanvasProps) {
  const ed = useEditor();
  const { store, registry, viewId, run, selection, select, readOnly, presence, effectiveTheme, snap, setRenaming } = ed;
  const view = useRecord('views', viewId);
  const nodesVersion = useCollection('nodes');
  const edgesVersion = useCollection('edges');
  const elementsVersion = useCollection('elements');
  const rf = useReactFlow();
  const [picker, setPicker] = useState<Picker | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number; flow: { x: number; y: number } } | null>(null);
  const dragStart = useRef<Map<string, { x: number; y: number }>>(new Map());
  /** Pegados consecutivos del mismo clip: cada uno se desplaza un poco más. */
  const pasteCount = useRef(0);
  /** Última posición del puntero en coordenadas del lienzo (para pegar "aquí"). */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  /** Tamaños/posiciones durante un redimensionado (React Flow en modo controlado no los aplica solo). */
  const [live, setLive] = useState<Record<string, LiveBox>>({});
  const liveRef = useRef(live);
  liveRef.current = live;
  const [alt, setAlt] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const peers = usePeers(presence?.awareness);
  const peerSig = selectionSignature(peers);
  const remoteSel = useMemo(() => remoteSelection(peers, viewId), [peerSig, viewId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- modelo → React Flow
  const rfNodes = useMemo<Node[]>(() => {
    if (!viewId) return [];
    const mine = indexOf(store).nodesOfView(viewId);
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
      for (const c of Object.values(rects.cells)) { const color = grid.layers.find(x => x.id === c.layerId)?.color; synthetic.push(mk(`${CELL_PREFIX}${cellKey(c.layerId, c.stageId)}`, '', c, 'core:cell', color ? `color-mix(in srgb, ${color} 25%, ${effectiveTheme === 'dark' ? '#161a22' : 'white'})` : undefined)); }
    }
    const cellIds = new Set(synthetic.map(n => n.id));
    return [...synthetic, ...ordered.map(n => {
      const el = n.elementId ? store.get('elements', n.elementId) : undefined;
      const type = el ? registry.elementType(el.typeId) : undefined;
      const dimmed = !!(el && view && registry.notationOf(el.typeId) !== view.notationId && registry.notationOf(el.typeId) !== 'freeform' && !el.libraryId)
        || !!(el && view && !registry.inViewpoint(view.notationId, view.viewpointId, el.typeId));
      const isCell = n.visualType === 'core:cell';
      const lv = live[n.id];
      const w = lv?.w ?? n.w, h = lv?.h ?? n.h;
      return {
        id: n.id,
        type: n.elementId ? 'element' : 'visual',
        position: { x: lv?.x ?? n.x, y: lv?.y ?? n.y },
        width: w, height: h,
        data: { node: lv ? { ...n, x: lv.x ?? n.x, y: lv.y ?? n.y, w, h } : n, dimmed, remoteColor: remoteSel.get(n.id) },
        parentId: n.parentNodeId && byId.has(n.parentNodeId) ? n.parentNodeId : (n.cell && cellIds.has(`${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}`) ? `${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}` : undefined),
        extent: n.parentNodeId && byId.has(n.parentNodeId) ? ('parent' as const) : undefined,
        selected: selection.nodes.includes(n.id),
        draggable: !readOnly && !isCell,
        selectable: !isCell,
        connectable: !readOnly && !!n.elementId,
        zIndex: isCell ? -10 : (type?.container || n.visualType === 'core:group') ? -1 : n.z ?? 0,
        style: { width: w, height: h },
      } satisfies Node;
    })];
  }, [nodesVersion, viewId, view, store, registry, selection.nodes, readOnly, elementsVersion, live, remoteSel, effectiveTheme]);

  const rfEdges = useMemo<Edge[]>(() => {
    if (!viewId) return [];
    const ids = new Set(rfNodes.map(n => n.id));
    return indexOf(store).edgesOfView(viewId).filter(e => ids.has(e.fromNodeId) && ids.has(e.toNodeId)).map(e => ({
      id: e.id, type: 'relation', source: e.fromNodeId, target: e.toNodeId,
      sourceHandle: e.fromPortId ?? '', targetHandle: e.toPortId ?? '',
      data: { edge: e }, selected: selection.edges.includes(e.id),
    }));
  }, [edgesVersion, store, viewId, rfNodes, selection.edges]);

  // ---------------------------------------------------------------- API del lienzo para otros paneles
  const fitNodes = useCallback((nodeIds?: string[]) => {
    if (nodeIds?.length) rf.fitView({ nodes: nodeIds.map(id => ({ id })), duration: 300, padding: 0.4, maxZoom: 1.5 });
    else rf.fitView({ duration: 300, padding: 0.1 });
  }, [rf]);
  const selectAll = useCallback(() => {
    if (!viewId) return;
    select({ nodes: indexOf(store).nodesOfView(viewId).filter(n => n.visualType !== 'core:cell').map(n => n.id), edges: indexOf(store).edgesOfView(viewId).map(e => e.id) });
  }, [store, viewId, select]);
  useEffect(() => {
    ed.canvas.current = {
      fitView: fitNodes,
      zoomIn: () => rf.zoomIn({ duration: 150 }),
      zoomOut: () => rf.zoomOut({ duration: 150 }),
      resetZoom: () => { const v = rf.getViewport(); rf.setViewport({ ...v, zoom: 1 }, { duration: 150 }); },
      selectAll,
      focus: () => wrapper.current?.focus(),
    };
    return () => { ed.canvas.current = null; };
  }, [ed.canvas, rf, fitNodes, selectAll]);

  // ---------------------------------------------------------------- presencia: publicar y escuchar
  const aw = presence?.awareness;
  useEffect(() => {
    if (!aw || !presence) return;
    aw.setLocalStateField('name', presence.me.name);
    aw.setLocalStateField('color', presence.me.color);
  }, [aw, presence]);
  useEffect(() => { aw?.setLocalStateField('viewId', viewId); }, [aw, viewId]);
  useEffect(() => { aw?.setLocalStateField('selection', selection.nodes); }, [aw, selection.nodes]);
  const publishCursor = useMemo(() => throttle((p: { x: number; y: number } | null) => aw?.setLocalStateField('cursor', p), 50), [aw]);
  useEffect(() => () => publishCursor.cancel(), [publishCursor]);
  const onMouseMove = useCallback((e: MouseEvent) => {
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    pointer.current = p;
    if (aw) publishCursor({ x: Math.round(p.x), y: Math.round(p.y) });
  }, [rf, aw, publishCursor]);
  const onMouseLeave = useCallback(() => { pointer.current = null; if (aw) publishCursor(null); }, [aw, publishCursor]);

  // Alt mantiene desactivado el ajuste a rejilla mientras se pulsa
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') setAlt(true); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') setAlt(false); };
    const blur = () => setAlt(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  // ---------------------------------------------------------------- React Flow → comandos
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const sel = new Set(selection.nodes);
    let selChanged = false;
    const commits: Command[] = [];
    let nextLive: Record<string, LiveBox> | null = null;
    const liveOf = (id: string) => (nextLive ?? liveRef.current)[id];
    const setLiveOf = (id: string, box: LiveBox | undefined) => {
      nextLive = nextLive ?? { ...liveRef.current };
      if (box) nextLive[id] = box; else delete nextLive[id];
    };
    for (const ch of changes) {
      if (ch.type === 'select') { selChanged = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); }
      else if (ch.type === 'dimensions' && ch.dimensions && ch.resizing) setLiveOf(ch.id, { ...liveOf(ch.id), w: ch.dimensions.width, h: ch.dimensions.height });
      else if (ch.type === 'position' && ch.position && !ch.dragging && liveOf(ch.id)) setLiveOf(ch.id, { ...liveOf(ch.id), x: ch.position.x, y: ch.position.y });
      else if (ch.type === 'dimensions' && ch.dimensions && ch.resizing === false) {
        // Fin del redimensionado: un solo patch con tamaño y, si se movió el borde superior/izquierdo, posición.
        const lv = liveOf(ch.id);
        const patch: Record<string, unknown> = { w: Math.round(ch.dimensions.width), h: Math.round(ch.dimensions.height) };
        if (lv?.x !== undefined) patch.x = Math.round(lv.x);
        if (lv?.y !== undefined) patch.y = Math.round(lv.y);
        commits.push({ type: 'patch', collection: 'nodes', id: ch.id, patch });
        setLiveOf(ch.id, undefined);
      }
      // Los movimientos durante el arrastre se aplican solo visualmente; al soltar, un comando por arrastre (ver onNodeDragStop)
    }
    if (selChanged) select({ nodes: [...sel], edges: selection.edges });
    if (nextLive) setLive(nextLive);
    if (commits.length && !readOnly) run({ type: 'batch', label: 'redimensionar', commands: commits });
  }, [selection, select, run, readOnly]);

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

  /** Coloca un nodo nuevo en `pos` (centro): dentro del contenedor/celda que haya debajo. En rejilla, solo dentro de una celda. */
  const placeAt = useCallback((pos: { x: number; y: number }, size: { w: number; h: number }): { x: number; y: number; parentNodeId?: string; cell?: ViewNode['cell'] } | null => {
    const container = findContainerAt(rf, store, registry, pos, undefined);
    let x = pos.x - size.w / 2, y = pos.y - size.h / 2, parentNodeId: string | undefined, cell: ViewNode['cell'] | undefined;
    if (container) {
      const pAbs = rf.getInternalNode(container.id)?.internals.positionAbsolute ?? container.position;
      x -= pAbs.x; y -= pAbs.y;
      if (isCellId(container.id)) cell = cellOf(container.id); else parentNodeId = container.id;
    } else if (view?.kind === 'grid') return null;
    return { x: Math.round(x), y: Math.round(y), parentNodeId, cell };
  }, [rf, store, registry, view]);

  const addVisual = useCallback((visual: { visualType: string; text?: string; src?: string }, pos: { x: number; y: number }) => {
    if (readOnly || !viewId) return;
    const size = visual.visualType === 'core:group' ? { w: 320, h: 220 } : visual.visualType === 'core:image' ? { w: 200, h: 150 } : visual.visualType === 'core:label' ? { w: 140, h: 28 } : { w: 180, h: 90 };
    const at = placeAt(pos, size); if (!at) return;
    const text = visual.text ?? (visual.visualType === 'core:note' ? 'Nota' : visual.visualType === 'core:group' ? 'Grupo' : visual.visualType === 'core:label' ? 'Etiqueta' : undefined);
    const node = makeNode(viewId, undefined, { ...at, w: size.w, h: size.h }, { visualType: visual.visualType, text, parentNodeId: at.parentNodeId, cell: at.cell, meta: visual.src ? { src: visual.src } : undefined });
    if (!node.meta) delete node.meta;
    run({ type: 'set', collection: 'nodes', id: node.id, value: node });
    select({ nodes: [node.id], edges: [] });
  }, [readOnly, viewId, placeAt, run, select]);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (readOnly || !viewId) return;
    const typeId = e.dataTransfer.getData(DND_TYPE);
    const templateId = e.dataTransfer.getData(DND_TEMPLATE);
    const elementId = e.dataTransfer.getData(DND_ELEMENT);
    const visual = e.dataTransfer.getData(DND_VISUAL);
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (visual) { try { addVisual(JSON.parse(visual), pos); } catch { /* payload inválido */ } return; }
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
    const at = placeAt(pos, size); if (!at) return;
    const node = makeNode(viewId, undefined, { ...at, w: size.w, h: size.h }, { parentNodeId: at.parentNodeId, cell: at.cell, style: { showPorts: false } });
    if (isNew) run({ type: 'addElementToView', element, node });
    else run({ type: 'set', collection: 'nodes', id: node.id, value: { ...node, elementId: element.id } });
    select({ nodes: [node.id], edges: [] });
  }, [rf, run, select, store, registry, viewId, readOnly, placeAt, addVisual]);

  function findLibraryOfType(typeId: string): string | undefined {
    return store.list('libraries').find(l => l.elementTypes.some(t => t.id === typeId))?.id;
  }

  // ---------------------------------------------------------------- copiar / pegar / duplicar
  const copy = useCallback((): Clip | null => {
    if (!selection.nodes.length) return null;
    const clip = copySelection(store, selection.nodes, selection.edges);
    setClipboard(clip);
    pasteCount.current = 0;
    return clip;
  }, [store, selection]);

  /** Destino en rejilla para los nodos sin celda: la celda bajo `at` (o la primera), y la posición relativa. */
  const gridTargetAt = useCallback((at: { x: number; y: number } | null): PasteOptions['gridTarget'] => {
    if (view?.kind !== 'grid') return undefined;
    const grid = normalizeGrid(view.grid);
    const rects = cellRects(grid);
    const valid = new Set(Object.values(rects.cells).map(c => cellKey(c.layerId, c.stageId)));
    const isValidCell = (c: { layerId: string; stageId: string }) => valid.has(cellKey(c.layerId, c.stageId));
    const under = at ? cellAt(grid, rects, at.x, at.y) : null;
    const cell = under ?? (grid.layers[0] && grid.stages[0] ? { layerId: grid.layers[0].id, stageId: grid.stages[0].id } : null);
    if (!cell) return undefined;
    const r = rects.cells[cellKey(cell.layerId, cell.stageId)];
    const origin = under && at && r ? { x: Math.max(0, Math.round(at.x - r.x)), y: Math.max(0, Math.round(at.y - r.y)) } : undefined;
    return { cell, origin, isValidCell, size: r ? { w: r.w, h: r.h } : undefined };
  }, [view]);

  const paste = useCallback((clip: Clip | null, mode: PasteMode, offset: { x: number; y: number }, at: { x: number; y: number } | null = null) => {
    if (readOnly || !viewId || !clip || !clip.nodes.length) return;
    // Clip de otro espacio de trabajo (otra pestaña): sus elementos no existen aquí, así que se clonan.
    const foreign = mode === 'appearance' && (clip.elements.some(e => !store.get('elements', e.id)) || clip.relations.some(r => !store.get('relations', r.id)));
    if (foreign) mode = 'clone';
    const plan = pastePlan(clip, { viewId, offset, mode, isGrid: view?.kind === 'grid', gridTarget: gridTargetAt(at) });
    if (!plan.commands.length) return;
    run({ type: 'batch', label: mode === 'clone' ? 'duplicar' : 'pegar', commands: plan.commands });
    select({ nodes: plan.newNodeIds, edges: [] });
  }, [readOnly, viewId, view, run, select, store, gridTargetAt]);

  const pasteFromClipboard = useCallback(async (mode: PasteMode, at: { x: number; y: number } | null = null) => {
    const clip = await readClipboard();
    if (!clip) return;
    if (at) {
      // "Pegar aquí": el primer nodo raíz cae bajo el puntero
      const roots = clip.nodes.filter(n => !n.parentNodeId || !clip.nodes.some(m => m.id === n.parentNodeId));
      const minX = Math.min(...roots.map(n => n.x)), minY = Math.min(...roots.map(n => n.y));
      paste(clip, mode, { x: Math.round(at.x - minX), y: Math.round(at.y - minY) }, at);
      return;
    }
    pasteCount.current += 1;
    const step = 24 * pasteCount.current;
    // En otra vista se pega donde estaba; en la misma, desplazado para que no tape el original.
    const offset = clip.viewId && clip.viewId !== viewId ? { x: 0, y: 0 } : { x: step, y: step };
    paste(clip, mode, offset, pointer.current);
  }, [paste, viewId]);

  const duplicate = useCallback(() => {
    if (!selection.nodes.length) return;
    paste(copySelection(store, selection.nodes, selection.edges), 'clone', { x: 24, y: 24 }, pointer.current);
  }, [store, selection, paste]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (readOnly) return;
    const moves = selection.nodes.flatMap(id => { const vn = store.get('nodes', id); return vn && vn.viewId === viewId ? [{ id, x: vn.x + dx, y: vn.y + dy }] : []; });
    if (moves.length) run({ type: 'moveNodes', moves });
  }, [readOnly, selection.nodes, store, viewId, run]);

  // ---------------------------------------------------------------- teclado y menú
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    // Navegación (también en solo lectura)
    if (mod && key === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && e.shiftKey && key === 'f') { e.preventDefault(); fitNodes(); return; }
    if (mod && e.key === '0') { e.preventDefault(); ed.canvas.current?.resetZoom(); return; }
    if (!mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); rf.zoomIn({ duration: 150 }); return; }
    if (!mod && e.key === '-') { e.preventDefault(); rf.zoomOut({ duration: 150 }); return; }
    if (e.key === 'Escape') { setPicker(null); setMenu(null); setPaneMenu(null); setRenaming(null); return; }
    if (readOnly) return;
    if (mod && key === 'c') { if (copy()) e.preventDefault(); return; }
    if (mod && key === 'v') { e.preventDefault(); void pasteFromClipboard(e.shiftKey ? 'clone' : 'appearance'); return; }
    if (mod && key === 'd') { e.preventDefault(); duplicate(); return; }
    if (e.key === 'F2') { if (selection.nodes.length === 1) { e.preventDefault(); setRenaming(selection.nodes[0]!); } return; }
    if (e.key.startsWith('Arrow') && selection.nodes.length) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      nudge(e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const cmds: Command[] = [
        ...selection.edges.map(id => ({ type: 'deleteRelation', id: store.get('edges', id)?.relationId ?? '' }) as Command).filter(c => c.type === 'deleteRelation' && c.id),
        ...selection.nodes.map(id => ({ type: 'deleteNode', id }) as Command),
      ];
      if (cmds.length) { run({ type: 'batch', label: 'quitar de la vista', commands: cmds }); select({ nodes: [], edges: [] }); }
      e.preventDefault();
    }
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) ed.history.redo(); else ed.history.undo(); }
    if (mod && key === 'y') { e.preventDefault(); ed.history.redo(); }
  }, [selection, store, run, select, readOnly, ed.history, ed.canvas, copy, pasteFromClipboard, duplicate, selectAll, fitNodes, rf, setRenaming, nudge]);

  /** Doble clic sobre una arista: inserta un bendpoint en el tramo más cercano. */
  const onEdgeDoubleClick = useCallback((e: MouseEvent, edge: Edge) => {
    if (readOnly) return;
    const ve = store.get('edges', edge.id); if (!ve) return;
    const center = (id: string) => { const n = rf.getInternalNode(id); if (!n) return undefined; const a = n.internals.positionAbsolute; return { x: a.x + (n.measured.width ?? 0) / 2, y: a.y + (n.measured.height ?? 0) / 2 }; };
    const a = center(ve.fromNodeId), b = center(ve.toNodeId); if (!a || !b) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pt = { x: Math.round(p.x), y: Math.round(p.y) };
    const i = nearestSegment([a, ...ve.bendpoints, b], pt);
    const bendpoints = [...ve.bendpoints.slice(0, i), pt, ...ve.bendpoints.slice(i)];
    run({ type: 'patch', collection: 'edges', id: ve.id, patch: { bendpoints } });
    select({ nodes: [], edges: [ve.id] });
  }, [readOnly, store, rf, run, select]);

  const onNodeDoubleClick = useCallback((_: MouseEvent, node: Node) => {
    const vn = store.get('nodes', node.id);
    if (vn?.detailViewId && store.get('views', vn.detailViewId)) ed.openView(vn.detailViewId, true);
  }, [store, ed]);

  const onNodeContextMenu = useCallback((e: MouseEvent, node: Node) => {
    e.preventDefault();
    if ((node.data as { node?: ViewNode }).node?.visualType === 'core:cell') return;
    setPaneMenu(null);
    setMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  const onPaneContextMenu = useCallback((e: MouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu(null);
    setPaneMenu({ x: e.clientX, y: e.clientY, flow: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  }, [rf]);

  if (!viewId || !view) return <div className="ad-canvas ad-canvas--empty">Elige o crea una vista</div>;

  const paneItems: PaneMenuItem[] = paneMenu ? [
    ...(!readOnly ? [
      { label: 'Pegar aquí', hint: 'Ctrl+V', onClick: () => void pasteFromClipboard('appearance', paneMenu.flow) },
      { label: 'Añadir nota', onClick: () => addVisual({ visualType: 'core:note' }, paneMenu.flow) },
    ] : []),
    { label: 'Seleccionar todo', hint: 'Ctrl+A', onClick: selectAll },
    { label: 'Ajustar a la vista', hint: 'Ctrl+Shift+F', onClick: () => fitNodes() },
    ...(onRequestLayout && !readOnly ? [{ label: 'Layout automático', onClick: onRequestLayout }] : []),
  ] : [];

  return (
    <div ref={wrapper} className="ad-canvas" onKeyDown={onKeyDown} tabIndex={0} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <ReactFlow
        nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(chs) => { const sel = new Set(selection.edges); let c = false; for (const ch of chs) if (ch.type === 'select') { c = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); } if (c) select({ nodes: selection.nodes, edges: [...sel] }); }}
        onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection} onConnectEnd={onConnectEnd}
        onDrop={onDrop} onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu} onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => { setPicker(null); setMenu(null); setPaneMenu(null); }}
        fitView minZoom={0.05} maxZoom={4} deleteKeyCode={null} multiSelectionKeyCode="Shift" selectionKeyCode="Shift"
        nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable
        snapToGrid={snap && !alt} snapGrid={SNAP_GRID}
        colorMode={effectiveTheme}
        proOptions={{ hideAttribution: true }}
        connectionRadius={24}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => { const vn = (n.data as { node?: ViewNode }).node; const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined; return (el && registry.elementType(el.typeId)?.color) || (effectiveTheme === 'dark' ? '#3a4150' : '#ddd'); }} />
        {peers.length > 0 && <PeerCursors peers={peers} viewId={viewId} />}
      </ReactFlow>
      <AlignBar />
      {picker && (
        <div className="ad-popover" style={{ left: picker.x, top: picker.y }}>
          <div className="ad-popover__title">Tipo de relación</div>
          {picker.options.map(o => <button key={o} className="ad-popover__item" onClick={() => picker.onPick(o)}>{registry.relationType(o)?.name ?? o} <small>{registry.notationOf(o)}</small></button>)}
        </div>
      )}
      {menu && <NodeMenu x={menu.x} y={menu.y} nodeId={menu.nodeId} onClose={() => setMenu(null)} />}
      {paneMenu && <PaneMenu x={paneMenu.x} y={paneMenu.y} items={paneItems} onClose={() => setPaneMenu(null)} />}
    </div>
  );
}

/** Cursores de los demás participantes que están en esta vista (coordenadas del lienzo; la etiqueta no escala con el zoom). */
function PeerCursors({ peers, viewId }: { peers: Peer[]; viewId: string }) {
  const { zoom } = useViewport();
  const here = peers.filter(p => p.viewId === viewId && p.cursor);
  if (!here.length) return null;
  return (
    <ViewportPortal>
      {here.map(p => (
        <div key={p.clientId} className="ad-peer-cursor" style={{ transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px) scale(${1 / zoom})`, color: p.color }}>
          <svg width="16" height="20" viewBox="0 0 16 20" aria-hidden><path d="M1 1 L15 9 L8 10.5 L4.5 18 Z" fill="currentColor" stroke="#fff" strokeWidth="1.2" /></svg>
          <span className="ad-peer-cursor__name" style={{ background: p.color }}>{p.name}</span>
        </div>
      ))}
    </ViewportPortal>
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
