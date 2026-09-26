/**
 * Pack `er`: modelo entidad-relación (Chen / notación de tablas) como datos puros.
 *
 * Una `Entity` lleva sus atributos en un campo `keyvalue` ("Atributo|Tipo") con `port: true`,
 * así cada atributo es un pin al que se puede conectar una relación (clave foránea → clave
 * primaria). `Attribute` existe como elemento suelto para el estilo Chen (óvalos alrededor de
 * la entidad).
 *
 * **Cardinalidades.** `ArrowHead` no tiene pata de gallo (crow's foot): se aproxima con las
 * cabezas existentes (`circle` = uno, `arrow` = muchos, `triangle` = herencia) y los campos
 * `sourceCard` / `targetCard` guardan la cardinalidad textual ("0..1", "1..*"). Cuando el
 * editor añada la cabeza `crow` bastará cambiar `sourceHead`/`targetHead` aquí.
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

const cardFields: FieldDef[] = [
  { key: 'sourceCard', label: 'Cardinalidad origen', kind: 'text', doc: '"1", "0..1", "1..*", "0..*".' },
  { key: 'targetCard', label: 'Cardinalidad destino', kind: 'text' },
  { key: 'identifying', label: 'Identificativa', kind: 'checkbox', doc: 'La clave del hijo incluye la del padre (línea continua en Crow\'s Foot).' },
  { key: 'onDelete', label: 'Al borrar', kind: 'select', options: 'no action,cascade,set null,restrict' },
];

export const ER_RELATION_TYPES: RelationType[] = [
  { id: ONE_TO_ONE, name: 'Uno a uno', category: CAT.relations, line: 'solid', sourceHead: 'circle', targetHead: 'circle', fields: cardFields, doc: '1:1. Cabeza `circle` en ambos extremos (aproximación sin pata de gallo).', meta: { cardinality: '1:1' } },
  { id: ONE_TO_MANY, name: 'Uno a muchos', category: CAT.relations, line: 'solid', sourceHead: 'circle', targetHead: 'arrow', fields: cardFields, doc: '1:N. Origen = lado uno (`circle`), destino = lado muchos (`arrow`).', meta: { cardinality: '1:N' } },
  { id: MANY_TO_MANY, name: 'Muchos a muchos', category: CAT.relations, line: 'solid', sourceHead: 'arrow', targetHead: 'arrow', fields: cardFields, doc: 'N:M. Se resuelve en físico con una tabla intermedia.', meta: { cardinality: 'N:M' } },
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
  doc: 'Modelo entidad-relación (conceptual, lógico o físico). Los atributos de una entidad son puertos; falta la cabeza "pata de gallo" en el editor.',
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
