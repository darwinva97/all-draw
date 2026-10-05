/**
 * Modelo ejecutable de un proceso BPMN a partir de una **vista** del espacio: nodos de flujo (eventos, actividades,
 * compuertas), flujos de secuencia y de mensaje. Las pools y lanes no cuentan; el ámbito de un nodo es el subproceso
 * (expandido) que lo contiene en la vista, o el proceso. Un subproceso colapsado con vista de detalle
 * (`detailViewId`) y sin hijos en la vista toma los nodos de esa vista como contenido.
 */
import type { Workspace, ViewNode, Element } from '@all-draw/core';
import { checkExpression, parseDuration } from './expr';
import type { SimWarning } from './types';

export type BpmnNodeKind =
  | 'start' | 'end' | 'catch' | 'throw' | 'boundary'
  | 'task' | 'subprocess' | 'eventSubprocess'
  | 'exclusive' | 'parallel' | 'inclusive' | 'complex' | 'eventBased';

export interface BpmnNodeInfo {
  /** Id del elemento del modelo. */
  id: string;
  /** Nodos de vista que lo representan (para resaltar). */
  nodeIds: string[];
  /** Vista de esos nodos (la principal o la de detalle de un subproceso). */
  viewId: string;
  kind: BpmnNodeKind;
  typeId: string;
  name: string;
  /** `none`, `message`, `timer`, `signal`, `conditional`, `error`, `escalation`, `cancel`, `compensation`, `terminate`, `link`, `multiple`… */
  eventDefinition: string;
  eventRef?: string;
  /** Eventos de borde y de inicio de subproceso de evento: interruptor (por defecto sí). */
  interrupting: boolean;
  /** Eventos de borde: actividad a la que se adhiere. */
  attachedTo?: string;
  /** Duración del temporizador en ms (eventos de temporizador). */
  timerMs?: number;
  timerText?: string;
  condition?: string;
  link?: string;
  taskType?: string;
  /** Duración simulada de una actividad (`props.duration` / `props.duracion`), en ms. */
  durationMs?: number;
  /** Elemento del subproceso que lo contiene (`null` = proceso). */
  scope: string | null;
  incoming: string[];
  outgoing: string[];
  defaultFlow?: string;
  /** Posición absoluta (para ordenar de forma estable). */
  x: number;
  y: number;
}

export interface BpmnFlowInfo {
  id: string;
  edgeIds: string[];
  source: string;
  target: string;
  name: string;
  condition?: string;
  isDefault: boolean;
}

export interface BpmnModel {
  kind: 'bpmn';
  viewId: string;
  name: string;
  nodes: Record<string, BpmnNodeInfo>;
  flows: Record<string, BpmnFlowInfo>;
  messageFlows: Record<string, BpmnFlowInfo>;
  /** Ids de nodo en orden estable (arriba-abajo, izquierda-derecha). */
  order: string[];
  warnings: SimWarning[];
}

const KIND: Record<string, BpmnNodeKind> = {
  'bpmn:StartEvent': 'start', 'bpmn:EndEvent': 'end', 'bpmn:IntermediateCatchEvent': 'catch', 'bpmn:IntermediateThrowEvent': 'throw',
  'bpmn:BoundaryEvent': 'boundary', 'bpmn:Task': 'task', 'bpmn:CallActivity': 'task', 'bpmn:SubProcess': 'subprocess',
  'bpmn:Transaction': 'subprocess', 'bpmn:AdHocSubProcess': 'subprocess', 'bpmn:EventSubProcess': 'eventSubprocess',
  'bpmn:ExclusiveGateway': 'exclusive', 'bpmn:ParallelGateway': 'parallel', 'bpmn:InclusiveGateway': 'inclusive',
  'bpmn:ComplexGateway': 'complex', 'bpmn:EventBasedGateway': 'eventBased',
};
const CONTAINERS = new Set(['subprocess', 'eventSubprocess']);
export const isActivity = (n: BpmnNodeInfo) => n.kind === 'task' || n.kind === 'subprocess';

/** ¿La vista tiene algo que simular como BPMN? */
export function isBpmnView(ws: Workspace, viewId: string): boolean {
  const v = ws.views[viewId];
  if (!v) return false;
  if (v.notationId === 'bpmn') return true;
  return Object.values(ws.nodes).some(n => n.viewId === viewId && n.elementId && KIND[ws.elements[n.elementId]?.typeId ?? '']);
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim());

export function buildBpmnModel(ws: Workspace, viewId: string): BpmnModel {
  const view = ws.views[viewId];
  if (!view) throw new Error(`No existe la vista ${viewId}`);
  const warnings: SimWarning[] = [];
  const warn = (key: string, vars?: SimWarning['vars'], element?: string) => {
    if (!warnings.some(w => w.key === key && w.element === element && JSON.stringify(w.vars) === JSON.stringify(vars))) warnings.push({ key, ...(vars ? { vars } : {}), ...(element ? { element } : {}) });
  };
  const nodes: Record<string, BpmnNodeInfo> = {};
  const flows: Record<string, BpmnFlowInfo> = {};
  const messageFlows: Record<string, BpmnFlowInfo> = {};
  const allNodes = Object.values(ws.nodes);
  const allEdges = Object.values(ws.edges);
  const visitedViews = new Set<string>();
  /** nodo de vista → elemento de flujo. */
  const elOfNode = new Map<string, string>();

  const visit = (vid: string, outerScope: string | null) => {
    if (visitedViews.has(vid)) return;
    visitedViews.add(vid);
    const vnodes = allNodes.filter(n => n.viewId === vid);
    const byId = new Map(vnodes.map(n => [n.id, n]));
    const abs = new Map<string, { x: number; y: number }>();
    const absOf = (n: ViewNode, guard = 0): { x: number; y: number } => {
      const c = abs.get(n.id); if (c) return c;
      const p = n.parentNodeId ? byId.get(n.parentNodeId) : undefined;
      const base = p && guard < 64 ? absOf(p, guard + 1) : { x: 0, y: 0 };
      const r = { x: base.x + n.x, y: base.y + n.y }; abs.set(n.id, r); return r;
    };
    const elOf = (n: ViewNode): Element | undefined => (n.elementId ? ws.elements[n.elementId] : undefined);
    const scopeOf = (n: ViewNode): string | null => {
      let p = n.parentNodeId ? byId.get(n.parentNodeId) : undefined;
      for (let i = 0; p && i < 64; i++) {
        const e = elOf(p);
        if (e && CONTAINERS.has(KIND[e.typeId] ?? '')) return e.id;
        p = p.parentNodeId ? byId.get(p.parentNodeId) : undefined;
      }
      return outerScope;
    };
    const subprocessNodes: ViewNode[] = [];
    for (const n of vnodes) {
      const e = elOf(n);
      const kind = e ? KIND[e.typeId] : undefined;
      if (!e || !kind || e.template) continue;
      elOfNode.set(n.id, e.id);
      const pos = absOf(n);
      const prev = nodes[e.id];
      if (prev) { prev.nodeIds.push(n.id); continue; }
      const f = e.fields ?? {};
      const def = str(f.eventDefinition) || 'none';
      const info: BpmnNodeInfo = {
        id: e.id, nodeIds: [n.id], viewId: vid, kind, typeId: e.typeId, name: e.name || '', eventDefinition: def,
        interrupting: f.interrupting !== false, scope: scopeOf(n), incoming: [], outgoing: [], x: pos.x, y: pos.y,
      };
      if (str(f.eventRef)) info.eventRef = str(f.eventRef);
      if (kind === 'boundary' && str(f.attachedTo)) info.attachedTo = str(f.attachedTo);
      if (str(f.condition)) info.condition = str(f.condition);
      if (str(f.link)) info.link = str(f.link);
      if (str(f.taskType)) info.taskType = str(f.taskType);
      if (def === 'timer' || str(f.timer)) {
        info.timerText = str(f.timer);
        const ms = parseDuration(info.timerText);
        if (def === 'timer') {
          if (ms === null) warn(info.timerText ? 'El temporizador «{timer}» de «{name}» no es una duración reconocible; se usa 1 min' : 'El temporizador de «{name}» no tiene duración; se usa 1 min', { name: info.name || e.id, timer: info.timerText }, e.id);
          info.timerMs = ms ?? 60_000;
        }
      }
      const dur = e.props?.duration ?? e.props?.duracion ?? e.props?.['duración'];
      if (dur !== undefined && (kind === 'task' || kind === 'subprocess')) {
        const ms = parseDuration(dur);
        if (ms === null) warn('La duración «{value}» de «{name}» no es reconocible; se ignora', { value: dur, name: info.name || e.id }, e.id);
        else info.durationMs = ms;
      }
      if (info.condition && checkExpression(info.condition)) warn('La condición «{condition}» de «{name}» no es válida: {error}', { condition: info.condition, name: info.name || e.id, error: checkExpression(info.condition)! }, e.id);
      nodes[e.id] = info;
      if (kind === 'subprocess') subprocessNodes.push(n);
      if (kind === 'boundary' && !info.attachedTo) {
        // Sin `attachedTo`: la actividad sobre cuyo borde está dibujado.
        const cx = pos.x + n.w / 2, cy = pos.y + n.h / 2;
        const host = vnodes.find(h => h !== n && (KIND[elOf(h)?.typeId ?? ''] === 'task' || KIND[elOf(h)?.typeId ?? ''] === 'subprocess') && (() => { const a = absOf(h); return cx >= a.x - 4 && cx <= a.x + h.w + 4 && cy >= a.y - 4 && cy <= a.y + h.h + 4; })());
        if (host) info.attachedTo = host.elementId!;
      }
    }
    // Flujos de esta vista.
    for (const ed of allEdges) {
      if (ed.viewId !== vid || !ed.relationId) continue;
      const r = ws.relations[ed.relationId];
      if (!r) continue;
      const isSeq = r.typeId === 'bpmn:SequenceFlow', isMsg = r.typeId === 'bpmn:MessageFlow';
      if (!isSeq && !isMsg) continue;
      const src = r.from.elementId ?? elOfNode.get(ed.fromNodeId), tgt = r.to.elementId ?? elOfNode.get(ed.toNodeId);
      if (!src || !tgt) continue;
      const bag = isSeq ? flows : messageFlows;
      const prev = bag[r.id];
      if (prev) { if (!prev.edgeIds.includes(ed.id)) prev.edgeIds.push(ed.id); continue; }
      const cond = str(r.fields?.condition);
      bag[r.id] = { id: r.id, edgeIds: [ed.id], source: src, target: tgt, name: r.name || ed.label || '', isDefault: r.fields?.default === true, ...(cond ? { condition: cond } : {}) };
      if (cond && checkExpression(cond)) warn('La condición «{condition}» del flujo «{name}» no es válida: {error}', { condition: cond, name: r.name || ed.label || r.id, error: checkExpression(cond)! }, src);
    }
    // Subprocesos colapsados con vista de detalle: su contenido es esa vista.
    for (const sp of subprocessNodes) {
      const spEl = sp.elementId!;
      if (sp.detailViewId && ws.views[sp.detailViewId] && !Object.values(nodes).some(x => x.scope === spEl)) visit(sp.detailViewId, spEl);
    }
  };
  visit(viewId, null);

  // Flujos cuyo origen o destino no es un nodo de flujo simulable: fuera.
  for (const bag of [flows, messageFlows]) for (const [id, f] of Object.entries(bag)) if (bag === flows ? !nodes[f.source] || !nodes[f.target] : !nodes[f.source] && !nodes[f.target]) delete bag[id];
  const order = Object.values(nodes).sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1)).map(n => n.id);
  const rank = new Map(order.map((id, i) => [id, i]));
  for (const f of Object.values(flows).sort((a, b) => rank.get(a.target)! - rank.get(b.target)! || (a.id < b.id ? -1 : 1))) {
    nodes[f.source]!.outgoing.push(f.id);
    nodes[f.target]!.incoming.push(f.id);
  }
  for (const n of Object.values(nodes)) {
    const defaults = n.outgoing.filter(id => flows[id]!.isDefault);
    if (defaults.length) n.defaultFlow = defaults[0];
    if (defaults.length > 1) warn('«{name}» tiene más de un flujo por defecto; se usa el primero', { name: n.name || n.id }, n.id);
    if (n.kind === 'boundary') {
      const host = n.attachedTo ? nodes[n.attachedTo] : undefined;
      if (!host || !isActivity(host)) { warn('El evento de borde «{name}» no está adherido a ninguna actividad de la vista; no se disparará', { name: n.name || n.id }, n.id); delete n.attachedTo; }
      else n.scope = host.scope;
    }
    if ((n.kind === 'exclusive' || n.kind === 'inclusive') && n.outgoing.length > 1 && n.outgoing.every(id => !flows[id]!.condition && !flows[id]!.isDefault))
      warn('Las salidas de «{name}» no tienen condiciones: la simulación preguntará qué rama seguir', { name: n.name || n.id }, n.id);
  }
  const roots = Object.values(nodes).filter(n => n.kind === 'start' && n.scope === null);
  if (!roots.length) warn('La vista no tiene ningún evento de inicio en el proceso principal');
  const model: BpmnModel = { kind: 'bpmn', viewId, name: view.name || viewId, nodes, flows, messageFlows, order, warnings };
  const a = analyzeBpmn(model);
  for (const id of a.traps) warn('«{name}» está en un bucle sin salida: desde ahí no se llega a ningún fin', { name: nodes[id]!.name || id }, id);
  return model;
}

// ---------------------------------------------------------------- análisis estático
export interface BpmnAnalysis {
  /** Nodos a los que no llega ningún token. */
  unreachable: string[];
  /** Nodos alcanzables desde los que no se llega a ningún fin (bucles sin salida). */
  traps: string[];
}

/** Sucesores "posibles" de un nodo: flujos de salida, eventos de borde (si es actividad) y enlaces (link). */
export function successors(model: BpmnModel, id: string): string[] {
  const n = model.nodes[id]!;
  const out = n.outgoing.map(f => model.flows[f]!.target);
  if (isActivity(n)) for (const b of Object.values(model.nodes)) if (b.kind === 'boundary' && b.attachedTo === id) out.push(b.id);
  if (n.kind === 'throw' && n.eventDefinition === 'link') for (const c of linkTargets(model, n)) out.push(c.id);
  return out;
}

export function linkTargets(model: BpmnModel, thrower: BpmnNodeInfo): BpmnNodeInfo[] {
  const key = thrower.link || thrower.name;
  return Object.values(model.nodes).filter(c => c.kind === 'catch' && c.eventDefinition === 'link' && c.scope === thrower.scope && (c.link || c.name) === key);
}

/** Nodos en los que puede empezar un token: inicios (del proceso, de subprocesos y de subprocesos de evento). */
export function entryNodes(model: BpmnModel): string[] {
  return Object.values(model.nodes).filter(n => n.kind === 'start' || (n.incoming.length === 0 && n.kind !== 'boundary' && n.kind !== 'eventSubprocess' && !(n.kind === 'catch' && n.eventDefinition === 'link'))).map(n => n.id);
}

export function analyzeBpmn(model: BpmnModel): BpmnAnalysis {
  const ids = model.order;
  const reach = new Set<string>();
  const stack = [...entryNodes(model)];
  while (stack.length) {
    const id = stack.pop()!;
    if (reach.has(id)) continue;
    reach.add(id);
    stack.push(...successors(model, id));
  }
  // "Salidas": fines y nodos sin salida (fin implícito). Un subproceso de evento o un subproceso también "termina".
  const preds = new Map<string, string[]>();
  for (const id of ids) for (const s of successors(model, id)) { const l = preds.get(s) ?? []; l.push(id); preds.set(s, l); }
  const canExit = new Set<string>();
  const queue = ids.filter(id => { const n = model.nodes[id]!; return n.kind === 'end' || (n.outgoing.length === 0 && !(n.kind === 'throw' && n.eventDefinition === 'link')) || n.kind === 'eventSubprocess'; });
  while (queue.length) {
    const id = queue.pop()!;
    if (canExit.has(id)) continue;
    canExit.add(id);
    queue.push(...(preds.get(id) ?? []));
  }
  return {
    unreachable: ids.filter(id => !reach.has(id) && model.nodes[id]!.kind !== 'eventSubprocess'),
    traps: ids.filter(id => reach.has(id) && !canExit.has(id)),
  };
}
