/**
 * Pack `catalog`: catálogo de tipos de diagrama. No aporta tipos de elemento ni de relación:
 * es una lista (`DIAGRAM_KINDS`, generada por `scripts/seed.mjs` desde
 * `_research/catalogo-corporativo-ti`) que dice qué diagramas existen en una organización de TI
 * y con qué pack de all-draw se modela cada uno. Sirve para el diálogo "nueva vista" (elegir un
 * tipo de diagrama y que la app cree la vista con la notación adecuada) y como diccionario.
 */
import type { NotationPack } from '@all-draw/core';
import { DIAGRAM_KINDS, KNOWN_PACKS, FAMILIES, type DiagramKind } from './generated';

export { DIAGRAM_KINDS, KNOWN_PACKS, FAMILIES };
export type { DiagramKind };

/** Tipos de diagrama que se modelan con el pack dado (`NotationPack.id`). */
export function kindsFor(notationId: string): DiagramKind[] {
  return DIAGRAM_KINDS.filter(k => k.notationId === notationId);
}

/** Tipo de diagrama por id (slug). */
export function kindById(id: string): DiagramKind | undefined {
  return DIAGRAM_KINDS.find(k => k.id === id);
}

/** Tipos de diagrama agrupados por familia (categoría del catálogo de origen), en el orden de origen. */
export function kindsByFamily(): { family: string; kinds: DiagramKind[] }[] {
  return FAMILIES.map(family => ({ family, kinds: DIAGRAM_KINDS.filter(k => k.family === family) }));
}

/** Tipos de diagrama sin pack equivalente (se dibujan en lienzo libre). */
export function kindsWithoutPack(): DiagramKind[] {
  return DIAGRAM_KINDS.filter(k => !k.notationId);
}

export const CATALOG_PACK: NotationPack = {
  id: 'catalog',
  name: 'Catálogo de diagramas',
  version: '0.1.0',
  doc: `Catálogo de ${DIAGRAM_KINDS.length} tipos de diagrama con notación formal y el pack que los modela. No define tipos: solo clasifica.`,
  categories: [],
  elementTypes: [],
  relationTypes: [],
  portTypes: [],
  viewpoints: [],
};

export default CATALOG_PACK;
