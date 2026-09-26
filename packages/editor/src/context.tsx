/**
 * Contexto del editor: store (memoria o Yjs), historial, registro de notaciones, vista actual,
 * selección y pila de navegación (breadcrumb). Los componentes leen el store con
 * `useSyncExternalStore` a través de los hooks de `hooks.ts`.
 */
import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react';
import type { Store, Command, NotationRegistry } from '@all-draw/core';

export interface HistoryLike { run(cmd: Command): void; undo(): boolean; redo(): boolean; readonly canUndo: boolean; readonly canRedo: boolean }

export interface Selection { nodes: string[]; edges: string[] }

export interface EditorCtx {
  store: Store;
  history: HistoryLike;
  registry: NotationRegistry;
  viewId: string | null;
  /** Abre una vista; `push` la apila para el breadcrumb (drill-down). */
  openView(id: string | null, push?: boolean): void;
  back(): void;
  trail: string[];
  selection: Selection;
  select(sel: Selection): void;
  run(cmd: Command): void;
  /** Modo de solo lectura (vistas públicas). */
  readOnly: boolean;
}

const Ctx = createContext<EditorCtx | null>(null);

export function EditorProvider(props: { store: Store; history: HistoryLike; registry: NotationRegistry; initialViewId?: string | null; readOnly?: boolean; children: ReactNode }) {
  const [trail, setTrail] = useState<string[]>(props.initialViewId ? [props.initialViewId] : []);
  const [selection, setSelection] = useState<Selection>({ nodes: [], edges: [] });
  const viewId = trail[trail.length - 1] ?? null;

  const openView = useCallback((id: string | null, push = false) => {
    setSelection({ nodes: [], edges: [] });
    setTrail(t => id === null ? [] : push ? [...t, id] : [id]);
  }, []);
  const back = useCallback(() => setTrail(t => t.length > 1 ? t.slice(0, -1) : t), []);
  const run = useCallback((cmd: Command) => { if (!props.readOnly) props.history.run(cmd); }, [props.history, props.readOnly]);

  const value = useMemo<EditorCtx>(() => ({
    store: props.store, history: props.history, registry: props.registry, viewId, openView, back, trail,
    selection, select: setSelection, run, readOnly: !!props.readOnly,
  }), [props.store, props.history, props.registry, viewId, openView, back, trail, selection, run, props.readOnly]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEditor fuera de EditorProvider');
  return c;
}
