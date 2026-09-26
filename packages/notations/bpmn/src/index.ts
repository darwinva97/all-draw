/**
 * Pack `bpmn`: subconjunto útil de BPMN 2.0 (fase F3) como datos puros. El metamodelo completo
 * (137 tipos) llega en F5 vía `bpmn-moddle` en `io/bpmn`; este pack cubre lo que se modela a mano.
 *
 * Reglas que la matriz NO puede expresar y valida el editor (`BpmnRules` equivalentes):
 *  - SequenceFlow solo entre nodos de flujo de la **misma pool** (y del mismo subproceso).
 *  - MessageFlow solo entre participantes de **pools distintas**.
 *  - BoundaryEvent debe estar adherido (`attachedTo`) a una actividad y colocado sobre su borde.
 *  - Una sola SequenceFlow marcada `default` por compuerta; las salidas de una compuerta exclusiva
 *    llevan condición salvo la default.
 */
import type { NotationPack, ValidityMatrix, NestingRule, Viewpoint } from '@all-draw/core';
import type { ElementType, RelationType, FieldDef } from '@all-draw/core';

export const BPMN_CATEGORIES = [
  { id: 'participants', name: 'Participantes', order: 0 },
  { id: 'activities', name: 'Actividades', order: 1 },
  { id: 'events', name: 'Eventos', order: 2 },
  { id: 'gateways', name: 'Compuertas', order: 3 },
  { id: 'data', name: 'Datos', order: 4 },
  { id: 'artifacts', name: 'Artefactos', order: 5 },
];

const SEQ = 'bpmn:SequenceFlow';
const MSG = 'bpmn:MessageFlow';
const ASSOC = 'bpmn:Association';
const DIN = 'bpmn:DataInputAssociation';
const DOUT = 'bpmn:DataOutputAssociation';

const COLORS = { activity: '#FFFFFF', event: '#FFFFFF', gateway: '#FFFFFF', participant: '#F5F5F5', data: '#FFFFFF', artifact: '#FFFFFF' };

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `bpmn:${id}`, name, category, fields: [], ...extra,
});

const activityFields: FieldDef[] = [
  { key: 'loop', label: 'Bucle', kind: 'select', options: 'none,standard,parallelMulti,sequentialMulti' },
];
const eventDef = (options: string): FieldDef => ({ key: 'eventDefinition', label: 'Definición de evento', kind: 'select', options });

export const BPMN_ELEMENT_TYPES: ElementType[] = [
  // Participantes
  el('Pool', 'Pool', 'participants', { shape: 'pool', container: true, color: COLORS.participant, icon: 'pool', doc: 'Participante de una colaboración. Contiene lanes y nodos de flujo.' }),
  el('Lane', 'Lane', 'participants', { shape: 'lane', container: true, color: COLORS.participant, icon: 'lane', doc: 'Carril dentro de una pool (rol, sistema). Puede anidar lanes.' }),
  // Actividades
  el('Task', 'Tarea', 'activities', {
    shape: 'rounded', color: COLORS.activity, icon: 'task',
    fields: [
      { key: 'taskType', label: 'Tipo de tarea', kind: 'select', options: 'none,user,service,script,manual,businessRule,send,receive' },
      ...activityFields,
    ],
  }),
  el('SubProcess', 'Subproceso', 'activities', {
    shape: 'rounded', container: true, color: COLORS.activity, icon: 'subprocess',
    doc: 'Colapsado: se abre por drill-down (`detailViewId`). Expandido: contiene nodos de flujo en la misma vista.',
    fields: [
      { key: 'collapsed', label: 'Colapsado', kind: 'checkbox' },
      { key: 'triggeredByEvent', label: 'Subproceso de evento', kind: 'checkbox' },
      ...activityFields,
    ],
  }),
  el('CallActivity', 'Actividad de llamada', 'activities', {
    shape: 'rounded', color: COLORS.activity, icon: 'call-activity', meta: { borderWidth: 3 },
    doc: 'Invoca un proceso global reutilizable.',
    fields: [{ key: 'calledElement', label: 'Proceso llamado', kind: 'ref' }, ...activityFields],
  }),
  // Eventos
  el('StartEvent', 'Evento de inicio', 'events', {
    shape: 'circle', color: COLORS.event, icon: 'start-event',
    fields: [eventDef('none,message,timer,signal,conditional,error,escalation')],
  }),
  el('EndEvent', 'Evento de fin', 'events', {
    shape: 'circle', color: COLORS.event, icon: 'end-event', meta: { borderWidth: 3 },
    fields: [eventDef('none,message,signal,error,escalation,terminate,compensation')],
  }),
  el('IntermediateCatchEvent', 'Evento intermedio de captura', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: 'intermediate-catch',
    fields: [eventDef('none,message,timer,signal,conditional,link')],
  }),
  el('IntermediateThrowEvent', 'Evento intermedio de lanzamiento', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: 'intermediate-throw',
    fields: [eventDef('none,message,signal,escalation,link,compensation')],
  }),
  el('BoundaryEvent', 'Evento de borde', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: 'boundary-event',
    doc: 'Se adhiere al borde de una actividad (`attachedTo`). No interruptor = borde discontinuo.',
    fields: [
      eventDef('message,timer,signal,conditional,error,escalation,compensation'),
      { key: 'interrupting', label: 'Interruptor', kind: 'checkbox' },
      { key: 'attachedTo', label: 'Adherido a', kind: 'ref', required: true },
    ],
  }),
  // Compuertas
  el('ExclusiveGateway', 'Compuerta exclusiva', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: 'gateway-exclusive', doc: 'XOR: un solo camino.' }),
  el('ParallelGateway', 'Compuerta paralela', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: 'gateway-parallel', doc: 'AND: todos los caminos.' }),
  el('InclusiveGateway', 'Compuerta inclusiva', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: 'gateway-inclusive', doc: 'OR: uno o varios caminos.' }),
  el('EventBasedGateway', 'Compuerta basada en eventos', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: 'gateway-event', doc: 'El primer evento intermedio que ocurra decide el camino.' }),
  el('ComplexGateway', 'Compuerta compleja', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: 'gateway-complex', fields: [{ key: 'activationCondition', label: 'Condición de activación', kind: 'text' }] }),
  // Datos
  el('DataObject', 'Objeto de datos', 'data', {
    shape: 'note', color: COLORS.data, icon: 'data-object',
    fields: [{ key: 'isCollection', label: 'Colección', kind: 'checkbox' }, { key: 'state', label: 'Estado', kind: 'text' }],
  }),
  el('DataStore', 'Almacén de datos', 'data', { shape: 'cylinder', color: COLORS.data, icon: 'data-store' }),
  // Artefactos
  el('Group', 'Grupo', 'artifacts', { shape: 'group', container: true, color: COLORS.artifact, icon: 'group', doc: 'Agrupación visual sin semántica de flujo.' }),
  el('TextAnnotation', 'Anotación', 'artifacts', { shape: 'note', color: COLORS.artifact, icon: 'annotation', fields: [{ key: 'text', label: 'Texto', kind: 'textarea' }] }),
];

export const BPMN_RELATION_TYPES: RelationType[] = [
  {
    id: SEQ, name: 'Flujo de secuencia', category: 'activities', line: 'solid', targetHead: 'arrow',
    doc: 'Orden de ejecución entre nodos de flujo de la misma pool. `default` marca la salida por defecto de una compuerta (barra oblicua en el origen).',
    fields: [
      { key: 'condition', label: 'Condición', kind: 'text' },
      { key: 'default', label: 'Por defecto', kind: 'checkbox' },
    ],
  },
  {
    id: MSG, name: 'Flujo de mensaje', category: 'participants', line: 'dashed', sourceHead: 'circle', targetHead: 'open',
    doc: 'Intercambio de mensajes entre participantes de pools distintas.',
    fields: [{ key: 'message', label: 'Mensaje', kind: 'text' }],
  },
  { id: ASSOC, name: 'Asociación', category: 'artifacts', line: 'dotted', targetHead: 'none', fields: [], doc: 'Une artefactos (anotaciones, grupos) con cualquier elemento.' },
  { id: DIN, name: 'Entrada de datos', category: 'data', line: 'dotted', targetHead: 'open', fields: [], doc: 'De un objeto/almacén de datos a una actividad.' },
  { id: DOUT, name: 'Salida de datos', category: 'data', line: 'dotted', targetHead: 'open', fields: [], doc: 'De una actividad a un objeto/almacén de datos.' },
];

// ---------------------------------------------------------------- Matriz
const ACTIVITIES = ['Task', 'SubProcess', 'CallActivity'];
const GATEWAYS = ['ExclusiveGateway', 'ParallelGateway', 'InclusiveGateway', 'EventBasedGateway', 'ComplexGateway'];
const EVENTS = ['StartEvent', 'EndEvent', 'IntermediateCatchEvent', 'IntermediateThrowEvent', 'BoundaryEvent'];
/** Nodos de flujo: los que pueden unirse con SequenceFlow. */
export const BPMN_FLOW_NODES = [...ACTIVITIES, ...GATEWAYS, ...EVENTS];
const DATA = ['DataObject', 'DataStore'];
const ARTIFACTS = ['TextAnnotation', 'Group'];
const ALL = BPMN_ELEMENT_TYPES.map(t => t.id.slice('bpmn:'.length));

/** Orígenes válidos de SequenceFlow: todo nodo de flujo salvo EndEvent. */
const SEQ_SOURCES = BPMN_FLOW_NODES.filter(n => n !== 'EndEvent');
/** Destinos válidos de SequenceFlow: todo nodo de flujo salvo StartEvent y BoundaryEvent (que se adhiere, no se conecta). */
const SEQ_TARGETS = BPMN_FLOW_NODES.filter(n => n !== 'StartEvent' && n !== 'BoundaryEvent');
/** Extremos de MessageFlow (entre pools distintas; lo valida el editor). */
const MSG_SOURCES = [...ACTIVITIES, 'EndEvent', 'IntermediateThrowEvent', 'Pool'];
const MSG_TARGETS = [...ACTIVITIES, 'StartEvent', 'IntermediateCatchEvent', 'BoundaryEvent', 'Pool'];

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  const add = (s: string, t: string, rel: string) => {
    const row = (m[s] ??= {});
    const cell = (row[t] ??= []);
    if (!cell.includes(rel)) cell.push(rel);
  };
  for (const s of ALL) m[s] = {};
  for (const s of SEQ_SOURCES) for (const t of SEQ_TARGETS) add(s, t, SEQ);
  for (const s of MSG_SOURCES) for (const t of MSG_TARGETS) add(s, t, MSG);
  for (const a of ALL) for (const x of ARTIFACTS) { add(a, x, ASSOC); add(x, a, ASSOC); }
  for (const a of ACTIVITIES) for (const d of DATA) { add(d, a, DIN); add(a, d, DOUT); }
  return m;
}

export const BPMN_VALIDITY: ValidityMatrix = buildValidity();

// ---------------------------------------------------------------- Anidamiento
export const BPMN_NESTING: NestingRule[] = [
  ...['Lane', ...BPMN_FLOW_NODES, ...DATA, ...ARTIFACTS].map(child => ({ parent: 'Pool', child, relationTypes: [] })),
  ...['Lane', ...BPMN_FLOW_NODES, ...DATA, ...ARTIFACTS].map(child => ({ parent: 'Lane', child, relationTypes: [] })),
  ...[...BPMN_FLOW_NODES, ...DATA, ...ARTIFACTS].map(child => ({ parent: 'SubProcess', child, relationTypes: [] })),
  { parent: 'Group', child: '*', relationTypes: [] },
];

// ---------------------------------------------------------------- Viewpoints
export const BPMN_VIEWPOINTS: Viewpoint[] = [
  { id: 'collaboration', name: 'Colaboración', doc: 'Diagrama de colaboración: pools, lanes y flujos de mensaje.', elementTypes: [] },
  {
    id: 'process', name: 'Proceso', doc: 'Un solo proceso: sin pools, lanes ni flujos de mensaje.',
    elementTypes: BPMN_ELEMENT_TYPES.map(t => t.id).filter(id => id !== 'bpmn:Pool' && id !== 'bpmn:Lane'),
    relationTypes: BPMN_RELATION_TYPES.map(r => r.id).filter(id => id !== MSG),
  },
];

export const BPMN_PACK: NotationPack = {
  id: 'bpmn',
  name: 'BPMN 2.0',
  version: '0.1.0',
  doc: 'Subconjunto de BPMN 2.0 para modelado manual (F3). El editor añade las reglas que la matriz no expresa: misma pool para flujos de secuencia, pools distintas para flujos de mensaje, eventos de borde adheridos a actividades.',
  color: '#1B75BB',
  viewKind: 'freeform',
  categories: BPMN_CATEGORIES,
  elementTypes: BPMN_ELEMENT_TYPES,
  relationTypes: BPMN_RELATION_TYPES,
  portTypes: [],
  validity: BPMN_VALIDITY,
  viewpoints: BPMN_VIEWPOINTS,
  nesting: BPMN_NESTING,
  defaultRelation: SEQ,
};

export default BPMN_PACK;
