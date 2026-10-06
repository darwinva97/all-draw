import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { makeView, newId, type Command, type Store } from '@all-draw/core';
import { Canvas, DND_TYPE, defaultSize } from './Canvas';
import { Palette } from './panels/Palette';
import { Inspector } from './panels/Inspector';
import { ViewsPanel } from './panels/ViewsPanel';
import { Problems } from './panels/Problems';
import { Toolbar, Crumbs, ToolbarTools } from './panels/Toolbar';
import { WorkspacePanel } from './panels/WorkspacePanel';
import { CommandPalette, GO_VIEW_ACTION, NEW_VIEW_ACTION } from './panels/CommandPalette';
import { addPayloadToCanvas } from './panels/palette-helpers';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { CommentsPanel } from './panels/Comments';
import { useEditor, type Theme } from './context';
import type { SearchAction } from './search';
import { useT, useLang } from '@all-draw/i18n';
import { Icon } from './icons';
import { inLayer } from './ui/layer';
import { isContextMenuKey, openContextMenuFor } from './ui/menu';
import { mountUiLayer } from './ui/toast';
import { useRecord, useCollection } from './hooks';
import { SimMarksContext, createSimMarks, NO_SIM_MARKS } from './nodes/env';
import './ui/dialog';
import './editor.css';

/** Panel de simulación (BPMN / estados): se carga al abrirlo, con el motor `@all-draw/sim`. */
const SimulationPanel = lazy(() => import('./panels/Simulation'));
/** Panel de texto en vivo (lenguaje textual de all-draw): se carga al abrirlo, con `@all-draw/io`. */
const TextPanel = lazy(() => import('./panels/TextPanel'));
/** Notaciones que se pueden simular. */
const SIMULABLE = new Set(['bpmn', 'statechart']);

export interface EditorProps {
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  /** Tema forzado por la app; si no se da, manda el toggle de la barra (persistido en `localStorage('alldraw:theme')`). */
  theme?: Theme;
  /** Layout automático de la vista actual: la app lo conecta (p. ej. a `@all-draw/layout`). Sin él, la opción no aparece. */
  onRequestLayout?: () => void;
  /** Layout automático de una vista sobre un store cualquiera (el panel de texto lo usa con las vistas nuevas sin posiciones). */
  layout?: (store: Store, viewId: string) => Promise<Command>;
  /**
   * Órdenes de la app desde la paleta de comandos (Ctrl+K): exportar, importar, compartir, historial, generar código
   * (`APP_COMMANDS`). Sin ella esas acciones no aparecen.
   */
  onCommand?: (id: AppCommand) => void;
  /** Cuáles de `APP_COMMANDS` ofrece la app ahora (p. ej. «Compartir» solo para quien puede). Por defecto, todas. */
  commands?: readonly AppCommand[];
}

/** Órdenes que el editor ofrece en Ctrl+K y que ejecuta la app (`onCommand`). */
export const APP_COMMANDS = ['export:svg', 'export:png', 'export:pdf', 'export:mermaid', 'export:drawio', 'export:json', 'import', 'codegen', 'share', 'history'] as const;
export type AppCommand = (typeof APP_COMMANDS)[number];
/** Etiqueta (clave en español) y palabras clave de cada orden de la app. */
const APP_COMMAND_TEXT: Record<AppCommand, { label: string; keywords: string; view?: boolean; edit?: boolean }> = {
  'export:svg': { label: 'Exportar la vista como SVG', keywords: 'exportar descargar imagen vectorial svg', view: true },
  'export:png': { label: 'Exportar la vista como PNG', keywords: 'exportar descargar imagen png', view: true },
  'export:pdf': { label: 'Exportar la vista como PDF', keywords: 'exportar descargar imprimir pdf', view: true },
  'export:mermaid': { label: 'Exportar la vista como Mermaid', keywords: 'exportar descargar texto mermaid', view: true },
  'export:drawio': { label: 'Exportar la vista como draw.io', keywords: 'exportar descargar drawio diagrams.net', view: true },
  'export:json': { label: 'Exportar el espacio (JSON de all-draw)', keywords: 'exportar descargar copia json espacio' },
  'import': { label: 'Importar un fichero…', keywords: 'importar abrir fichero archivo drawer bpmn archimate mermaid', edit: true },
  'codegen': { label: 'Generar código…', keywords: 'generar codigo sql typescript openapi' },
  'share': { label: 'Compartir…', keywords: 'compartir enlace invitar' },
  'history': { label: 'Historial de versiones…', keywords: 'historial versiones instantaneas restaurar' },
};

/** Rangos de pantalla: escritorio (≥ 1100 px), tableta (700–1099 px, paneles colapsables) y móvil (< 700 px, lienzo completo con hojas). */
export type LayoutMode = 'desktop' | 'tablet' | 'mobile';
const MQ_MOBILE = '(max-width: 699px)';
const MQ_TABLET = '(max-width: 1099px)';

function readMode(): LayoutMode {
  try {
    if (globalThis.matchMedia?.(MQ_MOBILE).matches) return 'mobile';
    if (globalThis.matchMedia?.(MQ_TABLET).matches) return 'tablet';
  } catch { /* sin matchMedia (tests) */ }
  return 'desktop';
}

/** Modo de disposición según el ancho de la ventana; se actualiza al redimensionar. */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(readMode);
  useEffect(() => {
    const mqs = [MQ_MOBILE, MQ_TABLET].map(q => globalThis.matchMedia?.(q)).filter((m): m is MediaQueryList => !!m);
    const h = () => setMode(readMode());
    for (const m of mqs) m.addEventListener('change', h);
    h();
    return () => { for (const m of mqs) m.removeEventListener('change', h); };
  }, []);
  return mode;
}

const PANELS_KEY = 'alldraw:panels';
interface PanelsState { left: boolean; right: boolean }
function readPanels(): PanelsState {
  try {
    const raw = globalThis.localStorage?.getItem(PANELS_KEY);
    if (raw) { const p = JSON.parse(raw) as Partial<PanelsState>; return { left: p.left !== false, right: p.right !== false }; }
  } catch { /* sin almacenamiento o JSON inválido */ }
  return { left: true, right: true };
}

/** Hojas del modo móvil (barra inferior). */
type Sheet = 'views' | 'add' | 'inspector' | 'more';

/** Color de la barra del navegador (PWA / móvil) acorde al tema del editor. */
const THEME_COLOR: Record<'light' | 'dark', string> = { light: '#ffffff', dark: '#161a22' };

/** Disposición completa del editor. La app envuelve esto en `EditorProvider`. */
export function Editor({ layout, toolbarLeft, toolbarRight, theme, onRequestLayout, onCommand, commands }: EditorProps) {
  const ed = useEditor();
  const t = useT();
  const [lang] = useLang(); // las acciones memorizadas se rehacen al cambiar de idioma
  const { readOnly, effectiveTheme, setTheme, registry, run, openView, canvas, selection, setRenaming, workspaceTab, openWorkspacePanel, closeWorkspacePanel, comments } = ed;
  const [searchOpen, setSearchOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const keysOpen = ed.shortcutsOpen;
  const setKeysOpen = useCallback((v: boolean | ((o: boolean) => boolean)) => ed.setShortcutsOpen(typeof v === 'function' ? v(keysOpen) : v), [ed, keysOpen]);
  const mode = useLayoutMode();
  const [panels, setPanels] = useState<PanelsState>(readPanels);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  useEffect(() => { if (theme) setTheme(theme); }, [theme, setTheme]);
  useEffect(() => { if (mode !== 'mobile') setSheet(null); }, [mode]);
  useEffect(() => { if (comments.open) setSheet(null); }, [comments.open, comments.threadId, comments.draft]);

  // theme-color del navegador sigue al tema del editor; al salir se restaura el valor estático del HTML.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    if (!metas.length) return;
    const saved = metas.map(m => m.getAttribute('content'));
    for (const m of metas) m.setAttribute('content', THEME_COLOR[effectiveTheme]);
    return () => { metas.forEach((m, i) => { if (saved[i] != null) m.setAttribute('content', saved[i]!); }); };
  }, [effectiveTheme]);
  // `<html data-theme>` sigue al editor: la capa flotante (avisos, diálogos, recorrido) se pinta con el mismo tema.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    const prev = html.getAttribute('data-theme');
    html.setAttribute('data-theme', effectiveTheme);
    return () => { if (prev == null) html.removeAttribute('data-theme'); else html.setAttribute('data-theme', prev); };
  }, [effectiveTheme]);
  useEffect(() => { mountUiLayer(); }, []);

  const togglePanel = useCallback((side: 'left' | 'right') => setPanels(p => {
    const next = { ...p, [side]: !p[side] };
    try { globalThis.localStorage?.setItem(PANELS_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento */ }
    return next;
  }), []);
  const panelToggles = useMemo(() => ({ left: panels.left, right: panels.right, toggleLeft: () => togglePanel('left'), toggleRight: () => togglePanel('right') }), [panels, togglePanel]);

  // Atajos globales: Ctrl+K / Ctrl+F abren la búsqueda; ? los atajos.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (inLayer(e)) return; // diálogos y avisos propios
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && e.shiftKey && !e.altKey && key === 'e') { e.preventDefault(); setTextOpen(o => !o); return; }
      // Ctrl+B: panel izquierdo (vistas y paleta); Ctrl+Alt+B: inspector (como las barras laterales de VS Code).
      // Por `code`: con Alt, en Mac `key` es «∫».
      if (mod && !e.shiftKey && e.code === 'KeyB' && mode !== 'mobile') { e.preventDefault(); togglePanel(e.altKey ? 'right' : 'left'); return; }
      if (mod && (key === 'k' || key === 'f') && !e.shiftKey && !e.altKey) { e.preventDefault(); setSearchOpen(o => !o); setKeysOpen(false); return; }
      const tg = e.target as HTMLElement | null;
      const typing = !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
      if (e.key === '?' && !typing && !mod) { e.preventDefault(); setKeysOpen(o => !o); setSearchOpen(false); }
      // F2 renombra el único nodo seleccionado aunque el foco no esté en el lienzo (p. ej. tras la paleta de comandos)
      if (e.key === 'F2' && !typing && !readOnly && selection.nodes.length === 1) { e.preventDefault(); setRenaming(selection.nodes[0]!); }
      // Shift+F10 / tecla Menú: menú contextual de lo seleccionado, con el foco en el lienzo (o perdido tras borrar).
      if (isContextMenuKey(e) && !typing) {
        const a = document.activeElement;
        if ((!a || a === document.body || !!a.closest('.ad-canvas')) && openContextMenuFor(selection)) e.preventDefault();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [readOnly, selection, setRenaming, setKeysOpen, mode, togglePanel]);

  const curView = useRecord('views', ed.viewId);
  const libraries = useCollection('libraries');
  const actions = useMemo<SearchAction[]>(() => {
    const packs = registry.allPacks().filter(p => p.id !== 'core');
    const out: SearchAction[] = [];
    const pack = curView ? registry.pack(curView.notationId) : undefined;
    if (!readOnly) {
      out.push({ id: NEW_VIEW_ACTION, label: t('Nueva vista…'), hint: t('Elegir notación'), keywords: t('nueva vista crear notacion') });
      // Una por notación: solo al buscar (o dentro de «Nueva vista…»).
      for (const p of packs) out.push({ id: `new-view:${p.id}`, label: t('Crear vista {name}', { name: p.name }), hint: t('Acción'), keywords: t('nueva vista crear'), searchOnly: true });
      out.push({ id: 'workspace', label: t('Abrir Espacio (librerías, reglas, personas)'), hint: t('Acción'), keywords: t('librerias reglas personas espacio') });
      if (onRequestLayout) out.push({ id: 'layout', label: t('Layout automático de la vista'), hint: t('Acción'), keywords: t('ordenar colocar layout automatico') });
      // «Añadir <tipo>» para cada tipo de la notación de la vista y de las librerías (solo al buscar).
      if (curView) {
        const seen = new Set<string>();
        const add = (id: string, name: string, where: string, category?: string) => {
          if (seen.has(id)) return; seen.add(id);
          out.push({ id: `add:${id}`, label: t('Añadir {type}', { type: name }), hint: where, keywords: `${t('añadir crear nuevo elemento')} ${category ?? ''}`, searchOnly: true });
        };
        for (const ty of pack?.elementTypes ?? []) if (!ty.abstract) add(ty.id, ty.name, pack!.name, ty.category ? pack!.categories.find(c => c.id === ty.category)?.name ?? ty.category : undefined);
        for (const lib of libraries) for (const ty of lib.elementTypes) add(ty.id, registry.elementType(ty.id)?.name ?? ty.name, lib.name || t('Librería'), ty.category);
      }
    }
    out.push({ id: GO_VIEW_ACTION, label: t('Ir a la vista…'), hint: t('Elegir vista'), keywords: t('ir vista abrir cambiar saltar') });
    if (curView && SIMULABLE.has(curView.notationId)) out.push({ id: 'simulate', label: t('Simular esta vista'), hint: t('Acción'), keywords: t('simular ejecutar probar tokens') });
    if (onCommand) {
      const on = new Set<AppCommand>(commands ?? APP_COMMANDS);
      for (const id of APP_COMMANDS) {
        const c = APP_COMMAND_TEXT[id];
        if (!on.has(id) || (c.view && !curView) || (c.edit && readOnly)) continue;
        out.push({ id: `app:${id}`, label: t(c.label), hint: t('Acción'), keywords: t(c.keywords) });
      }
    }
    if (ed.docsHref && pack) out.push({ id: 'docs:notation', label: t('Abrir la documentación de {name}', { name: pack.name }), hint: t('Ayuda'), keywords: t('ayuda documentacion manual notacion') });
    out.push({ id: 'text', label: t('Editar como texto'), hint: 'Ctrl+Shift+E', keywords: t('texto lenguaje dsl codigo editar') });
    out.push({ id: 'fit', label: t('Ajustar a la vista'), hint: 'Ctrl+Shift+F', keywords: t('encuadrar zoom') });
    out.push({ id: 'theme', label: t('Cambiar tema (claro / oscuro)'), hint: t('Acción'), keywords: t('tema oscuro claro') });
    out.push({ id: 'shortcuts', label: t('Atajos de teclado'), hint: '?', keywords: t('ayuda teclas') });
    return out;
  }, [registry, readOnly, onRequestLayout, t, lang, curView?.notationId, !!curView, libraries, onCommand, commands, ed.docsHref]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((id: string) => {
    if (id.startsWith('new-view:')) {
      const notationId = id.slice('new-view:'.length);
      const pack = registry.pack(notationId);
      const v = makeView(t('Nueva vista {name}', { name: pack?.name ?? '' }).trim(), { notationId, kind: pack?.viewKind ?? 'freeform' });
      if (v.kind === 'grid') v.grid = { layers: [{ id: newId('ly'), name: t('Negocio'), color: '#fde68a' }, { id: newId('ly'), name: t('Aplicación'), color: '#bfdbfe' }, { id: newId('ly'), name: t('Tecnología'), color: '#bbf7d0' }], stages: [t('Inicio'), t('Proceso'), t('Fin')].map(n => ({ id: newId('st'), name: n })), stageGroups: [] };
      run({ type: 'set', collection: 'views', id: v.id, value: v });
      openView(v.id);
    }
    else if (id.startsWith('add:')) {
      const typeId = id.slice('add:'.length);
      const vid = ed.viewId;
      if (vid) addPayloadToCanvas({ kind: DND_TYPE, data: typeId }, ed.store, registry, vid, ed.store.get('views', vid)?.kind !== 'sequence');
    }
    else if (id.startsWith('app:')) onCommand?.(id.slice('app:'.length) as AppCommand);
    else if (id === 'simulate') { ed.closeComments(); setSimOpen(true); }
    else if (id === 'docs:notation') {
      const v = ed.viewId ? ed.store.get('views', ed.viewId) : undefined;
      if (v && ed.docsHref) window.open(ed.docsHref(`notaciones/${v.notationId}`), '_blank', 'noopener');
    }
    else if (id === 'workspace') openWorkspacePanel();
    else if (id === 'layout') onRequestLayout?.();
    else if (id === 'text') setTextOpen(true);
    else if (id === 'fit') canvas.current?.fitView();
    else if (id === 'theme') setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    else if (id === 'shortcuts') setKeysOpen(true);
  }, [registry, run, openView, onRequestLayout, canvas, setTheme, effectiveTheme, openWorkspacePanel, t, setKeysOpen, ed, onCommand]); // eslint-disable-line react-hooks/exhaustive-deps -- setSimOpen es estable

  // En la hoja "Añadir" del móvil, tocar un elemento de la paleta lo añade (lo hace la propia paleta, igual que un
  // clic en escritorio) y la hoja se cierra para ver el resultado.
  const tapToAdd = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.ad-pal__item[draggable]');
    if (!item || (e.target as HTMLElement).closest('button, input, a')) return;
    setSheet(null);
  }, []);

  // Simulación: solo lectura del modelo; las marcas de los nodos van por `SimMarksContext`.
  const [simMarks] = useState(createSimMarks);
  const [simOpen, setSimOpen] = useState(false);
  const simView = useRecord('views', ed.viewId);
  const canSim = !!simView && SIMULABLE.has(simView.notationId);
  useEffect(() => { if (!canSim) setSimOpen(false); }, [canSim]);
  const simButton = canSim && <button className={`ad-btn ${simOpen ? 'is-on' : ''}`} aria-pressed={simOpen} onClick={() => { if (!simOpen) ed.closeComments(); setSimOpen(o => !o); }} title={t('Simular el proceso o la máquina de estados de esta vista')}><svg className="ad-icon" width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true"><path d="M5 3l8 5-8 5Z" /></svg><span className="ad-btn__label">{t('Simular')}</span></button>;
  const textButton = <button className={`ad-btn ${textOpen ? 'is-on' : ''}`} aria-pressed={textOpen} aria-label={t('Texto')} onClick={() => setTextOpen(o => !o)} title={t('Editar como texto (Ctrl+Shift+E)')}><svg className="ad-icon" width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" /></svg><span className="ad-btn__label">{t('Texto')}</span></button>;
  const left = readOnly ? <>{toolbarLeft}{simButton}{textButton}</> : <>
    {mode !== 'mobile' && <button className="ad-btn" onClick={() => openWorkspacePanel()} title={t('Librerías, reglas de estilo, personas y trazabilidad')}>{t('Espacio')}</button>}
    {toolbarLeft}
    {simButton}
    {textButton}
  </>;
  const mobile = mode === 'mobile';
  // Escritorio y tableta: los paneles se ocultan con los botones de la barra o Ctrl+B / Ctrl+Alt+B. Móvil: hojas.
  const showLeft = !mobile && panels.left;
  const showRight = !mobile && panels.right;
  const sheetTitle: Record<Sheet, string> = { views: t('Vistas'), add: t('Añadir'), inspector: t('Inspector'), more: t('Más') };
  return (
    <div className={`ad-editor theme-${effectiveTheme} ad-editor--${mode} ${readOnly ? 'is-readonly' : ''} ${showLeft ? '' : 'is-left-hidden'} ${showRight ? '' : 'is-right-hidden'}`}>
      <Toolbar left={left} right={mobile ? undefined : toolbarRight} onSearch={() => setSearchOpen(true)} onShortcuts={() => setKeysOpen(true)}
        panels={mobile ? undefined : panelToggles} compact={mobile} onMore={() => setSheet(s => (s === 'more' ? null : 'more'))} />
      <div className="ad-editor__body">
        {showLeft && <div className="ad-editor__left"><ViewsPanel />{!readOnly && <Palette />}</div>}
        <main className={`ad-editor__main${simOpen ? ' ad-sim-on' : ''}`}><SimMarksContext.Provider value={simOpen ? simMarks : NO_SIM_MARKS}><Canvas onRequestLayout={onRequestLayout} /></SimMarksContext.Provider><Problems />
          {simOpen && ed.viewId && <Suspense fallback={null}><SimulationPanel key={ed.viewId} viewId={ed.viewId} marks={simMarks} onClose={() => setSimOpen(false)} /></Suspense>}
          {textOpen && <Suspense fallback={null}><TextPanel onClose={() => setTextOpen(false)} layout={layout} defaultSize={defaultSize} /></Suspense>}
          {comments.open && <CommentsPanel />}</main>
        {showRight && <Inspector />}
      </div>
      {mobile && (
        <nav className="ad-tabbar" aria-label={t('Paneles')}>
          <button className={`ad-tabbar__btn ${sheet === 'views' ? 'is-on' : ''}`} aria-pressed={sheet === 'views'} onClick={() => setSheet(s => (s === 'views' ? null : 'views'))}><Icon name="layers" size={20} />{t('Vistas')}</button>
          {!readOnly && <button className={`ad-tabbar__btn ${sheet === 'add' ? 'is-on' : ''}`} aria-pressed={sheet === 'add'} onClick={() => setSheet(s => (s === 'add' ? null : 'add'))}><Icon name="shapes" size={20} />{t('Añadir')}</button>}
          <button className={`ad-tabbar__btn ${sheet === 'inspector' ? 'is-on' : ''}`} aria-pressed={sheet === 'inspector'} onClick={() => setSheet(s => (s === 'inspector' ? null : 'inspector'))}><Icon name="sliders" size={20} />{t('Inspector')}</button>
          <button className={`ad-tabbar__btn ${sheet === 'more' ? 'is-on' : ''}`} aria-pressed={sheet === 'more'} onClick={() => setSheet(s => (s === 'more' ? null : 'more'))}><Icon name="more" size={20} />{t('Más')}</button>
        </nav>
      )}
      {mobile && sheet && (
        <BottomSheet title={sheetTitle[sheet]} onClose={() => setSheet(null)}>
          {/* Elegir (o crear) una vista cierra la hoja para ver el lienzo */}
          {sheet === 'views' && <ViewsPanel onOpen={() => setSheet(null)} />}
          {sheet === 'add' && <div className="ad-sheet__pal" onClick={tapToAdd}><div className="ad-hint">{t('Toca un elemento para añadirlo al centro del lienzo.')}</div><Palette /></div>}
          {sheet === 'inspector' && <Inspector />}
          {sheet === 'more' && (
            <div className="ad-sheet__more">
              <Crumbs />
              <div className="ad-sheet__row">
                {!readOnly && <button className="ad-btn" onClick={() => { setSheet(null); openWorkspacePanel(); }}><Icon name="box" /><span className="ad-btn__label">{t('Espacio')}</span></button>}
                <ToolbarTools labels onSearch={() => { setSheet(null); setSearchOpen(true); }} onShortcuts={() => { setSheet(null); setKeysOpen(true); }} />
                <button className="ad-btn" onClick={() => { setSheet(null); canvas.current?.fitView(); }}><Icon name="fit" /><span className="ad-btn__label">{t('Ajustar a la vista')}</span></button>
                {onRequestLayout && !readOnly && <button className="ad-btn" onClick={() => { setSheet(null); onRequestLayout(); }}><Icon name="layout" /><span className="ad-btn__label">{t('Layout automático')}</span></button>}
              </div>
              {toolbarRight && <div className="ad-sheet__row ad-sheet__app">{toolbarRight}</div>}
            </div>
          )}
        </BottomSheet>
      )}
      {!readOnly && <WorkspacePanel open={workspaceTab !== null} onClose={closeWorkspacePanel} initialTab={workspaceTab ?? 'libraries'} />}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} actions={actions} onAction={onAction} />
      <ShortcutsPanel open={keysOpen} onClose={() => setKeysOpen(false)} />
    </div>
  );
}

/** Hoja deslizante desde abajo (móvil): 70 % de alto; se cierra con Escape, tocando fuera o arrastrando el asa hacia abajo. */
function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number } | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !inLayer(e)) { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  const onTouchStart = (e: ReactTouchEvent) => { drag.current = { y0: e.touches[0]!.clientY, dy: 0 }; };
  const onTouchMove = (e: ReactTouchEvent) => {
    if (!drag.current || !box.current) return;
    drag.current.dy = Math.max(0, e.touches[0]!.clientY - drag.current.y0);
    box.current.style.transform = drag.current.dy ? `translateY(${drag.current.dy}px)` : '';
  };
  const onTouchEnd = () => {
    const dy = drag.current?.dy ?? 0; drag.current = null;
    if (box.current) box.current.style.transform = '';
    if (dy > 80) onClose();
  };
  return (
    <div className="ad-sheet__backdrop" onClick={onClose}>
      <div ref={box} className="ad-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="ad-sheet__grip" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
          <span className="ad-sheet__handle" aria-hidden="true" />
          <span className="ad-sheet__title">{title}</span>
          <button className="ad-btn ad-btn--ghost ad-sheet__close" onClick={onClose} aria-label={t('Cerrar')}><Icon name="close" /></button>
        </div>
        <div className="ad-sheet__body">{children}</div>
      </div>
    </div>
  );
}
