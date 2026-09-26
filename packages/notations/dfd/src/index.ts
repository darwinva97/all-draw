/**
 * Pack `dfd`: diagrama de flujo de datos (Yourdon/DeMarco y Gane-Sarson) como datos puros.
 *
 * Tres elementos (proceso, almacén, entidad externa) y un flujo etiquetado con los datos que
 * transporta. La descomposición por niveles (contexto → nivel 1 → nivel 2…) **no** es anidamiento:
 * se hace con vistas de detalle cuyo `rootElementId` es el proceso que explotan, y `Process.number`
 * lleva la numeración jerárquica ("1", "1.2", "1.2.3").
 *
 * Matriz (regla clásica): los flujos siempre tocan un proceso; ni externo↔externo, ni
 * almacén↔almacén, ni externo↔almacén.
 */
import type { NotationPack, ValidityMatrix, ElementType, RelationType } from '@all-draw/core';

const NS = 'dfd';
const CAT = 'dfd';
export const FLOW = `${NS}:Flow`;

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category: CAT, fields: [], ...extra,
});

export const DFD_ELEMENT_TYPES: ElementType[] = [
  el('Process', 'Proceso', {
    shape: 'circle', color: '#DAE8FC', icon: '◯',
    doc: 'Transforma entradas en salidas. Círculo en Yourdon, rectángulo redondeado en Gane-Sarson (`style.figure` = 1). Se explota en una vista de detalle.',
    fields: [
      { key: 'number', label: 'Número', kind: 'text', doc: 'Numeración jerárquica: "0" para el contexto, "1", "1.2"…' },
      { key: 'description', label: 'Descripción', kind: 'textarea' },
    ],
    meta: { altShape: 'rounded' },
  }),
  el('DataStore', 'Almacén de datos', {
    shape: 'bar', color: '#F5F5F5', icon: '▭',
    doc: 'Datos en reposo (fichero, tabla, cola). Dos líneas paralelas abiertas (Yourdon) o caja con etiqueta D1 (Gane-Sarson).',
    fields: [{ key: 'number', label: 'Identificador', kind: 'text', doc: '"D1", "D2"…' }],
  }),
  el('External', 'Entidad externa', {
    shape: 'rect', color: '#FFE6CC', icon: '▢',
    doc: 'Origen o destino de datos fuera del sistema (persona, organización, otro sistema).',
    fields: [{ key: 'kind', label: 'Clase', kind: 'select', options: 'person,organization,system' }],
  }),
];

export const DFD_RELATION_TYPES: RelationType[] = [
  {
    id: FLOW, name: 'Flujo de datos', category: CAT, line: 'solid', sourceHead: 'none', targetHead: 'arrow',
    doc: 'Datos en movimiento. `data` nombra el paquete que viaja ("pedido validado").',
    fields: [{ key: 'data', label: 'Datos', kind: 'text', port: false, required: true }],
  },
];

export const DFD_VALIDITY: ValidityMatrix = {
  Process: { Process: [FLOW], DataStore: [FLOW], External: [FLOW] },
  DataStore: { Process: [FLOW] },
  External: { Process: [FLOW] },
};

export const DFD_PACK: NotationPack = {
  id: NS,
  name: 'Flujo de datos (DFD)',
  version: '0.1.0',
  doc: 'Procesos, almacenes y entidades externas unidos por flujos de datos. Niveles por vistas de detalle, no por anidamiento.',
  color: '#6C8EBF',
  viewKind: 'freeform',
  categories: [{ id: CAT, name: 'Flujo de datos', order: 0 }],
  elementTypes: DFD_ELEMENT_TYPES,
  relationTypes: DFD_RELATION_TYPES,
  portTypes: [],
  validity: DFD_VALIDITY,
  viewpoints: [
    { id: 'context', name: 'Contexto (nivel 0)', doc: 'Un único proceso y las entidades externas.', elementTypes: [`${NS}:Process`, `${NS}:External`] },
  ],
  defaultRelation: FLOW,
};

export default DFD_PACK;
