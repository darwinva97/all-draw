/**
 * Pack de notación ArchiMate 3.2. Los datos (elementos, relaciones, matriz, viewpoints) se generan
 * desde los ficheros de Archi con `scripts/generate.mjs`; aquí solo se ensambla el `NotationPack`
 * y se añaden las reglas de anidamiento y un par de ayudantes.
 */
import type { NotationPack, NestingRule } from '@all-draw/core';
import { CATEGORIES, ELEMENTS, RELATIONS, VALIDITY, VIEWPOINTS, SPEC_VERSION } from './generated';

export { CATEGORIES, ELEMENTS, RELATIONS, VALIDITY, VIEWPOINTS, LAYERS, CONCEPTS, SPEC_VERSION } from './generated';

const NS = 'archimate';
const local = (typeId: string): string => {
  const i = typeId.indexOf(':');
  return i < 0 ? typeId : typeId.slice(i + 1);
};

/**
 * Relaciones que Archi propone al meter un hijo dentro de un padre (preferencia
 * `NEW_RELATIONS_TYPES` por defecto: Composition, Aggregation, Assignment, Specialization,
 * Realization y Access), en orden de preferencia. Solo se ofrecen si la matriz las permite.
 */
export const NESTING_RELATIONS = [
  `${NS}:Composition`, `${NS}:Aggregation`, `${NS}:Assignment`, `${NS}:Realization`, `${NS}:Specialization`, `${NS}:Access`,
];

/** Grouping y Location aceptan cualquier cosa dentro con Composition/Aggregation. */
const GROUPING_PARENTS = ['Grouping', 'Location'];
const NESTING: NestingRule[] = [
  ...GROUPING_PARENTS.map((parent): NestingRule => ({ parent, child: '*', relationTypes: [`${NS}:Composition`, `${NS}:Aggregation`] })),
  // El resto de padres, uno a uno (así Grouping/Location no acumulan la regla genérica).
  ...ELEMENTS.filter((e) => !GROUPING_PARENTS.includes(local(e.id)) && local(e.id) !== 'Junction')
    .map((e): NestingRule => ({ parent: local(e.id), child: '*', relationTypes: NESTING_RELATIONS })),
];

export const ARCHIMATE_PACK: NotationPack = {
  id: NS,
  name: SPEC_VERSION,
  version: '3.2',
  doc: 'Lenguaje de arquitectura empresarial de The Open Group. Elementos, relaciones, matriz de validez y viewpoints tomados de Archi.',
  color: '#ffffb5',
  viewKind: 'freeform',
  categories: CATEGORIES,
  elementTypes: ELEMENTS,
  relationTypes: RELATIONS,
  portTypes: [],
  validity: VALIDITY,
  viewpoints: VIEWPOINTS,
  nesting: NESTING,
  defaultNestingRelation: `${NS}:Composition`,
  defaultRelation: `${NS}:Association`,
};

/** Ids de relación permitidos de `source` a `target` (ids completos o nombres locales; `Relationship` = relación como destino). */
export function allowedBetween(source: string, target: string): string[] {
  return VALIDITY[local(source)]?.[local(target)] ?? [];
}

/** ¿Es válida la relación `rel` (id completo o nombre local) entre `source` y `target`? */
export function isValid(source: string, target: string, rel: string): boolean {
  const relId = rel.includes(':') ? rel : `${NS}:${rel}`;
  return allowedBetween(source, target).includes(relId);
}

export default ARCHIMATE_PACK;
