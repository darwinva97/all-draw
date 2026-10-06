import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef, type DragEvent, type MouseEvent } from 'react';
type DragEv = globalThis.MouseEvent | globalThis.TouchEvent;
import {
  ReactFlow, Background, Controls, ControlButton, MiniMap, useReactFlow, useStore, ReactFlowProvider, ViewportPortal, useViewport, ConnectionMode, getViewportForBounds,
  type Node, type Edge, type Viewport, type NodeChange, type Connection, type IsValidConnection, type OnConnectEnd, type OnConnectStart, type FinalConnectionState,
  type AriaLabelConfig,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  makeElement, makeNode, makeRelation, makeEdge, allPorts, compatibleRelationTypes, indexOf, resolveStyle, type ViewNode, type Command, type Element,
  type ElementType, type Port, type RuleStyle,
} from '@all-draw/core';
import { useEditor } from './context';
import { useT, useLang } from '@all-draw/i18n';
import { useCollection, useRecord } from './hooks';
import { ElementNode, sameElementData, nodeText, titleCovered, type ElementNodeData } from './nodes/ElementNode';
import { ContainerTitles } from './nodes/ContainerTitles';
import { VisualNode, type VisualNodeData } from './nodes/VisualNode';
import { NodeEnvContext, LOW_DETAIL_ZOOM, type NodeEnv } from './nodes/env';
import { showTypeNamesOf } from './nodes/label';
import { isJunction, JUNCTION_SIZE } from '@all-draw/notation-archimate';
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
import { GanttGridNode, GanttScaleNode, GanttBarNode, GanttDependencyEdge } from './views/GanttNodes';
import { useGanttCanvas } from './views/gantt-canvas';
import { deleteSelection } from './delete-selection';
import { filterBpmnConnections } from './bpmn-rules';
import { compartmentHeight } from './nodes/compartments';
import { usePanGestures } from './pan';
import { useWheelMode, setWheelMode } from './prefs';
import { darken } from './nodes/shapes';
import { groupRelationOptions, pruneBridges, explainNoRelation, type RelationGroups } from './edges/relation-options';
import { LiteEdge, type LiteEdgeData } from './edges/LiteEdge';
import { creatableTargets, type CreateCandidate } from './edges/connect-assist';
import { ConnectFeedback, CreateConnectMenu, type ConnectFeedbackVerdict } from './panels/ConnectAssist';
import { noteTypeUsed, recentTypes } from './prefs';
import { WelcomeNote, WELCOME_PROP } from './panels/WelcomeNote';
import { toast } from './ui/toast';
import { Icon } from './icons';

export const CELL_PREFIX = 'cell:';
const isCellId = (id: string | undefined | null) => !!id && id.startsWith(CELL_PREFIX);

const nodeTypes = { element: ElementNode, visual: VisualNode, lifeline: LifelineNode, activation: ActivationNode, fragment: FragmentNode, ganttGrid: GanttGridNode, ganttScale: GanttScaleNode, ganttBar: GanttBarNode };
const edgeTypes = { relation: RelationEdge, relationLite: LiteEdge, sequenceMessage: SequenceMessageEdge, ganttDep: GanttDependencyEdge };

export const DND_TYPE = 'application/x-all-draw-type';
export const DND_TEMPLATE = 'application/x-all-draw-template';
export const DND_ELEMENT = 'application/x-all-draw-element';
/** Nodo visual (nota, grupo, etiqueta, imagen): JSON `{ visualType, text?, src? }`. */
export const DND_VISUAL = 'application/x-all-draw-visual';

export const SNAP_GRID: [number, number] = [8, 8];
/** A partir de tantos nodos en la vista, React Flow solo monta los que caen dentro del viewport. */
export const VIRTUALIZE_FROM = 300;
/**
 * Montaje por tandas: con más de `BATCH_FROM` nodos, al abrir la vista se monta primero una tanda de `BATCH_FIRST`
 * (los más cercanos al centro de lo que se ve) y después `BATCH_STEP` más en cada frame; mientras tanto, los que faltan
 * se ven como siluetas. Así el primer frame llega pronto y entre tandas el navegador atiende la entrada.
 */
export const BATCH_FROM = 150;
export const BATCH_FIRST = 60;
export const BATCH_STEP = 150;

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

interface Picker { x: number; y: number; groups: RelationGroups; onPick: (typeId: string) => void }
interface CreateMenu { x: number; y: number; flow: { x: number; y: number }; sourceId: string; fromHandle: string | null; candidates: CreateCandidate[] }
/** Silueta de un nodo que aún no se ha montado (montaje por tandas). */
interface Ghost { id: string; x: number; y: number; w: number; h: number; color: string }
/** Orden de montaje de una vista grande: ids por cercanía al centro visible, padre de cada uno y siluetas. */
interface BatchPlan { order: string[]; all: Set<string>; parent: Map<string, string>; ghosts: Ghost[] }
interface LiveBox { x?: number; y?: number; w?: number; h?: number }

function CanvasInner({ onRequestLayout, shared }: CanvasProps & { shared: CanvasShared }) {
  const ed = useEditor();
  const t = useT();
  const [lang] = useLang();
  const { store, registry, viewId, run, selection, select, readOnly, presence, effectiveTheme, snap, renaming, setRenaming } = ed;
  const view = useRecord('views', viewId);
  const nodesVersion = useCollection('nodes');
  const edgesVersion = useCollection('edges');
  const elementsVersion = useCollection('elements');
  const seq = useSequenceCanvas(view, { nodes: nodesVersion, edges: edgesVersion });
  // Gantt: barras calculadas de las fechas sobre una rejilla de tiempo (views/gantt*).
  const gantt = useGanttCanvas(view, { nodes: nodesVersion, edges: edgesVersion });
  const rf = useReactFlow();
  const [picker, setPicker] = useState<Picker | null>(null);
  const [createMenu, setCreateMenu] = useState<CreateMenu | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number; flow: { x: number; y: number } } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ x: number; y: number; edgeId: string } | null>(null);
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
    if (gantt.active) synthetic.push(...gantt.synthetic());
    const cellIds = new Set(synthetic.map(n => n.id));
    // Nodos con hijos: su nombre va en la banda superior, como en un contenedor.
    const kidsOf = new Map<string, { x: number; y: number; w: number; h: number }[]>();
    for (const n of mine) if (n.parentNodeId && byId.has(n.parentNodeId)) {
      const lv = live[n.id];
      const list = kidsOf.get(n.parentNodeId) ?? [];
      list.push({ x: lv?.x ?? n.x, y: lv?.y ?? n.y, w: lv?.w ?? n.w, h: lv?.h ?? n.h });
      kidsOf.set(n.parentNodeId, list);
    }
    const showTypes = showTypeNamesOf(view);
    const selectedIds = new Set(selection.nodes);
    const out = [...synthetic, ...ordered.map(n => {
      const el = n.elementId ? store.get('elements', n.elementId) : undefined;
      const type = el ? registry.elementType(el.typeId) : undefined;
      const notation = el ? registry.notationOf(el.typeId) : undefined;
      const dimmed = !!(el && view && notation !== view.notationId && notation !== 'freeform' && !el.libraryId)
        || !!(el && view && !registry.inViewpoint(view.notationId, view.viewpointId, el.typeId));
      const isCell = n.visualType === 'core:cell';
      const lv = live[n.id];
      // Clase, entidad…: el nodo crece hasta que caben todas sus filas (y sus pines quedan dentro).
      const minH = el && type?.meta?.compartments ? compartmentHeight(el, type) : 0;
      const w = lv?.w ?? n.w, h = Math.max(lv?.h ?? n.h, minH);
      const vn = lv ? { ...n, x: lv.x ?? n.x, y: lv.y ?? n.y, w, h } : n;
      const editing = renaming === n.id || undefined;
      const remoteColor = remoteSel.get(n.id);
      const old = prev.get(n.id)?.data;
      let data: ElementNodeData | VisualNodeData;
      if (n.elementId) {
        const kids = kidsOf.get(n.id);
        const d: ElementNodeData = { node: vn, element: el, type, rule: el ? styleOf(el) : NO_RULE, ports: el ? portsOf(el) : NO_PORTS, archimate: notation === 'archimate', dimmed, remoteColor, editing, hasChildren: kids ? true : undefined };
        // Un hijo tapa el título de la banda: lo pinta `ContainerTitles`, encima de los hijos.
        if (kids && !editing && titleCovered(d, nodeText(d, { lowDetail: false, showTypeNames: showTypes }), kids)) d.titleAbove = true;
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
        // Lector de pantalla: «Nombre (Tipo)» en vez del id interno.
        ariaLabel: el ? (el.name ? (type ? `${el.name} (${type.name})` : el.name) : type?.name ?? '') : n.text ?? undefined,
      } satisfies Node;
      return keep(seq.active ? seq.decorateNode(n, base) : gantt.active ? gantt.decorateNode(n, base, lv) : base);
    })];
    nodeCache.current = next;
    return out;
  }, [nodesVersion, viewId, view, store, registry, selection.nodes, readOnly, elementsVersion, live, remoteSel, effectiveTheme, seq, gantt, renaming, styleOf, portsOf, libraries]);

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
  /** ¿Se ve el minimapa? (en móvil no): el encuadre le deja sitio abajo para que no tape nodos. */
  const minimapShown = () => !wrapper.current?.closest('.ad-editor--mobile');
  // Vista vacía: 100 % en el origen, sin encuadre automático (con `fitView`, el primer nodo soltado se encuadraba al 400 %).
  const initialViewport = useMemo(() => {
    if (!viewId || !size) return undefined;
    return shared.viewports.get(viewId) ?? (size.w && size.h ? fitViewport(rfNodes, size.w, size.h, minimapShown()) : undefined) ?? EMPTY_VIEWPORT;
  }, [viewId, size]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al abrir la vista
  const onMoveEnd = useCallback((_: unknown, vp: Viewport) => { if (viewId) shared.viewports.set(viewId, vp); }, [viewId, shared]);
  // Moverse sin mover nodos: Espacio, herramienta mano (H), botón central, interior de contenedores, rueda (ver pan.ts).
  const [hand, setHand] = useState(false);
  const wheel = useWheelMode();
  const { spaceHeld, panning } = usePanGestures(wrapper, rf, { hand, wheel, onPanEnd: vp => onMoveEnd(null, vp) });

  // Antes del montaje de <ReactFlow> el almacén aún tiene el zoom por defecto: se usa el del encuadre inicial.
  const lowZoom = useStore(s => (s.domNode ? s.transform[2] : initialViewport?.zoom ?? 1) < LOW_DETAIL_ZOOM);
  const showTypeNames = showTypeNamesOf(view);
  const nodeEnv = useMemo<NodeEnv>(() => ({ registry, readOnly, dark: effectiveTheme === 'dark', lowDetail: lowZoom, showTypeNames, run, setRenaming }), [registry, readOnly, effectiveTheme, lowZoom, showTypeNames, run, setRenaming]);

  // ---------------------------------------------------------------- montaje por tandas (vistas grandes)
  /** Plan de montaje: se calcula una vez al abrir la vista (con su encuadre inicial). */
  const batchPlan = useMemo<BatchPlan | null>(() => {
    if (!viewId || !view || !size || !initialViewport || view.kind === 'grid' || view.kind === 'sequence' || view.kind === 'gantt') return null;
    if (rfNodes.length <= BATCH_FROM) return null;
    const colorOf = (n: Node) => { const el = (n.data as Partial<ElementNodeData>).element; return (el && registry.elementType(el.typeId)?.color) || (effectiveTheme === 'dark' ? '#3a4150' : '#dddddd'); };
    return planBatches(rfNodes, initialViewport, size, colorOf);
  }, [viewId, !!size]); // eslint-disable-line react-hooks/exhaustive-deps -- solo al abrir la vista
  const [mountLimit, setMountLimit] = useState(BATCH_FIRST);
  const mounting = !!batchPlan && mountLimit < batchPlan.order.length;
  const mountingRef = useRef(mounting); mountingRef.current = mounting;
  const allowed = useMemo(() => (batchPlan && mounting ? mountSet(batchPlan, mountLimit) : null), [batchPlan, mounting, mountLimit]);
  /** Nodos que se entregan a React Flow: todos, o los de las tandas ya montadas (y los nuevos, que no están en el plan). */
  const shownNodes = useMemo(() => {
    if (!allowed || !batchPlan) return rfNodes;
    return rfNodes.filter(n => allowed.has(n.id) || !batchPlan.all.has(n.id));
  }, [rfNodes, allowed, batchPlan]);
  const ghosts = useMemo(() => (allowed && batchPlan ? batchPlan.ghosts.filter(g => !allowed.has(g.id)) : null), [allowed, batchPlan]);
  useEffect(() => {
    if (!mounting) return;
    // Tras pintar el frame de esta tanda (rAF + tarea), la siguiente.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => { timer = setTimeout(() => setMountLimit(l => l + BATCH_STEP), 0); });
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [mounting, mountLimit]);

  const rfEdges = useMemo<Edge[]>(() => {
    if (!viewId) return [];
    const prev = edgeCache.current;
    const next = new Map<string, Edge>();
    const ids = new Set(shownNodes.map(n => n.id));
    // Zoom bajo: aristas simplificadas (`LiteEdge`), salvo en secuencia y Gantt, que pintan las suyas.
    const lite = lowZoom && !seq.active && !gantt.active;
    const dark = effectiveTheme === 'dark';
    const selectedIds = new Set(selection.edges);
    const nameOf = (nodeId: string) => {
      const vn = store.get('nodes', nodeId); const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined;
      return el ? (el.name || registry.elementType(el.typeId)?.name || '') : vn?.text ?? '';
    };
    const out = indexOf(store).edgesOfView(viewId).filter(e => ids.has(e.fromNodeId) && ids.has(e.toNodeId)).map(e => {
      const selected = selectedIds.has(e.id);
      const old = prev.get(e.id);
      // Lector de pantalla: «origen → destino (tipo)» en vez de «Edge from vn_… to vn_…».
      const rel = e.relationId ? store.get('relations', e.relationId) : undefined;
      const typeName = rel ? registry.relationType(rel.typeId)?.name ?? rel.typeId : '';
      const ariaLabel = `${nameOf(e.fromNodeId)} → ${nameOf(e.toNodeId)}${typeName ? ` (${typeName})` : ''}${rel?.name ? ` «${rel.name}»` : ''}`;
      // Misma arista del modelo y misma selección: el mismo objeto (las de secuencia se decoran de nuevo cada vez).
      let data: { edge: typeof e } | LiteEdgeData = { edge: e };
      if (lite) {
        const rt = rel ? registry.relationType(rel.typeId) : undefined;
        const line = e.style.line ?? rt?.line;
        data = { edge: e, color: e.style.color ?? rt?.color ?? (dark ? '#9aa3b2' : '#444'), dash: line === 'dashed' ? '8 5' : line === 'dotted' ? '2 4' : undefined };
      }
      const type = lite ? 'relationLite' : 'relation';
      const od = old?.data as Partial<LiteEdgeData> | undefined;
      if (!seq.active && old && old.type === type && od?.edge === e && od.color === (data as Partial<LiteEdgeData>).color && old.selected === selected && old.ariaLabel === ariaLabel) { next.set(e.id, old); return old; }
      const base: Edge = {
        id: e.id, type, source: e.fromNodeId, target: e.toNodeId,
        sourceHandle: e.fromPortId ?? '', targetHandle: e.toPortId ?? '',
        data, selected, ariaLabel,
      };
      const out = seq.active ? seq.decorateEdge(e, base) : gantt.active ? gantt.decorateEdge(e, base) : base;
      next.set(e.id, out);
      return out;
    });
    edgeCache.current = next;
    return out;
  }, [edgesVersion, store, registry, viewId, shownNodes, selection.edges, seq, gantt, elementsVersion, lowZoom, effectiveTheme]);


  // ---------------------------------------------------------------- API del lienzo para otros paneles
  const fitOptions = useCallback(() => {
    const el = wrapper.current;
    return { duration: 300, padding: fitPadding(el?.clientWidth ?? 0, el?.clientHeight ?? 0, minimapShown()), maxZoom: FIT_MAX_ZOOM };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fitNodes = useCallback((nodeIds?: string[]) => {
    const fit = () => {
      if (nodeIds?.length) rf.fitView({ nodes: nodeIds.map(id => ({ id })), duration: 300, padding: 0.4, maxZoom: 1.5 });
      else rf.fitView(fitOptions());
    };
    // Aún montando por tandas: se monta todo y se encuadra cuando React Flow ya conoce los nodos.
    if (mountingRef.current) { setMountLimit(Number.MAX_SAFE_INTEGER); requestAnimationFrame(() => requestAnimationFrame(fit)); }
    else fit();
  }, [rf, fitOptions]);
  const selectAll = useCallback(() => {
    if (!viewId) return;
    select({ nodes: indexOf(store).nodesOfView(viewId).filter(n => n.visualType !== 'core:cell').map(n => n.id), edges: indexOf(store).edgesOfView(viewId).map(e => e.id) });
  }, [store, viewId, select]);
  useEffect(() => {
    ed.canvas.current = {
      fitView: fitNodes,
      zoomIn: () => rf.zoomIn({ duration: 150 }),
      zoomOut: () => rf.zoomOut({ duration: 150 }),
      // 100 % alrededor del centro de lo que se ve (antes conservaba la traslación y el contenido podía salir de pantalla).
      resetZoom: () => { const el = wrapper.current; rf.setViewport(zoomAroundCenter(rf.getViewport(), el?.clientWidth ?? 0, el?.clientHeight ?? 0, 1), { duration: 150 }); },
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
        // Gantt: estirar una barra cambia sus fechas, no el tamaño del nodo.
        const gc = gantt.active ? gantt.resizeEnd(ch.id, { x: lv?.x, w: ch.dimensions.width }) : undefined;
        if (gc !== undefined) { if (gc) commits.push(gc); setLiveOf(ch.id, undefined); continue; }
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
  }, [selection, select, run, readOnly, gantt]);

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
      if (gantt.active) { const gc = gantt.dragStop(n, vn); if (gc !== undefined) { if (gc) extra.push(gc); continue; } }
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
  }, [store, registry, rf, run, readOnly, seq, gantt]);

  /** Nodo desde el que se empezó a arrastrar: es siempre el origen (en modo `loose` React Flow puede darle la vuelta). */
  const connectFrom = useRef<string | null>(null);
  const onConnectStart = useCallback<OnConnectStart>((_, p) => { connectFrom.current = p.nodeId; }, []);

  const isValidConnection = useCallback<IsValidConnection>((c) => {
    const flip = connectFrom.current !== null && c.target === connectFrom.current && c.source !== connectFrom.current;
    const oriented = flip ? { source: c.target, target: c.source, sourceHandle: c.targetHandle ?? null, targetHandle: c.sourceHandle ?? null } : c;
    return relationOptions(oriented).length > 0;
  }, [store, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Relaciones posibles; con `detail`, también las que la matriz permitía antes de las reglas de pools de BPMN. */
  function relationOptions(c: Connection | Edge, detail?: { matrix: string[] }): string[] {
    const a = store.get('nodes', c.source), b = store.get('nodes', c.target);
    const ea = a?.elementId ? store.get('elements', a.elementId) : undefined;
    const eb = b?.elementId ? store.get('elements', b.elementId) : undefined;
    if (!ea || !eb) return [];
    let opts = registry.allowedRelations(ea.typeId, eb.typeId);
    const viaPorts = !!(c.sourceHandle || c.targetHandle);
    if (viaPorts) {
      const pa = c.sourceHandle ? allPorts(ea, registry.fieldsOf(ea.typeId)).find(p => p.id === c.sourceHandle) : undefined;
      const pb = c.targetHandle ? allPorts(eb, registry.fieldsOf(eb.typeId)).find(p => p.id === c.targetHandle) : undefined;
      const compat = compatibleRelationTypes(registry.allPacks().flatMap(p => p.portRules ?? []), pa?.portTypeId, pb?.portTypeId);
      if (compat) { const set = new Set(compat); const filtered = opts.filter(o => set.has(o)); opts = filtered.length ? filtered : compat; }
    }
    // Entre tipos de una notación con matriz, las genéricas (enlace, traza…) no salvan una relación que la matriz prohíbe.
    opts = pruneBridges(registry, ea.typeId, eb.typeId, opts, viaPorts);
    if (detail) detail.matrix = opts;
    // BPMN: flujo de secuencia solo dentro de la misma pool; flujo de mensaje solo entre pools distintas. Si eso deja
    // solo las genéricas (enlace, traza…), tampoco valen: la matriz no las salva (como en `pruneBridges`).
    return pruneBridges(registry, ea.typeId, eb.typeId, filterBpmnConnections(store, c.source, c.target, opts), viaPorts);
  }

  const onConnectEnd = useCallback<OnConnectEnd>((event, state: FinalConnectionState) => {
    const from = connectFrom.current; connectFrom.current = null;
    if (readOnly || !state.fromNode || !viewId) return;
    // Secuencia: los manejadores de la línea de vida ya ocupan toda su altura; sin manejador válido no se conecta.
    if (seq.active) { if (!state.isValid || !state.toNode || seq.connect(state)) return; }
    // Soltar sobre el cuerpo del nodo (no solo junto a un manejador) también conecta: el destino es el nodo bajo el
    // puntero. Si React Flow ya resolvió un manejador válido, manda ese (pines).
    const pt = pointOf(event);
    const sourceId = from ?? state.fromNode.id;
    const byHandle = state.isValid && state.toNode && state.toNode.id !== sourceId ? state.toNode.id : undefined;
    const targetId = byHandle ?? (pt ? nodeAtPoint(pt.x, pt.y, sourceId) : undefined);
    const fromHandle = state.fromHandle && state.fromNode.id === sourceId ? state.fromHandle.id ?? null : null;
    // Soltar en un hueco vacío: «Crear y conectar» con los tipos que admiten la relación desde el origen.
    if (!targetId && pt && canCreateConnect && !overAnyNode(pt.x, pt.y) && insideCanvas(wrapper.current, pt)) { openCreateMenu(sourceId, fromHandle, pt); return; }
    if (!targetId || isCellId(targetId) || !store.get('nodes', targetId)?.elementId) return;
    const c: Connection = { source: sourceId, target: targetId, sourceHandle: fromHandle || null, targetHandle: byHandle ? state.toHandle?.id || null : null };
    const detail = { matrix: [] as string[] };
    const opts = relationOptions(c, detail);
    if (!opts.length) {
      const ea = store.get('elements', store.get('nodes', sourceId)?.elementId ?? ''), eb = store.get('elements', store.get('nodes', targetId)?.elementId ?? '');
      if (ea && eb) { const why = explainNoRelation(registry, t, ea.typeId, eb.typeId, detail.matrix.length > 0); toast.warning(why.title, { description: why.description, id: 'ad-connect-invalid' }); }
      return;
    }
    const create = (typeId: string) => {
      const a = store.get('nodes', c.source)!, b = store.get('nodes', c.target)!;
      const rel = makeRelation(typeId, { elementId: a.elementId!, portId: c.sourceHandle || undefined }, { elementId: b.elementId!, portId: c.targetHandle || undefined });
      if (c.sourceHandle && c.targetHandle) rel.mappings.push({ fromPath: c.sourceHandle.split('#')[1] ?? c.sourceHandle, toPath: c.targetHandle.split('#')[1] ?? c.targetHandle });
      run({ type: 'connect', relation: rel, edge: makeEdge(viewId, undefined, a.id, b.id, { fromPortId: c.sourceHandle || undefined, toPortId: c.targetHandle || undefined }) });
      setPicker(null);
    };
    const ea = store.get('elements', store.get('nodes', sourceId)!.elementId!)!;
    const def = view ? registry.pack(view.notationId)?.defaultRelation : undefined;
    if (opts.length === 1) create(opts[0]!);
    else setPicker({ x: pt?.x ?? 0, y: pt?.y ?? 0, groups: groupRelationOptions(registry, opts, ea.typeId, def), onPick: create });
  }, [store, registry, run, viewId, view, readOnly, seq, t, rf]); // eslint-disable-line react-hooks/exhaustive-deps

  /** «Crear y conectar» solo donde el lienzo coloca nodos libremente (no en secuencia ni en Gantt). */
  const canCreateConnect = !readOnly && !seq.active && !gantt.active;
  const openCreateMenu = (sourceId: string, fromHandle: string | null, pt: { x: number; y: number }) => {
    const src = store.get('nodes', sourceId); const ea = src?.elementId ? store.get('elements', src.elementId) : undefined;
    if (!ea || !view) return;
    const usage = new Map<string, number>();
    for (const e of store.list('elements')) usage.set(e.typeId, (usage.get(e.typeId) ?? 0) + 1);
    const libraryTypes = store.list('libraries').flatMap(l => l.elementTypes.map(x => registry.elementType(x.id) ?? x));
    const candidates = creatableTargets(registry, ea.typeId, view.notationId, view.viewpointId, { libraryTypes, usage, recent: recentTypes() });
    if (!candidates.length) {
      toast.info(t('«{from}» no puede ser origen de ninguna relación en esta vista', { from: registry.elementType(ea.typeId)?.name ?? ea.typeId }), { id: 'ad-connect-invalid' });
      return;
    }
    setPicker(null); setMenu(null); setPaneMenu(null); setEdgeMenu(null);
    setCreateMenu({ x: pt.x, y: pt.y, flow: rf.screenToFlowPosition(pt), sourceId, fromHandle, candidates });
  };
  /** Crea el elemento en el punto donde se soltó y la relación desde el origen: un solo paso de deshacer. */
  const createAndConnect = (cm: CreateMenu, c: CreateCandidate) => {
    if (readOnly || !viewId) return;
    const a = store.get('nodes', cm.sourceId); const type = registry.elementType(c.typeId);
    if (!a?.elementId || !type) return;
    const element = makeElement(c.typeId, isJunction(c.typeId) ? '' : type.name, { libraryId: type.notationId ? undefined : findLibraryOfType(c.typeId) });
    const size = defaultSize(type.shape, !!type.container, c.typeId);
    const at = placeAt(cm.flow, size);
    if (!at) { toast.warning(t('Suelta dentro de una celda para crear el elemento')); return; }
    const node = makeNode(viewId, undefined, { x: at.x, y: at.y, w: size.w, h: size.h }, { parentNodeId: at.parentNodeId, cell: at.cell, style: { showPorts: false } });
    const relation = makeRelation(c.relationId, { elementId: a.elementId, portId: cm.fromHandle || undefined }, { elementId: element.id });
    const edge = makeEdge(viewId, undefined, a.id, node.id, { fromPortId: cm.fromHandle || undefined });
    run({ type: 'batch', label: 'crear y conectar', commands: [{ type: 'addElementToView', element, node }, { type: 'connect', relation, edge }] });
    select({ nodes: [node.id], edges: [] });
    noteTypeUsed(c.typeId);
  };
  /** Veredicto de la etiqueta flotante al pasar sobre `targetId` mientras se arrastra una conexión. */
  const evaluateConnect = useCallback((sourceId: string, targetId: string, fromHandle: string | null, toHandle: string | null): ConnectFeedbackVerdict | null => {
    if (isCellId(targetId) || targetId.startsWith('hdr:')) return null;
    const ea = store.get('elements', store.get('nodes', sourceId)?.elementId ?? ''), eb = store.get('elements', store.get('nodes', targetId)?.elementId ?? '');
    if (!ea || !eb) return null;
    const detail = { matrix: [] as string[] };
    const opts = relationOptions({ source: sourceId, target: targetId, sourceHandle: fromHandle, targetHandle: toHandle }, detail);
    if (opts.length) {
      const g = groupRelationOptions(registry, opts, ea.typeId, view ? registry.pack(view.notationId)?.defaultRelation : undefined);
      const first = g.native[0] ?? g.bridge[0]!;
      const name = registry.relationType(first)?.name ?? first;
      return { ok: true, text: opts.length === 1 ? t('Se creará «{rel}»', { rel: name }) : t('«{rel}» u otra relación ({n} posibles)', { rel: name, n: opts.length }) };
    }
    const why = explainNoRelation(registry, t, ea.typeId, eb.typeId, detail.matrix.length > 0);
    return { ok: false, text: why.title, detail: why.description };
  }, [store, registry, view, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const connectSource = useCallback(() => connectFrom.current, []);

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
      element = makeElement(typeId, isJunction(typeId) ? '' : type.name, { libraryId: type.notationId ? undefined : findLibraryOfType(typeId) });
      noteTypeUsed(typeId);
    }
    if (!element) return;
    const type = registry.elementType(element.typeId);
    const size = defaultSize(type?.shape, !!type?.container, element.typeId);
    const seqAt = seq.active ? seq.drop(element.typeId, pos) : undefined;
    if (seqAt === null) return;
    // Gantt: la fila bajo el puntero da el padre y el orden, y la x el día de inicio.
    const ganttAt = gantt.active ? gantt.drop(element.typeId, pos) : undefined;
    if (ganttAt?.fields && isNew) element = { ...element, fields: { ...element.fields, ...ganttAt.fields } };
    const at: { x: number; y: number; w?: number; h?: number; parentNodeId?: string; cell?: ViewNode['cell'] } | null = seqAt ?? ganttAt ?? placeAt(pos, size); if (!at) return;
    const node = makeNode(viewId, undefined, { x: at.x, y: at.y, w: at.w ?? size.w, h: at.h ?? size.h }, { parentNodeId: at.parentNodeId, cell: at.cell, style: { showPorts: false } });
    if (isNew) run({ type: 'addElementToView', element, node });
    else run({ type: 'set', collection: 'nodes', id: node.id, value: { ...node, elementId: element.id } });
    select({ nodes: [node.id], edges: [] });
  }, [rf, run, select, store, registry, viewId, readOnly, placeAt, addVisual, seq, gantt]);

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
    if (!mod && !e.altKey && !e.shiftKey && key === 'h') { e.preventDefault(); setHand(h => !h); return; }
    if (!mod && !e.altKey && !e.shiftKey && key === 'v') { setHand(false); return; }
    if (e.key === 'Escape') { setHand(false); setPicker(null); setCreateMenu(null); setMenu(null); setPaneMenu(null); setEdgeMenu(null); setRenaming(null); return; }
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
      // Supr quita de esta vista (nodos y aristas); Shift+Supr borra del modelo las relaciones de las aristas (con confirmación).
      e.preventDefault();
      const sel = { nodes: selection.nodes, edges: selection.edges };
      // Lo borrado tenía el foco: se devuelve al lienzo para que Ctrl+Z y el resto de atajos sigan funcionando.
      void deleteSelection(store, run, sel, e.shiftKey, t).then(done => { if (done) select({ nodes: [], edges: [] }); wrapper.current?.focus({ preventScroll: true }); });
      return;
    }
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) ed.history.redo(); else ed.history.undo(); }
    if (mod && key === 'y') { e.preventDefault(); ed.history.redo(); }
  }, [selection, store, run, select, readOnly, ed.history, ed.canvas, copy, pasteFromClipboard, duplicate, selectAll, fitNodes, rf, setRenaming, nudge, t]);

  // Si desaparece el elemento que tenía el foco (nodo quitado, pegado deshecho, menú o edición cerrados), el foco
  // vuelve al lienzo: si no, se queda en <body> y Ctrl+Z, Ctrl+V o Ctrl+D dejan de responder.
  useEffect(() => {
    const el = wrapper.current; if (!el) return;
    let last: globalThis.Element | null = null;
    const restore = () => {
      if (last && !last.isConnected && (!document.activeElement || document.activeElement === document.body)) { last = null; el.focus({ preventScroll: true }); }
    };
    const onIn = (e: FocusEvent) => { last = e.target as globalThis.Element; };
    // Foco que sale a otro sitio (clic en un panel): no hay nada que devolver.
    const onOut = (e: FocusEvent) => { const target = e.target as globalThis.Element; queueMicrotask(() => { if (target.isConnected && last === target) last = null; else restore(); }); };
    const mo = new MutationObserver(restore);
    el.addEventListener('focusin', onIn); el.addEventListener('focusout', onOut);
    mo.observe(el, { childList: true, subtree: true });
    return () => { el.removeEventListener('focusin', onIn); el.removeEventListener('focusout', onOut); mo.disconnect(); };
  }, [viewId, !!view]); // eslint-disable-line react-hooks/exhaustive-deps

  // La selección no guarda ids que ya no existen (deshacer un pegado, quitar desde otro panel o desde otra persona).
  useEffect(() => {
    const nodes = selection.nodes.filter(id => store.get('nodes', id));
    const edges = selection.edges.filter(id => store.get('edges', id));
    if (nodes.length !== selection.nodes.length || edges.length !== selection.edges.length) select({ nodes, edges });
  }, [nodesVersion, edgesVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Textos de accesibilidad de React Flow en el idioma de la interfaz (controles, minimapa, descripciones de nodo y arista).
  const ariaLabelConfig = useMemo<Partial<AriaLabelConfig>>(() => {
    const dirs: Record<string, string> = { up: t('hacia arriba'), down: t('hacia abajo'), left: t('a la izquierda'), right: t('a la derecha') };
    return {
      'node.a11yDescription.default': t('Pulsa Intro o Espacio para seleccionar un nodo. Supr lo quita de esta vista y Escape cancela.'),
      'node.a11yDescription.keyboardDisabled': t('Pulsa Intro o Espacio para seleccionar un nodo; después, las flechas lo mueven. Supr lo quita de esta vista y Escape cancela.'),
      'node.a11yDescription.ariaLiveMessage': ({ direction, x, y }) => t('Nodo movido {dir}. Nueva posición: x {x}, y {y}', { dir: dirs[direction] ?? direction, x, y }),
      'edge.a11yDescription.default': t('Pulsa Intro o Espacio para seleccionar una relación. Supr la quita de esta vista y Escape cancela.'),
      'controls.ariaLabel': t('Controles del lienzo'),
      'controls.zoomIn.ariaLabel': t('Acercar'),
      'controls.zoomOut.ariaLabel': t('Alejar'),
      'controls.fitView.ariaLabel': t('Ajustar a la vista'),
      'controls.interactive.ariaLabel': t('Bloquear o desbloquear la edición'),
      'minimap.ariaLabel': t('Minimapa'),
      'handle.ariaLabel': t('Punto de conexión'),
    };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setPaneMenu(null); setEdgeMenu(null);
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

  /** Botón derecho sobre una arista: comentar, quitar de esta vista o borrar la relación del modelo. */
  const onEdgeContextMenu = useCallback((e: MouseEvent, edge: Edge) => {
    e.preventDefault();
    if (seq.active || !store.get('edges', edge.id)) return;
    setMenu(null); setPaneMenu(null);
    select({ nodes: [], edges: [edge.id] });
    setEdgeMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id });
  }, [seq.active, store, select]);

  const onPaneContextMenu = useCallback((e: MouseEvent | globalThis.MouseEvent) => {
    e.preventDefault();
    setMenu(null); setEdgeMenu(null);
    setPaneMenu({ x: e.clientX, y: e.clientY, flow: rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
  }, [rf]);

  /** Coloca el elemento raíz de la vista (vista de detalle recién creada en otra dimensión) y lo selecciona. */
  const placeRoot = useCallback((elementId: string) => {
    if (readOnly || !viewId) return;
    const el = store.get('elements', elementId); if (!el) return;
    const type = registry.elementType(el.typeId);
    const sz = defaultSize(type?.shape, !!type?.container, el.typeId);
    const node = makeNode(viewId, el.id, { x: 40, y: 40, w: sz.w, h: sz.h }, { style: { showPorts: false } });
    run({ type: 'set', collection: 'nodes', id: node.id, value: node });
    select({ nodes: [node.id], edges: [] });
  }, [readOnly, viewId, store, registry, run, select]);

  if (!viewId || !view) return <div className="ad-canvas ad-canvas--empty">{t('Elige o crea una vista')}</div>;

  // Vista vacía: qué hacer (y, si es la vista de detalle de un elemento de otra dimensión, colocarlo con un clic).
  const isEmpty = view.kind !== 'grid' && !rfNodes.some(n => !isCellId(n.id) && !n.id.startsWith('hdr:'));
  const root = isEmpty && view.rootElementId ? store.get('elements', view.rootElementId) : undefined;
  const pack = registry.pack(view.notationId);
  const example = isEmpty && pack ? exampleType(pack)?.name : undefined;
  /** Nota de bienvenida de la plantilla de la que salió el espacio (`props.welcome` de la vista). */
  const welcome = !readOnly ? view.props?.[WELCOME_PROP] : undefined;

  const minimapColor = (n: Node) => { const vn = (n.data as { node?: ViewNode }).node; const el = vn?.elementId ? store.get('elements', vn.elementId) : undefined; return (el && registry.elementType(el.typeId)?.color) || (effectiveTheme === 'dark' ? '#3a4150' : '#dddddd'); };

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
  const edgeMenuEdge = edgeMenu ? store.get('edges', edgeMenu.edgeId) : undefined;
  const edgeItems: PaneMenuItem[] = edgeMenu && edgeMenuEdge ? [
    { label: t('Comentar'), onClick: () => ed.openComments({ draft: { kind: 'edge', id: edgeMenuEdge.id, viewId: edgeMenuEdge.viewId } }) },
    ...(!readOnly ? [
      { label: t('Quitar de esta vista'), hint: t('Supr'), onClick: () => { void deleteSelection(store, run, { nodes: [], edges: [edgeMenuEdge.id] }, false, t).then(d => { if (d) select({ nodes: [], edges: [] }); wrapper.current?.focus({ preventScroll: true }); }); } },
      ...(edgeMenuEdge.relationId && store.get('relations', edgeMenuEdge.relationId) ? [{ label: t('Borrar del modelo'), hint: t('Shift+Supr'), danger: true, onClick: () => { void deleteSelection(store, run, { nodes: [], edges: [edgeMenuEdge.id] }, true, t).then(d => { if (d) select({ nodes: [], edges: [] }); wrapper.current?.focus({ preventScroll: true }); }); } }] : []),
    ] : []),
  ] : [];

  return (
    <div ref={wrapper} className={`ad-canvas${hand || spaceHeld ? ' is-hand' : ''}${panning ? ' is-panning' : ''}`} onKeyDown={onKeyDown} tabIndex={0} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} data-mounting={mounting ? batchPlan!.order.length - (allowed?.size ?? 0) : undefined}>
      <NodeEnvContext.Provider value={nodeEnv}>
      {size && <ReactFlow
        nodes={shownNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(chs) => { const sel = new Set(selection.edges); let c = false; for (const ch of chs) if (ch.type === 'select') { c = true; if (ch.selected) sel.add(ch.id); else sel.delete(ch.id); } if (c) select({ nodes: selection.nodes, edges: [...sel] }); }}
        onNodeDragStart={onNodeDragStart} onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection} onConnectStart={onConnectStart} onConnectEnd={onConnectEnd}
        onDrop={onDrop} onDragOver={onDragOver}
        onNodeDoubleClick={onNodeDoubleClick} onNodeContextMenu={onNodeContextMenu} onEdgeDoubleClick={onEdgeDoubleClick} onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onPaneClick={() => { setPicker(null); setCreateMenu(null); setMenu(null); setPaneMenu(null); setEdgeMenu(null); }}
        defaultViewport={initialViewport} fitView={!initialViewport} onMoveEnd={onMoveEnd}
        minZoom={MIN_ZOOM} maxZoom={MAX_ZOOM} deleteKeyCode={null} multiSelectionKeyCode="Shift" selectionKeyCode="Shift" panActivationKeyCode={null}
        onlyRenderVisibleElements={rfNodes.length > VIRTUALIZE_FROM}
        nodesDraggable={!readOnly} nodesConnectable={!readOnly} elementsSelectable
        snapToGrid={snap && !alt && !gantt.active} snapGrid={SNAP_GRID}
        colorMode={effectiveTheme}
        proOptions={{ hideAttribution: true }}
        connectionRadius={24}
        connectionMode={ConnectionMode.Loose}
        ariaLabelConfig={ariaLabelConfig}
      >
        <Background gap={16} />
        <Controls showInteractive={false} showFitView={false}>
          <ControlButton className="react-flow__controls-fitview" onClick={() => fitNodes()} title={t('Ajustar a la vista')} aria-label={t('Ajustar a la vista')}><Icon name="fit" size={12} /></ControlButton>
          <ControlButton className={`ad-control-hand${hand ? ' is-on' : ''}`} onClick={() => setHand(h => !h)} aria-pressed={hand}
            title={hand ? t('Mano activada: arrastrar mueve la vista (H o Esc para volver a seleccionar)') : t('Mano (H): arrastrar mueve la vista sin mover nada. También: mantener Espacio o el botón central')}
            aria-label={t('Herramienta mano')}><Icon name="hand" size={14} /></ControlButton>
          <ControlButton className={`ad-control-wheel${wheel === 'zoom' ? ' is-on' : ''}`} onClick={() => setWheelMode(wheel === 'pan' ? 'zoom' : 'pan')} aria-pressed={wheel === 'zoom'}
            title={wheel === 'pan' ? t('Rueda del ratón: desplaza (Ctrl+rueda hace zoom) · clic para que la rueda haga zoom') : t('Rueda del ratón: hace zoom · clic para que la rueda desplace')}
            aria-label={t('La rueda del ratón hace zoom')}><Icon name="mouse" size={14} /></ControlButton>
        </Controls>
        {/* Minimapa más pequeño y translúcido (opaco al pasar el puntero); las figuras blancas llevan borde. */}
        <MiniMap pannable zoomable className="ad-minimap" style={{ width: MINIMAP.w, height: MINIMAP.h }}
          bgColor={effectiveTheme === 'dark' ? 'rgba(22,26,34,.72)' : 'rgba(255,255,255,.72)'}
          nodeColor={(n) => minimapColor(n)} nodeStrokeColor={(n) => darken(minimapColor(n), 0.35)} nodeStrokeWidth={2} />
        {peers.length > 0 && <PeerCursors peers={peers} viewId={viewId} />}
        {ghosts && ghosts.length > 0 && <GhostLayer ghosts={ghosts} />}
        {!readOnly && !seq.active && !gantt.active && <ConnectFeedback sourceId={connectSource} evaluate={evaluateConnect} nodeAt={nodeAtPoint} overNode={overAnyNode} canCreate={canCreateConnect} />}
        <CommentLayer />
        <ContainerTitles nodes={rfNodes} />
      </ReactFlow>}
      </NodeEnvContext.Provider>
      <AlignBar />
      {isEmpty && (
        <div className="ad-canvas-hint" role="note">
          {root ? <>
            <p className="ad-canvas-hint__title">{t('Vista «{view}» de «{name}»', { view: pack?.name ?? view.notationId, name: root.name || registry.elementType(root.typeId)?.name || '' })}</p>
            <p>{t('Describe aquí «{name}» con esta notación: arrastra tipos de la paleta (por ejemplo, {example}) y conéctalos.', { name: root.name || '', example: example ?? '' })}</p>
            {!readOnly && <button type="button" className="ad-btn ad-btn--primary" onClick={() => placeRoot(root.id)}>{t('Colocar «{name}» en esta vista', { name: root.name || registry.elementType(root.typeId)?.name || '' })}</button>}
          </> : <>
            <p className="ad-canvas-hint__title">{t('Vista vacía')}</p>
            <p>{readOnly ? t('Esta vista aún no tiene elementos.') : t('Arrastra aquí un tipo de la paleta (por ejemplo, {example}) o pulsa Ctrl+K para buscar.', { example: example ?? '' })}</p>
          </>}
        </div>
      )}
      {createMenu && <CreateConnectMenu x={createMenu.x} y={createMenu.y} candidates={createMenu.candidates}
        typeName={id => registry.elementType(id)?.name ?? id} typeColor={id => registry.elementType(id)?.color} relationName={id => registry.relationType(id)?.name ?? id}
        onPick={c => createAndConnect(createMenu, c)} onClose={() => setCreateMenu(null)} />}
      {welcome && <WelcomeNote viewId={viewId} text={welcome} />}
      {picker && <RelationPicker picker={picker} title={t('Tipo de relación')} bridgeTitle={t('Trazabilidad')} nameOf={o => registry.relationType(o)?.name ?? o} docOf={o => registry.relationType(o)?.doc} />}
      {menu && <NodeMenu x={menu.x} y={menu.y} nodeId={menu.nodeId} onClose={() => setMenu(null)} />}
      {paneMenu && <PaneMenu x={paneMenu.x} y={paneMenu.y} items={paneItems} onClose={() => setPaneMenu(null)} />}
      {edgeMenu && edgeItems.length > 0 && <PaneMenu x={edgeMenu.x} y={edgeMenu.y} items={edgeItems} onClose={() => setEdgeMenu(null)} />}
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

/**
 * Selector «Tipo de relación»: las de la notación (la habitual primero) y, bajo «Trazabilidad», las genéricas. Con
 * nombres traducidos (no ids), el foco en la primera opción y dentro de la ventana aunque se suelte cerca del borde.
 */
function RelationPicker({ picker, title, bridgeTitle, nameOf, docOf }: { picker: Picker; title: string; bridgeTitle: string; nameOf: (id: string) => string; docOf: (id: string) => string | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: picker.x, top: picker.y });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(picker.x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(picker.y, window.innerHeight - r.height - 8)) });
    el.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [picker]);
  const item = (o: string) => <button key={o} type="button" role="menuitem" className="ad-popover__item" title={docOf(o)} data-relation={o} onClick={() => picker.onPick(o)}>{nameOf(o)}</button>;
  return (
    <div ref={ref} className="ad-popover ad-relpicker" role="menu" aria-label={title} style={pos}>
      <div className="ad-popover__title">{title}</div>
      {picker.groups.native.map(item)}
      {picker.groups.bridge.length > 0 && <div className="ad-popover__section">{bridgeTitle}</div>}
      {picker.groups.bridge.map(item)}
    </div>
  );
}

// ---------------------------------------------------------------- utilidades
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
/** El encuadre automático (al abrir una vista o «Ajustar a la vista») no amplía por encima del 100 %. */
export const FIT_MAX_ZOOM = 1;
const EMPTY_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
export const MINIMAP = { w: 168, h: 112 } as const;

/** Margen del encuadre en px; con minimapa, abajo se reserva su alto para que no tape los nodos de la esquina. */
export function fitPadding(width: number, height: number, minimap: boolean): { top: `${number}px`; right: `${number}px`; bottom: `${number}px`; left: `${number}px` } {
  const m = Math.round(Math.max(16, Math.min(48, Math.min(width, height) * 0.06)));
  const bottom = minimap && height > 420 ? Math.max(m, MINIMAP.h + 24) : m;
  return { top: `${m}px`, right: `${m}px`, bottom: `${bottom}px`, left: `${m}px` };
}

/** Encuadre con otro zoom alrededor del centro de lo que se ve (Ctrl+0). */
export function zoomAroundCenter(vp: Viewport, width: number, height: number, zoom: number): Viewport {
  const cx = (width / 2 - vp.x) / vp.zoom, cy = (height / 2 - vp.y) / vp.zoom;
  return { x: width / 2 - cx * zoom, y: height / 2 - cy * zoom, zoom };
}

/**
 * Tipo de ejemplo para la pista de la vista vacía: uno "de contenido" (no pool, lane, grupo ni pseudoestado) que pueda
 * ser origen de la relación habitual de la notación (BPMN: Tarea, no Proceso; estados: Estado, no Inicial).
 */
export function exampleType(pack: { elementTypes: ElementType[]; validity?: Record<string, Record<string, string[]>>; defaultRelation?: string }): ElementType | undefined {
  const content = pack.elementTypes.filter(x => !x.abstract && !['pool', 'lane', 'group', 'label', 'circle', 'double-circle', 'bar', 'diamond'].includes(x.shape ?? ''));
  const local = (id: string) => id.slice(id.indexOf(':') + 1);
  const def = pack.defaultRelation;
  const origin = def && pack.validity ? content.find(x => Object.values(pack.validity![local(x.id)] ?? {}).some(rels => rels.includes(def))) : undefined;
  return origin ?? content[0] ?? pack.elementTypes[0];
}

/** Punto (pantalla) donde terminó un arrastre, con ratón o con el dedo. */
function pointOf(e: globalThis.MouseEvent | globalThis.TouchEvent): { x: number; y: number } | undefined {
  if ('changedTouches' in e) { const t = e.changedTouches[0]; return t ? { x: t.clientX, y: t.clientY } : undefined; }
  return { x: e.clientX, y: e.clientY };
}

/** Nodo (de elemento) más alto bajo el punto; `undefined` si el primero es el propio origen o no hay ninguno. */
function nodeAtPoint(x: number, y: number, exclude: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const el of document.elementsFromPoint(x, y)) {
    const n = (el as HTMLElement).closest?.<HTMLElement>('.react-flow__node');
    if (!n) continue;
    const id = n.dataset.id;
    if (!id || isCellId(id) || id.startsWith('hdr:')) continue;
    return id === exclude ? undefined : id;
  }
  return undefined;
}
/** ¿Hay algún nodo (no celda ni cabecera de la rejilla) bajo el punto de pantalla? */
function overAnyNode(x: number, y: number): boolean {
  if (typeof document === 'undefined') return false;
  for (const el of document.elementsFromPoint(x, y)) {
    const n = (el as HTMLElement).closest?.<HTMLElement>('.react-flow__node');
    const id = n?.dataset.id;
    if (id && !isCellId(id) && !id.startsWith('hdr:')) return true;
  }
  return false;
}

/** ¿Está el punto de pantalla dentro del lienzo (y no sobre un panel o un control flotante)? */
function insideCanvas(wrapper: HTMLElement | null, p: { x: number; y: number }): boolean {
  if (!wrapper || typeof document === 'undefined') return false;
  const top = document.elementFromPoint(p.x, p.y);
  return !!top && wrapper.contains(top) && !!top.closest('.react-flow__pane, .react-flow__renderer, .react-flow__edges, .react-flow__edge');
}
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
export function fitViewport(nodes: Node[], width: number, height: number, minimap = false): Viewport | undefined {
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
  return getViewportForBounds({ x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) }, width, height, MIN_ZOOM, FIT_MAX_ZOOM, fitPadding(width, height, minimap));
}

function cellOf(cellNodeId: string): { layerId: string; stageId: string } {
  const [layerId, stageId] = cellNodeId.slice(CELL_PREFIX.length).split('|');
  return { layerId: layerId ?? '', stageId: stageId ?? '' };
}
export function defaultSize(shape: string | undefined, container: boolean, typeId?: string): { w: number; h: number } {
  if (container) return { w: 320, h: 220 };
  // Junction de ArchiMate: el círculo pequeño de Archi.
  if (typeId && isJunction(typeId)) return { w: JUNCTION_SIZE, h: JUNCTION_SIZE };
  // Persona C4: cabeza y cuerpo con el texto dentro (no el monigote pequeño con la etiqueta debajo)
  if (shape === 'actor' && typeId?.startsWith('c4:')) return { w: 160, h: 150 };
  // Almacén DFD: dos líneas con el nombre entre ellas (no la barra de bifurcación)
  if (typeId === 'dfd:DataStore') return { w: 160, h: 44 };
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

/**
 * Plan de montaje por tandas: los nodos por cercanía al centro del encuadre inicial (los visibles antes que los de
 * fuera), con su padre (un hijo no se monta sin él) y sus siluetas en coordenadas absolutas.
 */
export function planBatches(nodes: Node[], vp: Viewport, size: { w: number; h: number }, colorOf: (n: Node) => string): BatchPlan {
  const abs = new Map<string, { x: number; y: number }>();
  const view = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, w: size.w / vp.zoom, h: size.h / vp.zoom };
  const cx = view.x + view.w / 2, cy = view.y + view.h / 2;
  const parent = new Map<string, string>();
  const scored: { id: string; d: number }[] = [];
  const ghosts: Ghost[] = [];
  for (const n of nodes) {
    const p = n.parentId ? abs.get(n.parentId) : undefined;
    if (n.parentId) parent.set(n.id, n.parentId);
    const x = n.position.x + (p?.x ?? 0), y = n.position.y + (p?.y ?? 0), w = n.width ?? 0, h = n.height ?? 0;
    abs.set(n.id, { x, y });
    const inside = x + w >= view.x && y + h >= view.y && x <= view.x + view.w && y <= view.y + view.h;
    const d = Math.hypot(x + w / 2 - cx, y + h / 2 - cy);
    scored.push({ id: n.id, d: inside ? d : 1e12 + d });
    ghosts.push({ id: n.id, x, y, w, h, color: colorOf(n) });
  }
  scored.sort((a, b) => a.d - b.d);
  return { order: scored.map(s => s.id), all: new Set(abs.keys()), parent, ghosts };
}

/** Ids montados con un límite de `limit`: los primeros del plan y, con cada uno, sus antecesores. */
export function mountSet(plan: Pick<BatchPlan, 'order' | 'parent'>, limit: number): Set<string> {
  const out = new Set<string>();
  for (const id of plan.order) {
    if (out.size >= limit) break;
    let cur: string | undefined = id;
    while (cur && !out.has(cur)) { out.add(cur); cur = plan.parent.get(cur); }
  }
  return out;
}

/** Siluetas de los nodos que aún no se han montado (un solo SVG en coordenadas del lienzo). */
function GhostLayer({ ghosts }: { ghosts: Ghost[] }) {
  return (
    <ViewportPortal>
      <svg className="ad-ghosts" width={1} height={1} aria-hidden="true">
        {ghosts.map(g => <rect key={g.id} x={g.x} y={g.y} width={g.w} height={g.h} rx={4} fill={g.color} />)}
      </svg>
    </ViewportPortal>
  );
}
