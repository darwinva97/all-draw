/**
 * Pack `sequence`: diagramas de secuencia (UML 2 / MSC) como datos puros.
 *
 * Declara `viewKind: 'sequence'` porque la vista natural ordena las líneas de vida en horizontal
 * y los mensajes en vertical por `order`. **El editor todavía no tiene ese renderizador: pinta
 * la vista como `freeform`** (cajas y flechas libres). Cuando exista, usará `Message.order`
 * para la posición vertical y `Lifeline.kind` para el icono de cabecera.
 *
 * Fragmentos (alt/opt/loop…) son contenedores: los mensajes que caen dentro pertenecen al
 * fragmento por anidamiento, no por relación (todas las reglas de `nesting` van vacías).
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType } from '@all-draw/core';

const NS = 'sequence';
const CAT = { participants: 'participants', control: 'control', annotations: 'annotations' } as const;
export const MESSAGE = `${NS}:Message`;
export const RETURN = `${NS}:Return`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

export const SEQUENCE_ELEMENT_TYPES: ElementType[] = [
  el('Lifeline', 'Línea de vida', CAT.participants, {
    shape: 'rect', color: '#DAE8FC', icon: '⌶',
    doc: 'Participante de la interacción: actor, objeto, sistema o componente. `kind` fija el estereotipo de cabecera (Robustness: boundary/control/entity).',
    fields: [
      { key: 'kind', label: 'Clase', kind: 'select', options: 'actor,boundary,control,entity,database,participant', required: true },
      { key: 'type', label: 'Tipo', kind: 'text', doc: 'Clase o tipo del participante ("pedido: Pedido").' },
      { key: 'stereotype', label: 'Estereotipo', kind: 'text' },
    ],
  }),
  el('Activation', 'Activación', CAT.control, {
    shape: 'bar', color: '#FFFFFF', icon: '▮',
    doc: 'Franja de ejecución sobre una línea de vida. Se anida dentro de la Lifeline a la que pertenece.',
    fields: [{ key: 'label', label: 'Etiqueta', kind: 'text' }],
  }),
  el('Fragment', 'Fragmento', CAT.control, {
    shape: 'group', container: true, color: '#F5F5F5', icon: '⧉',
    doc: 'Fragmento combinado (alt, opt, loop, par, break, critical, ref). Contiene por anidamiento los mensajes y activaciones que agrupa.',
    fields: [
      { key: 'kind', label: 'Operador', kind: 'select', options: 'alt,opt,loop,par,break,critical,ref', required: true },
      { key: 'condition', label: 'Condición', kind: 'text', doc: 'Guarda del operando ("[stock > 0]") o nombre del diagrama referido (ref).' },
    ],
  }),
  el('Note', 'Nota', CAT.annotations, {
    shape: 'note', color: '#FFF2CC', icon: '🗒',
    doc: 'Comentario anclado a una línea de vida o a un mensaje (con `core:link`).',
    fields: [{ key: 'text', label: 'Texto', kind: 'textarea' }],
  }),
];

export const SEQUENCE_RELATION_TYPES: RelationType[] = [
  {
    id: MESSAGE, name: 'Mensaje', category: CAT.control, line: 'solid', sourceHead: 'none', targetHead: 'arrow',
    doc: '`kind`: sync (cabeza llena), async (abierta), return (discontinua), create (a la cabecera), destroy (X). `order` fija la posición vertical.',
    fields: [
      { key: 'kind', label: 'Clase', kind: 'select', options: 'sync,async,return,create,destroy' },
      { key: 'order', label: 'Orden', kind: 'number', doc: 'Posición en la secuencia (1, 2, 3…).' },
      { key: 'text', label: 'Texto', kind: 'text', doc: 'Nombre de la operación o del mensaje ("crearPedido(items)").' },
    ],
  },
  {
    id: RETURN, name: 'Respuesta', category: CAT.control, line: 'dashed', sourceHead: 'none', targetHead: 'open',
    doc: 'Retorno explícito (flecha discontinua con cabeza abierta). Equivale a Mensaje con kind=return.',
    fields: [
      { key: 'order', label: 'Orden', kind: 'number' },
      { key: 'text', label: 'Texto', kind: 'text', doc: 'Valor devuelto.' },
    ],
  },
];

const BOTH = [MESSAGE, RETURN];
const row = (...targets: string[]): Record<string, string[]> => Object.fromEntries(targets.map(t => [t, BOTH]));

/** Mensajes solo entre participantes (líneas de vida o sus activaciones). Notas y fragmentos no envían nada. */
export const SEQUENCE_VALIDITY: ValidityMatrix = {
  Lifeline: row('Lifeline', 'Activation'),
  Activation: row('Lifeline', 'Activation'),
  Fragment: {},
  Note: {},
};

export const SEQUENCE_NESTING: NestingRule[] = [
  { parent: 'Lifeline', child: 'Activation', relationTypes: [] },
  { parent: 'Activation', child: 'Activation', relationTypes: [] },
  { parent: 'Fragment', child: '*', relationTypes: [] },
];

export const SEQUENCE_PACK: NotationPack = {
  id: NS,
  name: 'Diagrama de secuencia',
  version: '0.1.0',
  doc: 'Interacciones ordenadas en el tiempo entre líneas de vida. Vista de clase `sequence` (el editor la pinta de momento como freeform).',
  color: '#6C8EBF',
  viewKind: 'sequence',
  categories: [
    { id: CAT.participants, name: 'Participantes', order: 0 },
    { id: CAT.control, name: 'Interacción', order: 1 },
    { id: CAT.annotations, name: 'Anotaciones', order: 2 },
  ],
  elementTypes: SEQUENCE_ELEMENT_TYPES,
  relationTypes: SEQUENCE_RELATION_TYPES,
  portTypes: [],
  validity: SEQUENCE_VALIDITY,
  viewpoints: [],
  nesting: SEQUENCE_NESTING,
  defaultRelation: MESSAGE,
};

export default SEQUENCE_PACK;
