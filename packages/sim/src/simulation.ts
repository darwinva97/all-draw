/**
 * Fachada común para la interfaz: una `Simulation` sobre una vista (BPMN o máquina de estados) con la misma forma de
 * controlar (iniciar, paso, ejecutar, acciones, variables) y una `SimView` lista para pintar: resaltado por nodo y
 * arista de la vista, acciones posibles, historial, temporizadores y bloqueos. El espacio no se modifica nunca.
 */
import type { Workspace } from '@all-draw/core';
import { buildBpmnModel, isBpmnView, type BpmnModel } from './bpmn-model';
import { BpmnSimulation, type BpmnSimOptions, type BpmnSimState } from './bpmn';
import { buildStatechartModel, isStatechartView, StatechartSimulation, SC_ROOT, type StatechartModel, type StatechartSimOptions, type StatechartSimState, type ScActionLog } from './statechart';
import { expressionVariables, runAction, type Vars } from './expr';
import type { SimEvent, SimStatus, SimWarning } from './types';

export type SimKind = 'bpmn' | 'statechart';

/** Marca de un nodo de la vista: con token / estado activo, esperando algo, bloqueado, ya recorrido o contenedor activo. */
export type NodeMark = 'active' | 'waiting' | 'blocked' | 'visited' | 'within';
/** Marca de una arista: recorrida en el último paso o alguna vez. */
export type EdgeMark = 'last' | 'visited';

export interface SimAction {
  id: string;
  kind: 'choice' | 'message' | 'signal' | 'complete' | 'condition' | 'event';
  /** Elemento del modelo implicado (compuerta, evento, tarea). */
  element?: string;
  /** Nombre visible (elemento o evento). */
  label: string;
  enabled: boolean;
  /** Elecciones: ramas posibles. */
  options?: { id: string; label: string; condition?: string }[];
  multi?: boolean;
  /** Condición (acciones de tipo `condition`). */
  condition?: string;
}

export interface SimView {
  kind: SimKind;
  status: SimStatus;
  time: number;
  step: number;
  variables: Vars;
  history: SimEvent[];
  actions: SimAction[];
  warnings: SimWarning[];
  /** Por id de nodo de vista. */
  nodes: Record<string, NodeMark>;
  /** Por id de arista de vista. */
  edges: Record<string, EdgeMark>;
  /** Elementos activos (con token o estado activo). */
  active: { element: string; name: string; count: number; wait?: string }[];
  blocked: { element: string; name: string; reason: string; missing?: string[] }[];
  timers: { element: string; name: string; due: number }[];
  /** Máquinas de estados: acciones ejecutadas. */
  actionLog: ScActionLog[];
  /** Máquinas de estados: valor del estado (como XState). */
  value?: unknown;
}

export interface Simulation {
  readonly kind: SimKind;
  readonly viewId: string;
  start(): void;
  step(): boolean;
  run(maxSteps?: number): { steps: number; status: SimStatus; stoppedByLimit: boolean };
  /** Ejecuta una acción de `view().actions` (con `options` elegidas para las elecciones). */
  perform(actionId: string, options?: string[]): boolean;
  setVariables(vars: Vars, replace?: boolean): void;
  view(): SimView;
  /** Nombre de un elemento o flujo (para el historial). */
  nameOf(id: string | undefined): string;
  /** Variables que leen las condiciones y guardas del modelo (para ofrecerlas como editables). */
  variableNames(): string[];
  /** Estado serializable. */
  snapshot(): BpmnSimState | StatechartSimState;
}

export interface SimulationOptions { variables?: Vars; manualTasks?: boolean; maxHistory?: number }

/** ¿Qué motor simula esta vista? `null` si ninguno. */
export function simulationKind(ws: Workspace, viewId: string | null | undefined): SimKind | null {
  if (!viewId || !ws.views[viewId]) return null;
  const v = ws.views[viewId]!;
  if (v.notationId === 'bpmn') return 'bpmn';
  if (v.notationId === 'statechart') return 'statechart';
  return isBpmnView(ws, viewId) ? 'bpmn' : isStatechartView(ws, viewId) ? 'statechart' : null;
}

export function createSimulation(ws: Workspace, viewId: string, opts: SimulationOptions = {}): Simulation {
  const kind = simulationKind(ws, viewId);
  if (kind === 'bpmn') return new BpmnFacade(buildBpmnModel(ws, viewId), opts);
  if (kind === 'statechart') return new StatechartFacade(buildStatechartModel(ws, viewId), opts);
  throw new Error(`La vista ${viewId} no es BPMN ni de estados`);
}

const unique = (xs: string[]) => [...new Set(xs)].filter(Boolean).sort((a, b) => a.localeCompare(b));

class BpmnFacade implements Simulation {
  readonly kind = 'bpmn' as const;
  readonly viewId: string;
  private sim: BpmnSimulation;
  private model: BpmnModel;
  constructor(model: BpmnModel, opts: SimulationOptions) {
    this.model = model;
    this.viewId = model.viewId;
    this.sim = new BpmnSimulation(model, opts as BpmnSimOptions);
  }
  start() { this.sim.start(); }
  step() { return this.sim.step(); }
  run(max = 1000) { return this.sim.run(max); }
  perform(id: string, options?: string[]) { return this.sim.perform(id, options); }
  setVariables(v: Vars, replace?: boolean) { this.sim.setVariables(v, replace); }
  snapshot() { return this.sim.snapshot(); }
  nameOf(id: string | undefined): string {
    if (!id) return '';
    const n = this.model.nodes[id];
    if (n) return n.name || typeLabel(n.typeId);
    const f = this.model.flows[id] ?? this.model.messageFlows[id];
    if (f) return f.name || `${this.nameOf(f.source)} → ${this.nameOf(f.target)}`;
    return id;
  }
  variableNames(): string[] {
    const exprs = [...Object.values(this.model.flows).map(f => f.condition ?? ''), ...Object.values(this.model.nodes).map(n => n.condition ?? '')];
    return unique([...exprs.flatMap(expressionVariables), ...Object.keys(this.sim.variables)]);
  }
  view(): SimView {
    const st = this.sim.snapshot();
    const nodes: Record<string, NodeMark> = {};
    const edges: Record<string, EdgeMark> = {};
    const setNodes = (el: string, m: NodeMark) => { for (const id of this.model.nodes[el]?.nodeIds ?? []) nodes[id] = m; };
    for (const el of Object.keys(st.visitedNodes)) setNodes(el, 'visited');
    for (const t of st.tokens) {
      const waiting = t.state === 'waiting' && t.wait !== 'subprocess';
      const cur = nodes[this.model.nodes[t.node]?.nodeIds[0] ?? ''];
      if (t.wait === 'subprocess') { if (cur !== 'active' && cur !== 'waiting') setNodes(t.node, 'within'); continue; }
      if (cur === 'active' && waiting) continue;
      setNodes(t.node, waiting ? 'waiting' : 'active');
    }
    if (st.status === 'deadlock') for (const b of st.blocked) setNodes(b.element, 'blocked');
    const flowEdges = (f: string) => (this.model.flows[f] ?? this.model.messageFlows[f])?.edgeIds ?? [];
    for (const f of Object.keys(st.visitedFlows)) for (const e of flowEdges(f)) edges[e] = 'visited';
    for (const f of st.lastFlows) for (const e of flowEdges(f)) edges[e] = 'last';
    const actions: SimAction[] = this.sim.available().map(a => {
      if (a.kind === 'choice') return { id: a.id, kind: a.kind, element: a.element, label: this.nameOf(a.element), enabled: true, multi: a.multi, options: a.flows.map(f => ({ id: f, label: this.model.flows[f]!.name || this.nameOf(this.model.flows[f]!.target), ...(this.model.flows[f]!.condition ? { condition: this.model.flows[f]!.condition } : {}) })) };
      if (a.kind === 'condition') return { id: a.id, kind: a.kind, element: a.element, label: this.nameOf(a.element), enabled: false, condition: a.condition };
      return { id: a.id, kind: a.kind, element: a.element, label: this.nameOf(a.element), enabled: true };
    });
    const active = this.sim.activeElements().map(a => ({ element: a.element, name: this.nameOf(a.element), count: a.count, ...(a.wait ? { wait: a.wait } : {}) }));
    return {
      kind: 'bpmn', status: st.status, time: st.time, step: st.step, variables: st.variables, history: st.history, actions, warnings: this.model.warnings,
      nodes, edges, active,
      blocked: st.blocked.map(b => ({ element: b.element, name: this.nameOf(b.element), reason: b.reason, ...(b.missing ? { missing: b.missing } : {}) })),
      timers: st.scheduled.filter(x => x.kind !== 'complete' || x.due > st.time).map(x => ({ element: x.node, name: this.nameOf(x.node), due: x.due })).sort((a, b) => a.due - b.due),
      actionLog: [],
    };
  }
}

class StatechartFacade implements Simulation {
  readonly kind = 'statechart' as const;
  readonly viewId: string;
  private sim: StatechartSimulation;
  private model: StatechartModel;
  constructor(model: StatechartModel, opts: SimulationOptions) {
    this.model = model;
    this.viewId = model.viewId;
    this.sim = new StatechartSimulation(model, opts as StatechartSimOptions);
  }
  start() { this.sim.start(); }
  step() { return this.sim.step(); }
  run(max = 1000) { return this.sim.run(max); }
  perform(id: string) {
    if (!id.startsWith('event:')) return false;
    this.sim.send(id.slice('event:'.length));
    return true;
  }
  setVariables(v: Vars, replace?: boolean) { this.sim.setVariables(v, replace); }
  snapshot() { return this.sim.snapshot(); }
  nameOf(id: string | undefined): string {
    if (!id) return '';
    const s = this.model.states[id];
    if (s) return s.id === SC_ROOT ? this.model.name : s.name;
    const t = this.model.transitions.find(x => x.id === id);
    if (t) return `${this.nameOf(t.source)} → ${t.targets.map(x => this.nameOf(x)).join(', ') || this.nameOf(t.source)}`;
    return id;
  }
  variableNames(): string[] {
    const guards = this.model.transitions.map(t => (t.guard === 'else' ? '' : t.guard));
    const assigns = [...this.model.transitions.flatMap(t => t.actions), ...Object.values(this.model.states).flatMap(s => [...s.entry, ...s.exit])]
      .map(a => { const e = runAction(a, {}); return e.kind === 'assign' ? e.target ?? '' : ''; });
    return unique([...guards.flatMap(expressionVariables), ...assigns, ...Object.keys(this.sim.variables)]);
  }
  view(): SimView {
    const st = this.sim.snapshot();
    const nodes: Record<string, NodeMark> = {};
    const edges: Record<string, EdgeMark> = {};
    const setNodes = (el: string, m: NodeMark) => { for (const id of this.model.states[el]?.nodeIds ?? []) nodes[id] = m; };
    for (const el of Object.keys(st.visitedStates)) setNodes(el, 'visited');
    const leaves = new Set(this.sim.activeLeaves());
    for (const el of this.sim.activeStates()) setNodes(el, leaves.has(el) ? 'active' : 'within');
    const tEdges = (id: string) => this.model.transitions.find(t => t.id === id)?.edgeIds ?? [];
    for (const id of Object.keys(st.visitedTransitions)) for (const e of tEdges(id)) edges[e] = 'visited';
    for (const id of st.lastTransitions) for (const e of tEdges(id)) edges[e] = 'last';
    const actions: SimAction[] = this.sim.availableEvents().map(ev => ({ id: `event:${ev.event}`, kind: 'event', label: ev.event, enabled: ev.enabled }));
    return {
      kind: 'statechart', status: st.status, time: st.time, step: st.step, variables: st.variables, history: st.history, actions, warnings: this.model.warnings,
      nodes, edges,
      active: this.sim.activeLeaves().map(id => ({ element: id, name: this.nameOf(id), count: 1 })),
      blocked: st.status === 'deadlock' ? this.sim.activeLeaves().filter(id => this.model.states[id]!.kind !== 'final').map(id => ({ element: id, name: this.nameOf(id), reason: 'noTransitions' })) : [],
      timers: this.sim.timers().map(t => ({ element: t.state, name: this.nameOf(t.state), due: t.due })),
      actionLog: st.actions,
      value: st.status === 'idle' ? undefined : this.sim.value(),
    };
  }
}

const typeLabel = (typeId: string) => typeId.replace(/^bpmn:/, '');
