/**
 * Motor de **máquinas de estados** (statecharts) con la semántica de XState v5, para que la simulación coincida con
 * lo que exporta `@all-draw/io` (`exportXState`):
 *
 * - Estados atómicos, compuestos (inicial por pseudoestado Inicial o, si no, el primer hijo de arriba-abajo e
 *   izquierda-derecha) y paralelos (todas las regiones a la vez). Finales: el padre compuesto emite `done.state.<nombre>`
 *   (y el paralelo cuando todas sus regiones terminan); un final de primer nivel termina la máquina.
 * - Historia superficial y profunda (se registra al salir del padre; sin registro, su transición por defecto o el
 *   inicial del padre).
 * - Transiciones con evento, guarda (expresión segura sobre las variables), acciones y `delay` (after). Sin evento ni
 *   retardo = `always` (se evalúan tras cada paso hasta que no quede ninguna). Las internas a sí mismo no salen del
 *   estado; las que apuntan al propio estado sin ser internas tampoco (como XState v5: `reenter: false`), pero un
 *   compuesto reinicia a sus hijos.
 * - Decisión (Choice): como la exporta io, un estado con transiciones `always`; la guarda `else` siempre se cumple.
 * - Extensiones que XState no tiene (el exportador las omite): Bifurcación (Fork: una transición a varias regiones),
 *   Unión (Join: se dispara cuando todos sus orígenes están activos) y Terminar.
 * - Orden de las acciones en un paso: salidas (de dentro afuera), acciones de la transición, entradas (de fuera
 *   adentro). Las acciones `x = expr`, `x += 1`, `x++` cambian variables y `raise(EV)` encola un evento interno.
 */
import type { Workspace, ViewNode, Element } from '@all-draw/core';
import { evalCondition, parseDuration, runAction, checkExpression, type Vars } from './expr';
import type { SimEvent, SimEventKind, SimStatus, SimWarning } from './types';
import { isFinished } from './types';

export type ScKind = 'root' | 'atomic' | 'compound' | 'parallel' | 'final' | 'history' | 'choice' | 'initial' | 'fork' | 'join' | 'terminate';

export interface ScNodeInfo {
  id: string;
  nodeIds: string[];
  name: string;
  kind: ScKind;
  parent: string | null;
  children: string[];
  /** Orden de documento (preorden). */
  order: number;
  /** Compuestos: hijo inicial. */
  initial?: string;
  /** Historia profunda (H*). */
  deep?: boolean;
  /** Historia: destino por defecto. */
  historyDefault?: string;
  entry: string[];
  exit: string[];
}

export interface ScTransitionInfo {
  id: string;
  edgeIds: string[];
  source: string;
  /** Destinos efectivos (vacío = sin destino: no sale del estado). Una bifurcación da varios. */
  targets: string[];
  event: string;
  guard: string;
  actions: string[];
  delayMs?: number;
  delayText?: string;
  /** Destino Unión: solo se dispara si todos los orígenes de la unión están activos. */
  join?: string;
  terminate?: boolean;
  order: number;
}

export interface StatechartModel {
  kind: 'statechart';
  viewId: string;
  name: string;
  root: string;
  states: Record<string, ScNodeInfo>;
  transitions: ScTransitionInfo[];
  warnings: SimWarning[];
}

export const SC_ROOT = '#root';
const T = { state: 'statechart:State', initial: 'statechart:Initial', final: 'statechart:Final', parallel: 'statechart:Parallel', history: 'statechart:History', choice: 'statechart:Choice', fork: 'statechart:Fork', join: 'statechart:Join', terminate: 'statechart:Terminate', transition: 'statechart:Transition' };
const KIND_OF: Record<string, ScKind> = { [T.state]: 'atomic', [T.initial]: 'initial', [T.final]: 'final', [T.parallel]: 'parallel', [T.history]: 'history', [T.choice]: 'choice', [T.fork]: 'fork', [T.join]: 'join', [T.terminate]: 'terminate' };
/** Lo que XState trata como estado (lo demás son pseudoestados). */
const STATEISH = new Set<ScKind>(['atomic', 'compound', 'parallel', 'final', 'history', 'choice']);

export function isStatechartView(ws: Workspace, viewId: string): boolean {
  const v = ws.views[viewId];
  if (!v) return false;
  if (v.notationId === 'statechart') return true;
  return Object.values(ws.nodes).some(n => n.viewId === viewId && n.elementId && ws.elements[n.elementId]?.typeId.startsWith('statechart:'));
}

const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : String(v ?? '').split('\n')).map(s => s.trim()).filter(Boolean);

export function buildStatechartModel(ws: Workspace, viewId: string): StatechartModel {
  const view = ws.views[viewId];
  if (!view) throw new Error(`No existe la vista ${viewId}`);
  const warnings: SimWarning[] = [];
  const warn = (key: string, vars?: SimWarning['vars'], element?: string) => {
    if (!warnings.some(w => w.key === key && w.element === element && JSON.stringify(w.vars) === JSON.stringify(vars))) warnings.push({ key, ...(vars ? { vars } : {}), ...(element ? { element } : {}) });
  };
  const vnodes = Object.values(ws.nodes).filter(n => n.viewId === viewId && n.elementId && ws.elements[n.elementId] && KIND_OF[ws.elements[n.elementId]!.typeId]);
  const byNode = new Map(vnodes.map(n => [n.id, n]));
  const elOf = (n: ViewNode): Element => ws.elements[n.elementId!]!;
  const states: Record<string, ScNodeInfo> = {
    [SC_ROOT]: { id: SC_ROOT, nodeIds: [], name: view.name || 'maquina', kind: 'root', parent: null, children: [], order: 0, entry: [], exit: [] },
  };
  const nodeToState = new Map<string, string>();
  // Un elemento que aparece dos veces en la vista: el primer nodo manda (los demás solo se resaltan).
  for (const n of vnodes) {
    const e = elOf(n);
    const prev = states[e.id];
    if (prev) { prev.nodeIds.push(n.id); nodeToState.set(n.id, e.id); continue; }
    states[e.id] = { id: e.id, nodeIds: [n.id], name: e.name || e.id, kind: KIND_OF[e.typeId]!, parent: null, children: [], order: 0, entry: lines(e.fields.entry), exit: lines(e.fields.exit), ...(e.typeId === T.history ? { deep: !!e.fields.deep } : {}) };
    nodeToState.set(n.id, e.id);
  }
  const firstNode = (id: string) => byNode.get(states[id]!.nodeIds[0]!)!;
  for (const st of Object.values(states)) {
    if (st.id === SC_ROOT) continue;
    const n = firstNode(st.id);
    const p = n.parentNodeId ? byNode.get(n.parentNodeId) : undefined;
    const pid = p ? nodeToState.get(p.id) : undefined;
    st.parent = pid && (states[pid]!.kind === 'atomic' || states[pid]!.kind === 'parallel' || states[pid]!.kind === 'compound') ? pid : SC_ROOT;
  }
  // Hijos ordenados como los ordena el exportador: de arriba abajo y de izquierda a derecha.
  const sorted = Object.values(states).filter(s => s.id !== SC_ROOT).sort((a, b) => { const na = firstNode(a.id), nb = firstNode(b.id); return na.y - nb.y || na.x - nb.x; });
  for (const st of sorted) states[st.parent!]!.children.push(st.id);
  for (const st of Object.values(states)) if (st.kind === 'atomic' && st.children.some(c => STATEISH.has(states[c]!.kind))) st.kind = 'compound';
  let order = 0;
  const number = (id: string) => { states[id]!.order = order++; for (const c of states[id]!.children) number(c); };
  number(SC_ROOT);
  for (const st of Object.values(states)) {
    const names = new Map<string, number>();
    for (const c of st.children) if (STATEISH.has(states[c]!.kind)) names.set(states[c]!.name, (names.get(states[c]!.name) ?? 0) + 1);
    for (const [name, k] of names) if (k > 1) warn('Dos estados hermanos se llaman «{name}»', { name }, st.id);
  }

  // Transiciones, en el orden de las aristas (el del exportador).
  type Raw = { id: string; edgeIds: string[]; source: string; target: string; event: string; guard: string; actions: string[]; delay: string; internal: boolean };
  const raws: Raw[] = [];
  for (const ed of Object.values(ws.edges)) {
    if (ed.viewId !== viewId || !ed.relationId) continue;
    const r = ws.relations[ed.relationId];
    if (!r || r.typeId !== T.transition) continue;
    const source = nodeToState.get(ed.fromNodeId), target = nodeToState.get(ed.toNodeId);
    if (!source || !target) continue;
    const prev = raws.find(x => x.id === r.id);
    if (prev) { prev.edgeIds.push(ed.id); continue; }
    const f = r.fields;
    raws.push({ id: r.id, edgeIds: [ed.id], source, target, event: String(f.event ?? r.name ?? '').trim(), guard: String(f.guard ?? '').trim(), actions: lines(f.actions), delay: String(f.delay ?? '').trim(), internal: !!f.internal });
  }
  // Iniciales, historias por defecto.
  for (const st of Object.values(states)) {
    if (st.kind === 'compound' || st.kind === 'root') {
      const init = st.children.find(c => states[c]!.kind === 'initial');
      const out = init ? raws.find(r => r.source === init) : undefined;
      const stateKids = st.children.filter(c => STATEISH.has(states[c]!.kind));
      if (out && stateKids.includes(out.target)) st.initial = out.target;
      else {
        if (init) warn('El pseudoestado inicial de «{name}» no apunta a un estado hermano', { name: st.name }, st.id);
        if (stateKids.length) st.initial = stateKids[0];
      }
      if (!stateKids.length && st.kind === 'root') warn('La vista no tiene estados');
    }
    if (st.kind === 'history') { const d = raws.find(r => r.source === st.id); if (d) st.historyDefault = d.target; }
  }
  const transitions: ScTransitionInfo[] = [];
  for (const r of raws) {
    const src = states[r.source]!, tgt = states[r.target]!;
    if (src.kind === 'initial' || src.kind === 'history' || src.kind === 'fork' || src.kind === 'join') continue;
    let targets = [r.target];
    let join: string | undefined;
    let terminate = false;
    if (tgt.kind === 'initial') { warn('Una transición apunta a un pseudoestado inicial; se omite', undefined, r.id); continue; }
    if (tgt.kind === 'fork') {
      targets = raws.filter(x => x.source === tgt.id).map(x => x.target).filter(id => STATEISH.has(states[id]!.kind));
      if (!targets.length) { warn('La bifurcación «{name}» no tiene salidas a estados', { name: tgt.name }, tgt.id); continue; }
    } else if (tgt.kind === 'join') {
      join = tgt.id;
      targets = raws.filter(x => x.source === tgt.id).map(x => x.target).filter(id => STATEISH.has(states[id]!.kind)).slice(0, 1);
      if (!targets.length) { warn('La unión «{name}» no tiene salida a un estado', { name: tgt.name }, tgt.id); continue; }
    } else if (tgt.kind === 'terminate') { terminate = true; targets = []; }
    if (r.internal && r.target === r.source) targets = [];
    const t: ScTransitionInfo = { id: r.id, edgeIds: r.edgeIds, source: r.source, targets, event: r.delay ? '' : r.event, guard: r.guard, actions: r.actions, order: transitions.length, ...(join ? { join } : {}), ...(terminate ? { terminate } : {}) };
    if (r.delay) {
      const ms = parseDuration(r.delay);
      if (ms === null) warn('El retardo «{delay}» no es una duración reconocible; se usa 1 s', { delay: r.delay }, r.id);
      t.delayMs = ms ?? 1000; t.delayText = r.delay;
    }
    if (t.guard && t.guard !== 'else' && checkExpression(t.guard)) warn('La guarda «{guard}» no es una expresión válida: {error}', { guard: t.guard, error: checkExpression(t.guard)! }, r.id);
    transitions.push(t);
  }
  return { kind: 'statechart', viewId, name: view.name || 'maquina', root: SC_ROOT, states, transitions, warnings };
}

// ---------------------------------------------------------------- simulación
export interface ScTimer { id: number; due: number; state: string; delayMs: number }
export interface ScActionLog { seq: number; step: number; time: number; kind: 'entry' | 'exit' | 'transition'; state?: string; transition?: string; action: string; effect: 'assign' | 'raise' | 'opaque' | 'error'; detail?: string }

export interface StatechartSimState {
  status: SimStatus;
  time: number;
  step: number;
  seq: number;
  nextId: number;
  /** Estados activos (incluida la raíz), en orden de documento. */
  configuration: string[];
  /** Historia registrada por pseudoestado de historia. */
  historyValue: Record<string, string[]>;
  variables: Vars;
  timers: ScTimer[];
  history: SimEvent[];
  actions: ScActionLog[];
  visitedTransitions: Record<string, number>;
  visitedStates: Record<string, number>;
  lastTransitions: string[];
}

export interface StatechartSimOptions {
  variables?: Vars;
  maxHistory?: number;
  /** Microsteps sin evento seguidos antes de declarar bucle. Por defecto 100. */
  maxMicrosteps?: number;
}

export interface AvailableEvent { event: string; enabled: boolean; transitions: string[] }
type ScEvent = { name: string; delay?: { state: string; ms: number }; done?: string };

export function initialStatechartState(variables: Vars = {}): StatechartSimState {
  return { status: 'idle', time: 0, step: 0, seq: 0, nextId: 1, configuration: [], historyValue: {}, variables: { ...variables }, timers: [], history: [], actions: [], visitedTransitions: {}, visitedStates: {}, lastTransitions: [] };
}

/** Valor del estado como en XState: `'a'`, `{ b: 'b1' }`, `{ p: { r1: 'x', r2: 'y' } }` (con los nombres). */
export type StateValue = string | { [k: string]: StateValue };

export class StatechartSimulation {
  readonly model: StatechartModel;
  readonly options: StatechartSimOptions;
  private s: StatechartSimState;
  private queue: ScEvent[] = [];
  private seen = new Set<string>();
  private loopFlag = false;
  private guardErrors = new Set<string>();
  private readonly byId: Record<string, ScNodeInfo>;

  constructor(model: StatechartModel, options: StatechartSimOptions = {}, state?: StatechartSimState) {
    this.model = model;
    this.options = options;
    this.byId = model.states;
    this.s = state ? structuredClone(state) : initialStatechartState(options.variables);
    if (state?.status === 'loop') this.loopFlag = true;
  }

  snapshot(): StatechartSimState { return structuredClone(this.s); }
  get status(): SimStatus { return this.s.status; }
  get time(): number { return this.s.time; }
  get variables(): Vars { return this.s.variables; }
  get history(): readonly SimEvent[] { return this.s.history; }
  get actions(): readonly ScActionLog[] { return this.s.actions; }
  get warnings(): SimWarning[] { return this.model.warnings; }
  /** Estados activos (sin la raíz). */
  activeStates(): string[] { return this.s.configuration.filter(id => id !== SC_ROOT); }
  /** Estados activos hoja (atómicos, finales, decisiones). */
  activeLeaves(): string[] { return this.activeStates().filter(id => this.isAtomic(this.byId[id]!)); }
  isActive(id: string): boolean { return this.s.configuration.includes(id); }

  value(): StateValue {
    const conf = new Set(this.s.configuration);
    const val = (id: string): StateValue => {
      const st = this.byId[id]!;
      const kids = st.children.filter(c => conf.has(c) && STATEISH.has(this.byId[c]!.kind));
      if (st.kind === 'parallel') return Object.fromEntries(kids.map(c => [this.byId[c]!.name, val(c)]));
      const k = kids[0];
      if (!k) return {};
      const child = this.byId[k]!;
      return this.isAtomic(child) ? child.name : { [child.name]: val(k) };
    };
    const root = val(SC_ROOT);
    return root;
  }

  start(): void {
    const vars = this.s.status === 'idle' ? this.s.variables : { ...(this.options.variables ?? {}), ...this.s.variables };
    this.s = initialStatechartState(vars);
    this.queue = []; this.seen.clear(); this.loopFlag = false; this.guardErrors.clear();
    this.s.status = 'running';
    this.log('start', {});
    this.s.configuration = [SC_ROOT];
    const toEnter = new Set<string>();
    this.addDescendants(SC_ROOT, toEnter);
    this.enter(toEnter);
    this.macrostep();
    this.updateStatus();
  }

  /** Envía un evento. Devuelve si alguna transición lo atendió. */
  send(event: string): boolean {
    if (this.s.status === 'idle') this.start();
    if (isFinished(this.s.status)) return false;
    this.external();
    this.s.step++;
    this.s.lastTransitions = [];
    this.log('event', { detail: event });
    const ts = this.select({ name: event });
    if (!ts.length) { this.log('ignored', { detail: event }); this.updateStatus(); return false; }
    this.microstep(ts);
    this.macrostep();
    this.updateStatus();
    return true;
  }

  /** Avanza al siguiente temporizador (`after`) y lo dispara. */
  step(): boolean {
    if (this.s.status === 'idle') { this.start(); return true; }
    if (isFinished(this.s.status)) return false;
    const next = [...this.s.timers].sort((a, b) => a.due - b.due || a.id - b.id)[0];
    if (!next) { this.updateStatus(); return false; }
    this.s.step++;
    this.s.lastTransitions = [];
    this.s.time = Math.max(this.s.time, next.due);
    this.s.timers = this.s.timers.filter(x => x !== next);
    this.log('timer', { element: next.state, detail: String(next.delayMs) });
    const ts = this.select({ name: `after(${next.delayMs})`, delay: { state: next.state, ms: next.delayMs } });
    if (ts.length) this.microstep(ts);
    this.macrostep();
    this.detectLoop();
    this.updateStatus();
    return true;
  }

  /** Adelanta el reloj `ms` disparando los temporizadores que venzan. */
  advance(ms: number): void {
    const until = this.s.time + Math.max(0, ms);
    while (!isFinished(this.s.status) && this.s.timers.some(t => t.due <= until)) if (!this.step()) break;
    if (!isFinished(this.s.status)) this.s.time = Math.max(this.s.time, until);
  }

  run(maxSteps = 1000): { steps: number; status: SimStatus; stoppedByLimit: boolean } {
    let steps = 0;
    if (this.s.status === 'idle') { this.start(); steps++; }
    while (steps < maxSteps && this.s.status === 'running' && this.s.timers.length) { if (!this.step()) break; steps++; }
    return { steps, status: this.s.status, stoppedByLimit: steps >= maxSteps && this.s.status === 'running' };
  }

  setVariables(vars: Vars, replace = false): void {
    this.s.variables = replace ? { ...vars } : { ...this.s.variables, ...vars };
    this.external();
    if (this.s.status === 'idle' || isFinished(this.s.status)) return;
    this.log('variables', { detail: JSON.stringify(vars) });
    // Las guardas de las `always` pueden haber cambiado.
    this.s.lastTransitions = [];
    this.macrostep();
    this.updateStatus();
  }

  /** Eventos que esperan los estados activos (con evento explícito), y si alguna guarda se cumple ahora. */
  availableEvents(): AvailableEvent[] {
    if (this.s.status === 'idle' || isFinished(this.s.status)) return [];
    const conf = new Set(this.s.configuration);
    const map = new Map<string, AvailableEvent>();
    for (const t of this.model.transitions) {
      if (!conf.has(t.source) || !t.event || t.delayMs !== undefined) continue;
      const ev = map.get(t.event) ?? { event: t.event, enabled: false, transitions: [] };
      ev.transitions.push(t.id);
      if (!ev.enabled && this.guardOk(t) && this.joinOk(t)) ev.enabled = true;
      map.set(t.event, ev);
    }
    return [...map.values()];
  }

  /** Temporizadores pendientes (after). */
  timers(): ScTimer[] { return [...this.s.timers].sort((a, b) => a.due - b.due || a.id - b.id); }

  // ---------------------------------------------------------------- núcleo
  private isAtomic(st: ScNodeInfo) { return st.kind === 'atomic' || st.kind === 'final' || st.kind === 'choice'; }
  private parentOf(id: string) { return this.byId[id]!.parent; }
  private isDescendant(a: string, b: string): boolean {
    let p = this.parentOf(a);
    while (p !== null) { if (p === b) return true; p = this.parentOf(p); }
    return false;
  }
  private properAncestors(id: string, upTo?: string): string[] {
    const out: string[] = [];
    let p = this.parentOf(id);
    while (p !== null && p !== upTo) { out.push(p); p = this.parentOf(p); }
    return out;
  }
  private byOrder = (a: string, b: string) => this.byId[a]!.order - this.byId[b]!.order;

  private log(kind: SimEventKind, e: Omit<SimEvent, 'seq' | 'step' | 'time' | 'kind'>): void {
    this.s.history.push({ seq: ++this.s.seq, step: this.s.step, time: this.s.time, kind, ...e });
    const max = this.options.maxHistory ?? 5000;
    if (this.s.history.length > max) this.s.history.splice(0, this.s.history.length - max);
  }

  private guardOk(t: ScTransitionInfo): boolean {
    if (!t.guard || t.guard === 'else') return true;
    const r = evalCondition(t.guard, this.s.variables);
    if (!r.ok) {
      if (!this.guardErrors.has(t.id)) { this.guardErrors.add(t.id); this.log('condition-error', { flow: t.id, detail: `${t.guard}: ${r.error}` }); }
      return false;
    }
    return r.value;
  }
  private joinOk(t: ScTransitionInfo): boolean {
    if (!t.join) return true;
    const sources = this.model.transitions.filter(x => x.join === t.join).map(x => x.source);
    return sources.every(s => this.s.configuration.includes(s));
  }

  private matches(t: ScTransitionInfo, ev: ScEvent | null): boolean {
    if (ev === null) return t.event === '' && t.delayMs === undefined;
    if (ev.delay) return t.delayMs === ev.delay.ms && t.source === ev.delay.state;
    if (t.delayMs !== undefined) return false;
    if (ev.done) {
      if (t.source !== ev.done) return false;
      const st = this.byId[ev.done]!;
      return t.event === 'done' || t.event === 'onDone' || t.event === `done.state.${st.name}` || t.event === `done.state.${st.id}` || t.event === `xstate.done.state.${st.name}`;
    }
    if (!t.event) return false;
    if (t.event === '*' || t.event === ev.name) return true;
    return t.event.endsWith('.*') && ev.name.startsWith(t.event.slice(0, -1));
  }

  /** Transiciones habilitadas para un evento (o `null` = sin evento), sin conflictos. */
  private select(ev: ScEvent | null): ScTransitionInfo[] {
    const conf = this.s.configuration;
    const enabled: ScTransitionInfo[] = [];
    // De cada hoja activa hacia arriba, la primera transición que case (por regiones, en orden de documento).
    for (const leaf of conf.filter(id => this.isAtomic(this.byId[id]!)).sort(this.byOrder)) {
      found: for (const st of [leaf, ...this.properAncestors(leaf)]) {
        for (const t of this.model.transitions) {
          if (t.source !== st || !this.matches(t, ev)) continue;
          if (!this.guardOk(t) || !this.joinOk(t)) continue;
          if (!enabled.includes(t)) enabled.push(t);
          break found;
        }
      }
    }
    // Conflictos: si dos transiciones salen de estados que se solapan, gana la del estado más profundo (o la primera).
    const out: ScTransitionInfo[] = [];
    for (const t1 of enabled) {
      let preempted = false;
      const remove: ScTransitionInfo[] = [];
      for (const t2 of out) {
        const a = this.exitSet([t1]), b = new Set(this.exitSet([t2]));
        if (a.some(x => b.has(x))) {
          if (this.isDescendant(t1.source, t2.source)) remove.push(t2); else { preempted = true; break; }
        }
      }
      if (!preempted) { for (const r of remove) out.splice(out.indexOf(r), 1); out.push(t1); }
    }
    return out;
  }

  /** Destinos efectivos (resuelve la historia). */
  private effectiveTargets(t: ScTransitionInfo): string[] {
    const out: string[] = [];
    for (const id of t.targets) {
      const st = this.byId[id]!;
      if (st.kind !== 'history') { out.push(id); continue; }
      out.push(...this.historyTargets(st));
    }
    return out;
  }
  private historyTargets(h: ScNodeInfo): string[] {
    const rec = this.s.historyValue[h.id];
    if (rec?.length) return rec;
    if (h.historyDefault && this.byId[h.historyDefault]!.kind !== 'history') return [h.historyDefault];
    const p = this.byId[h.parent!]!;
    return p.initial ? [p.initial] : [];
  }
  private domain(t: ScTransitionInfo): string | null {
    const targets = this.effectiveTargets(t);
    if (!t.targets.length) return null;
    if (targets.every(x => x === t.source || this.isDescendant(x, t.source))) return t.source;
    const [head, ...tail] = [...targets, t.source];
    for (const anc of this.properAncestors(head!)) if (tail.every(x => this.isDescendant(x, anc))) return anc;
    return SC_ROOT;
  }
  private exitSet(ts: ScTransitionInfo[]): string[] {
    const out = new Set<string>();
    for (const t of ts) {
      if (!t.targets.length) continue;
      const d = this.domain(t)!;
      for (const s of this.s.configuration) if (this.isDescendant(s, d)) out.add(s);
    }
    return [...out];
  }

  private addDescendants(id: string, toEnter: Set<string>): void {
    const st = this.byId[id]!;
    if (st.kind === 'history') {
      const targets = this.historyTargets(st);
      for (const s of targets) { toEnter.add(s); this.addDescendants(s, toEnter); }
      for (const s of targets) this.addAncestors(this.properAncestors(s, st.parent!), st.parent!, toEnter);
      return;
    }
    if (st.kind === 'compound' || st.kind === 'root') {
      const init = st.initial;
      if (!init) return;
      if (this.byId[init]!.kind !== 'history') toEnter.add(init);
      this.addDescendants(init, toEnter);
      this.addAncestors(this.properAncestors(init, id), id, toEnter);
    } else if (st.kind === 'parallel') {
      for (const c of st.children) {
        const k = this.byId[c]!.kind;
        if (k === 'history' || !STATEISH.has(k)) continue;
        if (![...toEnter].some(s => s === c || this.isDescendant(s, c))) { toEnter.add(c); this.addDescendants(c, toEnter); }
      }
    }
  }
  private addAncestors(ancestors: string[], domain: string | null, toEnter: Set<string>): void {
    for (const anc of ancestors) {
      if (!domain || this.isDescendant(anc, domain)) toEnter.add(anc);
      if (this.byId[anc]!.kind === 'parallel') {
        for (const c of this.byId[anc]!.children) {
          const k = this.byId[c]!.kind;
          if (k === 'history' || !STATEISH.has(k)) continue;
          if (![...toEnter].some(s => s === c || this.isDescendant(s, c))) { toEnter.add(c); this.addDescendants(c, toEnter); }
        }
      }
    }
  }

  private runActions(list: string[], kind: ScActionLog['kind'], ref: { state?: string; transition?: string }): void {
    for (const a of list) {
      const eff = runAction(a, this.s.variables);
      if (eff.kind === 'assign' && eff.variables) this.s.variables = eff.variables;
      if (eff.kind === 'raise' && eff.event) this.queue.push({ name: eff.event });
      this.s.actions.push({ seq: ++this.s.seq, step: this.s.step, time: this.s.time, kind, ...ref, action: a, effect: eff.kind, ...(eff.error ? { detail: eff.error } : eff.kind === 'assign' ? { detail: `${eff.target} = ${JSON.stringify(eff.variables![eff.target!])}` } : {}) });
      this.log('action', { element: ref.state, flow: ref.transition, detail: a });
      const max = this.options.maxHistory ?? 5000;
      if (this.s.actions.length > max) this.s.actions.splice(0, this.s.actions.length - max);
    }
  }

  private microstep(ts: ScTransitionInfo[]): void {
    const exits = this.exitSet(ts).sort((a, b) => this.byOrder(b, a));
    // Historia: se registra antes de salir.
    for (const x of exits) {
      for (const h of this.byId[x]!.children.filter(c => this.byId[c]!.kind === 'history')) {
        const hist = this.byId[h]!;
        this.s.historyValue[h] = this.s.configuration.filter(s => hist.deep ? this.isAtomic(this.byId[s]!) && this.isDescendant(s, x) : this.parentOf(s) === x);
      }
    }
    for (const x of exits) {
      this.log('exit', { element: x });
      this.runActions(this.byId[x]!.exit, 'exit', { state: x });
      this.s.configuration = this.s.configuration.filter(s => s !== x);
      this.s.timers = this.s.timers.filter(t => t.state !== x);
    }
    for (const t of ts) {
      this.s.visitedTransitions[t.id] = (this.s.visitedTransitions[t.id] ?? 0) + 1;
      this.s.lastTransitions.push(t.id);
      this.log('transition', { element: t.source, flow: t.id, detail: t.event || (t.delayMs !== undefined ? `after ${t.delayText ?? t.delayMs}` : '') });
      this.runActions(t.actions, 'transition', { transition: t.id });
    }
    if (ts.some(t => t.terminate)) {
      this.log('terminated', {});
      this.s.status = 'terminated';
      this.s.timers = [];
      return;
    }
    const toEnter = new Set<string>();
    for (const t of ts) {
      const d = this.domain(t);
      if (d === null) continue;
      for (const s of t.targets) {
        if (this.byId[s]!.kind !== 'history' && (t.source !== s || t.source !== d)) toEnter.add(s);
        this.addDescendants(s, toEnter);
      }
      for (const s of this.effectiveTargets(t)) {
        const anc = this.properAncestors(s, d);
        if (this.byId[d]!.kind === 'parallel') anc.push(d);
        this.addAncestors(anc, d, toEnter);
      }
    }
    this.enter(toEnter);
  }

  private enter(toEnter: Set<string>): void {
    const done = new Set<string>();
    for (const id of [...toEnter].sort(this.byOrder)) {
      if (this.s.configuration.includes(id)) continue;
      const st = this.byId[id]!;
      this.s.configuration.push(id);
      this.s.configuration.sort(this.byOrder);
      this.s.visitedStates[id] = (this.s.visitedStates[id] ?? 0) + 1;
      this.log('entry', { element: id });
      this.runActions(st.entry, 'entry', { state: id });
      // Temporizadores: uno por retardo distinto de sus transiciones `after`.
      const delays = [...new Set(this.model.transitions.filter(t => t.source === id && t.delayMs !== undefined).map(t => t.delayMs!))];
      for (const ms of delays) this.s.timers.push({ id: this.s.nextId++, due: this.s.time + ms, state: id, delayMs: ms });
      if (st.kind === 'final') {
        const parent = this.byId[st.parent!]!;
        let marker: ScNodeInfo | undefined = parent.kind === 'parallel' ? parent : parent.parent ? this.byId[parent.parent] : undefined;
        if (parent.kind === 'compound') { this.queue.push({ name: `done.state.${parent.name}`, done: parent.id }); this.log('done', { element: parent.id }); }
        while (marker?.kind === 'parallel' && !done.has(marker.id) && this.inFinal(marker.id)) {
          done.add(marker.id);
          this.queue.push({ name: `done.state.${marker.name}`, done: marker.id });
          this.log('done', { element: marker.id });
          marker = marker.parent ? this.byId[marker.parent] : undefined;
        }
        if (marker) continue;
        // Final de primer nivel (o paralelo de primer nivel terminado): la máquina acaba.
        this.s.status = 'completed';
        this.s.timers = [];
        this.log('completed', {});
      }
    }
  }

  private inFinal(id: string): boolean {
    const st = this.byId[id]!;
    const conf = this.s.configuration;
    if (st.kind === 'compound' || st.kind === 'root') return st.children.some(c => this.byId[c]!.kind === 'final' && conf.includes(c));
    if (st.kind === 'parallel') return st.children.filter(c => STATEISH.has(this.byId[c]!.kind) && this.byId[c]!.kind !== 'history').every(c => this.inFinal(c));
    return st.kind === 'final' && conf.includes(id);
  }

  private macrostep(): void {
    const max = this.options.maxMicrosteps ?? 100;
    for (let i = 0; this.s.status !== 'completed' && this.s.status !== 'terminated'; i++) {
      if (i >= max) {
        if (!this.loopFlag) { this.loopFlag = true; this.log('loop', { detail: this.activeLeaves().map(id => this.byId[id]!.name).join(', ') }); }
        this.queue = [];
        return;
      }
      let ts = this.select(null);
      if (!ts.length) {
        const ev = this.queue.shift();
        if (!ev) return;
        ts = this.select(ev);
        if (!ts.length) continue;
      }
      this.microstep(ts);
    }
    this.queue = [];
  }

  private external(): void { this.seen.clear(); this.loopFlag = false; }

  private detectLoop(): void {
    if (isFinished(this.s.status)) return;
    const sig = JSON.stringify([this.s.configuration, this.s.variables, this.s.timers.map(t => `${t.state}|${t.due - this.s.time}`).sort(), this.s.historyValue]);
    if (this.seen.has(sig)) {
      if (!this.loopFlag) { this.loopFlag = true; this.log('loop', { detail: this.activeLeaves().map(id => this.byId[id]!.name).join(', ') }); }
      return;
    }
    if (this.seen.size < 20_000) this.seen.add(sig);
  }

  private updateStatus(): void {
    if (this.s.status === 'completed' || this.s.status === 'terminated') return;
    if (this.loopFlag) { this.s.status = 'loop'; return; }
    if (this.s.timers.length) { this.s.status = 'running'; return; }
    if (this.availableEvents().length) { this.s.status = 'waiting'; return; }
    if (this.s.status !== 'deadlock') this.log('deadlock', { detail: this.activeLeaves().map(id => this.byId[id]!.name).join(', ') });
    this.s.status = 'deadlock';
  }
}

export function startStatechart(model: StatechartModel, options: StatechartSimOptions = {}): StatechartSimulation {
  const sim = new StatechartSimulation(model, options);
  sim.start();
  return sim;
}
