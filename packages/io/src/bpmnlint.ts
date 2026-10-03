/**
 * Diez reglas de bpmnlint portadas como `Validator` del núcleo, más `bpmn-pool-rules` (reglas de BPMN que la matriz de
 * validez no expresa: pools de los flujos y eventos de borde). Operan sobre el modelo semántico
 * (elementos y relaciones `bpmn:*`), sin XML: sirven para modelos importados y para los creados a mano.
 * Los códigos coinciden con los nombres de las reglas de bpmnlint.
 *
 * El "ámbito" de un nodo es su proceso: la Pool, el `Process` o el subproceso más cercano (según los
 * nodos de las vistas o `features.bpmnParent`); las lanes y los grupos no cuentan.
 */
import { indexOf, type Diagnostic, type Element, type Relation, type Store, type Validator } from '@all-draw/core';

const SEQ = 'bpmn:SequenceFlow';
const MSG = 'bpmn:MessageFlow';
/** Participantes: pool con proceso, pool colapsada y proceso sin pool (vista con raíz `Process`). */
const PARTICIPANTS = new Set(['bpmn:Pool', 'bpmn:Participant', 'bpmn:Process']);
const SUBPROCESSES = new Set(['bpmn:SubProcess', 'bpmn:EventSubProcess', 'bpmn:AdHocSubProcess', 'bpmn:Transaction']);
const ACTIVITIES = new Set([...SUBPROCESSES, 'bpmn:Task', 'bpmn:CallActivity']);
const GATEWAYS = new Set(['bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway', 'bpmn:ComplexGateway']);
const EVENTS = new Set(['bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateCatchEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:BoundaryEvent']);
const CHOREOGRAPHY = new Set(['bpmn:ChoreographyTask', 'bpmn:SubChoreography', 'bpmn:CallChoreography']);
const SCOPES = new Set(['bpmn:Pool', 'bpmn:Process', ...SUBPROCESSES]);
const CONDITIONAL_GATEWAYS = new Set(['bpmn:ExclusiveGateway', 'bpmn:InclusiveGateway', 'bpmn:ComplexGateway']);

const isFlowNode = (e: Element) => ACTIVITIES.has(e.typeId) || GATEWAYS.has(e.typeId) || EVENTS.has(e.typeId) || CHOREOGRAPHY.has(e.typeId);

/** Índice del modelo BPMN de un store: nodos de flujo, flujos de secuencia y ámbitos. */
export interface BpmnIndex {
  elements: Element[];
  flows: Relation[];
  incoming(id: string): Relation[];
  outgoing(id: string): Relation[];
  /** Ámbito (proceso/pool/subproceso) de un elemento, o `undefined` si está en la raíz. */
  scopeOf(id: string): string | undefined;
  /** Nodos de flujo por ámbito (`''` = raíz). */
  scopes: Map<string, Element[]>;
  /** Contenedor semántico más cercano (nodos de las vistas saltando grupos, o `features.bpmnParent`). */
  parentOf(id: string): string | undefined;
  /** Elemento BPMN por id. */
  get(id: string): Element | undefined;
}

export function indexBpmn(store: Store): BpmnIndex {
  const elements = store.list('elements').filter(e => e.typeId.startsWith('bpmn:') && !e.template);
  const byId = new Map(elements.map(e => [e.id, e]));
  const flows = store.list('relations').filter(r => r.typeId === SEQ && r.from.elementId && r.to.elementId);
  const inc = new Map<string, Relation[]>(), out = new Map<string, Relation[]>();
  for (const f of flows) {
    out.set(f.from.elementId!, [...(out.get(f.from.elementId!) ?? []), f]);
    inc.set(f.to.elementId!, [...(inc.get(f.to.elementId!) ?? []), f]);
  }
  // Padre de cada elemento: nodos de las vistas (saltando grupos) o `features.bpmnParent`.
  const index = indexOf(store);
  const nodeById = (id: string) => store.get('nodes', id);
  const parent = new Map<string, string | undefined>();
  const parentOf = (id: string): string | undefined => {
    if (parent.has(id)) return parent.get(id);
    let found: string | undefined;
    for (const n of index.nodesOfElement(id)) {
      let p = n.parentNodeId ? nodeById(n.parentNodeId) : undefined;
      while (p && (!p.elementId || byId.get(p.elementId)?.typeId === 'bpmn:Group')) p = p.parentNodeId ? nodeById(p.parentNodeId) : undefined;
      if (p?.elementId && byId.has(p.elementId)) { found = p.elementId; break; }
      const root = store.get('views', n.viewId)?.rootElementId;
      if (root && byId.has(root) && root !== id) { found = root; break; }
    }
    if (!found) { const bp = byId.get(id)?.features.bpmnParent; if (typeof bp === 'string' && byId.has(bp) && bp !== id) found = bp; }
    parent.set(id, found);
    return found;
  };
  const scopeCache = new Map<string, string | undefined>();
  const scopeOf = (id: string): string | undefined => {
    if (scopeCache.has(id)) return scopeCache.get(id);
    let p = parentOf(id), guard = 0;
    while (p && guard++ < 50 && !SCOPES.has(byId.get(p)!.typeId)) p = parentOf(p);
    scopeCache.set(id, p);
    return p;
  };
  const scopes = new Map<string, Element[]>();
  for (const e of elements) if (isFlowNode(e)) { const s = scopeOf(e.id) ?? ''; scopes.set(s, [...(scopes.get(s) ?? []), e]); }
  return { elements, flows, incoming: id => inc.get(id) ?? [], outgoing: id => out.get(id) ?? [], scopeOf, scopes, parentOf, get: id => byId.get(id) };
}

const diag = (code: string, severity: Diagnostic['severity'], collection: 'elements' | 'relations', id: string, message: string, extra: Partial<Diagnostic> = {}): Diagnostic =>
  ({ code, severity, subject: { collection, id }, message, supportedFixes: [], ...extra });

const label = (e: Element) => e.name || e.id;
const isNone = (e: Element) => !e.fields.eventDefinition || e.fields.eventDefinition === 'none';
const hasCondition = (f: Relation) => !!f.fields.condition || !!f.fields.default;

/** Ámbitos que deben tener eventos de inicio/fin: procesos y subprocesos normales con nodos dentro. */
function processScopes(ix: BpmnIndex): { id: string; owner: Element | undefined; nodes: Element[] }[] {
  const out: { id: string; owner: Element | undefined; nodes: Element[] }[] = [];
  for (const [id, nodes] of ix.scopes) {
    const owner = id ? ix.elements.find(e => e.id === id) : undefined;
    if (owner && (owner.typeId === 'bpmn:AdHocSubProcess' || owner.typeId === 'bpmn:EventSubProcess')) continue;
    if (!nodes.some(n => !CHOREOGRAPHY.has(n.typeId))) continue;
    out.push({ id, owner, nodes });
  }
  return out;
}

export const startEventRequired: Validator = {
  id: 'bpmnlint.start-event-required',
  run({ store }) {
    const ix = indexBpmn(store);
    return processScopes(ix).filter(s => !s.nodes.some(n => n.typeId === 'bpmn:StartEvent')).map(s =>
      s.owner
        ? diag('start-event-required', 'error', 'elements', s.owner.id, `El proceso "${label(s.owner)}" no tiene evento de inicio`)
        : diag('start-event-required', 'error', 'elements', s.nodes[0]!.id, 'El proceso no tiene evento de inicio', { evidence: { scope: 'root' } }));
  },
};

export const endEventRequired: Validator = {
  id: 'bpmnlint.end-event-required',
  run({ store }) {
    const ix = indexBpmn(store);
    return processScopes(ix).filter(s => !s.nodes.some(n => n.typeId === 'bpmn:EndEvent')).map(s =>
      s.owner
        ? diag('end-event-required', 'error', 'elements', s.owner.id, `El proceso "${label(s.owner)}" no tiene evento de fin`)
        : diag('end-event-required', 'error', 'elements', s.nodes[0]!.id, 'El proceso no tiene evento de fin', { evidence: { scope: 'root' } }));
  },
};

export const noDisconnected: Validator = {
  id: 'bpmnlint.no-disconnected',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    for (const e of ix.elements) {
      if (!isFlowNode(e) || e.typeId === 'bpmn:EventSubProcess') continue;
      if (e.fields.isForCompensation) continue;
      if (e.fields.eventDefinition === 'link') continue;
      if (e.typeId === 'bpmn:BoundaryEvent' && (e.fields.attachedTo || e.fields.eventDefinition === 'compensation')) continue;
      if (ix.incoming(e.id).length || ix.outgoing(e.id).length) continue;
      out.push(diag('no-disconnected', 'error', 'elements', e.id, `"${label(e)}" no está conectado a ningún flujo de secuencia`, {
        supportedFixes: [{ label: 'Borrar elemento', command: { type: 'deleteElement', id: e.id } }],
      }));
    }
    return out;
  },
};

export const singleBlankStartEvent: Validator = {
  id: 'bpmnlint.single-blank-start-event',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    for (const [, nodes] of ix.scopes) {
      const blanks = nodes.filter(n => n.typeId === 'bpmn:StartEvent' && isNone(n));
      if (blanks.length > 1) for (const b of blanks) out.push(diag('single-blank-start-event', 'error', 'elements', b.id, `Hay ${blanks.length} eventos de inicio sin definición en el mismo proceso`, { evidence: { ids: blanks.map(x => x.id) } }));
    }
    return out;
  },
};

export const noImplicitSplit: Validator = {
  id: 'bpmnlint.no-implicit-split',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    for (const e of ix.elements) {
      if (!isFlowNode(e) || GATEWAYS.has(e.typeId)) continue;
      const outgoing = ix.outgoing(e.id);
      if (outgoing.length > 1 && outgoing.some(f => !f.fields.condition))
        out.push(diag('no-implicit-split', 'warning', 'elements', e.id, `"${label(e)}" divide el flujo sin compuerta: ${outgoing.length} salidas sin condición`, { evidence: { flows: outgoing.map(f => f.id) } }));
    }
    return out;
  },
};

export const noDuplicateSequenceFlows: Validator = {
  id: 'bpmnlint.no-duplicate-sequence-flows',
  run({ store }) {
    const ix = indexBpmn(store);
    const seen = new Map<string, Relation>();
    const out: Diagnostic[] = [];
    for (const f of ix.flows) {
      const key = `${f.from.elementId}→${f.to.elementId}`;
      const first = seen.get(key);
      if (first) out.push(diag('no-duplicate-sequence-flows', 'error', 'relations', f.id, `Flujo de secuencia duplicado (${key})`, {
        evidence: { duplicateOf: first.id },
        supportedFixes: [{ label: 'Borrar duplicado', command: { type: 'deleteRelation', id: f.id } }],
      }));
      else seen.set(key, f);
    }
    return out;
  },
};

export const labelRequired: Validator = {
  id: 'bpmnlint.label-required',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    const needs = (e: Element): boolean => {
      const t = e.typeId;
      if (t === 'bpmn:Pool' || t === 'bpmn:Participant' || t === 'bpmn:Lane') return true;
      if (ACTIVITIES.has(t) && t !== 'bpmn:EventSubProcess') return true;
      if (CHOREOGRAPHY.has(t)) return true;
      if (EVENTS.has(t)) return t !== 'bpmn:BoundaryEvent';
      if (CONDITIONAL_GATEWAYS.has(t)) return ix.outgoing(e.id).length > 1;
      return false;
    };
    for (const e of ix.elements) if (needs(e) && !e.name.trim())
      out.push(diag('label-required', 'warning', 'elements', e.id, `Falta la etiqueta de ${e.typeId.slice(5)} (${e.id})`));
    // Flujos condicionales que salen de compuertas divergentes exclusivas/inclusivas.
    for (const e of ix.elements) {
      if (!CONDITIONAL_GATEWAYS.has(e.typeId)) continue;
      const outgoing = ix.outgoing(e.id);
      if (outgoing.length < 2) continue;
      for (const f of outgoing) if (!f.name.trim() && !f.fields.default)
        out.push(diag('label-required', 'warning', 'relations', f.id, `Falta la etiqueta del flujo que sale de "${label(e)}"`));
    }
    return out;
  },
};

export const superfluousGateway: Validator = {
  id: 'bpmnlint.superfluous-gateway',
  run({ store }) {
    const ix = indexBpmn(store);
    return ix.elements
      .filter(e => GATEWAYS.has(e.typeId) && ix.incoming(e.id).length === 1 && ix.outgoing(e.id).length === 1)
      .map(e => diag('superfluous-gateway', 'warning', 'elements', e.id, `La compuerta "${label(e)}" es superflua: una entrada y una salida`));
  },
};

export const fakeJoin: Validator = {
  id: 'bpmnlint.fake-join',
  run({ store }) {
    const ix = indexBpmn(store);
    return ix.elements
      .filter(e => isFlowNode(e) && !GATEWAYS.has(e.typeId) && e.typeId !== 'bpmn:EndEvent' && ix.incoming(e.id).length > 1)
      .map(e => diag('fake-join', 'warning', 'elements', e.id, `"${label(e)}" recibe ${ix.incoming(e.id).length} flujos: las entradas no se sincronizan (usa una compuerta)`, { evidence: { flows: ix.incoming(e.id).map(f => f.id) } }));
  },
};

export const noInclusiveGatewayWithoutCondition: Validator = {
  id: 'bpmnlint.no-inclusive-gateway-without-condition',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    for (const e of ix.elements) {
      if (e.typeId !== 'bpmn:InclusiveGateway') continue;
      const outgoing = ix.outgoing(e.id);
      if (outgoing.length < 2) continue;
      for (const f of outgoing) if (!hasCondition(f))
        out.push(diag('no-inclusive-gateway-without-condition', 'error', 'relations', f.id, `La salida de la compuerta inclusiva "${label(e)}" no tiene condición ni es la de por defecto`, { evidence: { gateway: e.id } }));
    }
    return out;
  },
};

/** Participante (pool, pool colapsada o proceso) de un elemento: él mismo si lo es, o el contenedor más cercano que lo sea. */
export function participantOf(ix: BpmnIndex, id: string): string | undefined {
  let cur: string | undefined = id, guard = 0;
  while (cur && guard++ < 50) {
    if (PARTICIPANTS.has(ix.get(cur)?.typeId ?? '')) return cur;
    cur = ix.parentOf(cur);
  }
  return undefined;
}

/**
 * Reglas de BPMN que la matriz de validez no puede expresar:
 * - un **flujo de secuencia** no sale de su pool/proceso (ambos extremos en el mismo participante);
 * - un **flujo de mensaje** une participantes **distintos** (nunca dos pasos de la misma pool);
 * - un **evento de borde** está anidado en una actividad (o adherido a una con `attachedTo`, como en los modelos importados).
 */
export const bpmnPoolRules: Validator = {
  id: 'bpmnlint.bpmn-pool-rules',
  run({ store }) {
    const ix = indexBpmn(store);
    const out: Diagnostic[] = [];
    const name = (id: string | undefined) => { const e = id ? ix.get(id) : undefined; return e ? label(e) : '?'; };
    for (const r of store.list('relations')) {
      if ((r.typeId !== SEQ && r.typeId !== MSG) || !r.from.elementId || !r.to.elementId) continue;
      if (!ix.get(r.from.elementId) || !ix.get(r.to.elementId)) continue;
      const a = participantOf(ix, r.from.elementId), b = participantOf(ix, r.to.elementId);
      if (r.typeId === SEQ && a !== b) {
        out.push(diag('bpmn-pool-rules', 'error', 'relations', r.id,
          `El flujo de secuencia de "${name(r.from.elementId)}" a "${name(r.to.elementId)}" cruza de pool (${a ? `"${name(a)}"` : 'ninguna'} → ${b ? `"${name(b)}"` : 'ninguna'}): entre pools distintas usa un flujo de mensaje`,
          { evidence: { rule: 'sequence-flow-same-pool', from: a, to: b } }));
      }
      if (r.typeId === MSG && a && a === b) {
        out.push(diag('bpmn-pool-rules', 'error', 'relations', r.id,
          `El flujo de mensaje de "${name(r.from.elementId)}" a "${name(r.to.elementId)}" no sale de "${name(a)}": los mensajes van entre pools distintas (dentro de una pool, flujo de secuencia)`,
          { evidence: { rule: 'message-flow-different-pools', pool: a } }));
      }
    }
    for (const e of ix.elements) {
      if (e.typeId !== 'bpmn:BoundaryEvent') continue;
      const parent = ix.parentOf(e.id);
      const host = typeof e.fields.attachedTo === 'string' ? e.fields.attachedTo : undefined;
      const nested = !!parent && ACTIVITIES.has(ix.get(parent)?.typeId ?? '');
      const attached = !!host && ACTIVITIES.has(ix.get(host)?.typeId ?? '');
      if (!nested && !attached) {
        out.push(diag('bpmn-pool-rules', 'error', 'elements', e.id, `El evento de borde "${label(e)}" no está sobre una actividad: suéltalo dentro de la tarea o subproceso al que pertenece`,
          { evidence: { rule: 'boundary-event-in-activity', parent } }));
      }
    }
    return out;
  },
};

export const BPMNLINT_VALIDATORS: Validator[] = [
  startEventRequired, endEventRequired, noDisconnected, singleBlankStartEvent, noImplicitSplit,
  noDuplicateSequenceFlows, labelRequired, superfluousGateway, fakeJoin, noInclusiveGatewayWithoutCondition,
  bpmnPoolRules,
];
