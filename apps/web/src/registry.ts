import { NotationRegistry, CORE_PACK, type Store, type NotationPack } from '@all-draw/core';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { C4_PACK } from '@all-draw/notation-c4';
import { GRID_PACK } from '@all-draw/notation-grid';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';
import { SEQUENCE_PACK } from '@all-draw/notation-sequence';
import { ER_PACK } from '@all-draw/notation-er';
import { UML_CLASS_PACK } from '@all-draw/notation-uml-class';
import { MINDMAP_PACK } from '@all-draw/notation-mindmap';
import { FLOWCHART_PACK } from '@all-draw/notation-flowchart';
import { DFD_PACK } from '@all-draw/notation-dfd';

export const PACKS: NotationPack[] = [FREEFORM_PACK, GRID_PACK, ARCHIMATE_PACK, BPMN_PACK, STATECHART_PACK, C4_PACK, SEQUENCE_PACK, ER_PACK, UML_CLASS_PACK, MINDMAP_PACK, FLOWCHART_PACK, DFD_PACK];
const COLORS: Record<string, string> = { freeform: '#64748b', grid: '#0ea5e9', archimate: '#ca8a04', bpmn: '#16a34a', statechart: '#7c3aed', c4: '#1168bd', sequence: '#db2777', er: '#0d9488', uml: '#9333ea', mindmap: '#f59e0b', flow: '#475569', dfd: '#0891b2' };

export function createRegistry(): NotationRegistry {
  const reg = new NotationRegistry().register(CORE_PACK);
  for (const p of PACKS) reg.register({ ...p, color: COLORS[p.id] ?? p.color });
  return reg;
}

/** Mantiene registrados los tipos de las librerías del workspace. */
export function bindLibraries(reg: NotationRegistry, store: Store): () => void {
  const sync = () => reg.syncLibraryTypes(store.list('libraries'));
  sync();
  return store.subscribe(ch => { if (ch.collection === 'libraries') sync(); });
}
