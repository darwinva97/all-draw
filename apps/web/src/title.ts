/** Título de la pestaña del navegador (fallo 45): sigue al idioma y al nombre del espacio. */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { Store } from '@all-draw/core';

/**
 * Título de la pestaña. Se vuelve a poner cada vez que cambia el texto (que ya llega traducido: cambia con el idioma, o
 * con el nombre del espacio) y vuelve a «all-draw» al desmontar. `null` = solo «all-draw».
 */
export function useDocumentTitle(title: string | null | undefined): void {
  useEffect(() => {
    document.title = title || 'all-draw';
    return () => { document.title = 'all-draw'; };
  }, [title]);
}

/** Nombre del espacio en vivo (`meta.name`): sigue los renombrados propios y los que llegan de otros, y la primera sincronización. */
export function useWorkspaceName(store: Store | null | undefined): string {
  const subscribe = useCallback((cb: () => void) => (store ? store.subscribe(ch => { if (ch.collection === 'meta') cb(); }) : () => {}), [store]);
  const read = () => store?.meta().name ?? '';
  return useSyncExternalStore(subscribe, read, read);
}
