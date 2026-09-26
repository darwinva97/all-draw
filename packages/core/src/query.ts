/** Consultas e índices derivados (se recalculan sobre el snapshot; el editor los memoiza por cambio). */
import type { Store } from './store';
import type { Dimension, View, ViewEdge, ViewNode, Relation, Element } from './model';
import type { NotationRegistry } from './notation';

export function nodesOfView(store: Store, viewId: string): ViewNode[] { return store.list('nodes').filter(n => n.viewId === viewId); }
export function edgesOfView(store: Store, viewId: string): ViewEdge[] { return store.list('edges').filter(e => e.viewId === viewId); }
export function nodesOfElement(store: Store, elementId: string): ViewNode[] { return store.list('nodes').filter(n => n.elementId === elementId); }
export function edgesOfRelation(store: Store, relationId: string): ViewEdge[] { return store.list('edges').filter(e => e.relationId === relationId); }
export function relationsOfElement(store: Store, elementId: string): Relation[] {
  return store.list('relations').filter(r => r.from.elementId === elementId || r.to.elementId === elementId);
}

/** Vistas donde aparece el elemento, agrupadas: las que lo detallan (root) y las que lo contienen. */
export function viewsOfElement(store: Store, elementId: string): { details: View[]; appearsIn: View[] } {
  const views = store.list('views');
  const details = views.filter(v => v.rootElementId === elementId);
  const inIds = new Set(nodesOfElement(store, elementId).map(n => n.viewId));
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
