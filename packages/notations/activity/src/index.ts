/**
 * Pack `activity`: diagrama de actividad de UML 2.5 como datos puros.
 *
 * - Nodos de acción (rectángulo redondeado), de control (inicial: círculo negro; final de actividad: diana; final de
 *   flujo: círculo con aspa; decisión/fusión: rombo; bifurcación/unión: barra negra), de objeto (rectángulo con
 *   `[estado]`) y de señal (enviar: pentágono en flecha; recibir: rectángulo con muesca).
 * - **Partición** (calle): contenedor con el nombre en una banda lateral; las acciones de un responsable van dentro.
 * - Relaciones: **flujo de control** y **flujo de objeto** (flecha continua) con `guarda` ("[aprobado]"), que el lienzo
 *   rotula sobre la arista. Un flujo de objeto tiene un nodo objeto en algún extremo; uno de control, en ninguno.
 *
 * Matriz: el inicial no recibe flujos, los finales no emiten, la partición no participa en ninguno.
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType, FieldDef } from '@all-draw/core';

const NS = 'activity';
export const ACTIVITY_PACK_ID = NS;
const CAT = { actions: 'actions', control: 'control', objects: 'objects', signals: 'signals', partitions: 'partitions' } as const;
export const CONTROL_FLOW = `${NS}:ControlFlow`;
export const OBJECT_FLOW = `${NS}:ObjectFlow`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

export const ACTIVITY_ELEMENT_TYPES: ElementType[] = [
  el('Action', 'Acción', CAT.actions, {
    shape: 'rounded', color: '#FFFFFF',
    doc: 'Paso ejecutable de la actividad: rectángulo de esquinas redondeadas con un verbo ("Validar pedido").',
    fields: [
      { key: 'callBehavior', label: 'Llama a otra actividad', kind: 'checkbox', doc: 'Acción de llamada (icono de rastrillo): se detalla en una vista de detalle.' },
      { key: 'localPrecondition', label: 'Precondición local', kind: 'text' },
    ],
  }),
  el('Initial', 'Nodo inicial', CAT.control, {
    shape: 'circle', color: '#000000',
    doc: 'Donde empieza el flujo: círculo negro relleno. Solo tiene salidas.',
  }),
  el('ActivityFinal', 'Final de actividad', CAT.control, {
    shape: 'double-circle', color: '#000000',
    doc: 'Termina toda la actividad (diana: círculo con un punto negro). Detiene todos los flujos que sigan en marcha.',
  }),
  el('FlowFinal', 'Final de flujo', CAT.control, {
    shape: 'circle', color: '#FFFFFF',
    doc: 'Termina solo el flujo que llega (círculo con un aspa); los demás siguen.',
  }),
  el('Decision', 'Decisión / fusión', CAT.control, {
    shape: 'diamond', color: '#FFFFFF',
    doc: 'Rombo. Como decisión, una entrada y varias salidas con guardas excluyentes; como fusión, varias entradas alternativas y una salida.',
    fields: [
      { key: 'role', label: 'Papel', kind: 'select', options: 'decision,merge', optionLabels: { decision: 'Decisión', merge: 'Fusión' } },
      { key: 'decisionInput', label: 'Entrada de decisión', kind: 'text', doc: 'Nota «decisionInput» con el criterio que evalúan las guardas.' },
    ],
  }),
  el('Fork', 'Bifurcación / unión', CAT.control, {
    shape: 'bar', color: '#000000',
    doc: 'Barra negra. Como bifurcación, reparte el flujo en ramas paralelas; como unión, espera a que lleguen todas.',
    fields: [
      { key: 'role', label: 'Papel', kind: 'select', options: 'fork,join', optionLabels: { fork: 'Bifurcación', join: 'Unión' } },
      { key: 'joinSpec', label: 'Especificación de unión', kind: 'text', doc: '{joinSpec = A and B}' },
    ],
  }),
  el('ObjectNode', 'Nodo objeto', CAT.objects, {
    shape: 'rect', color: '#FFFFFF',
    doc: 'Dato u objeto que fluye entre acciones (rectángulo con el nombre y, si lo hay, su `[estado]`).',
    fields: [
      { key: 'type', label: 'Tipo', kind: 'text', doc: 'Clase del objeto ("Pedido").' },
      { key: 'state', label: 'Estado', kind: 'text', doc: 'Estado en que está el objeto ("pagado"); se muestra entre corchetes.' },
      { key: 'isCollection', label: 'Colección', kind: 'checkbox' },
    ],
  }),
  el('SendSignal', 'Enviar señal', CAT.signals, {
    shape: 'rect', color: '#FFFFFF',
    doc: 'Envía una señal o un mensaje sin esperar respuesta: pentágono con la punta hacia la derecha.',
    fields: [{ key: 'signal', label: 'Señal', kind: 'text' }, { key: 'target', label: 'Destinatario', kind: 'text' }],
  }),
  el('AcceptEvent', 'Recibir señal o evento', CAT.signals, {
    shape: 'rect', color: '#FFFFFF',
    doc: 'Espera a que llegue una señal o un evento: rectángulo con una muesca en la izquierda.',
    fields: [
      { key: 'trigger', label: 'Disparador', kind: 'text', doc: 'Señal o evento que se espera ("Pago recibido", "cada día a las 8:00").' },
      { key: 'kind', label: 'Tipo de evento', kind: 'select', options: 'signal,time', optionLabels: { signal: 'Señal', time: 'Tiempo' } },
    ],
  }),
  el('Partition', 'Partición (calle)', CAT.partitions, {
    shape: 'lane', container: true, color: '#F5F5F5',
    doc: 'Calle con el nombre del responsable (persona, rol, sistema) en la banda lateral; las acciones que le tocan van dentro. Se pueden anidar.',
  }),
];

const guard: FieldDef = { key: 'guard', label: 'Guarda', kind: 'text', doc: 'Condición entre corchetes: "[aprobado]", "[else]".' };

export const ACTIVITY_RELATION_TYPES: RelationType[] = [
  {
    id: CONTROL_FLOW, name: 'Flujo de control', category: CAT.control, line: 'solid', sourceHead: 'none', targetHead: 'open',
    fields: [guard, { key: 'weight', label: 'Peso', kind: 'text', doc: 'Fichas que pasan a la vez ("{weight = 2}").' }],
    doc: 'Orden de ejecución entre acciones y nodos de control: flecha continua, con la guarda rotulada si la hay.',
  },
  {
    id: OBJECT_FLOW, name: 'Flujo de objeto', category: CAT.objects, line: 'solid', sourceHead: 'none', targetHead: 'open',
    fields: [guard, { key: 'selection', label: 'Selección', kind: 'text', doc: '«selection» con el criterio para elegir los objetos.' }],
    doc: 'Paso de datos u objetos: flecha continua que sale de un nodo objeto o llega a uno.',
  },
];

const ALL = ACTIVITY_ELEMENT_TYPES.map(t => t.id.slice(NS.length + 1));
/** Nodos que pueden emitir (todo salvo finales y partición) y recibir (todo salvo el inicial y la partición). */
const SOURCES = ALL.filter(n => !['ActivityFinal', 'FlowFinal', 'Partition'].includes(n));
const TARGETS = ALL.filter(n => !['Initial', 'Partition'].includes(n));
/** Extremos que admiten flujo de objeto junto a un nodo objeto. */
const OBJECT_PEERS = ['Action', 'Decision', 'Fork', 'ObjectNode', 'SendSignal', 'AcceptEvent', 'ActivityFinal', 'FlowFinal'];

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  for (const s of ALL) {
    m[s] = {};
    if (!SOURCES.includes(s)) continue;
    for (const t of TARGETS) {
      const object = s === 'ObjectNode' || t === 'ObjectNode';
      if (object) { if ((s === 'ObjectNode' && OBJECT_PEERS.includes(t)) || (t === 'ObjectNode' && OBJECT_PEERS.includes(s))) m[s]![t] = [OBJECT_FLOW]; }
      else m[s]![t] = [CONTROL_FLOW];
    }
  }
  return m;
}

export const ACTIVITY_VALIDITY: ValidityMatrix = buildValidity();

export const ACTIVITY_NESTING: NestingRule[] = [{ parent: 'Partition', child: '*', relationTypes: [] }];

export const ACTIVITY_PACK: NotationPack = {
  id: NS,
  name: 'Actividad (UML)',
  version: '0.1.0',
  doc: 'Acciones, nodos de control (inicial, finales, decisión, bifurcación), nodos objeto, señales y particiones unidos por flujos de control y de objeto con guardas.',
  color: '#D79B00',
  viewKind: 'freeform',
  categories: [
    { id: CAT.actions, name: 'Acciones', order: 0 },
    { id: CAT.control, name: 'Control', order: 1 },
    { id: CAT.objects, name: 'Objetos', order: 2 },
    { id: CAT.signals, name: 'Señales', order: 3 },
    { id: CAT.partitions, name: 'Particiones', order: 4 },
  ],
  elementTypes: ACTIVITY_ELEMENT_TYPES,
  relationTypes: ACTIVITY_RELATION_TYPES,
  portTypes: [],
  validity: ACTIVITY_VALIDITY,
  viewpoints: [],
  nesting: ACTIVITY_NESTING,
  defaultRelation: CONTROL_FLOW,
};

export default ACTIVITY_PACK;
