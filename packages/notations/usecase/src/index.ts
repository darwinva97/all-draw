/**
 * Pack `usecase`: diagrama de casos de uso de UML 2.5 como datos puros.
 *
 * - **Actor** (monigote) fuera del límite; **Caso de uso** (elipse) dentro del **Sistema** (límite, contenedor con el
 *   nombre arriba); **Paquete** (carpeta con pestaña) para agrupar.
 * - Relaciones: asociación actor ↔ caso de uso (línea continua), «include» y «extend» entre casos de uso (discontinuas
 *   con flecha abierta; el rótulo «…» lo pinta el lienzo desde `meta.keyword`), generalización entre actores o entre
 *   casos de uso y dependencia entre paquetes.
 * - La flecha de «extend» va del caso que **extiende** al caso **base**; la de «include», del base al incluido.
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType } from '@all-draw/core';

const NS = 'usecase';
export const USECASE_PACK_ID = NS;
const CAT = { actors: 'actors', usecases: 'usecases', structure: 'structure', relations: 'relations' } as const;
export const ASSOCIATION = `${NS}:Association`;
export const INCLUDE = `${NS}:Include`;
export const EXTEND = `${NS}:Extend`;
export const GENERALIZATION = `${NS}:Generalization`;
export const DEPENDENCY = `${NS}:Dependency`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

export const USECASE_ELEMENT_TYPES: ElementType[] = [
  el('Actor', 'Actor', CAT.actors, {
    shape: 'actor', color: '#FFFFFF', icon: '☺',
    doc: 'Rol que desempeña una persona, un sistema externo o un temporizador al interactuar con el sistema. Se dibuja como monigote, fuera del límite del sistema.',
    fields: [
      { key: 'kind', label: 'Tipo de actor', kind: 'select', options: 'person,system,time', optionLabels: { person: 'Persona', system: 'Sistema externo', time: 'Tiempo (temporizador)' } },
      { key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«system», «device»… (vacío para un actor humano).' },
    ],
  }),
  el('UseCase', 'Caso de uso', CAT.usecases, {
    shape: 'ellipse', color: '#FFF8E1',
    doc: 'Objetivo que un actor alcanza con el sistema ("Realizar pedido"). Elipse con el nombre dentro; va dentro del límite del sistema.',
    fields: [
      { key: 'extensionPoints', label: 'Puntos de extensión', kind: 'list', port: false, doc: 'Uno por línea: los puntos donde un «extend» puede añadir comportamiento.' },
      { key: 'precondition', label: 'Precondición', kind: 'textarea' },
      { key: 'postcondition', label: 'Postcondición', kind: 'textarea' },
    ],
  }),
  el('System', 'Sistema (límite)', CAT.structure, {
    shape: 'rect', container: true, color: '#FFFFFF',
    doc: 'Límite del sistema (subject): rectángulo con el nombre arriba que contiene los casos de uso. Los actores quedan fuera.',
  }),
  el('Package', 'Paquete', CAT.structure, {
    shape: 'group', container: true, color: '#F5F5F5', icon: '▱',
    doc: 'Carpeta con pestaña que agrupa casos de uso, actores u otros paquetes.',
  }),
];

export const USECASE_RELATION_TYPES: RelationType[] = [
  {
    id: ASSOCIATION, name: 'Asociación', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [],
    doc: 'Comunicación entre un actor y un caso de uso: línea continua sin flecha.',
  },
  {
    id: INCLUDE, name: 'Inclusión', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', fields: [], meta: { keyword: '«include»' },
    doc: 'El caso de uso origen incluye siempre el comportamiento del destino: flecha discontinua rotulada «include».',
  },
  {
    id: EXTEND, name: 'Extensión', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', meta: { keyword: '«extend»' },
    doc: 'El caso de uso origen añade comportamiento opcional al caso base (destino) en un punto de extensión: flecha discontinua rotulada «extend».',
    fields: [
      { key: 'extensionPoint', label: 'Punto de extensión', kind: 'text', doc: 'Uno de los puntos de extensión del caso base.' },
      { key: 'condition', label: 'Condición', kind: 'text', doc: 'Cuándo se aplica la extensión ("[cupón válido]").' },
    ],
  },
  {
    id: GENERALIZATION, name: 'Generalización', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'triangle', fields: [],
    doc: 'El actor o caso de uso origen es una especialización del destino (triángulo hueco).',
  },
  {
    id: DEPENDENCY, name: 'Dependencia', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open',
    fields: [{ key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«import», «access»…' }],
    doc: 'Un paquete usa o importa el contenido de otro.',
  },
];

export const USECASE_VALIDITY: ValidityMatrix = {
  Actor: { Actor: [GENERALIZATION], UseCase: [ASSOCIATION] },
  UseCase: { Actor: [ASSOCIATION], UseCase: [INCLUDE, EXTEND, GENERALIZATION] },
  System: {},
  Package: { Package: [DEPENDENCY] },
};

export const USECASE_NESTING: NestingRule[] = [
  { parent: 'System', child: 'UseCase', relationTypes: [] },
  { parent: 'Package', child: '*', relationTypes: [] },
];

export const USECASE_PACK: NotationPack = {
  id: NS,
  name: 'Casos de uso (UML)',
  version: '0.1.0',
  doc: 'Actores, casos de uso, límite del sistema y paquetes con asociación, «include», «extend», generalización y dependencia.',
  color: '#B85450',
  viewKind: 'freeform',
  categories: [
    { id: CAT.actors, name: 'Actores', order: 0 },
    { id: CAT.usecases, name: 'Casos de uso', order: 1 },
    { id: CAT.structure, name: 'Estructura', order: 2 },
    { id: CAT.relations, name: 'Relaciones', order: 3 },
  ],
  elementTypes: USECASE_ELEMENT_TYPES,
  relationTypes: USECASE_RELATION_TYPES,
  portTypes: [],
  validity: USECASE_VALIDITY,
  viewpoints: [],
  nesting: USECASE_NESTING,
  defaultRelation: ASSOCIATION,
};

export default USECASE_PACK;
