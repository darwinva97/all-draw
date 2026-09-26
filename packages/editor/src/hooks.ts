import { useSyncExternalStore, useRef, useCallback, useMemo } from 'react';
import type { Collection, RecordOf, Store, StoreChange, Element, Port } from '@all-draw/core';
import { allPorts } from '@all-draw/core';
import { useEditor } from './context';

/** Versión monotónica del store por colección: cambia cuando cambia algo de esa colección. */
function useVersion(store: Store, filter: (ch: StoreChange) => boolean): number {
  const ref = useRef(0);
  const subscribe = useCallback((cb: () => void) => store.subscribe(ch => { if (filter(ch)) { ref.current++; cb(); } }), [store, filter]);
  return useSyncExternalStore(subscribe, () => ref.current, () => ref.current);
}

export function useCollection<C extends Collection>(c: C): RecordOf<C>[] {
  const { store } = useEditor();
  const v = useVersion(store, useCallback((ch: StoreChange) => ch.collection === c, [c]));
  return useMemo(() => store.list(c), [store, c, v]);
}

export function useRecord<C extends Collection>(c: C, id: string | undefined | null): RecordOf<C> | undefined {
  const { store } = useEditor();
  const v = useVersion(store, useCallback((ch: StoreChange) => ch.collection === c && (ch.ids.includes(id ?? '') || ch.ids.includes('*')), [c, id]));
  return useMemo(() => (id ? store.get(c, id) : undefined), [store, c, id, v]);
}

export function useMeta() {
  const { store } = useEditor();
  const v = useVersion(store, useCallback((ch: StoreChange) => ch.collection === 'meta', []));
  return useMemo(() => store.meta(), [store, v]);
}

/** Cualquier cambio del store (para paneles que cruzan colecciones). */
export function useAnyChange(): number {
  const { store } = useEditor();
  return useVersion(store, useCallback(() => true, []));
}

export function usePorts(element: Element | undefined): Port[] {
  const { registry } = useEditor();
  return useMemo(() => (element ? allPorts(element, registry.fieldsOf(element.typeId)) : []), [element, registry]);
}
