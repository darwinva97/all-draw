/**
 * Motor BPMN por **tokens**. Semántica (simplificada pero fiel a BPMN 2.0 en lo que se dibuja):
 *
 * - `start()` pone un token en cada evento de inicio "simple" del proceso (o en todos, si no hay simples).
 * - Cada `step()` hace **una** cosa: procesa el token listo más antiguo o, si no hay ninguno, adelanta el reloj
 *   simulado hasta el siguiente vencimiento (fin de tarea con duración, temporizador) y lo dispara.
 * - Actividades: el token entra (activo) y sale cuando vence su duración (`props.duration`, por defecto 0). Con
 *   `manualTasks`, las tareas de usuario y manuales esperan a `complete()`. Las de recepción esperan un mensaje.
 * - Compuertas: exclusiva (primera condición cierta por orden, si no la de por defecto, si no pregunta), paralela
 *   (bifurca a todas; une cuando ha llegado un token por cada entrada), inclusiva (todas las ciertas; une cuando ya no
 *   puede llegar ningún token más por las entradas que faltan), compleja (como inclusiva) y basada en eventos (espera
 *   al primero de sus eventos: temporizador, mensaje, señal o condición).
 * - Subprocesos: entrar crea un ámbito con tokens en sus inicios; sale cuando el ámbito se queda sin tokens.
 *   Subprocesos de evento: se arman mientras su ámbito está vivo (temporizador, mensaje, señal, condición, error,
 *   escalado); interruptores matan el resto de tokens del ámbito.
 * - Eventos de borde: armados mientras la actividad está en curso; interruptores (por defecto) cancelan la actividad
 *   (y su ámbito), no interruptores lanzan un token adicional (una vez por activación).
 * - Fines: simple (consume), terminación (mata todo el ámbito; en el proceso, la simulación), error / cancelación /
 *   escalado (los captura el subproceso de evento o el evento de borde más cercano), mensaje y señal.
 * - Flujos de mensaje dibujados en la vista entregan el mensaje al terminar el origen (o lo dejan en el buzón).
 * - Bloqueo: quedan tokens y ninguno puede avanzar ni hay acciones posibles. Bucle: se repite el mismo estado
 *   (posiciones, esperas, variables, temporizadores relativos) sin intervención del usuario.
 *
 * Todo el estado (`BpmnSimState`) es JSON: `snapshot()` / `new BpmnSimulation(model, opts, state)`.
 */
import { evalCondition, type Vars } from './expr';
import { analyzeBpmn, isActivity, linkTargets, type BpmnModel, type BpmnNodeInfo } from './bpmn-model';
import type { SimEvent, SimEventKind, SimStatus, SimWarning } from './types';
import { isFinished } from './types';

export type BpmnWait = 'task' | 'manual' | 'message' | 'signal' | 'timer' | 'condition' | 'choice' | 'join' | 'eventGateway' | 'subprocess';

export interface BpmnToken {
  id: number;
  /** Elemento en el que está. */
  node: string;
  /** Ámbito (instancia de proceso o subproceso). */
  scope: number;
  /** `ready`: procesar en el próximo paso · `active`: actividad en curso · `waiting`: espera algo. */
  state: 'ready' | 'active' | 'waiting';
  wait?: BpmnWait;
  /** Flujo por el que llegó. */
  via?: string;
  /** Tiempo simulado de llegada. */
  since: number;
}

export interface BpmnScope { id: number; element: string | null; parent: number | null; host: number | null }

export interface BpmnScheduled {
  id: number;
  due: number;
  kind: 'complete' | 'timer' | 'boundary' | 'gateway' | 'eventSub';
  node: string;
  token?: number;
  scope?: number;
}

export interface BpmnBlocked { token: number; element: string; reason: 'join' | 'condition' | 'choice' | 'message' | 'signal' | 'manual' | 'other'; missing?: string[] }

export interface BpmnSimState {
  status: SimStatus;
  time: number;
  step: number;
  seq: number;
  nextId: number;
  tokens: BpmnToken[];
  scopes: BpmnScope[];
  scheduled: BpmnScheduled[];
  variables: Vars;
  /** Mensajes entregados a un nodo que aún no los esperaba. */
  mailbox: Record<string, number>;
  history: SimEvent[];
  visitedFlows: Record<string, number>;
  visitedNodes: Record<string, number>;
  /** Flujos y nodos recorridos en el último paso (para animar). */
  lastFlows: string[];
  lastNodes: string[];
  /** Disparos únicos ya hechos (borde no interruptor por activación, inicio condicional por ámbito). */
  fired: string[];
  /** Inicios del proceso que `start()` no usó (se pueden disparar a mano). */
  manualStarts: string[];
  blocked: BpmnBlocked[];
}

export interface BpmnSimOptions {
  variables?: Vars;
  /** Las tareas de usuario y manuales esperan a `complete()`. */
  manualTasks?: boolean;
  /** Entradas máximas del historial (las más antiguas se descartan). Por defecto 5000. */
  maxHistory?: number;
  /** Eventos de inicio que usa `start()` (por defecto: los simples del proceso, o todos). */
  startEvents?: string[];
}

export type BpmnAction =
  | { id: string; kind: 'choice'; token: number; element: string; flows: string[]; multi: boolean }
  | { id: string; kind: 'message' | 'signal'; element: string; token?: number; scope?: number; source: 'catch' | 'boundary' | 'gateway' | 'eventSub' | 'start' | 'receive' }
  | { id: string; kind: 'complete'; token: number; element: string }
  | { id: string; kind: 'condition'; element: string; token?: number; condition: string };

export interface RunResult { steps: number; status: SimStatus; stoppedByLimit: boolean }

const ROOT_SCOPE = 0;
const MAX_SIGNATURES = 20_000;

export function initialBpmnState(variables: Vars = {}): BpmnSimState {
  return {
    status: 'idle', time: 0, step: 0, seq: 0, nextId: 1, tokens: [], scopes: [], scheduled: [], variables: { ...variables }, mailbox: {}, history: [],
    visitedFlows: {}, visitedNodes: {}, lastFlows: [], lastNodes: [], fired: [], manualStarts: [], blocked: [],
  };
}

export class BpmnSimulation {
  readonly model: BpmnModel;
  readonly options: BpmnSimOptions;
  private s: BpmnSimState;
  private seen = new Set<string>();
  private loopFlag = false;
  private readonly boundariesOf = new Map<string, BpmnNodeInfo[]>();
  private readonly eventSubsOf = new Map<string | null, BpmnNodeInfo[]>();

  constructor(model: BpmnModel, options: BpmnSimOptions = {}, state?: BpmnSimState) {
    this.model = model;
    this.options = options;
    this.s = state ? structuredClone(state) : initialBpmnState(options.variables);
    for (const n of Object.values(model.nodes)) {
      if (n.kind === 'boundary' && n.attachedTo) { const l = this.boundariesOf.get(n.attachedTo) ?? []; l.push(n); this.boundariesOf.set(n.attachedTo, l); }
      // Inicios de subprocesos de evento, por ámbito que los arma (el que contiene al subproceso de evento).
      if (n.kind === 'start' && n.scope && model.nodes[n.scope]?.kind === 'eventSubprocess') {
        const host = model.nodes[n.scope]!.scope;
        const l = this.eventSubsOf.get(host) ?? []; l.push(n); this.eventSubsOf.set(host, l);
      }
    }
    if (state?.status === 'loop') this.loopFlag = true;
  }

  // ---------------------------------------------------------------- lectura
  /** Copia del estado (JSON). */
  snapshot(): BpmnSimState { return structuredClone(this.s); }
  get status(): SimStatus { return this.s.status; }
  get time(): number { return this.s.time; }
  get variables(): Vars { return this.s.variables; }
  get tokens(): readonly BpmnToken[] { return this.s.tokens; }
  get history(): readonly SimEvent[] { return this.s.history; }
  /** Avisos del modelo (temporizadores ilegibles, condiciones inválidas, bucles sin salida…). */
  get warnings(): SimWarning[] { return this.model.warnings; }
  analysis() { return analyzeBpmn(this.model); }

  // ---------------------------------------------------------------- control
  /** Reinicia y coloca los tokens iniciales. */
  start(): void {
    const vars = this.s.status === 'idle' ? this.s.variables : { ...(this.options.variables ?? {}), ...this.s.variables };
    this.s = initialBpmnState(vars);
    this.seen.clear(); this.loopFlag = false;
    this.s.scopes.push({ id: ROOT_SCOPE, element: null, parent: null, host: null });
    const roots = Object.values(this.model.nodes).filter(n => n.kind === 'start' && n.scope === null).sort(this.byOrder);
    const chosen = this.options.startEvents?.length ? roots.filter(n => this.options.startEvents!.includes(n.id))
      : roots.some(n => n.eventDefinition === 'none') ? roots.filter(n => n.eventDefinition === 'none') : roots;
    this.s.manualStarts = roots.filter(n => !chosen.includes(n) && (n.eventDefinition === 'message' || n.eventDefinition === 'signal')).map(n => n.id);
    this.s.status = 'running';
    this.log('start', {});
    if (!chosen.length) this.log('warning', { warning: { key: 'La vista no tiene ningún evento de inicio en el proceso principal' } });
    for (const n of chosen) this.newToken(n.id, ROOT_SCOPE);
    this.armEventSubprocesses(ROOT_SCOPE);
    this.settle();
    this.updateStatus();
  }

  /** Un paso. Devuelve si hubo progreso. */
  step(): boolean {
    if (this.s.status === 'idle') { this.start(); return true; }
    if (isFinished(this.s.status)) return false;
    this.s.lastFlows = []; this.s.lastNodes = [];
    const ready = this.s.tokens.filter(t => t.state === 'ready').sort((a, b) => a.id - b.id)[0];
    let progressed = false;
    this.s.step++;
    if (ready) { this.process(ready); progressed = true; }
    else {
      const next = [...this.s.scheduled].sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (next) { this.s.time = Math.max(this.s.time, next.due); this.fire(next); progressed = true; }
    }
    if (!progressed) { this.s.step--; this.updateStatus(); return false; }
    this.settle();
    this.detectLoop();
    this.updateStatus();
    return true;
  }

  /** Avanza hasta terminar, bloquearse, necesitar al usuario, detectar un bucle o agotar `maxSteps`. */
  run(maxSteps = 1000): RunResult {
    let steps = 0;
    if (this.s.status === 'idle') { this.start(); steps++; }
    while (steps < maxSteps && this.s.status === 'running') { if (!this.step()) break; steps++; }
    return { steps, status: this.s.status, stoppedByLimit: steps >= maxSteps && this.s.status === 'running' };
  }

  /** Cambia variables (las condiciones se reevalúan). */
  setVariables(vars: Vars, replace = false): void {
    this.s.variables = replace ? { ...vars } : { ...this.s.variables, ...vars };
    this.external();
    if (this.s.status === 'idle') return;
    this.log('variables', { detail: JSON.stringify(vars) });
    if (isFinished(this.s.status)) return;
    this.s.lastFlows = []; this.s.lastNodes = [];
    this.settle();
    this.updateStatus();
  }

  // ---------------------------------------------------------------- acciones del usuario
  /** Lo que el usuario puede hacer ahora: elegir rama, disparar mensajes/señales, completar tareas manuales. */
  available(): BpmnAction[] {
    if (this.s.status === 'idle' || isFinished(this.s.status)) return [];
    const out: BpmnAction[] = [];
    for (const t of [...this.s.tokens].sort((a, b) => a.id - b.id)) {
      const n = this.model.nodes[t.node]!;
      if (t.wait === 'choice') out.push({ id: `choice:${t.id}`, kind: 'choice', token: t.id, element: n.id, flows: this.choiceOptions(t), multi: n.kind !== 'exclusive' });
      else if (t.wait === 'manual') out.push({ id: `complete:${t.id}`, kind: 'complete', token: t.id, element: n.id });
      else if (t.wait === 'message') out.push({ id: `message:${n.id}:${t.id}`, kind: 'message', element: n.id, token: t.id, source: n.kind === 'task' ? 'receive' : 'catch' });
      else if (t.wait === 'signal') out.push({ id: `signal:${n.id}:${t.id}`, kind: 'signal', element: n.id, token: t.id, source: 'catch' });
      else if (t.wait === 'condition' && n.condition) out.push({ id: `condition:${n.id}:${t.id}`, kind: 'condition', element: n.id, token: t.id, condition: n.condition });
      else if (t.wait === 'eventGateway') {
        for (const f of n.outgoing) {
          const target = this.model.nodes[this.model.flows[f]!.target]!;
          const def = target.kind === 'task' ? 'message' : target.eventDefinition;
          if (def === 'message' || def === 'signal') out.push({ id: `${def}:${target.id}:${t.id}`, kind: def, element: target.id, token: t.id, source: 'gateway' });
          else if (def === 'conditional' && target.condition) out.push({ id: `condition:${target.id}:${t.id}`, kind: 'condition', element: target.id, token: t.id, condition: target.condition });
        }
      }
      if (t.state === 'active' || t.wait === 'subprocess' || (t.wait === 'message' && n.kind === 'task') || t.wait === 'manual') {
        for (const b of this.boundariesOf.get(n.id) ?? []) {
          if (!b.interrupting && this.s.fired.includes(`${t.id}:${b.id}`) && b.eventDefinition !== 'message' && b.eventDefinition !== 'signal') continue;
          if (b.eventDefinition === 'message' || b.eventDefinition === 'signal') out.push({ id: `${b.eventDefinition}:${b.id}:${t.id}`, kind: b.eventDefinition, element: b.id, token: t.id, source: 'boundary' });
          else if (b.eventDefinition === 'conditional' && b.condition) out.push({ id: `condition:${b.id}:${t.id}`, kind: 'condition', element: b.id, token: t.id, condition: b.condition });
        }
      }
    }
    for (const sc of this.s.scopes) {
      for (const st of this.eventSubsIn(sc)) {
        if (st.eventDefinition === 'message' || st.eventDefinition === 'signal') out.push({ id: `${st.eventDefinition}:${st.id}:s${sc.id}`, kind: st.eventDefinition, element: st.id, scope: sc.id, source: 'eventSub' });
      }
    }
    if (this.s.scopes.some(sc => sc.id === ROOT_SCOPE)) for (const id of this.s.manualStarts) {
      const n = this.model.nodes[id]!;
      out.push({ id: `${n.eventDefinition}:${id}:start`, kind: n.eventDefinition as 'message' | 'signal', element: id, source: 'start' });
    }
    return out;
  }

  /** Ejecuta una acción de `available()` por id. `flows` para las elecciones. */
  perform(actionId: string, flows?: string[]): boolean {
    const a = this.available().find(x => x.id === actionId);
    if (!a) return false;
    switch (a.kind) {
      case 'choice': return this.choose(a.token, flows ?? []);
      case 'complete': return this.complete(a.token);
      case 'condition': return false;
      case 'message': case 'signal': {
        this.external();
        this.s.lastFlows = []; this.s.lastNodes = [];
        this.s.step++;
        if (a.kind === 'signal') this.broadcast(this.signalKey(this.model.nodes[a.element]!), a.element);
        else this.triggerListener(a);
        this.settle(); this.updateStatus();
        return true;
      }
    }
  }

  /** Elige la(s) rama(s) de una compuerta que preguntó. */
  choose(tokenId: number, flowIds: string[]): boolean {
    const t = this.token(tokenId);
    if (!t || t.wait !== 'choice') return false;
    const n = this.model.nodes[t.node]!;
    const options = this.choiceOptions(t);
    const picked = [...new Set(flowIds)].filter(f => options.includes(f));
    if (!picked.length || (n.kind === 'exclusive' && picked.length !== 1)) return false;
    this.external();
    this.s.lastFlows = []; this.s.lastNodes = [];
    this.s.step++;
    this.log('choice', { element: n.id, token: t.id, detail: picked.map(f => this.flowName(f)).join(', ') });
    this.leave(t, picked);
    this.settle(); this.detectLoop(); this.updateStatus();
    return true;
  }

  /** Termina una tarea manual (con `manualTasks`). */
  complete(tokenId: number): boolean {
    const t = this.token(tokenId);
    if (!t || t.wait !== 'manual') return false;
    this.external();
    this.s.lastFlows = []; this.s.lastNodes = [];
    this.s.step++;
    this.completeActivity(t);
    this.settle(); this.updateStatus();
    return true;
  }

  /** Dispara a mano un mensaje o señal en un elemento (atajo de `perform`). */
  trigger(elementId: string, tokenId?: number): boolean {
    const a = this.available().find(x => (x.kind === 'message' || x.kind === 'signal') && x.element === elementId && (tokenId === undefined || ('token' in x && x.token === tokenId)));
    return a ? this.perform(a.id) : false;
  }

  /** Elementos con token y cuántos, con la espera más relevante. */
  activeElements(): { element: string; count: number; state: BpmnToken['state']; wait?: BpmnWait }[] {
    const map = new Map<string, { element: string; count: number; state: BpmnToken['state']; wait?: BpmnWait }>();
    for (const t of this.s.tokens) {
      const cur = map.get(t.node);
      if (cur) { cur.count++; if (t.state === 'ready') cur.state = 'ready'; continue; }
      map.set(t.node, { element: t.node, count: 1, state: t.state, ...(t.wait ? { wait: t.wait } : {}) });
    }
    return [...map.values()];
  }

  // ---------------------------------------------------------------- núcleo
  private byOrder = (a: BpmnNodeInfo, b: BpmnNodeInfo) => this.model.order.indexOf(a.id) - this.model.order.indexOf(b.id);
  private token(id: number) { return this.s.tokens.find(t => t.id === id); }
  private alive(t: BpmnToken) { return this.s.tokens.includes(t); }
  private flowName(f: string) { const fl = this.model.flows[f]; return fl ? fl.name || this.model.nodes[fl.target]?.name || f : f; }

  private log(kind: SimEventKind, e: Omit<SimEvent, 'seq' | 'step' | 'time' | 'kind'>): void {
    this.s.history.push({ seq: ++this.s.seq, step: this.s.step, time: this.s.time, kind, ...e });
    const max = this.options.maxHistory ?? 5000;
    if (this.s.history.length > max) this.s.history.splice(0, this.s.history.length - max);
  }

  private newToken(node: string, scope: number, via?: string): BpmnToken {
    const t: BpmnToken = { id: this.s.nextId++, node, scope, state: 'ready', since: this.s.time, ...(via ? { via } : {}) };
    this.s.tokens.push(t);
    return t;
  }
  private schedule(item: Omit<BpmnScheduled, 'id'>): void { this.s.scheduled.push({ id: this.s.nextId++, ...item }); }
  private unschedule(pred: (x: BpmnScheduled) => boolean): void { this.s.scheduled = this.s.scheduled.filter(x => !pred(x)); }

  private markNode(id: string) {
    this.s.visitedNodes[id] = (this.s.visitedNodes[id] ?? 0) + 1;
    if (!this.s.lastNodes.includes(id)) this.s.lastNodes.push(id);
  }

  /** Mueve el token por los flujos dados (el primero lo lleva el propio token; el resto, tokens nuevos). */
  private leave(t: BpmnToken, flowIds: string[] = this.model.nodes[t.node]!.outgoing): void {
    if (!this.alive(t)) return;
    const from = this.model.nodes[t.node]!;
    if (isActivity(from)) this.disarm(t);
    if (!flowIds.length) {
      this.removeToken(t);
      if (from.kind !== 'end' && from.kind !== 'eventSubprocess') this.log('end', { element: from.id, token: t.id, detail: 'implicit' });
      return;
    }
    if (flowIds.length > 1) this.log('fork', { element: from.id, token: t.id, detail: String(flowIds.length) });
    flowIds.forEach((f, i) => {
      const flow = this.model.flows[f]!;
      this.s.visitedFlows[f] = (this.s.visitedFlows[f] ?? 0) + 1;
      this.s.lastFlows.push(f);
      const tok = i === 0 ? t : this.newToken(flow.target, t.scope, f);
      if (i === 0) { tok.node = flow.target; tok.via = f; tok.state = 'ready'; delete tok.wait; tok.since = this.s.time; }
      this.log('flow', { element: from.id, flow: f, token: tok.id, detail: this.model.nodes[flow.target]?.name ?? '' });
    });
  }

  private removeToken(t: BpmnToken): void {
    this.s.tokens = this.s.tokens.filter(x => x !== t);
    this.unschedule(x => x.token === t.id);
    this.s.fired = this.s.fired.filter(k => !k.startsWith(`${t.id}:`));
  }

  /** Mata un token y, si espera a un subproceso, todo su ámbito. */
  private killToken(t: BpmnToken): void {
    this.removeToken(t);
    for (const sc of this.s.scopes.filter(x => x.host === t.id)) this.killScope(sc.id);
  }
  private killScope(id: number): void {
    for (const t of this.s.tokens.filter(x => x.scope === id)) this.killToken(t);
    for (const sc of this.s.scopes.filter(x => x.parent === id)) this.killScope(sc.id);
    this.unschedule(x => x.scope === id);
    this.s.fired = this.s.fired.filter(k => !k.startsWith(`s${id}:`));
    this.s.scopes = this.s.scopes.filter(x => x.id !== id);
  }

  private process(t: BpmnToken): void {
    const n = this.model.nodes[t.node]!;
    this.markNode(n.id);
    switch (n.kind) {
      case 'start':
        this.log('enter', { element: n.id, token: t.id });
        this.leave(t); return;
      case 'boundary':
        this.leave(t); return;
      case 'task': return this.enterTask(t, n);
      case 'subprocess': return this.enterSubprocess(t, n);
      case 'eventSubprocess':
        this.log('warning', { element: n.id, warning: { key: 'Un flujo de secuencia llega al subproceso de evento «{name}»; se ignora', vars: { name: n.name || n.id } } });
        this.removeToken(t); return;
      case 'exclusive': case 'inclusive': case 'complex': return this.gateway(t, n);
      case 'parallel': return this.parallel(t, n);
      case 'eventBased': return this.eventGateway(t, n);
      case 'catch': return this.catchEvent(t, n);
      case 'throw': return this.throwEvent(t, n);
      case 'end': return this.endEvent(t, n);
    }
  }

  // ---- actividades
  private enterTask(t: BpmnToken, n: BpmnNodeInfo): void {
    this.log('enter', { element: n.id, token: t.id });
    t.state = 'active';
    this.arm(t, n);
    if (n.taskType === 'receive') {
      if (this.takeMail(n.id)) this.log('message', { element: n.id, token: t.id });
      else { t.state = 'waiting'; t.wait = 'message'; this.log('wait', { element: n.id, token: t.id, detail: 'message' }); return; }
    }
    if (this.options.manualTasks && (n.taskType === 'user' || n.taskType === 'manual')) { t.wait = 'manual'; this.log('wait', { element: n.id, token: t.id, detail: 'manual' }); return; }
    t.wait = 'task';
    this.schedule({ kind: 'complete', node: n.id, token: t.id, due: this.s.time + (n.durationMs ?? 0) });
  }

  private completeActivity(t: BpmnToken): void {
    const n = this.model.nodes[t.node]!;
    this.markNode(n.id);
    this.log('leave', { element: n.id, token: t.id });
    this.deliver(n);
    this.leave(t);
  }

  private enterSubprocess(t: BpmnToken, n: BpmnNodeInfo): void {
    const inner = Object.values(this.model.nodes).filter(x => x.scope === n.id);
    if (!inner.length) return this.enterTask(t, n);
    const scope: BpmnScope = { id: this.s.nextId++, element: n.id, parent: t.scope, host: t.id };
    this.s.scopes.push(scope);
    t.state = 'waiting'; t.wait = 'subprocess';
    this.arm(t, n);
    this.log('subprocess-start', { element: n.id, token: t.id });
    let starts = inner.filter(x => x.kind === 'start' && x.eventDefinition === 'none');
    if (!starts.length) starts = inner.filter(x => x.kind === 'start');
    if (!starts.length) starts = inner.filter(x => x.incoming.length === 0 && x.kind !== 'boundary' && x.kind !== 'eventSubprocess' && !(x.kind === 'catch' && x.eventDefinition === 'link'));
    if (n.typeId === 'bpmn:AdHocSubProcess') this.log('warning', { element: n.id, warning: { key: 'El subproceso ad hoc «{name}» se simula ejecutando sus actividades sueltas en paralelo', vars: { name: n.name || n.id } } });
    for (const st of starts.sort(this.byOrder)) this.newToken(st.id, scope.id);
    this.armEventSubprocesses(scope.id);
  }

  /** Arma los eventos de borde de una actividad en curso. */
  private arm(t: BpmnToken, n: BpmnNodeInfo): void {
    for (const b of this.boundariesOf.get(n.id) ?? []) {
      if (b.eventDefinition === 'timer') this.schedule({ kind: 'boundary', node: b.id, token: t.id, due: this.s.time + (b.timerMs ?? 60_000) });
      else if (b.eventDefinition === 'message' && this.takeMail(b.id)) this.fireBoundary(b, t);
      if (!this.alive(t)) return;
    }
  }
  private disarm(t: BpmnToken): void {
    this.unschedule(x => x.token === t.id && (x.kind === 'boundary' || x.kind === 'complete'));
    this.s.fired = this.s.fired.filter(k => !k.startsWith(`${t.id}:`));
  }

  private fireBoundary(b: BpmnNodeInfo, host: BpmnToken, interrupting = b.interrupting): void {
    this.markNode(b.id);
    this.log('boundary', { element: b.id, token: host.id, detail: interrupting ? 'interrupting' : 'non-interrupting' });
    if (interrupting) {
      const scope = host.scope;
      this.killToken(host);
      this.newToken(b.id, scope);
    } else {
      this.s.fired.push(`${host.id}:${b.id}`);
      this.unschedule(x => x.token === host.id && x.node === b.id);
      this.newToken(b.id, host.scope);
    }
  }

  // ---- compuertas
  private choiceOptions(t: BpmnToken): string[] {
    const n = this.model.nodes[t.node]!;
    const conditioned = n.outgoing.filter(f => this.model.flows[f]!.condition);
    const free = n.outgoing.filter(f => !this.model.flows[f]!.condition && !this.model.flows[f]!.isDefault);
    // Si hay salidas sin condición (y no todas lo son), se pregunta entre esas; si no, entre todas.
    return conditioned.length && free.length > 1 ? free : n.outgoing;
  }

  private gateway(t: BpmnToken, n: BpmnNodeInfo): void {
    if (n.kind === 'complex' && !this.s.fired.includes(`w:${n.id}`)) {
      this.s.fired.push(`w:${n.id}`);
      this.log('warning', { element: n.id, warning: { key: 'La compuerta compleja «{name}» se simula como inclusiva', vars: { name: n.name || n.id } } });
    }
    // Unión (inclusiva/compleja con varias entradas): espera hasta que no pueda llegar nada más.
    if (n.kind !== 'exclusive' && n.incoming.length > 1) {
      t.state = 'waiting'; t.wait = 'join';
      this.log('wait', { element: n.id, token: t.id, detail: 'join' });
      this.tryInclusiveJoin(n, t.scope);
      return;
    }
    this.split(t, n);
  }

  private split(t: BpmnToken, n: BpmnNodeInfo): void {
    const outs = n.outgoing;
    if (outs.length <= 1) { this.log('enter', { element: n.id, token: t.id }); this.leave(t, outs); return; }
    const results: { f: string; ok: boolean }[] = [];
    for (const f of outs) {
      const fl = this.model.flows[f]!;
      if (!fl.condition || fl.isDefault) continue;
      const r = evalCondition(fl.condition, this.s.variables);
      if (!r.ok) this.log('condition-error', { element: n.id, flow: f, detail: `${fl.condition}: ${r.error}` });
      results.push({ f, ok: r.ok && r.value });
      if (n.kind === 'exclusive' && r.ok && r.value) break;
    }
    const truthy = results.filter(r => r.ok).map(r => r.f);
    const free = outs.filter(f => !this.model.flows[f]!.condition && !this.model.flows[f]!.isDefault);
    const anyConditioned = outs.some(f => this.model.flows[f]!.condition && !this.model.flows[f]!.isDefault);
    let chosen: string[] = [];
    let reason = '';
    if (n.kind === 'exclusive') {
      if (truthy.length) { chosen = [truthy[0]!]; reason = this.model.flows[truthy[0]!]!.condition!; }
      else if (n.defaultFlow) { chosen = [n.defaultFlow]; reason = 'default'; }
      else if (anyConditioned && free.length === 1) { chosen = free; reason = 'unconditioned'; }
    } else if (anyConditioned) {
      // Inclusiva: todas las ciertas más las que no llevan condición; si ninguna, la de por defecto.
      chosen = outs.filter(f => truthy.includes(f) || free.includes(f));
      reason = chosen.map(f => this.model.flows[f]!.condition ?? '—').join(' · ');
      if (!chosen.length && n.defaultFlow) { chosen = [n.defaultFlow]; reason = 'default'; }
    }
    if (!chosen.length) {
      t.state = 'waiting'; t.wait = 'choice';
      this.log('wait', { element: n.id, token: t.id, detail: 'choice' });
      return;
    }
    this.log('decision', { element: n.id, token: t.id, detail: reason });
    this.leave(t, chosen);
  }

  private parallel(t: BpmnToken, n: BpmnNodeInfo): void {
    if (n.incoming.length <= 1) { this.log('enter', { element: n.id, token: t.id }); this.leave(t); return; }
    t.state = 'waiting'; t.wait = 'join';
    const waiting = this.s.tokens.filter(x => x.node === n.id && x.scope === t.scope && x.wait === 'join').sort((a, b) => a.id - b.id);
    const pick: BpmnToken[] = [];
    for (const f of n.incoming) {
      const w = waiting.find(x => (x.via ?? n.incoming[0]) === f && !pick.includes(x));
      if (!w) { this.log('wait', { element: n.id, token: t.id, detail: 'join' }); return; }
      pick.push(w);
    }
    this.log('join', { element: n.id, token: pick[0]!.id, detail: String(pick.length) });
    for (const p of pick.slice(1)) this.removeToken(p);
    this.leave(pick[0]!);
  }

  /** Une los tokens que esperan en una inclusiva si por las entradas vacías ya no puede llegar nada. */
  private tryInclusiveJoin(n: BpmnNodeInfo, scope: number): boolean {
    const waiting = this.s.tokens.filter(x => x.node === n.id && x.scope === scope && x.wait === 'join').sort((a, b) => a.id - b.id);
    if (!waiting.length) return false;
    const arrived = new Set(waiting.map(w => w.via ?? n.incoming[0]));
    const missing = n.incoming.filter(f => !arrived.has(f));
    const others = this.s.tokens.filter(x => x.scope === scope && !(x.node === n.id && x.wait === 'join'));
    // Un token que acaba de llegar (aún sin procesar) se unirá en su turno.
    if (others.some(o => o.node === n.id)) return false;
    const reach = this.reachMap();
    const canStillArrive = missing.some(f => { const src = this.model.flows[f]!.source; return others.some(o => o.node === src || reach.get(o.node)!.has(src)); });
    if (canStillArrive) return false;
    this.log('join', { element: n.id, token: waiting[0]!.id, detail: String(waiting.length) });
    for (const w of waiting.slice(1)) this.removeToken(w);
    const first = waiting[0]!;
    first.state = 'ready'; delete first.wait;
    this.split(first, n);
    return true;
  }

  private reach?: Map<string, Set<string>>;
  private reachMap(): Map<string, Set<string>> {
    if (this.reach) return this.reach;
    const m = new Map<string, Set<string>>();
    const succ = (id: string) => {
      const n = this.model.nodes[id]!;
      const out = n.outgoing.map(f => this.model.flows[f]!.target);
      if (isActivity(n)) for (const b of this.boundariesOf.get(id) ?? []) out.push(b.id);
      if (n.kind === 'throw' && n.eventDefinition === 'link') for (const c of linkTargets(this.model, n)) out.push(c.id);
      return out;
    };
    for (const id of this.model.order) {
      const seen = new Set<string>();
      const stack = succ(id);
      while (stack.length) { const x = stack.pop()!; if (seen.has(x)) continue; seen.add(x); stack.push(...succ(x)); }
      m.set(id, seen);
    }
    this.reach = m;
    return m;
  }

  private eventGateway(t: BpmnToken, n: BpmnNodeInfo): void {
    t.state = 'waiting'; t.wait = 'eventGateway';
    this.log('wait', { element: n.id, token: t.id, detail: 'event' });
    for (const f of n.outgoing) {
      const target = this.model.nodes[this.model.flows[f]!.target]!;
      if (target.eventDefinition === 'timer') this.schedule({ kind: 'gateway', node: target.id, token: t.id, due: this.s.time + (target.timerMs ?? 60_000) });
    }
    for (const f of n.outgoing) {
      const target = this.model.nodes[this.model.flows[f]!.target]!;
      if ((target.eventDefinition === 'message' || target.kind === 'task') && this.takeMail(target.id)) { this.fireGatewayOption(t, target); return; }
    }
  }

  /** La compuerta basada en eventos sigue por el evento que ocurrió: el token pasa por él y sale. */
  private fireGatewayOption(t: BpmnToken, target: BpmnNodeInfo): void {
    const gw = this.model.nodes[t.node]!;
    const f = gw.outgoing.find(x => this.model.flows[x]!.target === target.id)!;
    this.unschedule(x => x.token === t.id && x.kind === 'gateway');
    this.log('decision', { element: gw.id, token: t.id, detail: target.name || target.id });
    this.leave(t, [f]);
    this.markNode(target.id);
    this.log(target.eventDefinition === 'timer' ? 'timer' : target.eventDefinition === 'signal' ? 'signal' : target.eventDefinition === 'conditional' ? 'condition' : 'message', { element: target.id, token: t.id });
    if (target.kind === 'task') { this.enterTaskAfterMessage(t, target); return; }
    this.leave(t);
  }
  private enterTaskAfterMessage(t: BpmnToken, n: BpmnNodeInfo): void {
    this.log('enter', { element: n.id, token: t.id });
    t.state = 'active'; t.wait = 'task';
    this.arm(t, n);
    if (this.alive(t)) this.schedule({ kind: 'complete', node: n.id, token: t.id, due: this.s.time + (n.durationMs ?? 0) });
  }

  // ---- eventos
  private catchEvent(t: BpmnToken, n: BpmnNodeInfo): void {
    switch (n.eventDefinition) {
      case 'timer':
        t.state = 'waiting'; t.wait = 'timer';
        this.schedule({ kind: 'timer', node: n.id, token: t.id, due: this.s.time + (n.timerMs ?? 60_000) });
        this.log('wait', { element: n.id, token: t.id, detail: 'timer' });
        return;
      case 'signal':
        t.state = 'waiting'; t.wait = 'signal';
        this.log('wait', { element: n.id, token: t.id, detail: 'signal' });
        return;
      case 'conditional':
        if (this.conditionHolds(n.condition, n.id)) { this.log('condition', { element: n.id, token: t.id, detail: n.condition ?? '' }); this.leave(t); return; }
        t.state = 'waiting'; t.wait = 'condition';
        this.log('wait', { element: n.id, token: t.id, detail: 'condition' });
        return;
      case 'link': case 'none':
        this.leave(t); return;
      default: // message, multiple, parallelMultiple…
        if (this.takeMail(n.id)) { this.log('message', { element: n.id, token: t.id }); this.leave(t); return; }
        t.state = 'waiting'; t.wait = 'message';
        this.log('wait', { element: n.id, token: t.id, detail: 'message' });
    }
  }

  private throwEvent(t: BpmnToken, n: BpmnNodeInfo): void {
    switch (n.eventDefinition) {
      case 'link': {
        const target = linkTargets(this.model, n)[0];
        if (!target) { this.log('warning', { element: n.id, warning: { key: 'El enlace «{name}» no tiene evento de captura con el mismo nombre', vars: { name: n.link || n.name || n.id } } }); this.leave(t); return; }
        this.log('link', { element: n.id, token: t.id, detail: target.name || target.id });
        t.node = target.id; t.state = 'ready'; delete t.via; t.since = this.s.time;
        return;
      }
      case 'signal': this.log('signal', { element: n.id, token: t.id, detail: this.signalKey(n) }); this.broadcast(this.signalKey(n), n.id); break;
      case 'message': this.log('message', { element: n.id, token: t.id }); this.deliver(n); break;
      case 'escalation': this.log('escalation', { element: n.id, token: t.id }); this.throwUp('escalation', n, t.scope); break;
      case 'compensation': this.log('warning', { element: n.id, warning: { key: 'La compensación de «{name}» no se simula', vars: { name: n.name || n.id } } }); break;
      default: this.log('enter', { element: n.id, token: t.id });
    }
    if (this.alive(t)) this.leave(t);
  }

  private endEvent(t: BpmnToken, n: BpmnNodeInfo): void {
    this.removeToken(t);
    const scope = t.scope;
    switch (n.eventDefinition) {
      case 'terminate': {
        this.log('terminated', { element: n.id, token: t.id });
        if (scope === ROOT_SCOPE) {
          this.killScope(ROOT_SCOPE);
          this.s.status = 'terminated';
          return;
        }
        for (const x of this.s.tokens.filter(x => x.scope === scope)) this.killToken(x);
        for (const sc of this.s.scopes.filter(x => x.parent === scope)) this.killScope(sc.id);
        return;
      }
      case 'error': case 'cancel':
        this.log('error', { element: n.id, token: t.id, detail: n.eventDefinition });
        this.throwUp(n.eventDefinition, n, scope);
        return;
      case 'escalation':
        this.log('escalation', { element: n.id, token: t.id });
        this.throwUp('escalation', n, scope);
        break;
      case 'message': this.deliver(n); break;
      case 'signal': this.broadcast(this.signalKey(n), n.id); break;
      case 'compensation': this.log('warning', { element: n.id, warning: { key: 'La compensación de «{name}» no se simula', vars: { name: n.name || n.id } } }); break;
    }
    this.log('end', { element: n.id, token: t.id });
  }

  /** Error, cancelación o escalado: lo captura el subproceso de evento o el borde más cercano hacia arriba. */
  private throwUp(kind: 'error' | 'cancel' | 'escalation', thrower: BpmnNodeInfo, scopeId: number): void {
    const matches = (c: BpmnNodeInfo) => c.eventDefinition === kind && (!c.eventRef || !thrower.eventRef || c.eventRef === thrower.eventRef);
    let sc = this.s.scopes.find(x => x.id === scopeId);
    while (sc) {
      const sub = this.eventSubsIn(sc).find(matches);
      if (sub) { this.fireEventSub(sub, sc.id, kind !== 'escalation' || sub.interrupting); return; }
      if (sc.host !== null) {
        const host = this.token(sc.host);
        const b = host ? (this.boundariesOf.get(host.node) ?? []).find(matches) : undefined;
        if (host && b) { this.fireBoundary(b, host, kind !== 'escalation' || b.interrupting); return; }
      }
      sc = sc.parent === null ? undefined : this.s.scopes.find(x => x.id === sc!.parent);
    }
    if (kind === 'escalation') { this.log('warning', { element: thrower.id, warning: { key: 'Nadie captura el escalado de «{name}»', vars: { name: thrower.name || thrower.id } } }); return; }
    this.log('error', { element: thrower.id, detail: 'uncaught' });
    this.killScope(ROOT_SCOPE);
    this.s.status = 'failed';
  }

  /** Inicio de un subproceso de evento dentro del ámbito `scopeId`. */
  private fireEventSub(start: BpmnNodeInfo, scopeId: number, interrupting = start.interrupting): void {
    const sub = this.model.nodes[start.scope!]!;
    this.markNode(start.id);
    this.log('event-subprocess', { element: sub.id, detail: interrupting ? 'interrupting' : 'non-interrupting' });
    if (interrupting) {
      for (const t of this.s.tokens.filter(x => x.scope === scopeId)) this.killToken(t);
      for (const sc of this.s.scopes.filter(x => x.parent === scopeId)) this.killScope(sc.id);
      this.unschedule(x => x.scope === scopeId);
      // Un subproceso de evento interruptor desarma los demás disparadores del ámbito.
      this.s.fired.push(`s${scopeId}:*`);
    } else if (start.eventDefinition === 'timer' || start.eventDefinition === 'conditional') this.s.fired.push(`s${scopeId}:${start.id}`);
    const inner: BpmnScope = { id: this.s.nextId++, element: sub.id, parent: scopeId, host: null };
    this.s.scopes.push(inner);
    this.newToken(start.id, inner.id);
    this.armEventSubprocesses(inner.id);
  }

  /** Inicios de subprocesos de evento armados en un ámbito vivo (ninguno si uno interruptor ya lo interrumpió). */
  private eventSubsIn(sc: BpmnScope): BpmnNodeInfo[] {
    return this.s.fired.includes(`s${sc.id}:*`) ? [] : this.eventSubsOf.get(sc.element) ?? [];
  }

  private armEventSubprocesses(scopeId: number): void {
    const sc = this.s.scopes.find(x => x.id === scopeId);
    if (!sc) return;
    for (const st of this.eventSubsIn(sc)) {
      if (st.eventDefinition === 'timer') this.schedule({ kind: 'eventSub', node: st.id, scope: scopeId, due: this.s.time + (st.timerMs ?? 60_000) });
      else if (st.eventDefinition === 'message' && this.takeMail(st.id)) this.fireEventSub(st, scopeId);
    }
  }

  private signalKey(n: BpmnNodeInfo): string { return (n.eventRef || n.name || '').trim(); }

  /** Señal: llega a todo lo que la escucha (capturas, bordes, compuertas de eventos, subprocesos de evento, inicios). */
  private broadcast(key: string, from: string): void {
    const match = (n: BpmnNodeInfo) => n.eventDefinition === 'signal' && n.id !== from && (!key || !this.signalKey(n) || this.signalKey(n) === key);
    for (const t of [...this.s.tokens].sort((a, b) => a.id - b.id)) {
      if (!this.alive(t)) continue;
      const n = this.model.nodes[t.node]!;
      if (t.wait === 'signal' && match(n)) { this.markNode(n.id); this.log('signal', { element: n.id, token: t.id, detail: key }); this.leave(t); continue; }
      if (t.wait === 'eventGateway') {
        const opt = n.outgoing.map(f => this.model.nodes[this.model.flows[f]!.target]!).find(match);
        if (opt) { this.fireGatewayOption(t, opt); continue; }
      }
      if (t.state === 'active' || t.wait === 'subprocess' || t.wait === 'manual' || (t.wait === 'message' && n.kind === 'task')) {
        for (const b of this.boundariesOf.get(n.id) ?? []) if (match(b) && this.alive(t)) this.fireBoundary(b, t);
      }
    }
    for (const sc of [...this.s.scopes]) {
      if (!this.s.scopes.includes(sc)) continue;
      for (const st of this.eventSubsIn(sc)) if (match(st)) { this.fireEventSub(st, sc.id); break; }
    }
    for (const id of this.s.manualStarts) { const n = this.model.nodes[id]!; if (match(n) && this.s.scopes.some(x => x.id === ROOT_SCOPE)) this.newToken(id, ROOT_SCOPE); }
  }

  /** Flujos de mensaje que salen de `n`: entrega a quien espera o deja el mensaje en el buzón del destino. */
  private deliver(n: BpmnNodeInfo): void {
    for (const mf of Object.values(this.model.messageFlows)) {
      if (mf.source !== n.id) continue;
      this.s.visitedFlows[mf.id] = (this.s.visitedFlows[mf.id] ?? 0) + 1;
      this.s.lastFlows.push(mf.id);
      const target = this.model.nodes[mf.target];
      this.log('message', { element: n.id, flow: mf.id, detail: target?.name ?? '' });
      if (!target) continue;
      if (!this.triggerListener({ element: target.id })) this.s.mailbox[target.id] = (this.s.mailbox[target.id] ?? 0) + 1;
    }
  }
  private takeMail(id: string): boolean {
    if (!this.s.mailbox[id]) return false;
    if (--this.s.mailbox[id]! <= 0) delete this.s.mailbox[id];
    return true;
  }

  /** Dispara un mensaje en un elemento que lo espera. Devuelve si alguien lo recibió. */
  private triggerListener(a: { element: string; token?: number; scope?: number }): boolean {
    const n = this.model.nodes[a.element]!;
    const tokens = [...this.s.tokens].sort((x, y) => x.id - y.id);
    // Captura o tarea de recepción con token esperando.
    const waiting = tokens.find(t => t.node === n.id && t.wait === 'message' && (a.token === undefined || t.id === a.token));
    if (waiting) {
      this.markNode(n.id);
      this.log('message', { element: n.id, token: waiting.id });
      if (n.kind === 'task') { waiting.state = 'active'; waiting.wait = 'task'; this.schedule({ kind: 'complete', node: n.id, token: waiting.id, due: this.s.time + (n.durationMs ?? 0) }); }
      else this.leave(waiting);
      return true;
    }
    // Opción de una compuerta basada en eventos.
    const gw = tokens.find(t => t.wait === 'eventGateway' && (a.token === undefined || t.id === a.token) && this.model.nodes[t.node]!.outgoing.some(f => this.model.flows[f]!.target === n.id));
    if (gw) { this.fireGatewayOption(gw, n); return true; }
    // Evento de borde de una actividad en curso.
    if (n.kind === 'boundary' && n.attachedTo) {
      const host = tokens.find(t => t.node === n.attachedTo && (t.state === 'active' || t.wait === 'subprocess' || t.wait === 'manual' || t.wait === 'message') && (a.token === undefined || t.id === a.token));
      if (host) { this.fireBoundary(n, host); return true; }
    }
    // Inicio de subproceso de evento en un ámbito vivo.
    if (n.kind === 'start' && n.scope && this.model.nodes[n.scope]?.kind === 'eventSubprocess') {
      const hostEl = this.model.nodes[n.scope]!.scope;
      const sc = this.s.scopes.find(x => x.element === hostEl && (a.scope === undefined || x.id === a.scope) && this.eventSubsIn(x).includes(n));
      if (sc) { this.fireEventSub(n, sc.id); return true; }
    }
    // Inicio del proceso (nueva instancia).
    if (n.kind === 'start' && n.scope === null && this.s.manualStarts.includes(n.id) && this.s.scopes.some(x => x.id === ROOT_SCOPE)) {
      this.markNode(n.id);
      this.log('message', { element: n.id });
      this.newToken(n.id, ROOT_SCOPE);
      return true;
    }
    return false;
  }

  private fire(item: BpmnScheduled): void {
    this.s.scheduled = this.s.scheduled.filter(x => x !== item);
    const n = this.model.nodes[item.node]!;
    const t = item.token !== undefined ? this.token(item.token) : undefined;
    switch (item.kind) {
      case 'complete': if (t) this.completeActivity(t); return;
      case 'timer':
        if (!t) return;
        this.markNode(n.id);
        this.log('timer', { element: n.id, token: t.id });
        this.leave(t);
        return;
      case 'boundary':
        if (!t) return;
        this.log('timer', { element: n.id, token: t.id });
        this.fireBoundary(n, t);
        return;
      case 'gateway': if (t) this.fireGatewayOption(t, n); return;
      case 'eventSub':
        if (item.scope !== undefined && this.s.scopes.some(x => x.id === item.scope)) { this.log('timer', { element: n.id }); this.fireEventSub(n, item.scope); }
    }
  }

  private conditionHolds(cond: string | undefined, element: string): boolean {
    if (!cond) return false;
    const r = evalCondition(cond, this.s.variables);
    if (!r.ok) {
      if (!this.s.fired.includes(`e:${element}`)) { this.s.fired.push(`e:${element}`); this.log('condition-error', { element, detail: `${cond}: ${r.error}` }); }
      return false;
    }
    return r.value;
  }

  /** Tras cada paso: condiciones que se cumplen, uniones inclusivas y ámbitos que terminan. */
  private settle(): void {
    for (let guard = 0; guard < 1000; guard++) {
      let changed = false;
      for (const t of [...this.s.tokens].sort((a, b) => a.id - b.id)) {
        if (!this.alive(t)) continue;
        const n = this.model.nodes[t.node]!;
        if (t.wait === 'condition' && this.conditionHolds(n.condition, n.id)) { this.markNode(n.id); this.log('condition', { element: n.id, token: t.id, detail: n.condition ?? '' }); this.leave(t); changed = true; continue; }
        if (t.wait === 'eventGateway') {
          const opt = n.outgoing.map(f => this.model.nodes[this.model.flows[f]!.target]!).find(o => o.eventDefinition === 'conditional' && this.conditionHolds(o.condition, o.id));
          if (opt) { this.fireGatewayOption(t, opt); changed = true; continue; }
        }
        if (t.state === 'active' || t.wait === 'subprocess' || t.wait === 'manual' || (t.wait === 'message' && n.kind === 'task')) {
          for (const b of this.boundariesOf.get(n.id) ?? []) {
            if (b.eventDefinition !== 'conditional' || this.s.fired.includes(`${t.id}:${b.id}`) || !this.alive(t)) continue;
            if (this.conditionHolds(b.condition, b.id)) { this.log('condition', { element: b.id, token: t.id, detail: b.condition ?? '' }); this.fireBoundary(b, t); changed = true; }
          }
        }
      }
      for (const sc of [...this.s.scopes]) {
        if (!this.s.scopes.includes(sc)) continue;
        for (const st of this.eventSubsIn(sc)) {
          if (st.eventDefinition !== 'conditional' || this.s.fired.includes(`s${sc.id}:${st.id}`)) continue;
          if (this.conditionHolds(st.condition, st.id)) { this.log('condition', { element: st.id, detail: st.condition ?? '' }); this.fireEventSub(st, sc.id); changed = true; break; }
        }
      }
      // Uniones inclusivas pendientes.
      const joins = new Map<string, BpmnToken>();
      for (const t of this.s.tokens) if (t.wait === 'join' && this.model.nodes[t.node]!.kind !== 'parallel') joins.set(`${t.node}|${t.scope}`, t);
      for (const t of joins.values()) if (this.tryInclusiveJoin(this.model.nodes[t.node]!, t.scope)) changed = true;
      // Ámbitos que se quedaron sin trabajo (los más profundos primero).
      const depth = (sc: BpmnScope): number => { let d = 0; let p = sc.parent; while (p !== null) { d++; p = this.s.scopes.find(x => x.id === p)?.parent ?? null; } return d; };
      for (const sc of [...this.s.scopes].sort((a, b) => depth(b) - depth(a))) {
        if (!this.s.scopes.includes(sc)) continue;
        if (this.s.tokens.some(t => t.scope === sc.id) || this.s.scopes.some(x => x.parent === sc.id)) continue;
        this.s.scopes = this.s.scopes.filter(x => x !== sc);
        this.unschedule(x => x.scope === sc.id);
        changed = true;
        if (sc.host !== null) {
          const host = this.token(sc.host);
          if (host) { this.log('subprocess-end', { element: host.node, token: host.id }); this.markNode(host.node); this.deliver(this.model.nodes[host.node]!); this.leave(host); }
        } else if (sc.parent !== null) this.log('subprocess-end', { element: sc.element ?? undefined });
        else if (this.s.status !== 'terminated' && this.s.status !== 'failed') { this.s.status = 'completed'; this.log('completed', {}); }
      }
      if (!changed) return;
    }
  }

  private external(): void { this.seen.clear(); this.loopFlag = false; }

  private detectLoop(): void {
    if (isFinished(this.s.status) || this.seen.size > MAX_SIGNATURES) return;
    const scopeEl = new Map(this.s.scopes.map(sc => [sc.id, sc.element ?? '']));
    const sig = JSON.stringify([
      this.s.tokens.map(t => `${t.node}|${t.state}|${t.wait ?? ''}|${t.via ?? ''}|${scopeEl.get(t.scope)}`).sort(),
      this.s.scheduled.map(x => `${x.kind}|${x.node}|${x.due - this.s.time}`).sort(),
      this.s.scopes.map(sc => sc.element ?? '').sort(),
      this.s.variables, this.s.mailbox,
    ]);
    if (this.seen.has(sig)) {
      if (!this.loopFlag) {
        this.loopFlag = true;
        this.log('loop', { detail: [...new Set(this.s.tokens.map(t => this.model.nodes[t.node]?.name || t.node))].join(', ') });
      }
      return;
    }
    this.seen.add(sig);
  }

  private updateStatus(): void {
    if (this.s.status === 'terminated' || this.s.status === 'failed' || this.s.status === 'completed') { this.s.blocked = []; return; }
    if (!this.s.scopes.some(x => x.id === ROOT_SCOPE)) { this.s.status = 'completed'; return; }
    this.s.blocked = [];
    const busy = this.s.tokens.some(t => t.state === 'ready') || this.s.scheduled.length > 0;
    if (busy) { this.s.status = this.loopFlag ? 'loop' : 'running'; return; }
    const actions = this.available();
    const actionable = actions.some(a => a.kind !== 'condition');
    for (const t of this.s.tokens) {
      const n = this.model.nodes[t.node]!;
      if (t.wait === 'join') {
        const arrived = new Set(this.s.tokens.filter(x => x.node === n.id && x.scope === t.scope && x.wait === 'join').map(x => x.via));
        const missing = n.incoming.filter(f => !arrived.has(f)).map(f => { const src = this.model.nodes[this.model.flows[f]!.source]!; return this.model.flows[f]!.name || src.name || src.id; });
        if (!this.s.blocked.some(b => b.element === n.id)) this.s.blocked.push({ token: t.id, element: n.id, reason: 'join', missing });
      } else if (t.wait === 'condition') this.s.blocked.push({ token: t.id, element: n.id, reason: 'condition' });
    }
    if (actionable || actions.length) { this.s.status = this.loopFlag ? 'loop' : 'waiting'; return; }
    if (this.s.status !== 'deadlock') this.log('deadlock', { detail: this.s.blocked.map(b => this.model.nodes[b.element]?.name || b.element).join(', ') });
    this.s.status = 'deadlock';
  }
}

/** Atajo: modelo + simulación iniciada. */
export function startBpmn(model: BpmnModel, options: BpmnSimOptions = {}): BpmnSimulation {
  const sim = new BpmnSimulation(model, options);
  sim.start();
  return sim;
}
