/**
 * Utilidades para escribir plantillas: crean registros con ids nuevos sobre un `Workspace` vacío.
 * Los textos se pasan ya traducidos (cada plantilla recibe `t`), así el espacio nace en el idioma activo.
 */
import { emptyWorkspace, makeEdge, makeElement, makeNode, makeRelation, makeView, type Element, type Relation, type View, type ViewEdge, type ViewNode, type Workspace } from '@all-draw/core';

export type Tr = (key: string, vars?: Record<string, string | number>) => string;

export interface Kit {
  ws: Workspace;
  el(typeId: string, name: string, extra?: Partial<Element>): Element;
  view(name: string, extra?: Partial<View>): View;
  node(view: View, el: Element | undefined, x: number, y: number, w?: number, h?: number, extra?: Partial<ViewNode>): ViewNode;
  rel(typeId: string, a: Element, b: Element, extra?: Partial<Relation>): Relation;
  edge(view: View, r: Relation, a: ViewNode, b: ViewNode, extra?: Partial<ViewEdge>): ViewEdge;
  /** Relación + arista en una vista. */
  link(view: View, typeId: string, a: ViewNode, b: ViewNode, extra?: Partial<Relation>, edgeExtra?: Partial<ViewEdge>): Relation;
  /** Etiqueta de texto suelta (nodo visual `core:label`). */
  label(view: View, text: string, x: number, y: number, w?: number, h?: number): ViewNode;
  done(current: View): Workspace;
}

export function kit(name: string): Kit {
  const ws = emptyWorkspace(name);
  ws.meta.createdAt = new Date().toISOString();
  const k: Kit = {
    ws,
    el(typeId, n, extra = {}) { const e = makeElement(typeId, n, extra); ws.elements[e.id] = e; return e; },
    view(n, extra = {}) { const v = makeView(n, extra); ws.views[v.id] = v; return v; },
    node(v, e, x, y, w = 160, h = 56, extra = {}) { const n = makeNode(v.id, e?.id, { x, y, w, h }, extra); ws.nodes[n.id] = n; return n; },
    rel(typeId, a, b, extra = {}) { const r = makeRelation(typeId, { elementId: a.id }, { elementId: b.id }, extra); ws.relations[r.id] = r; return r; },
    edge(v, r, a, b, extra = {}) { const e = makeEdge(v.id, r.id, a.id, b.id, extra); ws.edges[e.id] = e; return e; },
    link(v, typeId, a, b, extra = {}, edgeExtra = {}) {
      const ea = a.elementId ? ws.elements[a.elementId] : undefined, eb = b.elementId ? ws.elements[b.elementId] : undefined;
      if (!ea || !eb) throw new Error('link: nodo sin elemento');
      const r = k.rel(typeId, ea, eb, extra); k.edge(v, r, a, b, edgeExtra); return r;
    },
    label(v, text, x, y, w = 140, h = 28) { const n = makeNode(v.id, undefined, { x, y, w, h }, { visualType: 'core:label', text }); ws.nodes[n.id] = n; return n; },
    done(current) { ws.meta.currentViewId = current.id; return ws; },
  };
  return k;
}
