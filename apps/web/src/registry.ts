import { NotationRegistry, CORE_PACK, type Store } from '@all-draw/core';
import { ARCHIMATE_PACK } from '@all-draw/notation-archimate';
import { BPMN_PACK } from '@all-draw/notation-bpmn';
import { STATECHART_PACK } from '@all-draw/notation-statechart';
import { C4_PACK } from '@all-draw/notation-c4';
import { GRID_PACK } from '@all-draw/notation-grid';
import { FREEFORM_PACK } from '@all-draw/notation-freeform';

export const PACKS = [FREEFORM_PACK, GRID_PACK, ARCHIMATE_PACK, BPMN_PACK, STATECHART_PACK, C4_PACK];
const COLORS: Record<string, string> = { freeform: '#64748b', grid: '#0ea5e9', archimate: '#ca8a04', bpmn: '#16a34a', statechart: '#7c3aed', c4: '#1168bd' };

export function createRegistry(): NotationRegistry {
  const reg = new NotationRegistry().register(CORE_PACK);
  for (const p of PACKS) reg.register({ ...p, color: COLORS[p.id] ?? p.color });
  return reg;
}

/** Mantiene registrados los tipos de las librerías del workspace. */
export function bindLibraries(reg: NotationRegistry, store: Store): () => void {
  const sync = () => { for (const lib of store.list('libraries')) reg.registerLibraryTypes(lib); };
  sync();
  return store.subscribe(ch => { if (ch.collection === 'libraries') sync(); });
}
