/**
 * Layout automático con ELK (elkjs). Produce un **comando** (`batch` de `moveNodes` y `patch` de
 * tamaño para contenedores), nunca muta el store: el editor lo pasa por su historial y los agentes
 * lo aplican con `execute`.
 *
 * - Jerarquía: los nodos con `parentNodeId` son hijos ELK (`INCLUDE_CHILDREN`) con padding para la
 *   cabecera del contenedor. Las posiciones devueltas son relativas al padre, como en el modelo.
 * - Vistas grid: se hace layout por celda; los nodos conservan su `cell`.
 * - Puertos: las aristas con `fromPortId`/`toPortId` crean puertos ELK en el lado por el que el
 *   editor los pinta (salida a la derecha, entrada a la izquierda).
 *
 * Por defecto usa `elkjs/lib/elk.bundled.js` (sin web workers). `createElkWorkerLayout(worker)`
 * construye el mismo motor sobre `elkjs/lib/elk-api.js` para que la app lo ejecute en un Worker.
 */
import ElkBundled from 'elkjs/lib/elk.bundled.js';
import ElkApi from 'elkjs/lib/elk-api.js';
import type { ELK, ElkNode, ElkExtendedEdge, ElkPort } from 'elkjs/lib/elk-api';
import type { Command, NotationRegistry, Store, ViewEdge, ViewNode } from '@all-draw/core';
import { sequenceLayoutCommand } from './sequence';

export type LayoutAlgorithm = 'layered' | 'stress' | 'mrtree' | 'force';
export type LayoutDirection = 'DOWN' | 'RIGHT';

export interface LayoutOpts {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
  /** Separación entre nodos (y entre capas) en píxeles. */
  spacing?: number;
}

export interface LayoutEngine {
  layoutView(store: Store, reg: NotationRegistry | undefined, viewId: string, opts?: LayoutOpts): Promise<Command>;
  layoutSequence(store: Store, viewId: string, reg?: NotationRegistry): Promise<Command>;
}

type LayoutDefaults = Required<Pick<LayoutOpts, 'algorithm' | 'direction'>>;

/**
 * Algoritmo y dirección por notación, **por id de pack** (`flow`, `uml`… no el nombre de la carpeta). Un test recorre
 * los packs reales para que no se cuele un id que no existe ni falte alguno.
 */
export const AUTO_LAYOUT: Readonly<Record<string, LayoutDefaults>> = {
  // Flujos de izquierda a derecha
  bpmn: { algorithm: 'layered', direction: 'RIGHT' },
  statechart: { algorithm: 'layered', direction: 'RIGHT' },
  sequence: { algorithm: 'layered', direction: 'RIGHT' },
  dfd: { algorithm: 'layered', direction: 'RIGHT' },
  // Estructuras y diagramas de flujo de arriba abajo
  archimate: { algorithm: 'layered', direction: 'DOWN' },
  c4: { algorithm: 'layered', direction: 'DOWN' },
  uml: { algorithm: 'layered', direction: 'DOWN' },
  er: { algorithm: 'layered', direction: 'DOWN' },
  flow: { algorithm: 'layered', direction: 'DOWN' },
  // Árbol
  mindmap: { algorithm: 'mrtree', direction: 'RIGHT' },
  // Sin dirección propia
  freeform: { algorithm: 'stress', direction: 'DOWN' },
  grid: { algorithm: 'stress', direction: 'DOWN' },
  catalog: { algorithm: 'stress', direction: 'DOWN' },
};

/** Algoritmo y dirección por defecto según la notación de la vista (id de pack); desconocida → como `freeform`. */
export function autoLayoutDefaults(notationId: string): LayoutDefaults {
  const d = Object.hasOwn(AUTO_LAYOUT, notationId) ? AUTO_LAYOUT[notationId] : undefined;
  return { ...(d ?? AUTO_LAYOUT.freeform!) };
}

/** Padding interior de un contenedor según su figura (espacio para la cabecera o la banda lateral). */
export function containerPadding(shape: string | undefined): { top: number; left: number; bottom: number; right: number } {
  if (shape === 'pool') return { top: 12, left: 40, bottom: 12, right: 12 };
  if (shape === 'lane') return { top: 12, left: 34, bottom: 12, right: 12 };
  return { top: 36, left: 12, bottom: 12, right: 12 };
}

const ALGO_ID: Record<LayoutAlgorithm, string> = {
  layered: 'org.eclipse.elk.layered',
  stress: 'org.eclipse.elk.stress',
  mrtree: 'org.eclipse.elk.mrtree',
  force: 'org.eclipse.elk.force',
};

// ---------------------------------------------------------------- Construcción del grafo
interface Tree {
  byId: Map<string, ViewNode>;
  children: Map<string | null, ViewNode[]>;
  /** Padre efectivo (solo si está en la vista). */
  parentOf: (n: ViewNode) => string | null;
}

function buildTree(nodes: ViewNode[]): Tree {
  const byId = new Map(nodes.map(n => [n.id, n] as const));
  const parentOf = (n: ViewNode) => (n.parentNodeId && byId.has(n.parentNodeId) ? n.parentNodeId : null);
  const children = new Map<string | null, ViewNode[]>();
  for (const n of nodes) {
    const p = parentOf(n);
    const list = children.get(p) ?? [];
    list.push(n);
    children.set(p, list);
  }
  return { byId, children, parentOf };
}

function isContainer(n: ViewNode, store: Store, reg: NotationRegistry | undefined, tree: Tree): boolean {
  if ((tree.children.get(n.id)?.length ?? 0) > 0) return true;
  if (!n.elementId) return n.visualType === 'core:group';
  const el = store.get('elements', n.elementId);
  const type = el && reg ? reg.elementType(el.typeId) : undefined;
  return !!type?.container;
}

function shapeOf(n: ViewNode, store: Store, reg: NotationRegistry | undefined): string | undefined {
  if (!n.elementId) return n.visualType === 'core:group' ? 'group' : undefined;
  const el = store.get('elements', n.elementId);
  return el && reg ? reg.elementType(el.typeId)?.shape : undefined;
}

const portElkId = (nodeId: string, portId: string, side: 'in' | 'out') => `${nodeId}\u0000${portId}\u0000${side}`;

interface Built { root: ElkNode; nodeIds: Set<string> }

/**
 * Convierte un conjunto de nodos de primer nivel (y sus descendientes) en un grafo ELK. Las aristas
 * se cuelgan de la raíz (ELK admite cualquier ancestro común).
 */
function buildGraph(
  store: Store, reg: NotationRegistry | undefined, tree: Tree, roots: ViewNode[], edges: ViewEdge[], opts: Required<LayoutOpts>,
): Built {
  const nodeIds = new Set<string>();
  const ports = new Map<string, ElkPort[]>();
  const collect = (n: ViewNode) => { nodeIds.add(n.id); for (const c of tree.children.get(n.id) ?? []) collect(c); };
  roots.forEach(collect);

  const mine = edges.filter(e => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId) && e.fromNodeId !== e.toNodeId);
  const addPort = (nodeId: string, portId: string, side: 'in' | 'out') => {
    const id = portElkId(nodeId, portId, side);
    const list = ports.get(nodeId) ?? [];
    if (!list.some(p => p.id === id)) list.push({ id, width: 9, height: 9, layoutOptions: { 'elk.port.side': side === 'out' ? 'EAST' : 'WEST' } });
    ports.set(nodeId, list);
    return id;
  };
  const elkEdges: ElkExtendedEdge[] = mine.map(e => ({
    id: e.id,
    sources: [e.fromPortId ? addPort(e.fromNodeId, e.fromPortId, 'out') : e.fromNodeId],
    targets: [e.toPortId ? addPort(e.toNodeId, e.toPortId, 'in') : e.toNodeId],
  }));

  const toElk = (n: ViewNode): ElkNode => {
    const kids = tree.children.get(n.id) ?? [];
    const container = isContainer(n, store, reg, tree);
    const node: ElkNode = { id: n.id, width: Math.max(1, n.w), height: Math.max(1, n.h), layoutOptions: {} };
    const p = ports.get(n.id);
    if (p) { node.ports = p; node.layoutOptions!['elk.portConstraints'] = 'FIXED_SIDE'; }
    if (container && kids.length > 0) {
      const pad = containerPadding(shapeOf(n, store, reg));
      node.children = kids.map(toElk);
      node.layoutOptions!['elk.padding'] = `[top=${pad.top},left=${pad.left},bottom=${pad.bottom},right=${pad.right}]`;
      node.layoutOptions!['elk.nodeSize.constraints'] = 'MINIMUM_SIZE';
      node.layoutOptions!['elk.nodeSize.minimum'] = `(${Math.max(1, n.w)},${Math.max(1, n.h)})`;
    }
    return node;
  };

  const layoutOptions: Record<string, string> = {
    'elk.algorithm': ALGO_ID[opts.algorithm],
    'elk.direction': opts.direction,
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.spacing.nodeNode': String(opts.spacing),
    'elk.spacing.edgeNode': String(Math.round(opts.spacing / 2)),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.spacing),
    'elk.layered.spacing.edgeNodeBetweenLayers': String(Math.round(opts.spacing / 2)),
    'elk.stress.desiredEdgeLength': String(opts.spacing * 4),
    'elk.padding': '[top=0,left=0,bottom=0,right=0]',
  };
  return { root: { id: 'root', layoutOptions, children: roots.map(toElk), edges: elkEdges }, nodeIds };
}

// ---------------------------------------------------------------- Resultado → comando
interface Move { id: string; x: number; y: number }
interface Resize { id: string; w: number; h: number }

function collectResult(node: ElkNode, tree: Tree, moves: Move[], resizes: Resize[], offset: { x: number; y: number }) {
  for (const c of node.children ?? []) {
    const orig = tree.byId.get(c.id);
    if (!orig) continue;
    const x = Math.round((c.x ?? 0) + offset.x), y = Math.round((c.y ?? 0) + offset.y);
    if (x !== orig.x || y !== orig.y) moves.push({ id: c.id, x, y });
    if (c.children?.length) {
      const w = Math.round(c.width ?? orig.w), h = Math.round(c.height ?? orig.h);
      if (w !== orig.w || h !== orig.h) resizes.push({ id: c.id, w, h });
      collectResult(c, tree, moves, resizes, { x: 0, y: 0 });
    }
  }
}

/**
 * `stress` y `force` no respetan el tamaño de los nodos: se pasa después `sporeOverlap` nivel a
 * nivel (de abajo arriba) para separar solapes conservando la disposición.
 */
async function removeOverlaps(elk: ELK, node: ElkNode, spacing: number): Promise<void> {
  if (!node.children?.length) return;
  for (const c of node.children) await removeOverlaps(elk, c, spacing);
  const pass: ElkNode = await elk.layout({
    id: node.id,
    layoutOptions: { 'elk.algorithm': 'org.eclipse.elk.sporeOverlap', 'elk.spacing.nodeNode': String(spacing), 'elk.padding': node.layoutOptions?.['elk.padding'] ?? '[top=0,left=0,bottom=0,right=0]' },
    children: node.children.map(c => ({ id: c.id, x: c.x, y: c.y, width: c.width, height: c.height })),
  });
  const pos = new Map((pass.children ?? []).map(c => [c.id, c] as const));
  for (const c of node.children) { const p = pos.get(c.id); if (p) { c.x = p.x; c.y = p.y; } }
  node.width = pass.width;
  node.height = pass.height;
}

/** Ejecuta el layout de una vista con un motor ELK concreto y devuelve el comando. */
export async function layoutViewWith(elk: ELK, store: Store, reg: NotationRegistry | undefined, viewId: string, opts: LayoutOpts = {}): Promise<Command> {
  const view = store.get('views', viewId);
  if (view?.kind === 'sequence') return sequenceLayoutCommand(store, viewId);
  const defaults = autoLayoutDefaults(view?.notationId ?? 'freeform');
  const full: Required<LayoutOpts> = { algorithm: opts.algorithm ?? defaults.algorithm, direction: opts.direction ?? defaults.direction, spacing: opts.spacing ?? 40 };
  const nodes = store.list('nodes').filter(n => n.viewId === viewId);
  const edges = store.list('edges').filter(e => e.viewId === viewId);
  const tree = buildTree(nodes);
  const roots = tree.children.get(null) ?? [];

  // Grupos de primer nivel: uno por celda en vistas grid, uno solo en el resto.
  const groups = new Map<string, ViewNode[]>();
  const isGrid = view?.kind === 'grid';
  for (const r of roots) {
    const key = isGrid ? (r.cell ? `${r.cell.layerId}|${r.cell.stageId}` : '') : '';
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const moves: Move[] = [];
  const resizes: Resize[] = [];
  const pad = isGrid ? 12 : 0;
  for (const [, groupRoots] of groups) {
    if (groupRoots.length === 0) continue;
    const { root } = buildGraph(store, reg, tree, groupRoots, edges, full);
    const result = await elk.layout(root);
    if (full.algorithm === 'stress' || full.algorithm === 'force') await removeOverlaps(elk, result, full.spacing);
    // Conserva la esquina del grupo: el layout empieza en (minX, minY) de los nodos actuales (o 0 en celdas).
    const minX = isGrid ? pad : Math.max(0, Math.min(...groupRoots.map(r => r.x)));
    const minY = isGrid ? pad : Math.max(0, Math.min(...groupRoots.map(r => r.y)));
    collectResult(result, tree, moves, resizes, { x: minX, y: minY });
  }

  const commands: Command[] = [];
  if (moves.length) commands.push({ type: 'moveNodes', moves });
  for (const r of resizes) commands.push({ type: 'patch', collection: 'nodes', id: r.id, patch: { w: r.w, h: r.h } });
  return { type: 'batch', label: 'layout', commands };
}

/** Motor de layout sobre una instancia ELK. */
export function createLayoutEngine(elk: ELK): LayoutEngine {
  return {
    layoutView: (store, reg, viewId, opts) => layoutViewWith(elk, store, reg, viewId, opts),
    layoutSequence: (store, viewId, reg) => layoutViewWith(elk, store, reg, viewId, { algorithm: 'layered', direction: 'RIGHT' }),
  };
}

/**
 * Motor que ejecuta ELK en un Web Worker que aporta la app (por ejemplo
 * `new Worker(new URL('elkjs/lib/elk-worker.min.js', import.meta.url))`).
 */
export function createElkWorkerLayout(worker: Worker): LayoutEngine {
  const elk = new ElkApi({ workerFactory: () => worker });
  return createLayoutEngine(elk);
}

let defaultElk: ELK | undefined;
function bundled(): ELK {
  defaultElk ??= new ElkBundled();
  return defaultElk;
}

/** Layout de una vista con el ELK empaquetado (sin workers). */
export function layoutView(store: Store, reg: NotationRegistry | undefined, viewId: string, opts: LayoutOpts = {}): Promise<Command> {
  return layoutViewWith(bundled(), store, reg, viewId, opts);
}

/** Layout de flujo (statechart, bpmn): capas de izquierda a derecha. */
export function layoutSequence(store: Store, viewId: string, reg?: NotationRegistry): Promise<Command> {
  return layoutViewWith(bundled(), store, reg, viewId, { algorithm: 'layered', direction: 'RIGHT' });
}
