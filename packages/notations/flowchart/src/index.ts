/**
 * Pack `flowchart`: diagrama de flujo clásico (ISO 5807 / ANSI) como datos puros.
 *
 * Una sola relación, `flow:Arrow`, con `label` para las salidas de una decisión ("sí"/"no").
 * Matriz: todo con todo salvo que `End` no puede ser origen y `Start` no puede ser destino.
 * `Connector` (círculo) enlaza tramos alejados de la misma página o de otra.
 */
import type { NotationPack, ValidityMatrix, ElementType, RelationType } from '@all-draw/core';

const NS = 'flow';
const CAT = { terminals: 'terminals', steps: 'steps', data: 'data' } as const;
export const ARROW = `${NS}:Arrow`;

const el = (id: string, name: string, category: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category, fields: [], ...extra,
});

const description = { key: 'description', label: 'Descripción', kind: 'textarea' } as const;

export const FLOWCHART_ELEMENT_TYPES: ElementType[] = [
  el('Start', 'Inicio', CAT.terminals, { shape: 'rounded', color: '#D5E8D4', icon: '▶', doc: 'Terminal de inicio; solo puede ser origen.', fields: [] }),
  el('End', 'Fin', CAT.terminals, { shape: 'rounded', color: '#F8CECC', icon: '■', doc: 'Terminal de fin; solo puede ser destino.', fields: [] }),
  el('Process', 'Proceso', CAT.steps, { shape: 'rect', color: '#DAE8FC', icon: '▭', doc: 'Paso o acción.', fields: [description] }),
  el('Decision', 'Decisión', CAT.steps, { shape: 'diamond', color: '#FFF2CC', icon: '◇', doc: 'Pregunta con varias salidas; etiqueta cada flecha (`label`).', fields: [{ key: 'question', label: 'Pregunta', kind: 'text' }] }),
  el('IO', 'Entrada/Salida', CAT.data, { shape: 'parallelogram', color: '#E1D5E7', icon: '▱', doc: 'Entrada o salida de datos.', fields: [{ key: 'direction', label: 'Sentido', kind: 'select', options: 'input,output,both' }] }),
  el('Document', 'Documento', CAT.data, { shape: 'note', color: '#FFFFFF', icon: '🗎', doc: 'Documento o informe producido/consumido.', fields: [description] }),
  el('Database', 'Base de datos', CAT.data, { shape: 'cylinder', color: '#F5F5F5', icon: '⛁', doc: 'Almacén de datos.', fields: [{ key: 'technology', label: 'Tecnología', kind: 'text' }] }),
  el('Connector', 'Conector', CAT.terminals, { shape: 'circle', color: '#FFFFFF', icon: '○', doc: 'Conector de página: une tramos sin cruzar flechas por todo el diagrama.', fields: [{ key: 'ref', label: 'Referencia', kind: 'text', doc: 'Letra o número compartido por los dos conectores emparejados.' }] }),
  el('Subroutine', 'Subrutina', CAT.steps, { shape: 'rect', color: '#DAE8FC', icon: '▣', doc: 'Proceso predefinido (doble borde lateral); detállalo en una vista cuyo `rootElementId` sea este elemento.', fields: [description], meta: { doubleBorder: true } }),
];

export const FLOWCHART_RELATION_TYPES: RelationType[] = [
  { id: ARROW, name: 'Flecha', category: CAT.steps, line: 'solid', sourceHead: 'none', targetHead: 'arrow', fields: [{ key: 'label', label: 'Etiqueta', kind: 'text', doc: 'Sí / No / condición.' }], doc: 'Flujo de control.' },
];

const LOCAL = FLOWCHART_ELEMENT_TYPES.map(t => t.id.slice(NS.length + 1));

function buildValidity(): ValidityMatrix {
  const m: ValidityMatrix = {};
  for (const s of LOCAL) {
    m[s] = {};
    if (s === 'End') continue;
    for (const t of LOCAL) if (t !== 'Start') m[s]![t] = [ARROW];
  }
  return m;
}

export const FLOWCHART_VALIDITY: ValidityMatrix = buildValidity();

export const FLOWCHART_PACK: NotationPack = {
  id: NS,
  name: 'Diagrama de flujo',
  version: '0.1.0',
  doc: 'Diagrama de flujo clásico: inicio/fin, proceso, decisión, entrada/salida, documento, base de datos, conector y subrutina.',
  color: '#82B366',
  viewKind: 'freeform',
  categories: [
    { id: CAT.terminals, name: 'Terminales', order: 0 },
    { id: CAT.steps, name: 'Pasos', order: 1 },
    { id: CAT.data, name: 'Datos', order: 2 },
  ],
  elementTypes: FLOWCHART_ELEMENT_TYPES,
  relationTypes: FLOWCHART_RELATION_TYPES,
  portTypes: [],
  validity: FLOWCHART_VALIDITY,
  viewpoints: [],
  defaultRelation: ARROW,
};

export default FLOWCHART_PACK;
