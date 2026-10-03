/**
 * Pack de diagrama de clases UML 2 (paquete `@all-draw/notation-uml-class`) como datos puros.
 *
 * **El id del pack es `uml`, no `uml-class`**: `NotationRegistry.notationOf('uml:Class')` deriva
 * la notación del prefijo del tipo, y la matriz de validez y `View.notationId` se resuelven por
 * ese id. Así los tipos se llaman `uml:Class`, `uml:Interface`… y otros diagramas UML futuros
 * pueden compartir el prefijo.
 *
 * Compartimentos (`meta.compartments`): el lienzo y el SVG pintan nombre (con «estereotipo», en cursiva si es
 * abstracta), atributos y operaciones; cada atributo es un pin alineado con su fila.
 *
 * Matriz: Generalization solo entre tipos del mismo kind (Class→Class, Interface→Interface);
 * Realization solo Class→Interface; Package solo participa en Dependency.
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType, FieldDef } from '@all-draw/core';

const NS = 'uml';
/** Id con el que la app y el catálogo registran este pack (`UML_CLASS_PACK.id`). */
export const UML_CLASS_PACK_ID = NS;
const CAT = { classifiers: 'classifiers', relations: 'relations' } as const;
export const ASSOCIATION = `${NS}:Association`;
export const AGGREGATION = `${NS}:Aggregation`;
export const COMPOSITION = `${NS}:Composition`;
export const GENERALIZATION = `${NS}:Generalization`;
export const REALIZATION = `${NS}:Realization`;
export const DEPENDENCY = `${NS}:Dependency`;

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category: CAT.classifiers, fields: [], ...extra,
});

const stereotype: FieldDef = { key: 'stereotype', label: 'Estereotipo', kind: 'text', doc: '«entity», «service», «dto»…' };
const operations: FieldDef = { key: 'operations', label: 'Operaciones', kind: 'list', port: false, doc: 'Una por línea: "+ crear(pedido: Pedido): void".' };

export const UML_CLASS_ELEMENT_TYPES: ElementType[] = [
  el('Class', 'Clase', {
    shape: 'rect', color: '#FFFFCC', icon: 'C',
    doc: 'Clase con compartimentos de atributos y operaciones. Los atributos son puertos (para asociaciones campo a campo).',
    fields: [
      stereotype,
      { key: 'abstract', label: 'Abstracta', kind: 'checkbox' },
      { key: 'attributes', label: 'Atributos', kind: 'list', doc: 'Una por línea: "- nombre: String".' },
      operations,
    ],
    meta: { compartments: { sections: ['attributes', 'operations'], stereotype: 'stereotype', abstract: 'abstract' } },
  }),
  el('Interface', 'Interfaz', {
    shape: 'rect', color: '#E1F5FE', icon: 'I',
    doc: 'Interfaz («interface»): solo operaciones. Las clases la realizan.',
    fields: [stereotype, operations],
    meta: { stereotypeDefault: 'interface', compartments: { sections: ['operations'], stereotype: 'stereotype' } },
  }),
  el('Enum', 'Enumeración', {
    shape: 'rect', color: '#E8F5E9', icon: 'E',
    doc: 'Enumeración («enumeration») con sus literales.',
    fields: [{ key: 'values', label: 'Valores', kind: 'list', port: false }],
    meta: { stereotypeDefault: 'enumeration', compartments: { sections: ['values'] } },
  }),
  el('Package', 'Paquete', {
    shape: 'group', container: true, color: '#F5F5F5', icon: '▱',
    doc: 'Paquete / namespace. Contiene clasificadores por anidamiento.',
    fields: [{ key: 'namespace', label: 'Namespace', kind: 'text' }],
  }),
];

/** Extremos de asociación: multiplicidad y rol se pintan junto a cada extremo (texto libre). */
const endFields: FieldDef[] = [
  { key: 'sourceCard', label: 'Multiplicidad origen', kind: 'text', doc: '"1", "0..1", "*", "1..*", "0..*" (se rotula junto al extremo origen).' },
  { key: 'sourceRole', label: 'Rol origen', kind: 'text', doc: 'Nombre del extremo origen (se rotula al otro lado de la línea).' },
  { key: 'targetCard', label: 'Multiplicidad destino', kind: 'text', doc: '"1", "0..1", "*", "1..*", "0..*" (se rotula junto al extremo destino).' },
  { key: 'targetRole', label: 'Rol destino', kind: 'text' },
  { key: 'navigable', label: 'Navegable', kind: 'select', options: 'target,source,both,none', optionLabels: { target: 'Hacia el destino', source: 'Hacia el origen', both: 'En ambos sentidos', none: 'Ninguno' } },
];

export const UML_CLASS_RELATION_TYPES: RelationType[] = [
  { id: ASSOCIATION, name: 'Asociación', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: endFields, doc: 'Asociación (flecha abierta en el extremo navegable si `navigable` lo indica).' },
  { id: AGGREGATION, name: 'Agregación', category: CAT.relations, line: 'solid', sourceHead: 'diamond', targetHead: 'none', fields: endFields, doc: 'Todo (origen, rombo hueco) → parte (destino).' },
  { id: COMPOSITION, name: 'Composición', category: CAT.relations, line: 'solid', sourceHead: 'filled-diamond', targetHead: 'none', fields: endFields, doc: 'Todo (origen, rombo lleno) → parte (destino); la parte no sobrevive al todo.' },
  { id: GENERALIZATION, name: 'Generalización', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'triangle', fields: [], doc: 'Subclase → superclase. Solo entre clasificadores del mismo kind.' },
  { id: REALIZATION, name: 'Realización', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'triangle', fields: [], doc: 'Clase → interfaz que implementa.' },
  { id: DEPENDENCY, name: 'Dependencia', category: CAT.relations, line: 'dashed', sourceHead: 'none', targetHead: 'open', fields: [{ ...stereotype, doc: '«use», «import», «create»…' }], doc: 'Dependencia genérica (usa, importa, crea).' },
];

const STRUCT = [ASSOCIATION, AGGREGATION, COMPOSITION];
export const UML_CLASS_VALIDITY: ValidityMatrix = {
  Class: {
    Class: [...STRUCT, GENERALIZATION, DEPENDENCY],
    Interface: [ASSOCIATION, REALIZATION, DEPENDENCY],
    Enum: [...STRUCT, DEPENDENCY],
    Package: [DEPENDENCY],
  },
  Interface: {
    Class: [DEPENDENCY],
    Interface: [ASSOCIATION, GENERALIZATION, DEPENDENCY],
    Enum: [DEPENDENCY],
    Package: [DEPENDENCY],
  },
  Enum: { Class: [DEPENDENCY], Interface: [DEPENDENCY], Enum: [DEPENDENCY], Package: [DEPENDENCY] },
  Package: { Class: [DEPENDENCY], Interface: [DEPENDENCY], Enum: [DEPENDENCY], Package: [DEPENDENCY] },
};

export const UML_CLASS_NESTING: NestingRule[] = [{ parent: 'Package', child: '*', relationTypes: [] }];

export const UML_CLASS_PACK: NotationPack = {
  id: NS,
  name: 'Diagrama de clases (UML)',
  version: '0.1.0',
  doc: 'Clases, interfaces, enumeraciones y paquetes con asociación, agregación, composición, generalización, realización y dependencia.',
  color: '#D6B656',
  viewKind: 'freeform',
  categories: [
    { id: CAT.classifiers, name: 'Clasificadores', order: 0 },
    { id: CAT.relations, name: 'Relaciones', order: 1 },
  ],
  elementTypes: UML_CLASS_ELEMENT_TYPES,
  relationTypes: UML_CLASS_RELATION_TYPES,
  portTypes: [],
  validity: UML_CLASS_VALIDITY,
  viewpoints: [],
  nesting: UML_CLASS_NESTING,
  defaultRelation: ASSOCIATION,
};

export default UML_CLASS_PACK;
