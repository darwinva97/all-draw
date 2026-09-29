import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef, type DragEvent, type MouseEvent } from 'react';
type DragEv = globalThis.MouseEvent | globalThis.TouchEvent;
import {
  ReactFlow, Background, Controls, MiniMap, useReactFlow, useStore, ReactFlowProvider, ViewportPortal, useViewport, ConnectionMode, getViewportForBounds,
  type Node, type Edge, type Viewport, type NodeChange, type Connection, type IsValidConnection, type OnConnectEnd, type FinalConnectionState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  makeElement, makeNode, makeRelation, makeEdge, allPorts, compatibleRelationTypes, indexOf, resolveStyle, type ViewNode, type Command, type Element,
  type Port, type RuleStyle,
} from '@all-draw/core';
import { useEditor } from './context';
import { useT } from '@all-draw/i18n';
import { useCollection, useRecord } from './hooks';
import { ElementNode, sameElementData, type ElementNodeData } from './nodes/ElementNode';
import { VisualNode, type VisualNodeData } from './nodes/VisualNode';
import { NodeEnvContext, LOW_DETAIL_ZOOM, type NodeEnv } from './nodes/env';
import { RelationEdge } from './edges/RelationEdge';
import { nearestSegment } from './edges/bendpath';
import { NodeMenu } from './panels/NodeMenu';
import { PaneMenu, type PaneMenuItem } from './panels/PaneMenu';
import { CommentLayer } from './panels/Comments';
import { AlignBar } from './panels/AlignBar';
import { copySelection, pastePlan, setClipboard, readClipboard, type Clip, type PasteMode, type PasteOptions } from './clipboard';
import { usePeers, remoteSelection, selectionSignature, throttle, type Peer } from './presence';
import { cellRects, normalizeGrid, cellKey, cellAt } from '@all-draw/notation-grid';
import { LifelineNode, ActivationNode, FragmentNode } from './views/SequenceNodes';
import { SequenceMessageEdge } from './views/SequenceEdges';
import { useSequenceCanvas } from './views/useSequenceCanvas';

export const CELL_PREFIX = 'cell:';
const isCellId = (id: string | undefined | null) => !!id && id.startsWith(CELL_PREFIX);

const nodeTypes = { element: ElementNode, visual: VisualNode, lifeline: LifelineNode, activation: ActivationNode, fragment: FragmentNode };
const edgeTypes = { relation: RelationEdge, sequenceMessage: SequenceMessageEdge };

export const DND_TYPE = 'application/x-all-draw-type';
export const DND_TEMPLATE = 'application/x-all-draw-template';
export const DND_ELEMENT = 'application/x-all-draw-element';
/** Nodo visual (nota, grupo, etiqueta, imagen): JSON `{ visualType, text?, src? }`. */
export const DND_VISUAL = 'application/x-all-draw-visual';

export const SNAP_GRID: [number, number] = [8, 8];
/** A partir de tantos nodos en la vista, React Flow solo monta los que caen dentro del viewport. */
export const VIRTUALIZE_FROM = 300;

export interface CanvasProps {
  /** La app conecta aquí su layout automático (menú del lienzo y paleta de comandos). */
  onRequestLayout?: () => void;
}

/** Lo que sobrevive al cambio de vista: el encuadre de cada vista visitada y el último tamaño del lienzo. */
interface CanvasShared { viewports: Map<string, Viewport>; size: { w: number; h: number } | null }

export function Canvas(props: CanvasProps) {
  const { viewId } = useEditor();
  const shared = useRef<CanvasShared>({ viewports: new Map(), size: null });
  // Cada vista monta su propio lienzo con su propio almacén de React Flow (ver "cambio de vista" en CanvasInner).
  return <ReactFlowProvider key={viewId ?? ''}><CanvasInner {...props} shared={shared.current} /></ReactFlowProvider>;
}

interface Picker { x: number; y: number; options: string[]; onPick: (typeId: string) => void }
interface LiveBox { x?: number; y?: number; w?: number; h?: number }

function CanvasInner({ onRequestLayout, shared }: CanvasProps & { shared: CanvasShared }) {
  const ed = useEditor();
  const t = useT();
  const { store, registry, viewId, run, selection, select, readOnly, presence, effectiveTheme, snap, renaming, setRenaming } = ed;
  const view = useRecord('views', viewId);
  const nodesVersion = useCollection('nodes');
  const edgesVersion = useCollection('edges');
  const elementsVersion = useCollection('elements');
  const seq = useSequenceCanvas(view, { nodes: nodesVersion, edges: edgesVersion });
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
  // Estilo de las reglas y puertos por elemento, resueltos aquí una vez por vista (no en cada nodo). Las reglas dependen
  // también de `rules` y `people` (fuentes persona/papel): sus listas cambian de identidad al cambiar.
  const rules = useCollection('rules');
  const people = useCollection('people');
  // Los tipos y campos de las librerías se sincronizan en el registro (misma identidad): hay que recalcular a mano.
  const libraries = useCollection('libraries');
  const styleOf = useMemo(() => {
    const cache = new WeakMap<Element, RuleStyle>();
    return (el: Element): RuleStyle => { let st = cache.get(el); if (!st) { st = resolveStyle(store, registry, el, viewId ?? undefined).style; cache.set(el, st); } return st; };
  }, [store, registry, viewId, rules, people, libraries]);
  const portsOf = useMemo(() => {
    const cache = new WeakMap<Element, Port[]>();
    return (el: Element): Port[] => { let ps = cache.get(el); if (!ps) { ps = allPorts(el, registry.fieldsOf(el.typeId)); cache.set(el, ps); } return ps; };
  }, [registry, libraries]);
  /**
   * Nodos y aristas React Flow de la última construcción, por id. Si un nodo no ha cambiado se devuelve el mismo objeto
   * (y el mismo `data`): React Flow reutiliza entonces su nodo interno y no vuelve a pintarlo. Así, seleccionar, mover o
   * renombrar un nodo solo repinta ese nodo (y sus aristas), no los cientos de la vista.
   */
  const nodeCache = useRef(new Map<string, Node>());
  const edgeCache = useRef(new Map<string, Edge>());

  const rfNodes = useMemo<Node[]>(() => {
    if (!viewId) return [];
    const prev = nodeCache.current;
    const next = new Map<string, Node>();
    const keep = (n: Node): Node => { const old = prev.get(n.id); const out = old && sameRfNode(old, n) ? old : n; next.set(n.id, out); return out; };
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
      const mk = (id: string, text: string, r: { x: number; y: number; w: number; h: number }, visualType: string, fill?: string): Node => {
        // El `data` sintético se reutiliza si no cambia nada (si no, cada cambio repintaría todas las celdas).
        const old = prev.get(id)?.data as VisualNodeData | undefined;
        const o = old?.node;
        const data = o && o.text === text && o.x === r.x && o.y === r.y && o.w === r.w && o.h === r.h && o.visualType === visualType && o.style.fill === fill
          ? old! : { node: { id, viewId: view.id, visualType, text, x: r.x, y: r.y, w: r.w, h: r.h, style: { fill } } as ViewNode };
        return keep({
          id, type: 'visual', position: { x: r.x, y: r.y }, width: r.w, height: r.h, draggable: false, selectable: false, connectable: false, zIndex: -20,
          data, style: { width: r.w, height: r.h },
        });
      };
      for (const [id, r] of Object.entries(rects.layers)) { const l = grid.layers.find(x => x.id === id); synthetic.push(mk(`hdr:layer:${id}`, l?.name ?? '', r, 'core:header', l?.color)); }
      for (const [id, r] of Object.entries(rects.stages)) synthetic.push(mk(`hdr:stage:${id}`, grid.stages.find(x => x.id === id)?.name ?? '', r, 'core:header'));
      for (const [id, r] of Object.entries(rects.groups)) { const g = grid.stageGroups.find(x => x.id === id); synthetic.push(mk(`hdr:group:${id}`, g?.name ?? '', r, 'core:header', g?.color)); }
      for (const c of Object.values(rects.cells)) { const color = grid.layers.find(x => x.id === c.layerId)?.color; synthetic.push(mk(`${CELL_PREFIX}${cellKey(c.layerId, c.stageId)}`, '', c, 'core:cell', color ? `color-mix(in srgb, ${color} 25%, ${effectiveTheme === 'dark' ? '#161a22' : 'white'})` : undefined)); }
    }
    const cellIds = new Set(synthetic.map(n => n.id));
    const selectedIds = new Set(selection.nodes);
    const out = [...synthetic, ...ordered.map(n => {
      const el = n.elementId ? store.get('elements', n.elementId) : undefined;
      const type = el ? registry.elementType(el.typeId) : undefined;
      const notation = el ? registry.notationOf(el.typeId) : undefined;
      const dimmed = !!(el && view && notation !== view.notationId && notation !== 'freeform' && !el.libraryId)
        || !!(el && view && !registry.inViewpoint(view.notationId, view.viewpointId, el.typeId));
      const isCell = n.visualType === 'core:cell';
      const lv = live[n.id];
      const w = lv?.w ?? n.w, h = lv?.h ?? n.h;
      const vn = lv ? { ...n, x: lv.x ?? n.x, y: lv.y ?? n.y, w, h } : n;
      const editing = renaming === n.id || undefined;
      const remoteColor = remoteSel.get(n.id);
      const old = prev.get(n.id)?.data;
      let data: ElementNodeData | VisualNodeData;
      if (n.elementId) {
        const d: ElementNodeData = { node: vn, element: el, type, rule: el ? styleOf(el) : NO_RULE, ports: el ? portsOf(el) : NO_PORTS, archimate: notation === 'archimate', dimmed, remoteColor, editing };
        data = old && 'rule' in old && sameElementData(old as ElementNodeData, d) ? old as ElementNodeData : d;
      } else {
        const o = old as VisualNodeData | undefined;
        data = o && o.node === vn && o.remoteColor === remoteColor && o.editing === editing ? o : { node: vn, remoteColor, editing };
      }
      const base = {
        id: n.id,
        type: n.elementId ? 'element' : 'visual',
        position: { x: vn.x, y: vn.y },
        width: w, height: h,
        data,
        parentId: n.parentNodeId && byId.has(n.parentNodeId) ? n.parentNodeId : (n.cell && cellIds.has(`${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}`) ? `${CELL_PREFIX}${cellKey(n.cell.layerId, n.cell.stageId)}` : undefined),
        extent: n.parentNodeId && byId.has(n.parentNodeId) ? ('parent' as const) : undefined,
        selected: selectedIds.has(n.id),
        draggable: !readOnly && !isCell,
        selectable: !isCell,
        connectable: !readOnly && !!n.elementId,
        zIndex: isCell ? -10 : (type?.container || n.visualType === 'core:group') ? -1 : n.z ?? 0,
        style: { width: w, height: h },
      } satisfies Node;
      return keep(seq.active ? seq.decorateNode(n, base) : base);
    })];
    nodeCache.current = next;
    return out;
  }, [nodesVersion, viewId, view, store, registry, selection.nodes, readOnly, elementsVersion, live, remoteSel, effectiveTheme, seq, renaming, styleOf, portsOf, libraries]);

  const rfEdges = useMemo<Edge[]>(() => {
    if (!viewId) return [];
    const prev = edgeCache.current;
    const next = new Map<string, Edge>();
    const ids = new Set(rfNodes.map(n => n.id));
    const selectedIds = new Set(selection.edges);
    const out = indexOf(store).edgesOfView(viewId).filter(e => ids.has(e.fromNodeId) && ids.has(e.toNodeId)).map(e => {
      const selected = selectedIds.has(e.id);
      const old = prev.get(e.id);
      // Misma arista del modelo y misma selección: el mismo objeto (las de secuencia se decoran de nuevo cada vez).
      if (!seq.active && old && (old.data as { edge?: unknown }).edge === e && old.selected === selected) { next.set(e.id, old); return old; }
      const base: Edge = {
        id: e.id, type: 'relation', source: e.fromNodeId, target: e.toNodeId,
        sourceHandle: e.fromPortId ?? '', targetHandle: e.toPortId ?? '',
        data: { edge: e }, selected,
      };
      const out = seq.active ? seq.decorateEdge(e, base) : base;
      next.set(e.id, out);
      return out;
    });
    edgeCache.current = next;
    return out;
  }, [edgesVersion, store, viewId, rfNodes, selection.edges, seq]);

  // ---------------------------------------------------------------- cambio de vista
  /**
   * Cada vista monta su propio `ReactFlowProvider` (`key={viewId}` en `Canvas`), con un almacén nuevo. Con un solo
   * almacén para todas las vistas, React Flow quitaba los nodos de la vista anterior de su almacén antes de que React
   * los desmontara, y el selector de cada nodo retirado fallaba (con excepción) en cada actualización del almacén
   * hasta desmontarlo: ~30 ms por cambio con 60 nodos y ~160 ms con 300.
   * El encuadre inicial se calcula desde el modelo antes del primer pintado (como `fitView`, o el que tenía la vista
   * si ya se visitó), así el primer frame ya sale encuadrado, sin esperar a medir los nodos, y con
   * `onlyRenderVisibleElements` no se monta nada fuera del encuadre. Antes, al cambiar de vista se heredaba el
   * encuadre de la anterior (solo la primera vista se encuadraba).
   */
  const [size, setSize] = useState(shared.size);
  useLayoutEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    if (!size) { const s = { w: el.clientWidth, h: el.clientHeight }; shared.size = s; setSize(s); }
    const ro = new ResizeObserver(([e]) => { if (e) shared.size = { w: e.contentRect.width, h: e.contentRect.height }; });
    ro.observe(el);
    return () => ro.disconnect();
  }, [shared, size, !!viewId && !!view]); // eslint-disable-line react-hooks/exhaustive-deps
  const initialViewport = useMemo(() => {
    if (!viewId || !size) return undefined;
    return shared.viewports.get(viewId) ?? (size.w && size.h ? fitViewport(rfNodes, size.w, size.h) : undefined);
  }, [viewId, size]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al abrir la vista
  const onMoveEnd = useCallback((_: unknown, vp: Viewport) => { if (viewId) shared.viewports.set(viewId, vp); }, [viewId, shared]);

  // Antes del montaje de <ReactFlow> el almacén aún tiene el zoom por defecto: se usa el del encuadre inicial.
  const lowZoom = useStore(s => (s.domNode ? s.transform[2] : initialViewport?.zoom ?? 1) < LOW_DETAIL_ZOOM);
  const nodeEnv = useMemo<NodeEnv>(() => ({ registry, readOnly, dark: effectiveTheme === 'dark', lowDetail: lowZoom, run, setRenaming }), [registry, readOnly, effectiveTheme, lowZoom, run, setRenaming]);

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
    const extra: Command[] = [];
    for (const n of nodes) {
      const vn = store.get('nodes', n.id); if (!vn) continue;
      const start = dragStart.current.get(n.id);
      if (start && start.x === n.position.x && start.y === n.position.y && nodes.length > 1) continue;
      if (seq.active) { const sc = seq.dragStop(n, vn); if (sc !== undefined) { if (sc) extra.push(sc); continue; } }
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
    if (moves.length || extra.length) {
      const cmds: Command[] = [...(moves.length ? [{ type: 'moveNodes', moves } as Command] : []), ...extra];
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
  }, [store, registry, rf, run, readOnly, seq]);

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
    if (seq.active && seq.connect(state)) return;
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
  }, [store, registry, run, viewId, view, readOnly, seq]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const text = visual.text ?? (visual.visualType === 'core:note' ? t('Nota') : visual.visualType === 'core:group' ? t('Grupo') : visual.visualType === 'core:label' ? t('Etiqueta') : undefined);
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
      const tpl = store.get('elements', templateId); if (!tpl) return;
      element = makeElement(tpl.typeId, tpl.name, { doc: tpl.doc, fields: structuredClone(tpl.fields), libraryId: tpl.libraryId, templateId: tpl.id, tags: [...tpl.tags] });
    } else if (typeId) {
      const type = registry.elementType(typeId); if (!type) return;
      element = makeElement(typeId, type.name, { libraryId: type.notationId ? undefined : findLibraryOfType(typeId) });
    }
    if (!element) return;
    const type = registry.elementType(element.typeId);
    const size = defaultSize(type?.shape, !!type?.container);
    const seqAt = seq.active ? seq.drop(element.typeId, pos) : undefined;
    if (seqAt === null) return;
    const at: { x: number; y: number; w?: number; h?: number; parentNodeId?: string; cell?: ViewNode['cell'] } | null = seqAt ?? placeAt(pos, size); if (!at) return;
    const node = makeNode(viewId, undefined, { x: at.x, y: at.y, w: at.w ?? size.w, h: at.h ?? size.h }, { parentNodeId: at.parentNodeId, cell: at.cell, style: { showPorts: false } });
    if (isNew) run({ type: 'addElementToView', element, node });
    else run({ type: 'set', collection: 'nodes', id: node.id, value: { ...node, elementId: element.id } });
    select({ nodes: [node.id], edges: [] });
  }, [rf, run, select, store, registry, viewId, readOnly, placeAt, addVisual, seq]);

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

  // Táctil: pulsación larga (500 ms sin mover el dedo) sobre un nodo abre el mismo menú contextual que el botón derecho.
  // Escucha en fase de captura porque d3-drag (React Flow) corta la propagación del touchstart al empezar a arrastrar.
  useEffect(() => {
    const el = wrapper.current; if (!el) return;
    let lp: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null;
    const cancel = () => { if (lp) { clearTimeout(lp.timer); lp = null; } };
    const start = (e: TouchEvent) => {
      cancel();
      if (e.touches.length !== 1) return;
      const nodeId = (e.target as HTMLElement).closest<HTMLElement>('.react-flow__node')?.dataset.id;
      if (!nodeId || store.get('nodes', nodeId)?.visualType === 'core:cell') return;
      const { clientX: x, clientY: y } = e.touches[0]!;
      lp = { x, y, timer: setTimeout(() => { lp = null; setPaneMenu(null); setMenu({ x, y, nodeId }); }, 500) };
    };
    const move = (e: TouchEvent) => { if (lp && Math.hypot(e.touches[0]!.clientX - lp.x, e.touches[0]!.clientY - lp.y) > 10) cancel(); };
    const opts = { capture: true, passive: true } as const;
    el.addEventListener('touchstart', start, opts); el.addEventListener('touchmove', move, opts);
    el.addEventListener('touchend', cancel, opts); el.addEventListener('touchcancel', cancel, opts);
    return () => { cancel(); el.removeEventListener('touchstart', start, opts); el.removeEventListener('touchmove', move, opts); el.removeEventListener('touchend', cancel, opts); el.removeEventListener('touchcancel', cancel, opts); };
  }, [store]);

  const onPaneContextMenu = useCallback((e: MouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu(null);
    setPaneMenu({ x: e.clientX, y: e.clientY, flow: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  }, [rf]);

  if (!viewId || !view) return <div className="ad-canvas ad-canvas--empty">{t('Elige o crea una vista')}</div>;

  const paneItems: PaneMenuItem[] = paneMenu ? [
    ...(!readOnly ? [
      { label: t('Pegar aquí'), hint: 'Ctrl+V', onClick: () => void pasteFromClipboard('appearance', paneMenu.flow) },
      { label: t('Añadir nota'), onClick: () => addVisual({ visualType: 'core:note' }, paneMenu.flow) },
      { label: t('Comentar aquí'), onClick: () => ed.openComments({ draft: { kind: 'point', viewId, x: Math.round(paneMenu.flow.x), y: Math.round(paneMenu.flow.y) } }) },
    ] : []),
    { label: t('Seleccionar todo'), hint: 'Ctrl+A', onClick: selectAll },
    { label: t('Ajustar a la vista'), hint: 'Ctrl+Shift+F', onClick: () => fitNodes() },
    ...(onRequestLayout && !readOnly ? [{ label: t('Layout automático'), onClick: onRequestLayout }] : []),
  ] : [];

  return (
    <div ref={wrapper} className="ad-canvas" onKeyDown={onKeyDown} tabIndex={0} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <NodeEnvContext.Provider value={nodeEnv}>
      {size && <ReactFlow
        nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(chs) => { const sel = new Set(selection.edges); let c = false; for (const ch of chs) if (ch.type === 'select') { c = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); } if (c) select({ nodes: selection.nodes, edges: [...sel] }); }}
        onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection} onConnectEnd={onConnectEnd}
        onDrop={onDrop} onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu} onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => { setPicker(null); setMenu(null); setPaneMenu(null); }}
        defaultViewport={initialViewport} fitView={!initialViewport} onMoveEnd={onMoveEnd}
        minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} deleteKeyCode={null} multiSelectionKeyCode="Shift" selectionKeyCode="Shift"
        onlyRenderVisibleElements={rfNodes.length > VIRTUALIZE_FROM}
        nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable
        snapToGrid={snap && !alt} snapGrid={SNAP_GRID}
        colorMode={effectiveTheme}
        proOptions={{ hideAttribution: true }}
        connectionRadius={24}
        connectionMode={seq.active ? ConnectionMode.Loose : ConnectionMode.Strict}
      >
        <Background gap={16} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor={(n) => { const vn = (n.data as { node?: ViewNode }).node; const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined; return (el && registry.elementType(el.typeId)?.color) || (effectiveTheme === 'dark' ? '#3a4150' : '#ddd'); }} />
        {peers.length > 0 && <PeerCursors peers={peers} viewId={viewId} />}
        <CommentLayer />
      </ReactFlow>}
      </NodeEnvContext.Provider>
      <AlignBar />
      {picker && (
        <div className="ad-popover" style={{ left: picker.x, top: picker.y }}>
          <div className="ad-popover__title">{t('Tipo de relación')}</div>
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
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const NO_RULE: RuleStyle = {};
const NO_PORTS: Port[] = [];

/** Mismo nodo React Flow: igualdad simple por campo, salvo `position` y `style`, que se comparan por valor. */
function sameRfNode(a: Node, b: Node): boolean {
  const ka = Object.keys(a) as (keyof Node)[];
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    const x = a[k], y = b[k];
    if (Object.is(x, y)) continue;
    if ((k === 'position' || k === 'style') && x && y && typeof x === 'object' && typeof y === 'object') {
      const ox = x as Record<string, unknown>, oy = y as Record<string, unknown>;
      const kx = Object.keys(ox);
      if (kx.length !== Object.keys(oy).length || kx.some(kk => !Object.is(ox[kk], oy[kk]))) return false;
      continue;
    }
    return false;
  }
  return true;
}

/** Encuadre de los nodos (padres antes que hijos) en un lienzo de `width`×`height`, igual que `fitView` (margen 0,1). */
function fitViewport(nodes: Node[], width: number, height: number): Viewport | undefined {
  if (!nodes.length) return undefined;
  const abs = new Map<string, { x: number; y: number }>();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const p = n.parentId ? abs.get(n.parentId) : undefined;
    const x = n.position.x + (p?.x ?? 0), y = n.position.y + (p?.y ?? 0);
    abs.set(n.id, { x, y });
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + (n.width ?? 0)); y1 = Math.max(y1, y + (n.height ?? 0));
  }
  return getViewportForBounds({ x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }, width, height, MIN_ZOOM, MAX_ZOOM, 0.1);
}

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
