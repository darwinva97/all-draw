/** Consultas e índices derivados (se recalculan sobre el snapshot; el editor los memoiza por cambio). */
import type { Store } from './store';
import type { Comment, CommentAnchor, Dimension, View, ViewEdge, ViewNode, Relation, Element } from './model';
import type { NotationRegistry } from './notation';

// ---------------------------------------------------------------- índices incrementales
/**
 * Índice de nodos y aristas por vista, elemento y relación. Se mantiene al día con `subscribe`:
 * cada cambio solo toca los registros que cambiaron (con `'*'` se reconstruye entero). `version`
 * crece con cada actualización, para memoizar en la interfaz.
 */
export interface StoreIndex {
  nodesOfView(viewId: string): ViewNode[];
  edgesOfView(viewId: string): ViewEdge[];
  nodesOfElement(elementId: string): ViewNode[];
  edgesOfRelation(relationId: string): ViewEdge[];
  /** Vistas en las que aparece un elemento (ids únicos). */
  viewIdsOfElement(elementId: string): string[];
  readonly version: number;
  /** Deja de escuchar el store. */
  dispose(): void;
}

class MultiMap<V extends { id: string }> {
  private m = new Map<string, Map<string, V>>();
  add(key: string | undefined, v: V) { if (!key) return; let s = this.m.get(key); if (!s) this.m.set(key, (s = new Map())); s.set(v.id, v); }
  remove(key: string | undefined, id: string) { if (!key) return; const s = this.m.get(key); if (!s) return; s.delete(id); if (s.size === 0) this.m.delete(key); }
  get(key: string): V[] { const s = this.m.get(key); return s ? [...s.values()] : []; }
  clear() { this.m.clear(); }
}

export function createIndex(store: Store): StoreIndex {
  const nodeById = new Map<string, ViewNode>();
  const edgeById = new Map<string, ViewEdge>();
  const nodesByView = new MultiMap<ViewNode>(), nodesByElement = new MultiMap<ViewNode>();
  const edgesByView = new MultiMap<ViewEdge>(), edgesByRelation = new MultiMap<ViewEdge>();
  let version = 0;

  const putNode = (id: string) => {
    const prev = nodeById.get(id);
    if (prev) { nodesByView.remove(prev.viewId, id); nodesByElement.remove(prev.elementId, id); nodeById.delete(id); }
    const cur = store.get('nodes', id);
    if (cur) { nodeById.set(id, cur); nodesByView.add(cur.viewId, cur); nodesByElement.add(cur.elementId, cur); }
  };
  const putEdge = (id: string) => {
    const prev = edgeById.get(id);
    if (prev) { edgesByView.remove(prev.viewId, id); edgesByRelation.remove(prev.relationId, id); edgeById.delete(id); }
    const cur = store.get('edges', id);
    if (cur) { edgeById.set(id, cur); edgesByView.add(cur.viewId, cur); edgesByRelation.add(cur.relationId, cur); }
  };
  const rebuild = () => {
    nodeById.clear(); edgeById.clear(); nodesByView.clear(); nodesByElement.clear(); edgesByView.clear(); edgesByRelation.clear();
    for (const n of store.list('nodes')) putNode(n.id);
    for (const e of store.list('edges')) putEdge(e.id);
  };
  rebuild();
  const unsubscribe = store.subscribe(ch => {
    if (ch.collection !== 'nodes' && ch.collection !== 'edges') return;
    version++;
    if (ch.ids.includes('*')) { rebuild(); return; }
    // Ids que ya no existen y no conocíamos: nada que hacer. Los demás se reponen.
    for (const id of ch.ids) (ch.collection === 'nodes' ? putNode : putEdge)(id);
  });
  return {
    nodesOfView: id => nodesByView.get(id),
    edgesOfView: id => edgesByView.get(id),
    nodesOfElement: id => nodesByElement.get(id),
    edgesOfRelation: id => edgesByRelation.get(id),
    viewIdsOfElement: id => [...new Set(nodesByElement.get(id).map(n => n.viewId))],
    get version() { return version; },
    dispose: unsubscribe,
  };
}

const INDEXES = new WeakMap<Store, StoreIndex>();
/** Índice compartido de un store (se crea la primera vez y vive lo que viva el store). */
export function indexOf(store: Store): StoreIndex {
  let idx = INDEXES.get(store);
  if (!idx) { idx = createIndex(store); INDEXES.set(store, idx); }
  return idx;
}

export function nodesOfView(store: Store, viewId: string): ViewNode[] { return indexOf(store).nodesOfView(viewId); }
export function edgesOfView(store: Store, viewId: string): ViewEdge[] { return indexOf(store).edgesOfView(viewId); }
export function nodesOfElement(store: Store, elementId: string): ViewNode[] { return indexOf(store).nodesOfElement(elementId); }
export function edgesOfRelation(store: Store, relationId: string): ViewEdge[] { return indexOf(store).edgesOfRelation(relationId); }
export function relationsOfElement(store: Store, elementId: string): Relation[] {
  return store.list('relations').filter(r => r.from.elementId === elementId || r.to.elementId === elementId);
}

/** Vistas donde aparece el elemento, agrupadas: las que lo detallan (root) y las que lo contienen. */
export function viewsOfElement(store: Store, elementId: string): { details: View[]; appearsIn: View[] } {
  const views = store.list('views');
  const details = views.filter(v => v.rootElementId === elementId);
  const inIds = new Set(indexOf(store).viewIdsOfElement(elementId));
  const appearsIn = views.filter(v => inIds.has(v.id) && v.rootElementId !== elementId);
  return { details, appearsIn };
}

/** "Abrir en otra dimensión": para cada dimensión, la vista existente del elemento o null (= crear). */
export function dimensionsOfElement(store: Store, elementId: string): { dimension: Dimension; view: View | null }[] {
  const { details } = viewsOfElement(store, elementId);
  return store.list('dimensions').map(d => ({
    dimension: d,
    view: details.find(v => v.notationId === d.notationId && (!d.viewpointId || v.viewpointId === d.viewpointId)) ?? null,
  }));
}

/** Descendientes de un nodo (anidamiento) en orden de profundidad. */
export function descendants(store: Store, nodeId: string): ViewNode[] {
  const all = store.list('nodes');
  const out: ViewNode[] = [];
  const walk = (id: string) => { for (const n of all) if (n.parentNodeId === id) { out.push(n); walk(n.id); } };
  walk(nodeId);
  return out;
}

/** Elementos huérfanos: sin aparición en ninguna vista. */
export function orphanElements(store: Store): Element[] {
  const used = new Set(store.list('nodes').map(n => n.elementId));
  return store.list('elements').filter(e => !e.template && !used.has(e.id));
}

/** Paleta efectiva para una vista: tipos de su notación (los del viewpoint primero) + tipos de librerías. */
export function paletteFor(store: Store, reg: NotationRegistry, view: View) {
  const pack = reg.pack(view.notationId);
  const inVp = (id: string) => reg.inViewpoint(view.notationId, view.viewpointId, id);
  const notation = (pack?.elementTypes ?? []).filter(t => !t.abstract).map(t => ({ type: t, dimmed: !inVp(t.id) }));
  const libs = store.list('libraries').flatMap(l => l.elementTypes.map(t => ({ type: t, dimmed: false, libraryId: l.id })));
  const templates = store.list('elements').filter(e => e.template);
  return { notation, libs, templates };
}

// ---------------------------------------------------------------- comentarios
/** Un hilo: el primer comentario (`root`, lleva `resolved`) y todos en orden cronológico. */
export interface CommentThread {
  id: string;
  root: Comment;
  comments: Comment[];
  anchor: CommentAnchor;
  resolved: boolean;
  /** Fecha del último comentario o edición (ISO). */
  updatedAt: string;
}

const THREADS = new WeakMap<readonly Comment[], CommentThread[]>();
/** Todos los hilos, del más reciente al más antiguo (memoizado por versión de la colección). */
export function commentThreads(store: Store): CommentThread[] {
  const list = store.list('comments');
  let out = THREADS.get(list);
  if (out) return out;
  const groups = new Map<string, Comment[]>();
  for (const c of list) { const g = groups.get(c.threadId); if (g) g.push(c); else groups.set(c.threadId, [c]); }
  out = [];
  for (const [id, cs] of groups) {
    cs.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
    const root = cs.find(c => c.id === id) ?? cs[0]!;
    const updatedAt = cs.reduce((m, c) => { const d = c.editedAt && c.editedAt > c.createdAt ? c.editedAt : c.createdAt; return d > m ? d : m; }, '');
    out.push({ id, root, comments: root === cs[0] ? cs : [root, ...cs.filter(c => c !== root)], anchor: root.anchor, resolved: !!root.resolved, updatedAt });
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  THREADS.set(list, out);
  return out;
}

/** Vistas en las que se ve un ancla (un elemento o relación puede aparecer en varias). */
export function anchorViewIds(store: Store, a: CommentAnchor): string[] {
  switch (a.kind) {
    case 'view': return a.id ? [a.id] : a.viewId ? [a.viewId] : [];
    case 'point': return a.viewId ? [a.viewId] : [];
    case 'node': { const v = (a.id && store.get('nodes', a.id)?.viewId) || a.viewId; return v ? [v] : []; }
    case 'edge': { const v = (a.id && store.get('edges', a.id)?.viewId) || a.viewId; return v ? [v] : []; }
    case 'element': return a.id ? indexOf(store).viewIdsOfElement(a.id) : [];
    case 'relation': return a.id ? [...new Set(indexOf(store).edgesOfRelation(a.id).map(e => e.viewId))] : [];
  }
}

/**
 * Hilos anclados a `anchor`: mismo `kind` y, si se dan, mismo `id` y misma vista. Así
 * `{ kind: 'point', viewId }` devuelve todos los puntos comentados de una vista.
 */
export function threadsOf(store: Store, anchor: Partial<CommentAnchor> & { kind: CommentAnchor['kind'] }): CommentThread[] {
  return commentThreads(store).filter(t => t.anchor.kind === anchor.kind
    && (anchor.id === undefined || t.anchor.id === anchor.id)
    && (anchor.viewId === undefined || anchorViewIds(store, t.anchor).includes(anchor.viewId)));
}

/** Hilos visibles en una vista: de la vista, de sus puntos, nodos y aristas, y de los elementos y relaciones que aparecen en ella. */
export function threadsOfView(store: Store, viewId: string): CommentThread[] {
  return commentThreads(store).filter(t => anchorViewIds(store, t.anchor).includes(viewId));
}

/** Hilos sin resolver (de una vista, o de todo el espacio). */
export function openThreadCount(store: Store, viewId?: string | null): number {
  return (viewId ? threadsOfView(store, viewId) : commentThreads(store)).filter(t => !t.resolved).length;
}
