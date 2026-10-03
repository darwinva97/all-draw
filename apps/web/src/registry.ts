import { NotationRegistry, CORE_PACK, type Store, type NotationPack } from '@all-draw/core';
import { tIn, getLang, type Lang } from '@all-draw/i18n';
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
/** Color de cada notación en la interfaz (chips, puntos, paleta). */
export const PACK_COLORS: Record<string, string> = { freeform: '#64748b', grid: '#0ea5e9', archimate: '#ca8a04', bpmn: '#16a34a', statechart: '#7c3aed', c4: '#1168bd', sequence: '#db2777', er: '#0d9488', uml: '#9333ea', mindmap: '#f59e0b', flow: '#475569', dfd: '#0891b2' };

/** Traduce los nombres y descripciones visibles de un pack (nombre, categorías, tipos, relaciones, viewpoints) al idioma dado. */
export function localizePack(p: NotationPack, lang: Lang): NotationPack {
  if (lang === 'es') return p;
  const tr = (s: string) => tIn(lang, s);
  /** Las descripciones (`doc`) se traducen con el diccionario `en-docs` (mismo mecanismo: clave = texto español). */
  const doc = (s: string | undefined) => (s ? tr(s) : s);
  return {
    ...p, name: tr(p.name), doc: doc(p.doc),
    categories: p.categories.map(c => ({ ...c, name: tr(c.name) })),
    elementTypes: p.elementTypes.map(e => ({ ...e, name: tr(e.name), category: e.category ? tr(e.category) : e.category, doc: doc(e.doc) })),
    relationTypes: p.relationTypes.map(r => ({ ...r, name: tr(r.name), category: r.category ? tr(r.category) : r.category, doc: doc(r.doc) })),
    portTypes: p.portTypes.map(x => ({ ...x, name: tr(x.name) })),
    viewpoints: p.viewpoints.map(v => ({ ...v, name: tr(v.name), doc: doc(v.doc) })),
  };
}

export function createRegistry(lang: Lang = getLang()): NotationRegistry {
  const reg = new NotationRegistry().register(localizePack(CORE_PACK, lang));
  for (const p of PACKS) reg.register(localizePack({ ...p, color: PACK_COLORS[p.id] ?? p.color }, lang));
  return reg;
}

/** Mantiene registrados los tipos de las librerías del workspace. */
export function bindLibraries(reg: NotationRegistry, store: Store): () => void {
  const sync = () => reg.syncLibraryTypes(store.list('libraries'));
  sync();
  return store.subscribe(ch => { if (ch.collection === 'libraries') sync(); });
}
