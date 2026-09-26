/**
 * Pack `statechart`: máquinas de estados (UML/XState) como datos puros.
 *
 * Los estados compuestos y las regiones paralelas se modelan por anidamiento (contenedores en la
 * vista), no por relación: por eso todas las reglas de `nesting` llevan `relationTypes: []`.
 */
import type { NotationPack, ValidityMatrix, NestingRule } from '@all-draw/core';
import type { ElementType, RelationType } from '@all-draw/core';

const CAT = 'states';
const T = 'statechart:Transition';

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `statechart:${id}`, name, category: CAT, fields: [], ...extra,
});

export const STATECHART_ELEMENT_TYPES: ElementType[] = [
  el('State', 'Estado', {
    shape: 'rounded', container: true, color: '#FFF2CC', icon: 'state',
    doc: 'Estado atómico o compuesto (si contiene otros estados).',
    fields: [
      { key: 'entry', label: 'Entry', kind: 'textarea', doc: 'Acciones al entrar.' },
      { key: 'exit', label: 'Exit', kind: 'textarea', doc: 'Acciones al salir.' },
      { key: 'activities', label: 'Actividades', kind: 'list', port: false, doc: 'Actividades "do" mientras el estado está activo.' },
    ],
  }),
  el('Initial', 'Inicial', { shape: 'circle', color: '#000000', icon: 'initial', doc: 'Pseudoestado inicial; solo puede ser origen.' }),
  el('Final', 'Final', { shape: 'double-circle', color: '#000000', icon: 'final', doc: 'Estado final; solo puede ser destino.' }),
  el('Choice', 'Decisión', { shape: 'diamond', color: '#FFFFFF', icon: 'choice', doc: 'Pseudoestado de elección con guardas dinámicas.' }),
  el('Fork', 'Bifurcación', { shape: 'bar', color: '#000000', icon: 'fork', doc: 'Divide una transición hacia varias regiones.' }),
  el('Join', 'Unión', { shape: 'bar', color: '#000000', icon: 'join', doc: 'Sincroniza varias transiciones en una.' }),
  el('History', 'Historia', {
    shape: 'circle', color: '#FFFFFF', icon: 'history',
    doc: 'Pseudoestado de historia (H o H*).',
    fields: [{ key: 'deep', label: 'Profunda (H*)', kind: 'checkbox' }],
  }),
  el('Parallel', 'Región paralela', {
    shape: 'rect', container: true, color: '#E1D5E7', icon: 'parallel',
    doc: 'Región ortogonal: sus hijos se ejecutan concurrentemente. Borde discontinuo.',
    meta: { borderStyle: 'dashed' },
  }),
  el('Terminate', 'Terminar', { shape: 'circle', color: '#000000', icon: 'terminate', doc: 'Pseudoestado de terminación (X); solo puede ser destino.' }),
];

export const STATECHART_RELATION_TYPES: RelationType[] = [
  {
    id: T, name: 'Transición', category: CAT, line: 'solid', targetHead: 'arrow',
    doc: 'Etiqueta: evento [guarda] / acciones. `delay` para transiciones temporizadas (after), `internal` para las que no salen del estado.',
    fields: [
      { key: 'event', label: 'Evento', kind: 'text' },
      { key: 'guard', label: 'Guarda', kind: 'text' },
      { key: 'actions', label: 'Acciones', kind: 'list', port: false },
      { key: 'delay', label: 'Retardo', kind: 'text', doc: 'Transición temporizada (after 500ms).' },
      { key: 'internal', label: 'Interna', kind: 'checkbox' },
    ],
  },
];

const row = (...targets: string[]): Record<string, string[]> => Object.fromEntries(targets.map(t => [t, [T]]));

/**
 * Matriz de validez. Ausente = prohibido. Pseudoestados: Initial solo origen, Final/Terminate solo destino,
 * Fork reparte a varios estados, Join recibe de varios, Choice decide, History restaura un estado.
 */
export const STATECHART_VALIDITY: ValidityMatrix = {
  Initial: row('State', 'Choice', 'Fork'),
  State: row('State', 'Final', 'Choice', 'Fork', 'Join', 'Terminate', 'Parallel', 'History'),
  Parallel: row('State', 'Final', 'Choice', 'Fork', 'Join', 'Terminate', 'Parallel'),
  Choice: row('State', 'Final', 'Choice', 'Terminate', 'Parallel'),
  Fork: row('State', 'Parallel'),
  Join: row('State', 'Final', 'Choice', 'Terminate', 'Parallel'),
  History: row('State'),
  Final: {},
  Terminate: {},
};

const CHILDREN = ['State', 'Initial', 'Final', 'History', 'Choice', 'Fork', 'Join', 'Parallel', 'Terminate'];
export const STATECHART_NESTING: NestingRule[] = ['State', 'Parallel'].flatMap(parent =>
  CHILDREN.map(child => ({ parent, child, relationTypes: [] })),
);

export const STATECHART_PACK: NotationPack = {
  id: 'statechart',
  name: 'Máquina de estados',
  version: '0.1.0',
  doc: 'Máquinas de estados jerárquicas (UML statechart / XState). Los estados compuestos se expresan anidando estados dentro de un estado o de una región paralela.',
  color: '#D6B656',
  viewKind: 'freeform',
  categories: [{ id: CAT, name: 'Estados', order: 0 }],
  elementTypes: STATECHART_ELEMENT_TYPES,
  relationTypes: STATECHART_RELATION_TYPES,
  portTypes: [],
  validity: STATECHART_VALIDITY,
  viewpoints: [],
  nesting: STATECHART_NESTING,
  defaultRelation: T,
};

export default STATECHART_PACK;
