/**
 * Pack **libre**: figuras genéricas sin semántica (caja, elipse, rombo, cilindro, actor, nota,
 * grupo, texto) y cuatro conectores. No tiene matriz de validez: todo se puede unir con todo.
 * Es la notación por defecto de un lienzo sin notación y el tipo de respaldo de los importadores
 * cuando un elemento de origen no tiene tipo.
 */
import type { NotationPack, ElementType, RelationType } from '@all-draw/core';

const soft = {
  box: '#e2e8f0',      // pizarra clara
  ellipse: '#e0f2fe',  // cielo
  diamond: '#fef3c7',  // ámbar
  cylinder: '#ede9fe', // violeta
  actor: '#dcfce7',    // verde
  note: '#fef9c3',     // amarillo post-it
  group: '#f1f5f9',
  text: 'transparent',
} as const;

export const FREEFORM_ELEMENT_TYPES: ElementType[] = [
  {
    id: 'freeform:box', name: 'Caja', category: 'shapes', shape: 'rounded', color: soft.box, icon: '▭',
    fields: [{ key: 'description', label: 'Descripción', kind: 'textarea' }],
    doc: 'Rectángulo redondeado de propósito general.',
  },
  { id: 'freeform:ellipse', name: 'Elipse', category: 'shapes', shape: 'ellipse', color: soft.ellipse, icon: '○', fields: [] },
  { id: 'freeform:diamond', name: 'Rombo', category: 'shapes', shape: 'diamond', color: soft.diamond, icon: '◇', fields: [] },
  { id: 'freeform:cylinder', name: 'Cilindro', category: 'shapes', shape: 'cylinder', color: soft.cylinder, icon: '⛁', fields: [] },
  { id: 'freeform:actor', name: 'Actor', category: 'shapes', shape: 'actor', color: soft.actor, icon: '☺', fields: [] },
  { id: 'freeform:note', name: 'Nota', category: 'annotations', shape: 'note', color: soft.note, icon: '🗒', container: false, fields: [] },
  { id: 'freeform:group', name: 'Grupo', category: 'annotations', shape: 'group', color: soft.group, icon: '▢', container: true, fields: [] },
  { id: 'freeform:text', name: 'Texto', category: 'annotations', shape: 'label', color: soft.text, icon: 'T', fields: [] },
];

export const FREEFORM_RELATION_TYPES: RelationType[] = [
  { id: 'freeform:arrow', name: 'Flecha', category: 'connectors', line: 'solid', sourceHead: 'none', targetHead: 'arrow', fields: [] },
  { id: 'freeform:line', name: 'Línea', category: 'connectors', line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [] },
  { id: 'freeform:dashed', name: 'Discontinua', category: 'connectors', line: 'dashed', sourceHead: 'none', targetHead: 'arrow', fields: [] },
  { id: 'freeform:bidirectional', name: 'Bidireccional', category: 'connectors', line: 'solid', sourceHead: 'arrow', targetHead: 'arrow', fields: [] },
];

export const FREEFORM_PACK: NotationPack = {
  id: 'freeform',
  name: 'Libre',
  version: '1.0',
  doc: 'Figuras y conectores genéricos sin reglas: cualquier cosa se puede unir con cualquier cosa.',
  color: '#64748b',
  viewKind: 'freeform',
  categories: [
    { id: 'shapes', name: 'Figuras', order: 0 },
    { id: 'annotations', name: 'Anotaciones', order: 1 },
    { id: 'connectors', name: 'Conectores', order: 2 },
  ],
  elementTypes: FREEFORM_ELEMENT_TYPES,
  relationTypes: FREEFORM_RELATION_TYPES,
  portTypes: [],
  // sin `validity`: todo permitido
  viewpoints: [],
  defaultRelation: 'freeform:arrow',
};

export default FREEFORM_PACK;
