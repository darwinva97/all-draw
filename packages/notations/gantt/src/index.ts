/**
 * Pack `gantt`: diagrama de Gantt como datos puros.
 *
 * La vista natural es `viewKind: 'gantt'`: una fila por tarea y barras sobre una línea de tiempo (días, semanas o
 * meses) **calculadas de los campos** (`start`, `end` o `duration`), no de la posición del nodo. Arrastrar una barra
 * cambia sus fechas y estirarla cambia la duración; las dependencias se dibujan como flechas en codo.
 *
 * Convenciones de fechas (ISO `AAAA-MM-DD`, días naturales):
 *  - `start` es el primer día y `end` el último (inclusivo): una tarea de un día tiene `start === end`.
 *  - Si falta `end`, sale de `duration` (días); si falta `start`, de `end` y `duration`, o de sus predecesoras.
 *  - Un **hito** tiene solo `start` (duración 0) y se pinta como rombo al principio de ese día.
 *  - Una **fase** (grupo) abarca de la primera a la última fecha de lo que contiene (barra resumen).
 * Dependencias: FS (fin → inicio, la habitual), SS, FF, SF, con un desfase opcional en días.
 */
import type { NotationPack, ValidityMatrix, NestingRule, ElementType, RelationType } from '@all-draw/core';

const NS = 'gantt';
export const GANTT_PACK_ID = NS;
const CAT = { schedule: 'schedule', relations: 'relations' } as const;
export const TASK = `${NS}:Task`;
export const MILESTONE = `${NS}:Milestone`;
export const GROUP = `${NS}:Group`;
export const DEPENDENCY = `${NS}:Dependency`;
/** Tipos de dependencia (valor del campo `kind`). */
export const DEPENDENCY_KINDS = ['FS', 'SS', 'FF', 'SF'] as const;
export type DependencyKind = (typeof DEPENDENCY_KINDS)[number];

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category: CAT.schedule, fields: [], ...extra,
});

export const GANTT_ELEMENT_TYPES: ElementType[] = [
  el('Task', 'Tarea', {
    shape: 'rect', color: '#DAE8FC', icon: '▬',
    doc: 'Trabajo con fecha de inicio y fin (o duración): una barra en su fila. El progreso rellena la barra y las tareas críticas se pintan en rojo.',
    fields: [
      { key: 'start', label: 'Inicio', kind: 'date', doc: 'Primer día de la tarea (AAAA-MM-DD).' },
      { key: 'end', label: 'Fin', kind: 'date', doc: 'Último día de la tarea (inclusivo). Si falta, se calcula con la duración.' },
      { key: 'duration', label: 'Duración (días)', kind: 'number', doc: 'Días naturales, contando el primero y el último. Se usa si falta el inicio o el fin.' },
      { key: 'progress', label: 'Progreso (%)', kind: 'number', doc: 'De 0 a 100.' },
      { key: 'assignee', label: 'Responsable', kind: 'text' },
      { key: 'critical', label: 'Crítica', kind: 'checkbox', doc: 'Está en el camino crítico: cualquier retraso retrasa el proyecto.' },
    ],
  }),
  el('Milestone', 'Hito', {
    shape: 'diamond', color: '#000000', icon: '◆',
    doc: 'Punto de control sin duración (entrega, aprobación, lanzamiento): un rombo en su fecha.',
    fields: [{ key: 'start', label: 'Fecha', kind: 'date', doc: 'Día del hito (AAAA-MM-DD).' }],
  }),
  el('Group', 'Fase', {
    shape: 'group', container: true, color: '#F5F5F5', icon: '▭',
    doc: 'Fase o grupo de tareas: barra resumen que va de la primera a la última fecha de las tareas e hitos que contiene.',
  }),
];

export const GANTT_RELATION_TYPES: RelationType[] = [
  {
    id: DEPENDENCY, name: 'Dependencia', category: CAT.relations, line: 'solid', sourceHead: 'none', targetHead: 'arrow',
    doc: 'La tarea destino depende de la origen. FS: empieza cuando la otra acaba (la habitual); SS: empiezan a la vez; FF: acaban a la vez; SF: acaba cuando la otra empieza. Se dibuja como flecha en codo.',
    fields: [
      { key: 'kind', label: 'Tipo de dependencia', kind: 'select', options: DEPENDENCY_KINDS.join(','), optionLabels: { FS: 'Fin → inicio (FS)', SS: 'Inicio → inicio (SS)', FF: 'Fin → fin (FF)', SF: 'Inicio → fin (SF)' } },
      { key: 'lag', label: 'Desfase (días)', kind: 'number', doc: 'Días de espera entre una tarea y otra (negativo: solapamiento).' },
    ],
  },
];

const ALL = ['Task', 'Milestone', 'Group'];
export const GANTT_VALIDITY: ValidityMatrix = Object.fromEntries(ALL.map(s => [s, Object.fromEntries(ALL.map(t => [t, [DEPENDENCY]]))]));

export const GANTT_NESTING: NestingRule[] = ALL.map(child => ({ parent: 'Group', child, relationTypes: [] }));

export const GANTT_PACK: NotationPack = {
  id: NS,
  name: 'Diagrama de Gantt',
  version: '0.1.0',
  doc: 'Tareas, hitos y fases sobre una línea de tiempo calculada de sus fechas, con dependencias FS, SS, FF y SF. Vista propia de clase `gantt`.',
  color: '#0E7490',
  viewKind: 'gantt',
  categories: [
    { id: CAT.schedule, name: 'Planificación', order: 0 },
    { id: CAT.relations, name: 'Relaciones', order: 1 },
  ],
  elementTypes: GANTT_ELEMENT_TYPES,
  relationTypes: GANTT_RELATION_TYPES,
  portTypes: [],
  validity: GANTT_VALIDITY,
  viewpoints: [],
  nesting: GANTT_NESTING,
  defaultRelation: DEPENDENCY,
};

export default GANTT_PACK;
