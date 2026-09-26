/**
 * Pack `bpmn`: los elementos **modelables** de BPMN 2.0 (los 53 que renderiza bpmn-js más
 * coreografías y conversaciones) como datos puros. El metamodelo completo (137 tipos) lo lee y
 * escribe `@all-draw/io` (`importBpmn`/`exportBpmn`) vía `bpmn-moddle`; lo que no cabe en el pack
 * viaja en `Element.features.bpmnExtensions` para no perderse.
 *
 * Convenciones de tipos:
 *  - Las 8 tareas de bpmn-js son un solo `Task` con campo `taskType` (`bpmn:UserTask` ↔ `user`).
 *  - `Pool` es un participante con proceso (expandido); `Participant` es la pool vacía/colapsada
 *    ("caja negra", sin `processRef`).
 *  - `EventSubProcess` es `bpmn:SubProcess triggeredByEvent="true"`; `AdHocSubProcess` y
 *    `Transaction` son tipos propios como en el metamodelo.
 *  - `DataObject`/`DataStore` corresponden a `DataObjectReference`/`DataStoreReference` en el XML.
 *  - Los eventos llevan campo `eventDefinition`; `multiple`/`parallelMultiple` = varias definiciones.
 *
 * Reglas que la matriz NO puede expresar y valida el editor (`BpmnRules` equivalentes):
 *  - SequenceFlow solo entre nodos de flujo de la **misma pool** (y del mismo subproceso).
 *  - MessageFlow solo entre participantes de **pools distintas**.
 *  - BoundaryEvent debe estar adherido (`attachedTo`) a una actividad y colocado sobre su borde.
 *  - Una sola SequenceFlow marcada `default` por compuerta; las salidas de una compuerta exclusiva
 *    llevan condición salvo la default.
 *  - La Association de compensación va de un BoundaryEvent `compensation` a una actividad marcada
 *    `isForCompensation`, con `direction: 'One'`.
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
  { id: 'choreography', name: 'Coreografía', order: 6 },
  { id: 'conversations', name: 'Conversaciones', order: 7 },
  { id: 'definitions', name: 'Definiciones', order: 8 },
];

const SEQ = 'bpmn:SequenceFlow';
const MSG = 'bpmn:MessageFlow';
const ASSOC = 'bpmn:Association';
const DIN = 'bpmn:DataInputAssociation';
const DOUT = 'bpmn:DataOutputAssociation';
const CONV = 'bpmn:ConversationLink';

const COLORS = { activity: '#FFFFFF', event: '#FFFFFF', gateway: '#FFFFFF', participant: '#F5F5F5', data: '#FFFFFF', artifact: '#FFFFFF', choreography: '#FFFFFF', definition: '#FAFAFA' };

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `bpmn:${id}`, name, category, fields: [], ...extra,
});

/** Marcadores comunes a toda actividad (bucle, multi-instancia, compensación). */
const activityFields: FieldDef[] = [
  { key: 'loop', label: 'Bucle', kind: 'select', options: 'none,standard,parallelMulti,sequentialMulti' },
  { key: 'isForCompensation', label: 'Actividad de compensación', kind: 'checkbox', doc: 'Se ejecuta solo al compensar; se une a su evento de borde por una Association dirigida.' },
];
const subProcessFields: FieldDef[] = [
  { key: 'collapsed', label: 'Colapsado', kind: 'checkbox' },
  ...activityFields,
];
const eventDef = (options: string): FieldDef => ({ key: 'eventDefinition', label: 'Definición de evento', kind: 'select', options });
const EVENT_REF: FieldDef = { key: 'eventRef', label: 'Mensaje / señal / error / escalado', kind: 'ref', doc: 'Elemento de definición (Message, Signal, Error, Escalation) al que se refiere el evento.' };

/** Definiciones de evento admitidas por cada clase de evento (según el replace menu de bpmn-js). */
export const BPMN_EVENT_DEFINITIONS = {
  StartEvent: 'none,message,timer,signal,conditional,error,escalation,compensation,multiple,parallelMultiple',
  EndEvent: 'none,message,signal,error,escalation,cancel,compensation,terminate,multiple',
  IntermediateCatchEvent: 'message,timer,signal,conditional,link,multiple,parallelMultiple',
  IntermediateThrowEvent: 'none,message,signal,escalation,link,compensation,multiple',
  BoundaryEvent: 'none,message,timer,signal,conditional,error,escalation,cancel,compensation,multiple,parallelMultiple',
} as const;

export const BPMN_ELEMENT_TYPES: ElementType[] = [
  // Participantes
  el('Pool', 'Pool', 'participants', { shape: 'pool', container: true, color: COLORS.participant, icon: '', doc: 'Participante de una colaboración con proceso propio. Contiene lanes y nodos de flujo.', fields: [{ key: 'multiplicity', label: 'Multiplicidad', kind: 'checkbox' }] }),
  el('Participant', 'Participante (pool colapsada)', 'participants', {
    shape: 'pool', color: COLORS.participant, icon: '▭',
    doc: 'Pool vacía o colapsada ("caja negra"): participante sin proceso modelado. Origen y destino de flujos de mensaje.',
    fields: [{ key: 'collapsed', label: 'Colapsada', kind: 'checkbox' }, { key: 'multiplicity', label: 'Multiplicidad', kind: 'checkbox' }],
  }),
  el('Lane', 'Lane', 'participants', { shape: 'lane', container: true, color: COLORS.participant, icon: '', doc: 'Carril dentro de una pool (rol, sistema). Puede anidar lanes.' }),
  el('Process', 'Proceso', 'participants', {
    shape: 'rect', color: COLORS.participant, icon: '⚙', doc: 'Proceso raíz de una vista sin pool (`View.rootElementId`). No se dibuja como nodo.',
    fields: [{ key: 'isExecutable', label: 'Ejecutable', kind: 'checkbox' }, { key: 'processType', label: 'Tipo', kind: 'select', options: 'None,Public,Private' }],
  }),
  // Actividades
  el('Task', 'Tarea', 'activities', {
    shape: 'rounded', color: COLORS.activity, icon: '',
    fields: [
      { key: 'taskType', label: 'Tipo de tarea', kind: 'select', options: 'none,user,service,script,manual,businessRule,send,receive' },
      ...activityFields,
      { key: 'instantiate', label: 'Instancia el proceso (receive)', kind: 'checkbox' },
    ],
  }),
  el('SubProcess', 'Subproceso', 'activities', {
    shape: 'rounded', container: true, color: COLORS.activity, icon: '⊞',
    doc: 'Colapsado: se abre por drill-down (`detailViewId`). Expandido: contiene nodos de flujo en la misma vista.',
    fields: subProcessFields,
  }),
  el('EventSubProcess', 'Subproceso de evento', 'activities', {
    shape: 'rounded', container: true, color: COLORS.activity, icon: '⊟', meta: { borderStyle: 'dotted' },
    doc: 'Subproceso disparado por su evento de inicio (`triggeredByEvent`). Sin flujos de secuencia de entrada ni de salida.',
    fields: subProcessFields,
  }),
  el('AdHocSubProcess', 'Subproceso ad hoc', 'activities', {
    shape: 'rounded', container: true, color: COLORS.activity, icon: '~',
    doc: 'Las actividades internas se ejecutan en cualquier orden hasta la condición de fin.',
    fields: [
      ...subProcessFields,
      { key: 'ordering', label: 'Orden', kind: 'select', options: 'Parallel,Sequential' },
      { key: 'completionCondition', label: 'Condición de fin', kind: 'text' },
      { key: 'cancelRemainingInstances', label: 'Cancelar instancias restantes', kind: 'checkbox' },
    ],
  }),
  el('Transaction', 'Transacción', 'activities', {
    shape: 'rounded', container: true, color: COLORS.activity, icon: '⧈', meta: { doubleBorder: true },
    doc: 'Subproceso transaccional: doble borde; se cancela con eventos `cancel`.',
    fields: [...subProcessFields, { key: 'method', label: 'Método', kind: 'select', options: 'Compensate,Image,Store' }],
  }),
  el('CallActivity', 'Actividad de llamada', 'activities', {
    shape: 'rounded', color: COLORS.activity, icon: '⊡', meta: { borderWidth: 3 },
    doc: 'Invoca un proceso global reutilizable.',
    fields: [{ key: 'calledElement', label: 'Proceso llamado', kind: 'ref' }, ...activityFields],
  }),
  // Eventos
  el('StartEvent', 'Evento de inicio', 'events', {
    shape: 'circle', color: COLORS.event, icon: '○',
    fields: [
      eventDef(BPMN_EVENT_DEFINITIONS.StartEvent),
      { key: 'interrupting', label: 'Interruptor', kind: 'checkbox', doc: 'Solo en subprocesos de evento: no interruptor = borde discontinuo.' },
      EVENT_REF,
      { key: 'timer', label: 'Temporizador', kind: 'text', doc: 'timeDate | timeCycle | timeDuration.' },
      { key: 'condition', label: 'Condición', kind: 'text' },
    ],
  }),
  el('EndEvent', 'Evento de fin', 'events', {
    shape: 'circle', color: COLORS.event, icon: '●', meta: { borderWidth: 3 },
    fields: [eventDef(BPMN_EVENT_DEFINITIONS.EndEvent), EVENT_REF],
  }),
  el('IntermediateCatchEvent', 'Evento intermedio de captura', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: '◎',
    fields: [eventDef(BPMN_EVENT_DEFINITIONS.IntermediateCatchEvent), EVENT_REF, { key: 'timer', label: 'Temporizador', kind: 'text' }, { key: 'condition', label: 'Condición', kind: 'text' }, { key: 'link', label: 'Nombre del enlace', kind: 'text' }],
  }),
  el('IntermediateThrowEvent', 'Evento intermedio de lanzamiento', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: '◉',
    fields: [eventDef(BPMN_EVENT_DEFINITIONS.IntermediateThrowEvent), EVENT_REF, { key: 'link', label: 'Nombre del enlace', kind: 'text' }],
  }),
  el('BoundaryEvent', 'Evento de borde', 'events', {
    shape: 'double-circle', color: COLORS.event, icon: '◌',
    doc: 'Se adhiere al borde de una actividad (`attachedTo`). No interruptor = borde discontinuo. Con `compensation` se une por Association a la actividad compensadora.',
    fields: [
      eventDef(BPMN_EVENT_DEFINITIONS.BoundaryEvent),
      { key: 'interrupting', label: 'Interruptor', kind: 'checkbox' },
      { key: 'attachedTo', label: 'Adherido a', kind: 'ref', required: true },
      EVENT_REF,
      { key: 'timer', label: 'Temporizador', kind: 'text' },
      { key: 'condition', label: 'Condición', kind: 'text' },
    ],
  }),
  // Compuertas
  el('ExclusiveGateway', 'Compuerta exclusiva', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: '✕', doc: 'XOR: un solo camino.' }),
  el('ParallelGateway', 'Compuerta paralela', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: '＋', doc: 'AND: todos los caminos.' }),
  el('InclusiveGateway', 'Compuerta inclusiva', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: '○', doc: 'OR: uno o varios caminos.' }),
  el('EventBasedGateway', 'Compuerta basada en eventos', 'gateways', {
    shape: 'diamond', color: COLORS.gateway, icon: '⬠', doc: 'El primer evento intermedio que ocurra decide el camino.',
    fields: [{ key: 'instantiate', label: 'Instancia el proceso', kind: 'checkbox' }, { key: 'eventGatewayType', label: 'Tipo', kind: 'select', options: 'Exclusive,Parallel' }],
  }),
  el('ComplexGateway', 'Compuerta compleja', 'gateways', { shape: 'diamond', color: COLORS.gateway, icon: '✱', fields: [{ key: 'activationCondition', label: 'Condición de activación', kind: 'text' }] }),
  // Datos
  el('DataObject', 'Objeto de datos', 'data', {
    shape: 'note', color: COLORS.data, icon: '🗎',
    fields: [{ key: 'isCollection', label: 'Colección', kind: 'checkbox' }, { key: 'state', label: 'Estado', kind: 'text' }],
  }),
  el('DataStore', 'Almacén de datos', 'data', { shape: 'cylinder', color: COLORS.data, icon: '⛁' }),
  el('DataInput', 'Entrada de datos', 'data', { shape: 'note', color: COLORS.data, icon: '🗎→', doc: 'Dato de entrada del proceso (flecha vacía en la esquina).', fields: [{ key: 'isCollection', label: 'Colección', kind: 'checkbox' }] }),
  el('DataOutput', 'Salida de datos', 'data', { shape: 'note', color: COLORS.data, icon: '🗎⇒', doc: 'Dato de salida del proceso (flecha rellena en la esquina).', fields: [{ key: 'isCollection', label: 'Colección', kind: 'checkbox' }] }),
  el('Message', 'Mensaje', 'data', { shape: 'label', color: COLORS.data, icon: '✉', doc: 'Sobre que se dibuja sobre un flujo de mensaje o junto a una tarea de coreografía. Se asocia con Association.', fields: [{ key: 'initiating', label: 'Iniciador', kind: 'checkbox' }] }),
  // Artefactos
  el('Group', 'Grupo', 'artifacts', { shape: 'group', container: true, color: COLORS.artifact, icon: '▢', doc: 'Agrupación visual sin semántica de flujo.', fields: [{ key: 'categoryValue', label: 'Categoría', kind: 'text' }] }),
  el('TextAnnotation', 'Anotación', 'artifacts', { shape: 'note', color: COLORS.artifact, icon: '🗒', fields: [{ key: 'text', label: 'Texto', kind: 'textarea' }] }),
  // Coreografía
  el('ChoreographyTask', 'Tarea de coreografía', 'choreography', {
    shape: 'rounded', color: COLORS.choreography, icon: '⇄', doc: 'Intercambio de mensajes entre dos participantes (bandas superior e inferior).',
    fields: [
      { key: 'initiatingParticipant', label: 'Participante iniciador', kind: 'ref' },
      { key: 'participants', label: 'Participantes', kind: 'list', port: false },
      { key: 'loopType', label: 'Bucle', kind: 'select', options: 'None,Standard,MultiInstanceSequential,MultiInstanceParallel' },
    ],
  }),
  el('SubChoreography', 'Subcoreografía', 'choreography', {
    shape: 'rounded', container: true, color: COLORS.choreography, icon: '⊞⇄',
    fields: [{ key: 'collapsed', label: 'Colapsada', kind: 'checkbox' }, { key: 'initiatingParticipant', label: 'Participante iniciador', kind: 'ref' }, { key: 'participants', label: 'Participantes', kind: 'list', port: false }, { key: 'loopType', label: 'Bucle', kind: 'select', options: 'None,Standard,MultiInstanceSequential,MultiInstanceParallel' }],
  }),
  el('CallChoreography', 'Llamada a coreografía', 'choreography', {
    shape: 'rounded', color: COLORS.choreography, icon: '⊡⇄', meta: { borderWidth: 3 },
    fields: [{ key: 'calledChoreography', label: 'Coreografía llamada', kind: 'ref' }, { key: 'initiatingParticipant', label: 'Participante iniciador', kind: 'ref' }, { key: 'participants', label: 'Participantes', kind: 'list', port: false }, { key: 'loopType', label: 'Bucle', kind: 'select', options: 'None,Standard,MultiInstanceSequential,MultiInstanceParallel' }],
  }),
  // Conversaciones
  el('Conversation', 'Conversación', 'conversations', { shape: 'hexagon', color: COLORS.choreography, icon: '⬡', doc: 'Conjunto de intercambios de mensajes entre participantes; se une a ellos con ConversationLink.' }),
  el('SubConversation', 'Subconversación', 'conversations', { shape: 'hexagon', container: true, color: COLORS.choreography, icon: '⬡⊞', fields: [{ key: 'collapsed', label: 'Colapsada', kind: 'checkbox' }] }),
  el('CallConversation', 'Llamada a conversación', 'conversations', { shape: 'hexagon', color: COLORS.choreography, icon: '⬡⊡', meta: { borderWidth: 3 }, fields: [{ key: 'calledCollaboration', label: 'Colaboración llamada', kind: 'ref' }] }),
  // Definiciones (elementos raíz referenciados por eventos; no se dibujan)
  el('Signal', 'Señal', 'definitions', { shape: 'label', color: COLORS.definition, icon: '△', doc: 'Definición de señal referenciada por eventos `signal`.' }),
  el('Error', 'Error', 'definitions', { shape: 'label', color: COLORS.definition, icon: '⚡', doc: 'Definición de error referenciada por eventos `error`.', fields: [{ key: 'errorCode', label: 'Código', kind: 'text' }] }),
  el('Escalation', 'Escalado', 'definitions', { shape: 'label', color: COLORS.definition, icon: '⇑', doc: 'Definición de escalado referenciada por eventos `escalation`.', fields: [{ key: 'escalationCode', label: 'Código', kind: 'text' }] }),
];

export const BPMN_RELATION_TYPES: RelationType[] = [
  {
    id: SEQ, name: 'Flujo de secuencia', category: 'activities', line: 'solid', targetHead: 'arrow',
    doc: 'Orden de ejecución entre nodos de flujo de la misma pool. `default` marca la salida por defecto de una compuerta (barra oblicua en el origen); `condition` dibuja un rombo en el origen si sale de una actividad.',
    fields: [
      { key: 'condition', label: 'Condición', kind: 'text' },
      { key: 'default', label: 'Por defecto', kind: 'checkbox' },
      { key: 'immediate', label: 'Inmediato', kind: 'checkbox' },
    ],
  },
  {
    id: MSG, name: 'Flujo de mensaje', category: 'participants', line: 'dashed', sourceHead: 'circle', targetHead: 'open',
    doc: 'Intercambio de mensajes entre participantes de pools distintas.',
    fields: [{ key: 'message', label: 'Mensaje', kind: 'text' }, { key: 'messageRef', label: 'Elemento Message', kind: 'ref' }],
  },
  {
    id: ASSOC, name: 'Asociación', category: 'artifacts', line: 'dotted', targetHead: 'none',
    doc: 'Une artefactos (anotaciones, grupos, mensajes) con cualquier elemento. Con `direction: One` es la asociación de compensación (evento de borde → actividad compensadora).',
    fields: [{ key: 'direction', label: 'Dirección', kind: 'select', options: 'None,One,Both' }],
  },
  { id: DIN, name: 'Entrada de datos', category: 'data', line: 'dotted', targetHead: 'open', fields: [], doc: 'De un objeto/almacén/entrada de datos a una actividad o evento de lanzamiento.' },
  { id: DOUT, name: 'Salida de datos', category: 'data', line: 'dotted', targetHead: 'open', fields: [], doc: 'De una actividad o evento de captura a un objeto/almacén/salida de datos.' },
  { id: CONV, name: 'Enlace de conversación', category: 'conversations', line: 'solid', targetHead: 'none', fields: [], meta: { doubleLine: true }, doc: 'Une un participante con una conversación (línea doble).' },
];

// ---------------------------------------------------------------- Matriz
/** Actividades con flujo de secuencia (el subproceso de evento no tiene entradas ni salidas). */
export const BPMN_ACTIVITIES = ['Task', 'SubProcess', 'AdHocSubProcess', 'Transaction', 'CallActivity'];
/** Contenedores de nodos de flujo (subprocesos de toda clase). */
export const BPMN_SUBPROCESSES = ['SubProcess', 'EventSubProcess', 'AdHocSubProcess', 'Transaction'];
export const BPMN_GATEWAYS = ['ExclusiveGateway', 'ParallelGateway', 'InclusiveGateway', 'EventBasedGateway', 'ComplexGateway'];
export const BPMN_EVENTS = ['StartEvent', 'EndEvent', 'IntermediateCatchEvent', 'IntermediateThrowEvent', 'BoundaryEvent'];
export const BPMN_CHOREOGRAPHY_ACTIVITIES = ['ChoreographyTask', 'SubChoreography', 'CallChoreography'];
export const BPMN_CONVERSATION_NODES = ['Conversation', 'SubConversation', 'CallConversation'];
/** Nodos de flujo: los que pueden unirse con SequenceFlow (más el subproceso de evento, que solo contiene). */
export const BPMN_FLOW_NODES = [...BPMN_ACTIVITIES, 'EventSubProcess', ...BPMN_GATEWAYS, ...BPMN_EVENTS, ...BPMN_CHOREOGRAPHY_ACTIVITIES];
const DATA = ['DataObject', 'DataStore', 'DataInput', 'DataOutput'];
const ARTIFACTS = ['TextAnnotation', 'Group'];
const PARTICIPANTS = ['Pool', 'Participant'];
const ALL = BPMN_ELEMENT_TYPES.map(t => t.id.slice('bpmn:'.length));

/** Orígenes válidos de SequenceFlow: todo nodo de flujo salvo EndEvent y el subproceso de evento. */
const SEQ_SOURCES = BPMN_FLOW_NODES.filter(n => n !== 'EndEvent' && n !== 'EventSubProcess');
/** Destinos válidos: todo nodo de flujo salvo StartEvent, BoundaryEvent (se adhiere) y subproceso de evento. */
const SEQ_TARGETS = BPMN_FLOW_NODES.filter(n => n !== 'StartEvent' && n !== 'BoundaryEvent' && n !== 'EventSubProcess');
/** Extremos de MessageFlow (entre pools distintas; lo valida el editor). */
const MSG_SOURCES = [...BPMN_ACTIVITIES, 'EndEvent', 'IntermediateThrowEvent', ...PARTICIPANTS];
const MSG_TARGETS = [...BPMN_ACTIVITIES, 'StartEvent', 'IntermediateCatchEvent', 'BoundaryEvent', ...PARTICIPANTS];
/** Datos: entradas hacia actividades y eventos de lanzamiento; salidas desde actividades y eventos de captura. */
const DIN_SOURCES = ['DataObject', 'DataStore', 'DataInput'];
const DIN_TARGETS = [...BPMN_ACTIVITIES, 'IntermediateThrowEvent', 'EndEvent'];
const DOUT_SOURCES = [...BPMN_ACTIVITIES, 'StartEvent', 'IntermediateCatchEvent', 'BoundaryEvent'];
const DOUT_TARGETS = ['DataObject', 'DataStore', 'DataOutput'];

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
  for (const a of ALL) for (const x of [...ARTIFACTS, 'Message']) { add(a, x, ASSOC); add(x, a, ASSOC); }
  for (const s of DIN_SOURCES) for (const t of DIN_TARGETS) add(s, t, DIN);
  for (const s of DOUT_SOURCES) for (const t of DOUT_TARGETS) add(s, t, DOUT);
  // Compensación: del evento de borde a la actividad compensadora (Association dirigida).
  for (const a of BPMN_ACTIVITIES) add('BoundaryEvent', a, ASSOC);
  // Conversaciones: participante ↔ conversación.
  for (const p of PARTICIPANTS) for (const c of BPMN_CONVERSATION_NODES) { add(p, c, CONV); add(c, p, CONV); }
  return m;
}

export const BPMN_VALIDITY: ValidityMatrix = buildValidity();

// ---------------------------------------------------------------- Anidamiento
const POOL_CHILDREN = ['Lane', ...BPMN_FLOW_NODES.filter(n => !BPMN_CHOREOGRAPHY_ACTIVITIES.includes(n)), ...DATA, ...ARTIFACTS, 'Message'];
const SUBPROCESS_CHILDREN = [...BPMN_FLOW_NODES.filter(n => !BPMN_CHOREOGRAPHY_ACTIVITIES.includes(n)), ...DATA, ...ARTIFACTS];
const CHOREOGRAPHY_CHILDREN = [...BPMN_CHOREOGRAPHY_ACTIVITIES, ...BPMN_GATEWAYS, ...BPMN_EVENTS, ...ARTIFACTS, 'Message'];
export const BPMN_NESTING: NestingRule[] = [
  ...POOL_CHILDREN.map(child => ({ parent: 'Pool', child, relationTypes: [] })),
  ...POOL_CHILDREN.map(child => ({ parent: 'Lane', child, relationTypes: [] })),
  ...BPMN_SUBPROCESSES.flatMap(parent => SUBPROCESS_CHILDREN.map(child => ({ parent, child, relationTypes: [] }))),
  ...CHOREOGRAPHY_CHILDREN.map(child => ({ parent: 'SubChoreography', child, relationTypes: [] })),
  ...[...BPMN_CONVERSATION_NODES, ...PARTICIPANTS, ...ARTIFACTS].map(child => ({ parent: 'SubConversation', child, relationTypes: [] })),
  { parent: 'Group', child: '*', relationTypes: [] },
];

// ---------------------------------------------------------------- Viewpoints
const CHOREOGRAPHY_TYPES = [...BPMN_CHOREOGRAPHY_ACTIVITIES, ...BPMN_GATEWAYS, ...BPMN_EVENTS, 'Participant', 'Message', ...ARTIFACTS, 'Signal', 'Error', 'Escalation'].map(n => `bpmn:${n}`);
const NOT_IN_PROCESS = new Set(['Pool', 'Participant', 'Lane', ...BPMN_CHOREOGRAPHY_ACTIVITIES, ...BPMN_CONVERSATION_NODES].map(n => `bpmn:${n}`));

export const BPMN_VIEWPOINTS: Viewpoint[] = [
  { id: 'collaboration', name: 'Colaboración', doc: 'Diagrama de colaboración: pools, lanes, flujos de mensaje y conversaciones.', elementTypes: [] },
  {
    id: 'process', name: 'Proceso', doc: 'Un solo proceso: sin pools, lanes, flujos de mensaje, coreografías ni conversaciones.',
    elementTypes: BPMN_ELEMENT_TYPES.map(t => t.id).filter(id => !NOT_IN_PROCESS.has(id)),
    relationTypes: BPMN_RELATION_TYPES.map(r => r.id).filter(id => id !== MSG && id !== CONV),
  },
  {
    id: 'choreography', name: 'Coreografía', doc: 'Diagrama de coreografía: tareas de coreografía, eventos y compuertas; los participantes son bandas, no pools.',
    elementTypes: CHOREOGRAPHY_TYPES,
    relationTypes: [SEQ, ASSOC, MSG],
  },
];

export const BPMN_PACK: NotationPack = {
  id: 'bpmn',
  name: 'BPMN 2.0',
  version: '0.2.0',
  doc: 'Elementos modelables de BPMN 2.0 (procesos, colaboraciones, coreografías y conversaciones). El editor añade las reglas que la matriz no expresa: misma pool para flujos de secuencia, pools distintas para flujos de mensaje, eventos de borde adheridos a actividades, una sola salida por defecto por compuerta.',
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
