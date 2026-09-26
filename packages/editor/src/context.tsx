/**
 * Contexto del editor: store (memoria o Yjs), historial, registro de notaciones, vista actual,
 * selección y pila de navegación (breadcrumb). Los componentes leen el store con
 * `useSyncExternalStore` a través de los hooks de `hooks.ts`.
 */
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type { Store, Command, NotationRegistry, Validator } from '@all-draw/core';
import type { AwarenessLike, PresenceMe } from './presence';
import type { WorkspaceTab } from './panels/WorkspacePanel';

export interface HistoryLike { run(cmd: Command): void; undo(): boolean; redo(): boolean; readonly canUndo: boolean; readonly canRedo: boolean }

export interface Selection { nodes: string[]; edges: string[] }

export type Theme = 'light' | 'dark' | 'system';

/** Operaciones del lienzo que otros paneles (paleta de comandos, barra, atajos) pueden pedir. */
export interface CanvasApi {
  /** Encuadra los nodos dados (o toda la vista). */
  fitView(nodeIds?: string[]): void;
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  selectAll(): void;
  /** Da el foco al lienzo (para que reciba los atajos). */
  focus(): void;
}

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
  validators: Validator[];
  /** Presencia (colaboración): awareness y quién soy. Ausente si no hay sesión compartida. */
  presence: { awareness: AwarenessLike; me: PresenceMe } | null;
  /** Tema elegido y tema efectivo (resuelto `system`). */
  theme: Theme;
  setTheme(t: Theme): void;
  effectiveTheme: 'light' | 'dark';
  /** Ajuste a rejilla de 8 px al mover/redimensionar. */
  snap: boolean;
  setSnap(v: boolean): void;
  /** Nodo cuyo nombre se está editando en línea (F2 / doble clic en el texto). */
  renaming: string | null;
  setRenaming(id: string | null): void;
  /** API del lienzo montado (null si no hay vista abierta). */
  canvas: RefObject<CanvasApi | null>;
  /** Pestaña abierta del panel Espacio (null = cerrado). */
  workspaceTab: WorkspaceTab | null;
  openWorkspacePanel(tab?: WorkspaceTab): void;
  closeWorkspacePanel(): void;
}

const Ctx = createContext<EditorCtx | null>(null);

export const THEME_KEY = 'alldraw:theme';
export const SNAP_KEY = 'alldraw:snap';

function readStored(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function writeStored(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* sin almacenamiento */ }
}
function systemTheme(): 'light' | 'dark' {
  try { return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch { return 'light'; }
}

export interface EditorProviderProps {
  store: Store;
  history: HistoryLike;
  registry: NotationRegistry;
  initialViewId?: string | null;
  readOnly?: boolean;
  /** Validadores adicionales para el panel de problemas (además de los del núcleo). */
  validators?: Validator[];
  /** Presencia colaborativa: awareness (Yjs o compatible) y datos propios. */
  presence?: { awareness: AwarenessLike; me: PresenceMe };
  /** Tema inicial; si no se da, se lee de `localStorage('alldraw:theme')` (por defecto `system`). */
  theme?: Theme;
  children: ReactNode;
}

export function EditorProvider(props: EditorProviderProps) {
  const [trail, setTrail] = useState<string[]>(props.initialViewId ? [props.initialViewId] : []);
  const [selection, setSelection] = useState<Selection>({ nodes: [], edges: [] });
  const [renaming, setRenaming] = useState<string | null>(null);
  const [theme, setThemeState] = useState<Theme>(() => props.theme ?? ((readStored(THEME_KEY) as Theme | null) ?? 'system'));
  const [sys, setSys] = useState<'light' | 'dark'>(systemTheme);
  const [snap, setSnapState] = useState<boolean>(() => readStored(SNAP_KEY) === '1');
  const canvas = useRef<CanvasApi | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab | null>(null);
  const viewId = trail[trail.length - 1] ?? null;

  useEffect(() => { if (props.theme) setThemeState(props.theme); }, [props.theme]);
  useEffect(() => {
    const mq = globalThis.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const h = () => setSys(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  // Tipos de librería: el registro refleja siempre las librerías del store (altas, cambios y bajas).
  useEffect(() => {
    const { store, registry } = props;
    registry.syncLibraryTypes(store.list('libraries'));
    return store.subscribe(ch => { if (ch.collection === 'libraries') registry.syncLibraryTypes(store.list('libraries')); });
  }, [props.store, props.registry]); // eslint-disable-line react-hooks/exhaustive-deps

  const openView = useCallback((id: string | null, push = false) => {
    setSelection({ nodes: [], edges: [] });
    setRenaming(null);
    setTrail(t => id === null ? [] : push ? [...t, id] : [id]);
  }, []);
  const back = useCallback(() => setTrail(t => t.length > 1 ? t.slice(0, -1) : t), []);
  const run = useCallback((cmd: Command) => { if (!props.readOnly) props.history.run(cmd); }, [props.history, props.readOnly]);
  const setTheme = useCallback((t: Theme) => { setThemeState(t); writeStored(THEME_KEY, t); }, []);
  const setSnap = useCallback((v: boolean) => { setSnapState(v); writeStored(SNAP_KEY, v ? '1' : '0'); }, []);
  const presence = useMemo(() => props.presence ?? null, [props.presence]);
  const openWorkspacePanel = useCallback((tab: WorkspaceTab = 'libraries') => setWorkspaceTab(tab), []);
  const closeWorkspacePanel = useCallback(() => setWorkspaceTab(null), []);
  const effectiveTheme = theme === 'system' ? sys : theme;

  const value = useMemo<EditorCtx>(() => ({
    store: props.store, history: props.history, registry: props.registry, viewId, openView, back, trail,
    selection, select: setSelection, run, readOnly: !!props.readOnly, validators: props.validators ?? [],
    presence, theme, setTheme, effectiveTheme, snap, setSnap, renaming, setRenaming, canvas, workspaceTab, openWorkspacePanel, closeWorkspacePanel,
  }), [props.store, props.history, props.registry, viewId, openView, back, trail, selection, run, props.readOnly, props.validators, presence, theme, setTheme, effectiveTheme, snap, setSnap, renaming, workspaceTab, openWorkspacePanel, closeWorkspacePanel]);

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEditor fuera de EditorProvider');
  return c;
}
