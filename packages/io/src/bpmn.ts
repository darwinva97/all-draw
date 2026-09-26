/**
 * Import/export de BPMN 2.0 XML con `bpmn-moddle` (metamodelo completo, sin DOM).
 *
 * Correspondencia con el pack `bpmn`:
 *  - `bpmn:Definitions` → un `Workspace`; cada `bpmndi:BPMNDiagram` → una `View` (`notationId: 'bpmn'`).
 *  - `bpmn:Participant` con `processRef` → `bpmn:Pool` (contenedor); sin él → `bpmn:Participant` (colapsada).
 *  - `bpmn:UserTask`… → `bpmn:Task` con `taskType`; `SubProcess triggeredByEvent` → `EventSubProcess`.
 *  - `DataObjectReference`/`DataStoreReference` → `DataObject`/`DataStore` (los ids de los referenciados
 *    se guardan en `features` para conservarlos).
 *  - `eventDefinitions` → campo `eventDefinition` (+ `eventRef`, `timer`, `condition`, `link`).
 *  - `extensionElements` y atributos de otros espacios de nombres → `features.bpmnExtensions` /
 *    `features.bpmnAttrs` (JSON serializable) y vuelven al XML al exportar.
 *  - Nodos: `BPMNShape.Bounds` absolutos → `ViewNode` relativo a su padre (pool, lane, subproceso).
 *    `BPMNEdge.waypoint` → `bendpoints` absolutos sin el primero ni el último.
 */
/// <reference path="./bpmn-moddle.d.ts" />
import { BpmnModdle, type ModdleElement } from 'bpmn-moddle';
import { emptyWorkspace, newId, type Workspace, type Element, type Relation, type View, type ViewNode, type ViewEdge } from '@all-draw/core';

export interface BpmnImportResult { workspace: Workspace; warnings: string[] }

const NS = 'bpmn:';
const SEQ = 'bpmn:SequenceFlow';
const MSG = 'bpmn:MessageFlow';
const ASSOC = 'bpmn:Association';
const DIN = 'bpmn:DataInputAssociation';
const DOUT = 'bpmn:DataOutputAssociation';
const CONV = 'bpmn:ConversationLink';
const TARGET_NAMESPACE = 'http://bpmn.io/schema/bpmn';
const EXPORTER_VERSION = '0.2.0';

/** Tipo moddle de tarea ↔ valor del campo `taskType`. */
const TASK_TYPES: Record<string, string> = {
  'bpmn:Task': 'none', 'bpmn:UserTask': 'user', 'bpmn:ServiceTask': 'service', 'bpmn:ScriptTask': 'script',
  'bpmn:ManualTask': 'manual', 'bpmn:BusinessRuleTask': 'businessRule', 'bpmn:SendTask': 'send', 'bpmn:ReceiveTask': 'receive',
};
const TASK_TYPE_TO_MODDLE: Record<string, string> = Object.fromEntries(Object.entries(TASK_TYPES).map(([k, v]) => [v, k]));

/** Definición de evento moddle ↔ valor del campo `eventDefinition`. */
const EVENT_DEFS: Record<string, string> = {
  'bpmn:MessageEventDefinition': 'message', 'bpmn:TimerEventDefinition': 'timer', 'bpmn:SignalEventDefinition': 'signal',
  'bpmn:ConditionalEventDefinition': 'conditional', 'bpmn:ErrorEventDefinition': 'error', 'bpmn:EscalationEventDefinition': 'escalation',
  'bpmn:CancelEventDefinition': 'cancel', 'bpmn:CompensateEventDefinition': 'compensation', 'bpmn:LinkEventDefinition': 'link',
  'bpmn:TerminateEventDefinition': 'terminate',
};
const EVENT_DEF_TO_MODDLE: Record<string, string> = Object.fromEntries(Object.entries(EVENT_DEFS).map(([k, v]) => [v, k]));
/** Propiedad de referencia de cada definición de evento (`messageRef`, `signalRef`…). */
const EVENT_REF_PROP: Record<string, string> = { message: 'messageRef', signal: 'signalRef', error: 'errorRef', escalation: 'escalationRef' };
const DEFINITION_TYPES: Record<string, string> = { 'bpmn:Message': 'bpmn:Message', 'bpmn:Signal': 'bpmn:Signal', 'bpmn:Error': 'bpmn:Error', 'bpmn:Escalation': 'bpmn:Escalation' };

const SUBPROCESS_TYPES = new Set(['bpmn:SubProcess', 'bpmn:EventSubProcess', 'bpmn:AdHocSubProcess', 'bpmn:Transaction']);
const ACTIVITY_TYPES = new Set([...SUBPROCESS_TYPES, 'bpmn:Task', 'bpmn:CallActivity']);
const EVENT_TYPES = new Set(['bpmn:StartEvent', 'bpmn:EndEvent', 'bpmn:IntermediateCatchEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:BoundaryEvent']);
const GATEWAY_TYPES = new Set(['bpmn:ExclusiveGateway', 'bpmn:ParallelGateway', 'bpmn:InclusiveGateway', 'bpmn:EventBasedGateway', 'bpmn:ComplexGateway']);
const CHOREOGRAPHY_TYPES = new Set(['bpmn:ChoreographyTask', 'bpmn:SubChoreography', 'bpmn:CallChoreography']);
const CONVERSATION_TYPES = new Set(['bpmn:Conversation', 'bpmn:SubConversation', 'bpmn:CallConversation']);
const ARTIFACT_TYPES = new Set(['bpmn:TextAnnotation', 'bpmn:Group']);
/** Tipos que no se dibujan como figura DI (raíces y definiciones). */
const NO_SHAPE_TYPES = new Set(['bpmn:Process', 'bpmn:Message', 'bpmn:Signal', 'bpmn:Error', 'bpmn:Escalation']);
/** Contenedores semánticos: el padre de un nodo es el contenedor más cercano de esta lista. */
const SEMANTIC_CONTAINERS = new Set(['bpmn:Pool', 'bpmn:Lane', 'bpmn:Process', ...SUBPROCESS_TYPES, 'bpmn:SubChoreography', 'bpmn:SubConversation']);

const isFlowNode = (t: string) => ACTIVITY_TYPES.has(t) || EVENT_TYPES.has(t) || GATEWAY_TYPES.has(t) || CHOREOGRAPHY_TYPES.has(t);

// ---------------------------------------------------------------- Utilidades moddle
type Bo = ModdleElement;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const list = (v: unknown): Bo[] => (Array.isArray(v) ? (v as Bo[]) : []);
const bo = (v: unknown): Bo | undefined => (v && typeof v === 'object' && '$type' in (v as object) ? (v as Bo) : undefined);
const boId = (v: unknown): string | undefined => bo(v)?.id;
const body = (v: unknown): string | undefined => str(bo(v)?.get('body'));

/** JSON serializable de un elemento moddle (extensiones, elementos desconocidos). */
export interface BpmnJson { $type: string; $ns?: string; attrs?: Record<string, unknown>; body?: string; children?: BpmnJson[]; props?: Record<string, unknown> }

export function moddleToJson(el: Bo): BpmnJson {
  const d = el.$descriptor;
  if (d.isGeneric) {
    const attrs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(el)) if (!k.startsWith('$') && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) attrs[k] = v;
    const out: BpmnJson = { $type: el.$type, $ns: d.ns.uri, attrs };
    if (el.$body) out.body = el.$body;
    if (el.$children?.length) out.children = el.$children.map(moddleToJson);
    return out;
  }
  const props: Record<string, unknown> = {};
  for (const p of d.properties) {
    const v = el.get(p.name);
    if (v === undefined || v === null) continue;
    if (p.isReference) props[p.name] = p.isMany ? list(v).map(x => ({ $ref: x.id })) : { $ref: bo(v)?.id };
    else if (p.isMany) props[p.name] = list(v).map(moddleToJson);
    else if (bo(v)) props[p.name] = moddleToJson(v as Bo);
    else props[p.name] = v;
  }
  const attrs = { ...el.$attrs };
  return { $type: el.$type, props, ...(Object.keys(attrs).length ? { attrs } : {}) };
}

export function jsonToModdle(moddle: BpmnModdle, j: BpmnJson, resolve: (ref: string) => Bo | undefined): Bo {
  if (j.$ns) {
    const el = moddle.createAny(j.$type, j.$ns, { ...(j.attrs ?? {}) });
    if (j.body) el.$body = j.body;
    if (j.children) el.$children = j.children.map(c => jsonToModdle(moddle, c, resolve));
    return el;
  }
  const el = moddle.create(j.$type, {});
  for (const [k, v] of Object.entries(j.props ?? {})) {
    if (Array.isArray(v)) el.set(k, v.map(x => (x && typeof x === 'object' && '$ref' in x ? resolve((x as { $ref: string }).$ref) : jsonToModdle(moddle, x as BpmnJson, resolve))).filter(Boolean));
    else if (v && typeof v === 'object' && '$ref' in (v as object)) { const r = resolve((v as { $ref: string }).$ref); if (r) el.set(k, r); }
    else if (v && typeof v === 'object' && '$type' in (v as object)) el.set(k, jsonToModdle(moddle, v as BpmnJson, resolve));
    else el.set(k, v);
  }
  if (j.attrs) for (const [k, v] of Object.entries(j.attrs)) el.$attrs[k] = v;
  return el;
}

// ---------------------------------------------------------------- Geometría
interface Rect { x: number; y: number; w: number; h: number }
interface Pt { x: number; y: number }
const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
/** Punto del borde de `r` en la dirección de su centro hacia `p`. */
function borderPoint(r: Rect, p: Pt): Pt {
  const c = center(r);
  const dx = p.x - c.x, dy = p.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const tx = dx !== 0 ? (r.w / 2) / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? (r.h / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: Math.round(c.x + dx * t), y: Math.round(c.y + dy * t) };
}

// ================================================================ IMPORT
class Importer {
  readonly ws: Workspace;
  private readonly warnings: string[];
  /** Padre semántico de cada elemento (pool, lane, subproceso, proceso). */
  private readonly parentOf = new Map<string, string>();
  /** `SequenceFlow` marcados como salida por defecto de su origen. */
  private readonly defaultFlows = new Set<string>();
  /** Relaciones diferidas hasta tener todos los elementos: [bo, typeId, fromId, toId, fields]. */
  private readonly pendingRelations: { bo: Bo; typeId: string; from: string; to: string; fields: Record<string, unknown> }[] = [];
  private readonly nodeByElement = new Map<string, Map<string, string>>();

  constructor(ws: Workspace, warnings: string[]) { this.ws = ws; this.warnings = warnings; }

  warn(msg: string) { this.warnings.push(msg); }

  run(defs: Bo) {
    const roots = list(defs.get('rootElements'));
    // 1. Definiciones y participantes (para conocer qué proceso va en qué pool).
    for (const r of roots) {
      const t = DEFINITION_TYPES[r.$type];
      if (t) this.addElement(r, t, r.$type === 'bpmn:Error' ? { errorCode: str(r.get('errorCode')) } : r.$type === 'bpmn:Escalation' ? { escalationCode: str(r.get('escalationCode')) } : {});
    }
    const poolOfProcess = new Map<string, string>();
    for (const r of roots) {
      if (!r.$instanceOf('bpmn:Collaboration')) continue;
      for (const p of list(r.get('participants'))) {
        const proc = bo(p.get('processRef'));
        const mult = bo(p.get('participantMultiplicity'));
        const fields: Record<string, unknown> = { multiplicity: !!mult };
        if (proc) { this.addElement(p, 'bpmn:Pool', fields, undefined, { bpmnProcessId: proc.id }); poolOfProcess.set(proc.id ?? '', p.id ?? ''); }
        else this.addElement(p, 'bpmn:Participant', { ...fields, collapsed: true });
      }
    }
    // 2. Procesos.
    for (const r of roots) {
      if (r.$type !== 'bpmn:Process') continue;
      let container = poolOfProcess.get(r.id ?? '');
      if (!container) {
        this.addElement(r, 'bpmn:Process', { isExecutable: !!r.get('isExecutable'), processType: str(r.get('processType')) });
        container = r.id;
      } else {
        // Datos del proceso que no caben en la pool: ejecutable y extensiones del proceso.
        const pool = this.ws.elements[container]!;
        pool.fields.isExecutable = !!r.get('isExecutable');
        const ext = bo(r.get('extensionElements'));
        if (ext) pool.features.bpmnProcessExtensions = moddleToJson(ext);
        if (Object.keys(r.$attrs).length) pool.features.bpmnProcessAttrs = { ...r.$attrs };
        const pname = str(r.get('name'));
        if (pname && pname !== pool.name) pool.features.bpmnProcessName = pname;
        const doc = this.docOf(r);
        if (doc && !pool.doc) { pool.doc = doc; pool.features.bpmnDocFrom = 'process'; }
        else if (doc) pool.features.bpmnProcessDoc = doc;
      }
      this.importContainer(r, container);
    }
    // 3. Colaboraciones, coreografías y conversaciones.
    for (const r of roots) {
      if (!r.$instanceOf('bpmn:Collaboration')) continue;
      for (const m of list(r.get('messageFlows'))) {
        const from = boId(m.get('sourceRef')), to = boId(m.get('targetRef'));
        if (from && to) this.pendingRelations.push({ bo: m, typeId: MSG, from, to, fields: { message: bo(m.get('messageRef'))?.get('name'), messageRef: boId(m.get('messageRef')) } });
      }
      this.importArtifacts(list(r.get('artifacts')), undefined);
      this.importConversations(list(r.get('conversations')), undefined);
      for (const l of list(r.get('conversationLinks'))) {
        const from = boId(l.get('sourceRef')), to = boId(l.get('targetRef'));
        if (from && to) this.pendingRelations.push({ bo: l, typeId: CONV, from, to, fields: {} });
      }
      if (r.$type === 'bpmn:Choreography') this.importFlowElements(list(r.get('flowElements')), undefined);
    }
    for (const r of roots) if (!DEFINITION_TYPES[r.$type] && r.$type !== 'bpmn:Process' && !r.$instanceOf('bpmn:Collaboration') && r.$type !== 'bpmn:DataStore' && r.$type !== 'bpmn:Category')
      this.warn(`Elemento raíz ignorado: ${r.$type}${r.id ? ` (${r.id})` : ''}`);
    // 4. Relaciones.
    for (const p of this.pendingRelations) this.addRelation(p.bo, p.typeId, p.from, p.to, p.fields);
    // 5. Diagramas.
    const defsAttrs = JSON.stringify({ id: defs.id, targetNamespace: str(defs.get('targetNamespace')), attrs: defs.$attrs });
    for (const d of list(defs.get('diagrams'))) this.importDiagram(d, defsAttrs);
    if (!list(defs.get('diagrams')).length) this.warn('El fichero no trae bpmndi:BPMNDiagram: se importa el modelo sin vistas.');
  }

  private docOf(el: Bo): string {
    return list(el.get('documentation')).map(d => str(d.get('text')) ?? '').filter(Boolean).join('\n');
  }

  private addElement(el: Bo, typeId: string, fields: Record<string, unknown>, parent?: string, features: Record<string, unknown> = {}): Element {
    const id = el.id ?? newId('el');
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '' && v !== null) clean[k] = v;
    const feats: Record<string, unknown> = { ...features };
    const ext = bo(el.get('extensionElements'));
    if (ext) feats.bpmnExtensions = moddleToJson(ext);
    if (Object.keys(el.$attrs).length) feats.bpmnAttrs = { ...el.$attrs };
    // Las lanes ya han reclamado sus nodos (`flowNodeRef`): ese padre manda sobre el contenedor.
    const effectiveParent = this.parentOf.get(id) ?? parent;
    if (effectiveParent) feats.bpmnParent = effectiveParent;
    const e: Element = { id, typeId, name: str(el.get('name')) ?? '', doc: this.docOf(el), fields: clean, ports: [], profiles: [], props: {}, features: feats, tags: [] };
    this.ws.elements[id] = e;
    if (effectiveParent) this.parentOf.set(id, effectiveParent);
    return e;
  }

  private addRelation(el: Bo, typeId: string, from: string, to: string, fields: Record<string, unknown>) {
    const end = (id: string): Relation['from'] | undefined => (this.ws.elements[id] ? { elementId: id } : this.ws.relations[id] ? { relationId: id } : undefined);
    const f = end(from), t = end(to);
    if (!f || !t) { this.warn(`${el.$type} ${el.id ?? ''} apunta a un elemento desconocido (${from} → ${to})`); return; }
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== '' && v !== null && v !== false) clean[k] = v;
    const feats: Record<string, unknown> = {};
    const ext = bo(el.get('extensionElements'));
    if (ext) feats.bpmnExtensions = moddleToJson(ext);
    if (Object.keys(el.$attrs).length) feats.bpmnAttrs = { ...el.$attrs };
    const id = el.id ?? newId('rel');
    this.ws.relations[id] = { id, typeId, name: str(el.get('name')) ?? '', doc: this.docOf(el), from: f, to: t, mappings: [], fields: clean, props: {}, features: feats };
  }

  /** Proceso o subproceso: lanes, nodos de flujo, artefactos y datos de entrada/salida. */
  private importContainer(c: Bo, containerId: string | undefined) {
    for (const ls of list(c.get('laneSets'))) this.importLanes(ls, containerId);
    this.importFlowElements(list(c.get('flowElements')), containerId);
    this.importArtifacts(list(c.get('artifacts')), containerId);
    const io = bo(c.get('ioSpecification'));
    if (io) {
      for (const d of list(io.get('dataInputs'))) this.addElement(d, 'bpmn:DataInput', { isCollection: !!d.get('isCollection') }, containerId);
      for (const d of list(io.get('dataOutputs'))) this.addElement(d, 'bpmn:DataOutput', { isCollection: !!d.get('isCollection') }, containerId);
    }
  }

  private importLanes(laneSet: Bo, parent: string | undefined) {
    for (const lane of list(laneSet.get('lanes'))) {
      const e = this.addElement(lane, 'bpmn:Lane', {}, parent);
      for (const ref of list(lane.get('flowNodeRef'))) if (ref.id) this.parentOf.set(ref.id, e.id);
      const child = bo(lane.get('childLaneSet'));
      if (child) this.importLanes(child, e.id);
    }
  }

  private importArtifacts(artifacts: Bo[], parent: string | undefined) {
    for (const a of artifacts) {
      if (a.$type === 'bpmn:TextAnnotation') this.addElement(a, 'bpmn:TextAnnotation', { text: str(a.get('text')) }, parent);
      else if (a.$type === 'bpmn:Group') this.addElement(a, 'bpmn:Group', { categoryValue: str(bo(a.get('categoryValueRef'))?.get('value')) }, parent);
      else if (a.$type === 'bpmn:Association') {
        const from = boId(a.get('sourceRef')), to = boId(a.get('targetRef'));
        if (from && to) this.pendingRelations.push({ bo: a, typeId: ASSOC, from, to, fields: { direction: str(a.get('associationDirection'))?.replace(/^None$/, '') } });
      } else this.warn(`Artefacto no soportado: ${a.$type}`);
    }
  }

  private importConversations(nodes: Bo[], parent: string | undefined) {
    for (const n of nodes) {
      if (!CONVERSATION_TYPES.has(n.$type)) { this.warn(`Nodo de conversación no soportado: ${n.$type}`); continue; }
      const fields: Record<string, unknown> = n.$type === 'bpmn:CallConversation' ? { calledCollaboration: boId(n.get('calledCollaborationRef')) } : {};
      const e = this.addElement(n, n.$type, fields, parent);
      if (n.$type === 'bpmn:SubConversation') this.importConversations(list(n.get('conversationNodes')), e.id);
    }
  }

  private loopOf(el: Bo): string | undefined {
    const lc = bo(el.get('loopCharacteristics'));
    if (!lc) return undefined;
    if (lc.$type === 'bpmn:StandardLoopCharacteristics') return 'standard';
    return lc.get('isSequential') ? 'sequentialMulti' : 'parallelMulti';
  }

  private activityFields(el: Bo): Record<string, unknown> {
    return { loop: this.loopOf(el), isForCompensation: !!el.get('isForCompensation') || undefined };
  }

  private eventFields(el: Bo): Record<string, unknown> {
    const defs = [...list(el.get('eventDefinitions')), ...list(el.get('eventDefinitionRefs'))];
    const fields: Record<string, unknown> = {};
    if (defs.length === 0) fields.eventDefinition = 'none';
    else if (defs.length > 1) fields.eventDefinition = el.get('parallelMultiple') ? 'parallelMultiple' : 'multiple';
    else fields.eventDefinition = EVENT_DEFS[defs[0]!.$type] ?? 'none';
    const d = defs[0];
    if (d) {
      const kind = EVENT_DEFS[d.$type] ?? '';
      const refProp = EVENT_REF_PROP[kind];
      if (refProp) fields.eventRef = boId(d.get(refProp));
      if (kind === 'timer') fields.timer = body(d.get('timeDate')) ?? body(d.get('timeCycle')) ?? body(d.get('timeDuration'));
      if (kind === 'timer') fields.timerKind = bo(d.get('timeDate')) ? 'timeDate' : bo(d.get('timeCycle')) ? 'timeCycle' : bo(d.get('timeDuration')) ? 'timeDuration' : undefined;
      if (kind === 'conditional') fields.condition = body(d.get('condition'));
      if (kind === 'link') fields.link = str(d.get('name'));
      if (kind === 'compensation' && bo(d.get('activityRef'))) fields.compensateActivity = boId(d.get('activityRef'));
      if (kind === 'compensation' && d.get('waitForCompletion') === false) fields.waitForCompletion = false;
      if (kind === 'error' || kind === 'escalation' || kind === 'signal' || kind === 'message') fields.eventDefinitionId = d.id;
    }
    return fields;
  }

  private importFlowElements(flow: Bo[], parent: string | undefined) {
    for (const f of flow) this.importFlowElement(f, parent);
  }

  private importFlowElement(f: Bo, parent: string | undefined) {
    const t = f.$type;
    let e: Element | undefined;
    if (TASK_TYPES[t]) {
      e = this.addElement(f, 'bpmn:Task', { taskType: TASK_TYPES[t] === 'none' ? undefined : TASK_TYPES[t], ...this.activityFields(f), instantiate: !!f.get('instantiate') || undefined }, parent);
    } else if (t === 'bpmn:SubProcess' || t === 'bpmn:AdHocSubProcess' || t === 'bpmn:Transaction') {
      const typeId = t === 'bpmn:SubProcess' && f.get('triggeredByEvent') ? 'bpmn:EventSubProcess' : t;
      const extra: Record<string, unknown> = t === 'bpmn:AdHocSubProcess'
        ? { ordering: str(f.get('ordering')), completionCondition: body(f.get('completionCondition')), cancelRemainingInstances: f.get('cancelRemainingInstances') === false ? false : undefined }
        : t === 'bpmn:Transaction' ? { method: str(f.get('method'))?.replace(/^##/, '') } : {};
      e = this.addElement(f, typeId, { ...this.activityFields(f), ...extra }, parent);
      this.importContainer(f, e.id);
    } else if (t === 'bpmn:CallActivity') {
      e = this.addElement(f, t, { calledElement: str(f.get('calledElement')), ...this.activityFields(f) }, parent);
    } else if (EVENT_TYPES.has(t)) {
      const fields = this.eventFields(f);
      if (t === 'bpmn:StartEvent' && f.get('isInterrupting') === false) fields.interrupting = false;
      if (t === 'bpmn:BoundaryEvent') { fields.interrupting = f.get('cancelActivity') !== false; fields.attachedTo = boId(f.get('attachedToRef')); }
      e = this.addElement(f, t, fields, parent);
    } else if (GATEWAY_TYPES.has(t)) {
      const fields: Record<string, unknown> = t === 'bpmn:ComplexGateway' ? { activationCondition: body(f.get('activationCondition')) }
        : t === 'bpmn:EventBasedGateway' ? { instantiate: !!f.get('instantiate') || undefined, eventGatewayType: str(f.get('eventGatewayType')) } : {};
      if (str(f.get('gatewayDirection')) && f.get('gatewayDirection') !== 'Unspecified') fields.gatewayDirection = f.get('gatewayDirection');
      e = this.addElement(f, t, fields, parent);
    } else if (t === 'bpmn:DataObjectReference') {
      const ref = bo(f.get('dataObjectRef'));
      e = this.addElement(f, 'bpmn:DataObject', { isCollection: !!ref?.get('isCollection') || undefined, state: str(bo(f.get('dataState'))?.get('name')) }, parent, ref ? { bpmnDataObjectId: ref.id } : {});
    } else if (t === 'bpmn:DataStoreReference') {
      const ref = bo(f.get('dataStoreRef'));
      e = this.addElement(f, 'bpmn:DataStore', { state: str(bo(f.get('dataState'))?.get('name')) }, parent, ref ? { bpmnDataStoreId: ref.id } : {});
      if (ref && !e.name) e.name = str(ref.get('name')) ?? '';
    } else if (t === 'bpmn:DataObject') {
      return; // Lo representa su DataObjectReference.
    } else if (t === 'bpmn:SequenceFlow') {
      const from = boId(f.get('sourceRef')), to = boId(f.get('targetRef'));
      if (from && to) this.pendingRelations.push({ bo: f, typeId: SEQ, from, to, fields: { condition: body(f.get('conditionExpression')), immediate: f.get('isImmediate') === true || undefined } });
      return;
    } else if (CHOREOGRAPHY_TYPES.has(t)) {
      const fields: Record<string, unknown> = {
        initiatingParticipant: boId(f.get('initiatingParticipantRef')),
        participants: list(f.get('participantRef')).map(p => p.id),
        loopType: str(f.get('loopType')),
        calledChoreography: t === 'bpmn:CallChoreography' ? boId(f.get('calledChoreographyRef')) : undefined,
      };
      if (t === 'bpmn:ChoreographyTask') fields.messageFlows = list(f.get('messageFlowRef')).map(m => m.id);
      e = this.addElement(f, t, fields, parent);
      if (t === 'bpmn:SubChoreography') { this.importFlowElements(list(f.get('flowElements')), e.id); this.importArtifacts(list(f.get('artifacts')), e.id); }
    } else {
      this.warn(`Elemento de flujo no soportado: ${t}${f.id ? ` (${f.id})` : ''}`);
      return;
    }
    const def = bo(f.get('default'));
    if (def?.id) this.defaultFlows.add(def.id);
    for (const a of list(f.get('dataInputAssociations'))) {
      const src = boId(list(a.get('sourceRef'))[0]);
      if (src) this.pendingRelations.push({ bo: a, typeId: DIN, from: src, to: e.id, fields: {} });
    }
    for (const a of list(f.get('dataOutputAssociations'))) {
      const tgt = boId(a.get('targetRef'));
      if (tgt) this.pendingRelations.push({ bo: a, typeId: DOUT, from: e.id, to: tgt, fields: {} });
    }
  }

  // -------------------------------------------------------------- DI
  private importDiagram(d: Bo, defsAttrs: string) {
    const plane = bo(d.get('plane'));
    const root = bo(plane?.get('bpmnElement'));
    const viewId = d.id ?? newId('vw');
    const viewpointId = root?.$type === 'bpmn:Choreography' ? 'choreography' : root?.$instanceOf('bpmn:Collaboration') ? 'collaboration' : 'process';
    const view: View = {
      id: viewId, kind: 'freeform', notationId: 'bpmn', viewpointId,
      name: str(d.get('name')) ?? str(root?.get('name')) ?? root?.id ?? 'BPMN',
      doc: '', style: {}, props: { bpmnDefinitions: defsAttrs, bpmnPlaneId: plane?.id ?? '' },
    };
    if (root?.$type === 'bpmn:Process' || (root && SUBPROCESS_TYPES.has(root.$type)) || root?.$type === 'bpmn:SubProcess') {
      const rootEl = root.$type === 'bpmn:Process' ? (this.ws.elements[root.id ?? ''] ? root.id : this.poolOfProcessId(root.id)) : root.id;
      if (rootEl) view.rootElementId = rootEl;
    }
    this.ws.views[viewId] = view;
    const nodes = new Map<string, string>();
    this.nodeByElement.set(viewId, nodes);
    const abs = new Map<string, Rect>();
    const shapes: { s: Bo; el: Element; r: Rect }[] = [];
    for (const s of list(plane?.get('planeElement'))) {
      if (s.$type !== 'bpmndi:BPMNShape') continue;
      const el = bo(s.get('bpmnElement'));
      const b = bo(s.get('bounds'));
      if (!el?.id || !b) { this.warn(`BPMNShape ${s.id ?? ''} sin elemento o sin Bounds`); continue; }
      if (s.get('choreographyActivityShape')) continue; // bandas de participante: las dibuja el render
      const e = this.ws.elements[el.id];
      if (!e) { if (!this.ws.relations[el.id]) this.warn(`BPNShape ${s.id ?? ''} apunta a un elemento no importado (${el.id})`); continue; }
      const r: Rect = { x: Number(b.get('x')) || 0, y: Number(b.get('y')) || 0, w: Number(b.get('width')) || 0, h: Number(b.get('height')) || 0 };
      abs.set(e.id, r);
      shapes.push({ s, el: e, r });
    }
    let z = 0;
    for (const { s, el, r } of shapes) {
      let p = this.parentOf.get(el.id);
      while (p && !abs.has(p)) p = this.parentOf.get(p);
      const pr = p ? abs.get(p) : undefined;
      const nodeId = s.id ?? `${viewId}__${el.id}`;
      const node: ViewNode = {
        id: nodeId, viewId, elementId: el.id, x: r.x - (pr?.x ?? 0), y: r.y - (pr?.y ?? 0), w: r.w, h: r.h, z: z++, style: {},
      };
      if (p) node.parentNodeId = nodes.get(p);
      const isContainer = SUBPROCESS_TYPES.has(el.typeId) || el.typeId === 'bpmn:Pool' || el.typeId === 'bpmn:Participant' || el.typeId === 'bpmn:SubChoreography' || el.typeId === 'bpmn:SubConversation';
      if (isContainer && s.get('isExpanded') === false) {
        node.style.collapsed = true;
        el.fields.collapsed = true;
      } else if (isContainer && s.get('isExpanded') === true && el.typeId === 'bpmn:Participant') el.fields.collapsed = false;
      const meta: Record<string, unknown> = {};
      if (s.get('isHorizontal') !== undefined) meta.isHorizontal = s.get('isHorizontal');
      if (s.get('isMarkerVisible') !== undefined) meta.isMarkerVisible = s.get('isMarkerVisible');
      const lb = bo(bo(s.get('label'))?.get('bounds'));
      if (lb) meta.label = { x: Number(lb.get('x')), y: Number(lb.get('y')), w: Number(lb.get('width')), h: Number(lb.get('height')) };
      const stroke = str(s.get('bioc:stroke')) ?? str(s.get('color:border-color'));
      const fill = str(s.get('bioc:fill')) ?? str(s.get('color:background-color'));
      if (stroke) node.style.stroke = stroke;
      if (fill) node.style.fill = fill;
      if (Object.keys(meta).length) node.meta = meta;
      this.ws.nodes[nodeId] = node;
      nodes.set(el.id, nodeId);
    }
    // Aristas.
    for (const s of list(plane?.get('planeElement'))) {
      if (s.$type !== 'bpmndi:BPMNEdge') continue;
      const el = bo(s.get('bpmnElement'));
      const rel = el?.id ? this.ws.relations[el.id] : undefined;
      if (!rel) { this.warn(`BPMNEdge ${s.id ?? ''} apunta a una relación no importada (${el?.id ?? '?'})`); continue; }
      const fromNode = rel.from.elementId ? nodes.get(rel.from.elementId) : undefined;
      const toNode = rel.to.elementId ? nodes.get(rel.to.elementId) : undefined;
      if (!fromNode || !toNode) { this.warn(`BPMNEdge ${s.id ?? ''}: falta la figura de un extremo en el diagrama ${viewId}`); continue; }
      const wps = list(s.get('waypoint')).map(w => ({ x: Number(w.get('x')) || 0, y: Number(w.get('y')) || 0 }));
      const edgeId = s.id ?? `${viewId}__${rel.id}`;
      const edge: ViewEdge = { id: edgeId, viewId, relationId: rel.id, fromNodeId: fromNode, toNodeId: toNode, bendpoints: wps.slice(1, -1), style: {} };
      if (rel.name) edge.label = rel.name;
      const stroke = str(s.get('bioc:stroke')) ?? str(s.get('color:border-color'));
      if (stroke) edge.style.color = stroke;
      this.ws.edges[edgeId] = edge;
    }
    // Default flows: se marcan al final porque el origen puede haberse leído después del flujo.
    for (const id of this.defaultFlows) { const r = this.ws.relations[id]; if (r) r.fields.default = true; }
  }

  private poolOfProcessId(processId: string | undefined): string | undefined {
    if (!processId) return undefined;
    return Object.values(this.ws.elements).find(e => e.typeId === 'bpmn:Pool' && e.features.bpmnProcessId === processId)?.id;
  }

  /** Enlaza subprocesos colapsados con el diagrama que los detalla. */
  linkDetailViews(defs: Bo) {
    const byRoot = new Map<string, string>();
    for (const d of list(defs.get('diagrams'))) {
      const root = boId(bo(d.get('plane'))?.get('bpmnElement'));
      if (root && d.id) byRoot.set(root, d.id);
    }
    for (const n of Object.values(this.ws.nodes)) {
      if (!n.elementId || !n.style.collapsed) continue;
      const detail = byRoot.get(n.elementId);
      if (detail && detail !== n.viewId) n.detailViewId = detail;
    }
  }
}

export async function importBpmn(xml: string): Promise<BpmnImportResult> {
  const moddle = new BpmnModdle();
  const warnings: string[] = [];
  let parsed: Awaited<ReturnType<BpmnModdle['fromXML']>>;
  try { parsed = await moddle.fromXML(xml); }
  catch (err) { throw new Error(`BPMN inválido: ${err instanceof Error ? err.message : String(err)}`); }
  for (const w of parsed.warnings) warnings.push(w.message);
  const defs = parsed.rootElement;
  const ws = emptyWorkspace(str(defs.get('name')) || 'BPMN');
  const imp = new Importer(ws, warnings);
  imp.run(defs);
  imp.linkDetailViews(defs);
  const first = Object.keys(ws.views)[0];
  if (first) ws.meta.currentViewId = first;
  return { workspace: ws, warnings };
}

// ================================================================ EXPORT
class Exporter {
  private readonly moddle = new BpmnModdle();
  private readonly ws: Workspace;
  private readonly views: View[];
  private readonly elements = new Map<string, Element>();
  private readonly bos = new Map<string, Bo>();
  /** Padre semántico (contenedor) de cada elemento, derivado de los nodos. */
  private readonly parentOf = new Map<string, string | undefined>();
  private readonly rootElements: Bo[] = [];
  private collaboration: Bo | undefined;
  private choreography: Bo | undefined;
  private defaultProcess: Bo | undefined;
  /** Proceso moddle de cada Pool / Process. */
  private readonly processOf = new Map<string, Bo>();
  private readonly deferredRefs: (() => void)[] = [];

  constructor(ws: Workspace, viewId?: string) {
    this.ws = ws;
    const all = Object.values(ws.views).filter(v => v.notationId === 'bpmn');
    if (viewId) {
      const picked = new Set<string>();
      const visit = (id: string) => {
        if (picked.has(id) || !ws.views[id]) return;
        picked.add(id);
        for (const n of Object.values(ws.nodes)) if (n.viewId === id && n.detailViewId) visit(n.detailViewId);
      };
      visit(viewId);
      this.views = all.filter(v => picked.has(v.id));
      if (!this.views.length) throw new Error(`La vista ${viewId} no existe o no es BPMN`);
    } else this.views = all;
    const inViews = new Set(this.views.map(v => v.id));
    const onView = new Set(Object.values(ws.nodes).filter(n => inViews.has(n.viewId) && n.elementId).map(n => n.elementId!));
    for (const e of Object.values(ws.elements)) {
      if (!e.typeId.startsWith(NS) || e.template) continue;
      if (!viewId || onView.has(e.id) || NO_SHAPE_TYPES.has(e.typeId)) this.elements.set(e.id, e);
    }
    // Referencias necesarias aunque no estén en la vista (actividad adherida, definiciones).
    for (const e of [...this.elements.values()]) for (const k of ['attachedTo', 'eventRef', 'initiatingParticipant']) {
      const ref = e.fields[k];
      if (typeof ref === 'string' && ws.elements[ref]?.typeId.startsWith(NS)) this.elements.set(ref, ws.elements[ref]!);
    }
  }

  private relations(): Relation[] {
    return Object.values(this.ws.relations).filter(r => r.typeId.startsWith(NS) && r.from.elementId && r.to.elementId && this.elements.has(r.from.elementId) && this.elements.has(r.to.elementId));
  }

  /** Padre semántico: contenedor más cercano según los nodos (saltando grupos), o `features.bpmnParent`. */
  private semanticParent(id: string): string | undefined {
    if (this.parentOf.has(id)) return this.parentOf.get(id);
    let found: string | undefined;
    const nodes = Object.values(this.ws.nodes).filter(n => n.elementId === id);
    const preferred = nodes.filter(n => this.views.some(v => v.id === n.viewId));
    for (const n of preferred.length ? preferred : nodes) {
      let p = n.parentNodeId ? this.ws.nodes[n.parentNodeId] : undefined;
      while (p && !(p.elementId && this.elements.has(p.elementId) && SEMANTIC_CONTAINERS.has(this.elements.get(p.elementId)!.typeId))) p = p.parentNodeId ? this.ws.nodes[p.parentNodeId] : undefined;
      if (p?.elementId) { found = p.elementId; break; }
      const view = this.ws.views[n.viewId];
      const root = view?.rootElementId ? this.elements.get(view.rootElementId) : undefined;
      if (root && SEMANTIC_CONTAINERS.has(root.typeId) && root.id !== id) { found = root.id; break; }
    }
    if (!found) {
      const bp = this.elements.get(id)?.features.bpmnParent;
      if (typeof bp === 'string' && this.elements.has(bp) && bp !== id) found = bp;
    }
    this.parentOf.set(id, found);
    return found;
  }

  /** Contenedor de flujo (proceso o subproceso) de un elemento: salta las lanes. */
  private flowContainer(id: string): Bo {
    let p = this.semanticParent(id);
    while (p) {
      const t = this.elements.get(p)!.typeId;
      if (t === 'bpmn:Pool' || t === 'bpmn:Process') return this.processOf.get(p) ?? this.ensureDefaultProcess();
      if (SUBPROCESS_TYPES.has(t) || t === 'bpmn:SubChoreography') return this.bos.get(p)!;
      p = this.semanticParent(p);
    }
    const e = this.elements.get(id)!;
    if (CHOREOGRAPHY_TYPES.has(e.typeId) || this.isChoreographyElement(id)) return this.ensureChoreography();
    return this.ensureDefaultProcess();
  }

  /** Pertenece a la coreografía: aparece en una vista "Coreografía" o, sin nodos, solo hay coreografía. */
  private isChoreographyElement(id: string): boolean {
    const nodes = Object.values(this.ws.nodes).filter(n => n.elementId === id);
    if (nodes.length) return nodes.some(n => this.ws.views[n.viewId]?.viewpointId === 'choreography');
    return !!this.choreography && !this.collaboration;
  }

  private ensureCollaboration(): Bo {
    if (!this.collaboration) { this.collaboration = this.moddle.create('bpmn:Collaboration', { id: 'Collaboration_1', participants: [], messageFlows: [], artifacts: [], conversations: [], conversationLinks: [] }); this.rootElements.push(this.collaboration); }
    return this.collaboration;
  }
  private ensureChoreography(): Bo {
    if (!this.choreography) { this.choreography = this.moddle.create('bpmn:Choreography', { id: 'Choreography_1', participants: [], messageFlows: [], flowElements: [], artifacts: [] }); this.rootElements.push(this.choreography); }
    return this.choreography;
  }
  private ensureDefaultProcess(): Bo {
    if (!this.defaultProcess) {
      const procEl = [...this.elements.values()].find(e => e.typeId === 'bpmn:Process');
      this.defaultProcess = procEl ? this.processOf.get(procEl.id)! : this.newProcess('Process_1', undefined);
    }
    return this.defaultProcess;
  }
  private newProcess(id: string, el: Element | undefined): Bo {
    const p = this.moddle.create('bpmn:Process', { id, flowElements: [], artifacts: [], laneSets: [] });
    if (el) {
      if (el.typeId === 'bpmn:Process') { p.set('name', el.name || undefined); if (el.fields.processType) p.set('processType', el.fields.processType); }
      if (el.typeId === 'bpmn:Pool') {
        const pname = str(el.features.bpmnProcessName); if (pname) p.set('name', pname);
        const pdoc = el.features.bpmnDocFrom === 'process' ? el.doc : str(el.features.bpmnProcessDoc);
        if (pdoc) p.set('documentation', [this.moddle.create('bpmn:Documentation', { text: pdoc })]);
      }
      if (el.fields.isExecutable !== undefined) p.set('isExecutable', !!el.fields.isExecutable);
      const ext = el.typeId === 'bpmn:Pool' ? el.features.bpmnProcessExtensions : el.features.bpmnExtensions;
      if (ext) p.set('extensionElements', jsonToModdle(this.moddle, ext as BpmnJson, r => this.bos.get(r)));
      const attrs = el.typeId === 'bpmn:Pool' ? el.features.bpmnProcessAttrs : el.features.bpmnAttrs;
      if (attrs && typeof attrs === 'object') Object.assign(p.$attrs, attrs);
      if (el.typeId === 'bpmn:Process' && el.doc) p.set('documentation', [this.moddle.create('bpmn:Documentation', { text: el.doc })]);
    }
    this.rootElements.push(p);
    return p;
  }

  private push(el: Bo, prop: string, value: Bo) {
    const cur = list(el.get(prop));
    el.set(prop, [...cur, value]);
    value.$parent = el;
  }

  private applyCommon(b: Bo, e: Element | Relation) {
    if (e.name && b.$descriptor.propertiesByName.name) b.set('name', e.name);
    if (e.doc && e.features.bpmnDocFrom !== 'process') b.set('documentation', [this.moddle.create('bpmn:Documentation', { text: e.doc })]);
    const ext = e.features.bpmnExtensions;
    if (ext && typeof ext === 'object') this.deferredRefs.push(() => b.set('extensionElements', jsonToModdle(this.moddle, ext as BpmnJson, r => this.bos.get(r))));
    const attrs = e.features.bpmnAttrs;
    if (attrs && typeof attrs === 'object') Object.assign(b.$attrs, attrs);
  }

  private loopCharacteristics(e: Element): Bo | undefined {
    const loop = e.fields.loop;
    if (loop === 'standard') return this.moddle.create('bpmn:StandardLoopCharacteristics', {});
    if (loop === 'parallelMulti') return this.moddle.create('bpmn:MultiInstanceLoopCharacteristics', {});
    if (loop === 'sequentialMulti') return this.moddle.create('bpmn:MultiInstanceLoopCharacteristics', { isSequential: true });
    return undefined;
  }

  private eventDefinitions(e: Element): Bo[] {
    const kind = str(e.fields.eventDefinition) ?? 'none';
    if (kind === 'none') return [];
    const kinds = kind === 'multiple' || kind === 'parallelMultiple' ? ['message', 'signal'] : [kind];
    return kinds.map(k => {
      const type = EVENT_DEF_TO_MODDLE[k];
      if (!type) return undefined;
      const idField = str(e.fields.eventDefinitionId);
      const d = this.moddle.create(type, { id: idField ?? `${e.id}_${k}` });
      const refProp = EVENT_REF_PROP[k];
      const ref = str(e.fields.eventRef);
      if (refProp && ref) this.deferredRefs.push(() => { const r = this.bos.get(ref); if (r) d.set(refProp, r); });
      if (k === 'timer' && e.fields.timer) d.set(str(e.fields.timerKind) ?? 'timeDuration', this.moddle.create('bpmn:FormalExpression', { body: String(e.fields.timer) }));
      if (k === 'conditional') d.set('condition', this.moddle.create('bpmn:FormalExpression', { body: str(e.fields.condition) ?? '' }));
      if (k === 'link') d.set('name', str(e.fields.link) ?? e.name);
      if (k === 'compensation' && e.fields.waitForCompletion === false) d.set('waitForCompletion', false);
      if (k === 'compensation' && str(e.fields.compensateActivity)) this.deferredRefs.push(() => { const r = this.bos.get(str(e.fields.compensateActivity)!); if (r) d.set('activityRef', r); });
      return d;
    }).filter((d): d is Bo => !!d);
  }

  /** Crea el objeto moddle de un elemento (sin colocarlo en su contenedor). */
  private createBo(e: Element): Bo | undefined {
    const t = e.typeId, f = e.fields;
    const m = this.moddle;
    let b: Bo | undefined;
    if (t === 'bpmn:Task') {
      b = m.create(TASK_TYPE_TO_MODDLE[str(f.taskType) ?? 'none'] ?? 'bpmn:Task', { id: e.id });
      if (f.instantiate) b.set('instantiate', true);
    } else if (SUBPROCESS_TYPES.has(t)) {
      b = m.create(t === 'bpmn:EventSubProcess' ? 'bpmn:SubProcess' : t, { id: e.id, flowElements: [], artifacts: [] });
      if (t === 'bpmn:EventSubProcess') b.set('triggeredByEvent', true);
      if (t === 'bpmn:AdHocSubProcess') {
        if (f.ordering) b.set('ordering', f.ordering);
        if (f.completionCondition) b.set('completionCondition', m.create('bpmn:FormalExpression', { body: String(f.completionCondition) }));
        if (f.cancelRemainingInstances === false) b.set('cancelRemainingInstances', false);
      }
      if (t === 'bpmn:Transaction' && f.method) b.set('method', `##${String(f.method).replace(/^##/, '')}`);
    } else if (t === 'bpmn:CallActivity') {
      b = m.create(t, { id: e.id });
      if (f.calledElement) b.set('calledElement', String(f.calledElement));
    } else if (EVENT_TYPES.has(t)) {
      b = m.create(t, { id: e.id, eventDefinitions: this.eventDefinitions(e) });
      if (t === 'bpmn:StartEvent' && f.interrupting === false) b.set('isInterrupting', false);
      if (t === 'bpmn:BoundaryEvent') {
        b.set('cancelActivity', f.interrupting !== false);
        const host = str(f.attachedTo);
        if (host) this.deferredRefs.push(() => { const r = this.bos.get(host); if (r) b!.set('attachedToRef', r); });
      }
      if ((f.eventDefinition === 'parallelMultiple') && t !== 'bpmn:EndEvent' && t !== 'bpmn:IntermediateThrowEvent') b.set('parallelMultiple', true);
    } else if (GATEWAY_TYPES.has(t)) {
      b = m.create(t, { id: e.id });
      if (f.gatewayDirection) b.set('gatewayDirection', f.gatewayDirection);
      if (t === 'bpmn:ComplexGateway' && f.activationCondition) b.set('activationCondition', m.create('bpmn:FormalExpression', { body: String(f.activationCondition) }));
      if (t === 'bpmn:EventBasedGateway') { if (f.instantiate) b.set('instantiate', true); if (f.eventGatewayType) b.set('eventGatewayType', f.eventGatewayType); }
    } else if (t === 'bpmn:DataObject') {
      const doId = str(e.features.bpmnDataObjectId) ?? `${e.id}_do`;
      const dobj = m.create('bpmn:DataObject', { id: doId });
      if (f.isCollection) dobj.set('isCollection', true);
      b = m.create('bpmn:DataObjectReference', { id: e.id, dataObjectRef: dobj });
      this.bos.set(doId, dobj);
      if (f.state) b.set('dataState', m.create('bpmn:DataState', { id: `${e.id}_state`, name: String(f.state) }));
    } else if (t === 'bpmn:DataStore') {
      const dsId = str(e.features.bpmnDataStoreId) ?? `${e.id}_ds`;
      let ds = this.bos.get(dsId);
      if (!ds) { ds = m.create('bpmn:DataStore', { id: dsId, name: e.name || undefined }); this.bos.set(dsId, ds); this.rootElements.push(ds); }
      b = m.create('bpmn:DataStoreReference', { id: e.id, dataStoreRef: ds });
      if (f.state) b.set('dataState', m.create('bpmn:DataState', { id: `${e.id}_state`, name: String(f.state) }));
    } else if (t === 'bpmn:DataInput' || t === 'bpmn:DataOutput') {
      b = m.create(t, { id: e.id });
      if (f.isCollection) b.set('isCollection', true);
    } else if (t === 'bpmn:TextAnnotation') {
      b = m.create(t, { id: e.id, text: str(f.text) ?? e.name });
    } else if (t === 'bpmn:Group') {
      b = m.create(t, { id: e.id });
      const value = str(f.categoryValue) ?? e.name;
      if (value) {
        const cat = m.create('bpmn:Category', { id: `${e.id}_cat`, categoryValue: [m.create('bpmn:CategoryValue', { id: `${e.id}_cv`, value })] });
        this.rootElements.push(cat);
        b.set('categoryValueRef', list(cat.get('categoryValue'))[0]);
      }
    } else if (CHOREOGRAPHY_TYPES.has(t)) {
      b = m.create(t, { id: e.id, participantRef: [] });
      if (f.loopType) b.set('loopType', f.loopType);
      if (t === 'bpmn:SubChoreography') { b.set('flowElements', []); b.set('artifacts', []); }
      const parts = Array.isArray(f.participants) ? (f.participants as unknown[]).map(String) : [];
      const initiating = str(f.initiatingParticipant);
      this.deferredRefs.push(() => {
        b!.set('participantRef', parts.map(p => this.bos.get(p) ?? this.participantByName(p)).filter((x): x is Bo => !!x));
        const ini = initiating ? this.bos.get(initiating) : undefined; if (ini) b!.set('initiatingParticipantRef', ini);
        if (t === 'bpmn:CallChoreography' && str(f.calledChoreography)) { const c = this.bos.get(str(f.calledChoreography)!); if (c) b!.set('calledChoreographyRef', c); }
        if (t === 'bpmn:ChoreographyTask' && Array.isArray(f.messageFlows)) b!.set('messageFlowRef', (f.messageFlows as unknown[]).map(x => this.bos.get(String(x))).filter(Boolean));
      });
    } else if (CONVERSATION_TYPES.has(t)) {
      b = m.create(t, { id: e.id });
      if (t === 'bpmn:SubConversation') b.set('conversationNodes', []);
      if (t === 'bpmn:CallConversation' && str(f.calledCollaboration)) this.deferredRefs.push(() => { const c = this.bos.get(str(f.calledCollaboration)!); if (c) b!.set('calledCollaborationRef', c); });
    } else if (t === 'bpmn:Pool' || t === 'bpmn:Participant') {
      b = m.create('bpmn:Participant', { id: e.id });
      if (f.multiplicity) b.set('participantMultiplicity', m.create('bpmn:ParticipantMultiplicity', {}));
      if (t === 'bpmn:Pool') { const p = this.newProcess(str(e.features.bpmnProcessId) ?? `Process_${e.id}`, e); b.set('processRef', p); this.processOf.set(e.id, p); }
    } else if (t === 'bpmn:Process') {
      this.processOf.set(e.id, this.newProcess(e.id, e));
      return undefined;
    } else if (t === 'bpmn:Lane') {
      b = m.create('bpmn:Lane', { id: e.id, flowNodeRef: [] });
    } else if (DEFINITION_TYPES[t]) {
      b = m.create(t, { id: e.id });
      if (t === 'bpmn:Error' && f.errorCode) b.set('errorCode', String(f.errorCode));
      if (t === 'bpmn:Escalation' && f.escalationCode) b.set('escalationCode', String(f.escalationCode));
      this.rootElements.push(b);
    } else return undefined;
    if (ACTIVITY_TYPES.has(t)) {
      const lc = this.loopCharacteristics(e); if (lc) b.set('loopCharacteristics', lc);
      if (f.isForCompensation) b.set('isForCompensation', true);
    }
    this.applyCommon(b, e);
    return b;
  }

  private participantByName(name: string): Bo | undefined {
    for (const [id, b] of this.bos) if (b.$type === 'bpmn:Participant' && (b.get('name') === name || id === name)) return b;
    const p = this.moddle.create('bpmn:Participant', { id: `Participant_${name.replace(/[^A-Za-z0-9_]/g, '_')}`, name });
    this.bos.set(p.id!, p);
    this.push(this.ensureChoreography(), 'participants', p);
    return p;
  }

  /** Coloca cada objeto moddle en su contenedor. */
  private place(e: Element, b: Bo) {
    const t = e.typeId;
    if (t === 'bpmn:Pool' || t === 'bpmn:Participant') {
      const isChoreo = this.choreography && this.isChoreographyElement(e.id);
      this.push(isChoreo ? this.ensureChoreography() : this.ensureCollaboration(), 'participants', b);
      return;
    }
    if (t === 'bpmn:Lane') {
      const parent = this.semanticParent(e.id);
      const pe = parent ? this.elements.get(parent) : undefined;
      if (pe?.typeId === 'bpmn:Lane') {
        const pb = this.bos.get(parent!)!;
        let set = bo(pb.get('childLaneSet'));
        if (!set) { set = this.moddle.create('bpmn:LaneSet', { id: `${parent}_lanes`, lanes: [] }); pb.set('childLaneSet', set); set.$parent = pb; }
        this.push(set, 'lanes', b);
      } else {
        const proc = pe && this.processOf.get(pe.id) ? this.processOf.get(pe.id)! : this.ensureDefaultProcess();
        let set = list(proc.get('laneSets'))[0];
        if (!set) { set = this.moddle.create('bpmn:LaneSet', { id: `${proc.id}_lanes`, lanes: [] }); this.push(proc, 'laneSets', set); }
        this.push(set, 'lanes', b);
      }
      return;
    }
    if (CONVERSATION_TYPES.has(t)) {
      const parent = this.semanticParent(e.id);
      const pb = parent ? this.bos.get(parent) : undefined;
      if (pb?.$type === 'bpmn:SubConversation') this.push(pb, 'conversationNodes', b);
      else this.push(this.ensureCollaboration(), 'conversations', b);
      return;
    }
    if (DEFINITION_TYPES[t]) return;
    if (t === 'bpmn:DataInput' || t === 'bpmn:DataOutput') {
      const c = this.flowContainer(e.id);
      let io = bo(c.get('ioSpecification'));
      if (!io) { io = this.moddle.create('bpmn:InputOutputSpecification', { id: `${c.id}_io`, dataInputs: [], dataOutputs: [], inputSets: [this.moddle.create('bpmn:InputSet', { id: `${c.id}_inputSet` })], outputSets: [this.moddle.create('bpmn:OutputSet', { id: `${c.id}_outputSet` })] }); c.set('ioSpecification', io); io.$parent = c; }
      this.push(io, t === 'bpmn:DataInput' ? 'dataInputs' : 'dataOutputs', b);
      return;
    }
    if (ARTIFACT_TYPES.has(t)) {
      // Anotaciones y grupos de una colaboración van en ella si no cuelgan de ningún proceso.
      const target = !this.semanticParent(e.id) && this.collaboration && !this.isChoreographyElement(e.id) ? this.collaboration : this.flowContainer(e.id);
      this.push(target, 'artifacts', b);
      return;
    }
    const container = this.flowContainer(e.id);
    // El DataObject referenciado vive junto a su referencia.
    if (t === 'bpmn:DataObject') { const d = bo(b.get('dataObjectRef')); if (d) this.push(container, 'flowElements', d); }
    this.push(container, 'flowElements', b);
    // Lanes: el nodo de flujo se referencia desde la lane más cercana.
    let p = this.semanticParent(e.id);
    while (p) {
      const pe = this.elements.get(p)!;
      if (pe.typeId === 'bpmn:Lane') { const lb = this.bos.get(p); if (lb && isFlowNode(t)) this.push(lb, 'flowNodeRef', b); break; }
      if (pe.typeId !== 'bpmn:Lane' && pe.typeId !== 'bpmn:Group') break;
      p = this.semanticParent(p);
    }
  }

  private placeRelation(r: Relation) {
    const from = r.from.elementId!, to = r.to.elementId!;
    const fb = this.bos.get(from), tb = this.bos.get(to);
    if (!fb || !tb) return;
    const m = this.moddle;
    const f = r.fields;
    if (r.typeId === SEQ) {
      const flow = m.create('bpmn:SequenceFlow', { id: r.id, sourceRef: fb, targetRef: tb });
      if (f.condition) flow.set('conditionExpression', m.create('bpmn:FormalExpression', { body: String(f.condition) }));
      if (f.immediate) flow.set('isImmediate', true);
      if (f.default) fb.set('default', flow);
      this.applyCommon(flow, r);
      this.push(this.flowContainer(from), 'flowElements', flow);
      this.push(fb, 'outgoing', flow); this.push(tb, 'incoming', flow);
      this.bos.set(r.id, flow);
    } else if (r.typeId === MSG) {
      const flow = m.create('bpmn:MessageFlow', { id: r.id, sourceRef: fb, targetRef: tb });
      const ref = str(f.messageRef);
      if (ref && this.bos.get(ref)) flow.set('messageRef', this.bos.get(ref));
      else if (f.message && !flow.get('name')) flow.set('name', String(f.message));
      this.applyCommon(flow, r);
      this.push(this.choreography && !this.collaboration ? this.choreography : this.ensureCollaboration(), 'messageFlows', flow);
      this.bos.set(r.id, flow);
    } else if (r.typeId === ASSOC) {
      const a = m.create('bpmn:Association', { id: r.id, sourceRef: fb, targetRef: tb });
      if (f.direction && f.direction !== 'None') a.set('associationDirection', f.direction);
      this.applyCommon(a, r);
      const fe = this.elements.get(from)!, te = this.elements.get(to)!;
      const collab = fe.typeId === 'bpmn:Pool' || fe.typeId === 'bpmn:Participant' || te.typeId === 'bpmn:Pool' || te.typeId === 'bpmn:Participant' || fe.typeId === 'bpmn:Message' || te.typeId === 'bpmn:Message' || CONVERSATION_TYPES.has(fe.typeId) || CONVERSATION_TYPES.has(te.typeId);
      const crossPool = !collab && !!this.collaboration && this.flowContainer(from) !== this.flowContainer(to);
      const anchor = ARTIFACT_TYPES.has(fe.typeId) && !ARTIFACT_TYPES.has(te.typeId) ? to : from;
      this.push(collab || crossPool ? this.ensureCollaboration() : this.flowContainer(anchor), 'artifacts', a);
      this.bos.set(r.id, a);
    } else if (r.typeId === DIN) {
      let prop = list(tb.get('properties'))[0];
      if (!prop) { prop = m.create('bpmn:Property', { id: `${to}_prop`, name: '__targetRef_placeholder' }); this.push(tb, 'properties', prop); }
      const a = m.create('bpmn:DataInputAssociation', { id: r.id, sourceRef: [fb], targetRef: prop });
      this.applyCommon(a, r);
      this.push(tb, 'dataInputAssociations', a);
      this.bos.set(r.id, a);
    } else if (r.typeId === DOUT) {
      const a = m.create('bpmn:DataOutputAssociation', { id: r.id, targetRef: tb });
      this.applyCommon(a, r);
      this.push(fb, 'dataOutputAssociations', a);
      this.bos.set(r.id, a);
    } else if (r.typeId === CONV) {
      const l = m.create('bpmn:ConversationLink', { id: r.id, sourceRef: fb, targetRef: tb });
      this.applyCommon(l, r);
      this.push(this.ensureCollaboration(), 'conversationLinks', l);
      this.bos.set(r.id, l);
    }
  }

  // -------------------------------------------------------------- DI
  private absRect(n: ViewNode): Rect {
    let x = n.x, y = n.y;
    let p = n.parentNodeId ? this.ws.nodes[n.parentNodeId] : undefined;
    let guard = 0;
    while (p && guard++ < 50) { x += p.x; y += p.y; p = p.parentNodeId ? this.ws.nodes[p.parentNodeId] : undefined; }
    return { x, y, w: n.w, h: n.h };
  }

  private buildDiagram(view: View): Bo {
    const m = this.moddle;
    const nodes = Object.values(this.ws.nodes).filter(n => n.viewId === view.id && n.elementId && this.bos.has(n.elementId)).sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    const edges = Object.values(this.ws.edges).filter(e => e.viewId === view.id && e.relationId && this.bos.has(e.relationId));
    // Elemento raíz del plano.
    let rootBo: Bo | undefined;
    const rootEl = view.rootElementId ? this.elements.get(view.rootElementId) : undefined;
    const hasCollab = nodes.some(n => { const t = this.elements.get(n.elementId!)!.typeId; return t === 'bpmn:Pool' || t === 'bpmn:Participant' || CONVERSATION_TYPES.has(t); }) || edges.some(e => this.ws.relations[e.relationId!]?.typeId === MSG);
    if (view.viewpointId === 'choreography' && this.choreography) rootBo = this.choreography;
    else if (hasCollab) rootBo = this.ensureCollaboration();
    else if (rootEl && SUBPROCESS_TYPES.has(rootEl.typeId)) rootBo = this.bos.get(rootEl.id);
    else if (rootEl && (rootEl.typeId === 'bpmn:Process' || rootEl.typeId === 'bpmn:Pool')) rootBo = this.processOf.get(rootEl.id);
    if (!rootBo) {
      const first = nodes.find(n => this.elements.get(n.elementId!)!.typeId !== 'bpmn:Group');
      rootBo = first ? this.flowContainer(first.elementId!) : this.ensureDefaultProcess();
    }
    const planeId = view.props.bpmnPlaneId || `${view.id}_plane`;
    const plane = m.create('bpmndi:BPMNPlane', { id: planeId, bpmnElement: rootBo, planeElement: [] });
    const rects = new Map<string, Rect>();
    for (const n of nodes) {
      const e = this.elements.get(n.elementId!)!;
      if (NO_SHAPE_TYPES.has(e.typeId)) continue;
      const r = this.absRect(n);
      rects.set(n.id, r);
      const shape = m.create('bpmndi:BPMNShape', { id: n.id, bpmnElement: this.bos.get(e.id), bounds: m.create('dc:Bounds', { x: r.x, y: r.y, width: r.w, height: r.h }) });
      const t = e.typeId;
      if (SUBPROCESS_TYPES.has(t) || t === 'bpmn:Pool' || t === 'bpmn:SubChoreography' || t === 'bpmn:SubConversation' || t === 'bpmn:CallActivity' || t === 'bpmn:CallChoreography')
        shape.set('isExpanded', !(n.style.collapsed || e.fields.collapsed === true) && t !== 'bpmn:CallActivity' && t !== 'bpmn:CallChoreography');
      if (t === 'bpmn:Participant') shape.set('isExpanded', e.fields.collapsed === false);
      if (t === 'bpmn:Pool' || t === 'bpmn:Participant' || t === 'bpmn:Lane') shape.set('isHorizontal', n.meta?.isHorizontal !== false);
      if (t === 'bpmn:ExclusiveGateway') shape.set('isMarkerVisible', n.meta?.isMarkerVisible !== false);
      const lb = n.meta?.label as Rect | undefined;
      if (lb && typeof lb === 'object') shape.set('label', m.create('bpmndi:BPMNLabel', { bounds: m.create('dc:Bounds', { x: lb.x, y: lb.y, width: lb.w, height: lb.h }) }));
      if (n.style.stroke) shape.set('bioc:stroke', n.style.stroke);
      if (n.style.fill) shape.set('bioc:fill', n.style.fill);
      this.push(plane, 'planeElement', shape);
    }
    for (const ed of edges) {
      const a = rects.get(ed.fromNodeId), b = rects.get(ed.toNodeId);
      if (!a || !b) continue;
      const mid = ed.bendpoints;
      const first = borderPoint(a, mid[0] ?? center(b));
      const last = borderPoint(b, mid[mid.length - 1] ?? center(a));
      const wps = [first, ...mid, last].map(p => m.create('dc:Point', { x: p.x, y: p.y }));
      const edge = m.create('bpmndi:BPMNEdge', { id: ed.id, bpmnElement: this.bos.get(ed.relationId!), waypoint: wps });
      if (ed.style.color) edge.set('bioc:stroke', ed.style.color);
      this.push(plane, 'planeElement', edge);
    }
    return m.create('bpmndi:BPMNDiagram', { id: view.id, name: view.name || undefined, plane });
  }

  async build(): Promise<string> {
    const m = this.moddle;
    // 1. Objetos moddle de cada elemento (pools y procesos primero para que los contenedores existan).
    const ordered = [...this.elements.values()].sort((a, b) => rank(a.typeId) - rank(b.typeId));
    // Padres antes que hijos; dentro de cada nivel se respeta el orden del workspace (sort estable).
    for (const e of ordered) { const b = this.createBo(e); if (b) this.bos.set(e.id, b); }
    if ([...this.elements.values()].some(e => CHOREOGRAPHY_TYPES.has(e.typeId)) || this.views.some(v => v.viewpointId === 'choreography')) this.ensureChoreography();
    // 2. Colocación en contenedores, por profundidad (padres antes que hijos).
    const depth = (id: string): number => { let d = 0, p = this.semanticParent(id); while (p && d < 50) { d++; p = this.semanticParent(p); } return d; };
    for (const e of [...ordered].sort((a, b) => depth(a.id) - depth(b.id))) { const b = this.bos.get(e.id); if (b) this.place(e, b); }
    // 3. Relaciones y referencias diferidas.
    for (const r of this.relations()) this.placeRelation(r);
    for (const fn of this.deferredRefs) fn();
    // 4. Definitions + DI.
    let defsMeta: { id?: string; targetNamespace?: string; attrs?: Record<string, unknown> } = {};
    for (const v of this.views) { const raw = v.props.bpmnDefinitions; if (raw) { try { defsMeta = JSON.parse(raw); break; } catch { /* ignorar */ } } }
    const defs = m.create('bpmn:Definitions', {
      id: defsMeta.id ?? 'Definitions_1',
      targetNamespace: defsMeta.targetNamespace ?? TARGET_NAMESPACE,
      exporter: 'all-draw',
      exporterVersion: EXPORTER_VERSION,
      rootElements: [],
      diagrams: [],
    });
    if (defsMeta.attrs) for (const [k, v] of Object.entries(defsMeta.attrs)) if (!k.startsWith('xmlns')) defs.$attrs[k] = v;
    // Orden legible: colaboración, procesos, definiciones.
    const order = (b: Bo) => (b.$instanceOf('bpmn:Collaboration') ? 0 : b.$type === 'bpmn:Process' ? 1 : 2);
    for (const r of [...this.rootElements].sort((a, b) => order(a) - order(b))) this.push(defs, 'rootElements', r);
    for (const v of this.views) this.push(defs, 'diagrams', this.buildDiagram(v));
    const { xml } = await m.toXML(defs, { format: true });
    return xml;
  }
}

/** Orden de creación: definiciones y procesos/pools antes que el resto (los demás conservan su orden). */
function rank(typeId: string): number {
  if (DEFINITION_TYPES[typeId]) return 0;
  if (typeId === 'bpmn:Process' || typeId === 'bpmn:Pool' || typeId === 'bpmn:Participant') return 1;
  return 2;
}

/**
 * Exporta las vistas BPMN del workspace (o la vista indicada y sus vistas de detalle) como XML BPMN 2.0
 * con DI. Los ids de elementos, relaciones, vistas, nodos y aristas se conservan.
 */
export async function exportBpmn(ws: Workspace, viewId?: string): Promise<string> {
  return new Exporter(ws, viewId).build();
}
