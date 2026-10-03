/**
 * Borrar lo seleccionado, coherente para nodos y aristas:
 * - **Supr**: quita de *esta vista* (nodos → `deleteNode`; aristas → `delete` de `edges`). El modelo no cambia.
 * - **Shift+Supr** o "Borrar del modelo": las aristas borran su *relación* del modelo, con todas sus aristas en todas
 *   las vistas (`deleteRelation`), tras confirmar. Los nodos seleccionados se siguen quitando solo de la vista.
 */
import type { Command, Store } from '@all-draw/core';
import type { t as T } from '@all-draw/i18n';
import { confirmDialog } from './ui/dialog';

export interface SelectionIds { nodes: string[]; edges: string[] }

/** Relaciones (sin repetir) de las aristas dadas. */
export function relationsOfEdges(store: Store, edgeIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of edgeIds) { const r = store.get('edges', id)?.relationId; if (r && store.get('relations', r)) out.add(r); }
  return [...out];
}

/** Comandos para borrar la selección: de la vista (`fromModel` falso) o, para las aristas, del modelo. */
export function deleteSelectionCommands(store: Store, sel: SelectionIds, fromModel: boolean): Command[] {
  const cmds: Command[] = [];
  if (fromModel) {
    const rels = relationsOfEdges(store, sel.edges);
    for (const id of rels) cmds.push({ type: 'deleteRelation', id });
    // Aristas sin relación en el modelo (huérfanas): solo queda quitarlas de la vista
    for (const id of sel.edges) { const e = store.get('edges', id); if (e && !(e.relationId && rels.includes(e.relationId))) cmds.push({ type: 'delete', collection: 'edges', id }); }
  } else {
    for (const id of sel.edges) if (store.get('edges', id)) cmds.push({ type: 'delete', collection: 'edges', id });
  }
  for (const id of sel.nodes) if (store.get('nodes', id)) cmds.push({ type: 'deleteNode', id });
  return cmds;
}

/** Confirmación (diálogo propio) antes de borrar relaciones del modelo. `true` si se acepta. */
export function confirmDeleteRelations(n: number, t: typeof T): Promise<boolean> {
  return confirmDialog({
    title: n === 1 ? t('¿Borrar la relación del modelo y de todas las vistas?') : t('¿Borrar {n} relaciones del modelo y de todas las vistas?', { n }),
    message: t('Se borran también sus aristas en todas las vistas. Puedes deshacerlo con Ctrl+Z.'),
    confirmLabel: t('Borrar del modelo'),
    danger: true,
  });
}

/**
 * Borra la selección y devuelve si se hizo algo. Con `fromModel` y relaciones afectadas pide confirmación;
 * si se cancela no se toca nada.
 */
export async function deleteSelection(store: Store, run: (c: Command) => void, sel: SelectionIds, fromModel: boolean, t: typeof T): Promise<boolean> {
  const rels = fromModel ? relationsOfEdges(store, sel.edges) : [];
  if (rels.length && !(await confirmDeleteRelations(rels.length, t))) return false;
  const cmds = deleteSelectionCommands(store, sel, fromModel);
  if (!cmds.length) return false;
  run({ type: 'batch', label: fromModel && rels.length ? 'borrar del modelo' : 'quitar de la vista', commands: cmds });
  return true;
}
