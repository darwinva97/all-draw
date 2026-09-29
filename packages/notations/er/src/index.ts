/**
 * Pack `er`: modelo entidad-relación (Chen / notación de tablas) como datos puros.
 *
 * Una `Entity` lleva sus atributos en un campo `keyvalue` ("Atributo|Tipo") con `port: true`,
 * así cada atributo es un pin al que se puede conectar una relación (clave foránea → clave
 * primaria). `Attribute` existe como elemento suelto para el estilo Chen (óvalos alrededor de
 * la entidad).
 *
 * **Cardinalidades (pata de gallo / Information Engineering).** Cada tipo trae sus cabezas IE
 * (`only-one`, `one-or-many`…). Los campos select `sourceCard` / `targetCard` las sustituyen por
 * relación: `1` = uno (barra), `1..1` = uno y solo uno (doble barra), `0..1` = cero o uno
 * (círculo + barra), `*` = muchos (pata), `1..*` = uno o muchos (barra + pata), `0..*` = cero o
 * muchos (círculo + pata). El editor y los exportadores (SVG, draw.io, Mermaid `erDiagram`) los leen.
 */
import type { NotationPack, ValidityMatrix, ElementType, RelationType, FieldDef } from '@all-draw/core';

const NS = 'er';
const CAT = { model: 'model', relations: 'relations' } as const;
export const ONE_TO_ONE = `${NS}:OneToOne`;
export const ONE_TO_MANY = `${NS}:OneToMany`;
export const MANY_TO_MANY = `${NS}:ManyToMany`;
export const INHERITS = `${NS}:Inherits`;
export const HAS = `${NS}:Has`;

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category: CAT.model, fields: [], ...extra,
});

export const ER_ELEMENT_TYPES: ElementType[] = [
  el('Entity', 'Entidad', {
    shape: 'rect', container: false, color: '#DAE8FC', icon: '▤',
    doc: 'Entidad / tabla. Cada atributo es un puerto: las relaciones pueden unir atributo con atributo (FK → PK).',
    fields: [
      { key: 'attributes', label: 'Atributos', kind: 'keyvalue', options: 'Atributo|Tipo', port: true, portTypeId: 'er:attribute', doc: 'Nombre y tipo de cada atributo.' },
      { key: 'pk', label: 'Clave primaria', kind: 'list', port: false, doc: 'Atributos que forman la clave primaria.' },
      { key: 'weak', label: 'Entidad débil', kind: 'checkbox', doc: 'Depende de otra entidad para identificarse (doble borde).' },
      { key: 'table', label: 'Tabla física', kind: 'text', doc: 'Nombre de la tabla en el modelo físico.' },
    ],
  }),
  el('Attribute', 'Atributo', {
    shape: 'ellipse', color: '#FFFFFF', icon: '○',
    doc: 'Atributo suelto (estilo Chen). Se une a su entidad con `er:Has`.',
    fields: [
      { key: 'type', label: 'Tipo', kind: 'text' },
      { key: 'key', label: 'Clave', kind: 'select', options: 'none,pk,fk,unique' },
      { key: 'nullable', label: 'Nulo', kind: 'checkbox' },
    ],
  }),
  el('View', 'Vista', {
    shape: 'rounded', color: '#F5F5F5', icon: '◫',
    doc: 'Vista de base de datos: consulta sobre una o más entidades (`er:Has` hacia las entidades que usa).',
    fields: [
      { key: 'query', label: 'Consulta', kind: 'textarea' },
      { key: 'materialized', label: 'Materializada', kind: 'checkbox' },
    ],
    meta: { borderStyle: 'dashed' },
  }),
];

/** Valores de `sourceCard`/`targetCard` → cabeza IE que dibujan. */
export const CARDINALITIES = { '1': 'one', '1..1': 'only-one', '0..1': 'zero-or-one', '*': 'many', '1..*': 'one-or-many', '0..*': 'zero-or-many' } as const;
const CARD_OPTIONS = Object.keys(CARDINALITIES).join(',');
const CARD_DOC = 'Sustituye la cabeza de este extremo: 1 = uno (barra), 1..1 = uno y solo uno (doble barra), 0..1 = cero o uno, * = muchos (pata de gallo), 1..* = uno o muchos, 0..* = cero o muchos.';

const cardFields: FieldDef[] = [
  { key: 'sourceCard', label: 'Cardinalidad origen', kind: 'select', options: CARD_OPTIONS, doc: CARD_DOC },
  { key: 'targetCard', label: 'Cardinalidad destino', kind: 'select', options: CARD_OPTIONS, doc: CARD_DOC },
  { key: 'identifying', label: 'Identificativa', kind: 'checkbox', doc: 'La clave del hijo incluye la del padre (línea continua en Crow\'s Foot).' },
  { key: 'onDelete', label: 'Al borrar', kind: 'select', options: 'no action,cascade,set null,restrict' },
];

export const ER_RELATION_TYPES: RelationType[] = [
  { id: ONE_TO_ONE, name: 'Uno a uno', category: CAT.relations, line: 'solid', sourceHead: 'only-one', targetHead: 'only-one', fields: cardFields, doc: '1:1. Doble barra (uno y solo uno) en ambos extremos.', meta: { cardinality: '1:1' } },
  { id: ONE_TO_MANY, name: 'Uno a muchos', category: CAT.relations, line: 'solid', sourceHead: 'only-one', targetHead: 'one-or-many', fields: cardFields, doc: '1:N. Origen = lado uno (doble barra), destino = lado muchos (barra + pata de gallo).', meta: { cardinality: '1:N' } },
  { id: MANY_TO_MANY, name: 'Muchos a muchos', category: CAT.relations, line: 'solid', sourceHead: 'one-or-many', targetHead: 'one-or-many', fields: cardFields, doc: 'N:M (uno o muchos en ambos extremos). Se resuelve en físico con una tabla intermedia.', meta: { cardinality: 'N:M' } },
  { id: INHERITS, name: 'Hereda', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'triangle', fields: [{ key: 'kind', label: 'Estrategia', kind: 'select', options: 'single table,joined,table per class' }], doc: 'Especialización / generalización (subtipo → supertipo).' },
  { id: HAS, name: 'Tiene', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [], doc: 'Entidad → Atributo (estilo Chen) y Vista → Entidad (la vista se apoya en ella).' },
];

const CARD = [ONE_TO_ONE, ONE_TO_MANY, MANY_TO_MANY];
export const ER_VALIDITY: ValidityMatrix = {
  Entity: { Entity: [...CARD, INHERITS], Attribute: [HAS] },
  View: { Entity: [HAS], View: [HAS] },
  Attribute: {},
};

export const ER_PACK: NotationPack = {
  id: NS,
  name: 'Entidad-relación',
  version: '0.1.0',
  doc: 'Modelo entidad-relación (conceptual, lógico o físico). Los atributos de una entidad son puertos; las relaciones usan la notación de pata de gallo (Information Engineering) con cardinalidad por extremo.',
  color: '#6C8EBF',
  viewKind: 'freeform',
  categories: [
    { id: CAT.model, name: 'Modelo', order: 0 },
    { id: CAT.relations, name: 'Relaciones', order: 1 },
  ],
  elementTypes: ER_ELEMENT_TYPES,
  relationTypes: ER_RELATION_TYPES,
  portTypes: [{ id: 'er:attribute', name: 'Atributo', doc: 'Puerto derivado de cada atributo de una entidad.' }],
  validity: ER_VALIDITY,
  portRules: [{ from: 'er:attribute', to: 'er:attribute', relationTypes: CARD }],
  viewpoints: [
    { id: 'conceptual', name: 'Conceptual', doc: 'Entidades y relaciones sin tipos físicos.', elementTypes: [`${NS}:Entity`, `${NS}:Attribute`] },
    { id: 'logical', name: 'Lógico', doc: 'Entidades con atributos tipados.', elementTypes: [`${NS}:Entity`] },
    { id: 'physical', name: 'Físico', doc: 'Tablas y vistas.', elementTypes: [`${NS}:Entity`, `${NS}:View`] },
  ],
  defaultRelation: ONE_TO_MANY,
};

export default ER_PACK;
