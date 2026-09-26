/**
 * Pack `mindmap`: mapa mental como datos puros. Un `Root` central, `Topic` de primer nivel y
 * `Subtopic` para el resto; la jerarquía se expresa **con aristas** (`mindmap:Branch`, línea sin
 * cabeza), no por anidamiento: por eso no hay `nesting` ni `defaultNestingRelation`.
 *
 * La matriz solo permite ramas "hacia fuera" (Root → Topic → Subtopic → Subtopic); nada apunta
 * a la raíz.
 */
import type { NotationPack, ValidityMatrix, ElementType, RelationType } from '@all-draw/core';

const NS = 'mindmap';
const CAT = 'topics';
export const BRANCH = `${NS}:Branch`;

const el = (id: string, name: string, extra: Partial<ElementType> = {}): ElementType => ({
  id: `${NS}:${id}`, name, category: CAT, fields: [], ...extra,
});

const notes = { key: 'notes', label: 'Notas', kind: 'textarea' } as const;

export const MINDMAP_ELEMENT_TYPES: ElementType[] = [
  el('Root', 'Idea central', { shape: 'ellipse', color: '#FFD966', icon: '◉', doc: 'Nodo central del mapa; solo puede ser origen de ramas.', fields: [notes] }),
  el('Topic', 'Tema', { shape: 'rounded', color: '#DAE8FC', icon: '●', doc: 'Rama principal que cuelga de la idea central.', fields: [notes, { key: 'priority', label: 'Prioridad', kind: 'number' }] }),
  el('Subtopic', 'Subtema', { shape: 'label', color: '#F5F5F5', icon: '○', doc: 'Detalle de un tema; puede anidarse en profundidad con más ramas.', fields: [notes] }),
];

export const MINDMAP_RELATION_TYPES: RelationType[] = [
  { id: BRANCH, name: 'Rama', category: CAT, line: 'solid', sourceHead: 'none', targetHead: 'none', fields: [], doc: 'Línea sin cabeza padre → hijo.' },
];

export const MINDMAP_VALIDITY: ValidityMatrix = {
  Root: { Topic: [BRANCH], Subtopic: [BRANCH] },
  Topic: { Topic: [BRANCH], Subtopic: [BRANCH] },
  Subtopic: { Subtopic: [BRANCH] },
};

export const MINDMAP_PACK: NotationPack = {
  id: NS,
  name: 'Mapa mental',
  version: '0.1.0',
  doc: 'Idea central, temas y subtemas unidos por ramas (aristas, no anidamiento).',
  color: '#FFD966',
  viewKind: 'freeform',
  categories: [{ id: CAT, name: 'Temas', order: 0 }],
  elementTypes: MINDMAP_ELEMENT_TYPES,
  relationTypes: MINDMAP_RELATION_TYPES,
  portTypes: [],
  validity: MINDMAP_VALIDITY,
  viewpoints: [],
  defaultRelation: BRANCH,
};

export default MINDMAP_PACK;
