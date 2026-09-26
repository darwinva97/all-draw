/** Registro con todos los packs de notación del monorepo (lo que el editor también carga). */
import { CORE_PACK, NotationRegistry, type NotationPack } from '@all-draw/core';
import ARCHIMATE from '@all-draw/notation-archimate';
import BPMN from '@all-draw/notation-bpmn';
import C4 from '@all-draw/notation-c4';
import FREEFORM from '@all-draw/notation-freeform';
import GRID from '@all-draw/notation-grid';
import STATECHART from '@all-draw/notation-statechart';
import SEQUENCE from '@all-draw/notation-sequence';
import ER from '@all-draw/notation-er';
import UML from '@all-draw/notation-uml-class';
import MINDMAP from '@all-draw/notation-mindmap';
import FLOWCHART from '@all-draw/notation-flowchart';
import DFD from '@all-draw/notation-dfd';
import CATALOG from '@all-draw/notation-catalog';

export const ALL_PACKS: NotationPack[] = [CORE_PACK, FREEFORM, GRID, BPMN, ARCHIMATE, C4, STATECHART, SEQUENCE, ER, UML, MINDMAP, FLOWCHART, DFD, CATALOG];

export function createRegistry(packs: NotationPack[] = ALL_PACKS): NotationRegistry {
  const reg = new NotationRegistry();
  for (const p of packs) reg.register(p);
  return reg;
}

/** Resumen serializable de los packs, para `GET /api/notations` y el MCP. */
export function describePacks(packs: NotationPack[] = ALL_PACKS) {
  return packs.map(p => ({
    id: p.id,
    name: p.name,
    doc: p.doc ?? '',
    viewKind: p.viewKind ?? 'freeform',
    categories: p.categories,
    elementTypes: p.elementTypes.map(t => ({ id: t.id, name: t.name, category: t.category, container: !!t.container, abstract: !!t.abstract, extends: t.extends, fields: t.fields.map(f => ({ key: f.key, label: f.label, kind: f.kind, required: !!f.required })), doc: t.doc })),
    relationTypes: p.relationTypes.map(t => ({ id: t.id, name: t.name, category: t.category, doc: t.doc })),
    portTypes: p.portTypes.map(t => ({ id: t.id, name: t.name })),
    viewpoints: p.viewpoints.map(v => ({ id: v.id, name: v.name, elementTypes: v.elementTypes })),
    hasValidityMatrix: !!p.validity,
    defaultRelation: p.defaultRelation,
    defaultNestingRelation: p.defaultNestingRelation,
  }));
}
