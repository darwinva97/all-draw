/** Fábricas compactas de espacios BPMN y de estados para los tests (ids fijos, posiciones en orden de declaración). */
import { emptyWorkspace, makeElement, makeNode, makeRelation, makeEdge, makeView, type Workspace } from '@all-draw/core';

export interface NodeSpec { id: string; type: string; name?: string; fields?: Record<string, unknown>; parent?: string; props?: Record<string, string>; detailView?: string }
export interface FlowSpec { id?: string; from: string; to: string; condition?: string; default?: boolean; name?: string; type?: string; fields?: Record<string, unknown> }

/**
 * Vista con un nodo por elemento (`n:<id>`) y una arista por flujo (`e:<id>`). El orden de declaración es el orden
 * espacial (y = índice × 100), que es el que usan los motores para desempatar.
 */
export function workspaceOf(notationId: string, nodes: NodeSpec[], flows: FlowSpec[], opts: { ws?: Workspace; viewId?: string; relationType?: string } = {}): { ws: Workspace; viewId: string } {
  const ws = opts.ws ?? emptyWorkspace('test');
  const view = makeView(opts.viewId ?? 'v', { id: opts.viewId ?? 'v', notationId });
  ws.views[view.id] = view;
  const abs = new Map<string, number>();
  nodes.forEach((s, i) => {
    const prefix = notationId === 'statechart' ? 'statechart' : 'bpmn';
    const typeId = s.type.includes(':') ? s.type : `${prefix}:${s.type}`;
    if (!ws.elements[s.id]) ws.elements[s.id] = makeElement(typeId, s.name ?? s.id, { id: s.id, fields: s.fields ?? {}, props: s.props ?? {} });
    const y = i * 100;
    abs.set(s.id, y);
    const parentY = s.parent ? abs.get(s.parent)! : 0;
    const n = makeNode(view.id, s.id, { x: 10, y: y - parentY, w: 100, h: 50 }, { id: `n:${view.id}:${s.id}`, ...(s.parent ? { parentNodeId: `n:${view.id}:${s.parent}` } : {}), ...(s.detailView ? { detailViewId: s.detailView } : {}) });
    ws.nodes[n.id] = n;
  });
  flows.forEach((f, i) => {
    const id = f.id ?? `f${i + 1}`;
    const typeId = f.type ?? opts.relationType ?? (notationId === 'statechart' ? 'statechart:Transition' : 'bpmn:SequenceFlow');
    const fields: Record<string, unknown> = { ...(f.fields ?? {}) };
    if (f.condition !== undefined) fields.condition = f.condition;
    if (f.default) fields.default = true;
    const r = makeRelation(typeId, { elementId: f.from }, { elementId: f.to }, { id, name: f.name ?? '', fields });
    ws.relations[id] = r;
    const e = makeEdge(view.id, id, `n:${view.id}:${f.from}`, `n:${view.id}:${f.to}`, { id: `e:${view.id}:${id}` });
    ws.edges[e.id] = e;
  });
  return { ws, viewId: view.id };
}

export const bpmnWs = (nodes: NodeSpec[], flows: FlowSpec[], opts: Parameters<typeof workspaceOf>[3] = {}) => workspaceOf('bpmn', nodes, flows, opts);
export const scWs = (nodes: NodeSpec[], flows: FlowSpec[], opts: Parameters<typeof workspaceOf>[3] = {}) => workspaceOf('statechart', nodes, flows, opts);

/** Transición de máquina de estados. */
export const tr = (from: string, to: string, event = '', extra: { guard?: string; actions?: string[]; delay?: string; internal?: boolean; id?: string } = {}): FlowSpec => ({
  ...(extra.id ? { id: extra.id } : {}), from, to, name: event,
  fields: { event, guard: extra.guard ?? '', actions: extra.actions ?? [], ...(extra.delay ? { delay: extra.delay } : {}), ...(extra.internal ? { internal: true } : {}) },
});
