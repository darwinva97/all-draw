import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { makeView, newId } from '@all-draw/core';
import { Canvas } from './Canvas';
import { Palette } from './panels/Palette';
import { Inspector } from './panels/Inspector';
import { ViewsPanel } from './panels/ViewsPanel';
import { Problems } from './panels/Problems';
import { Toolbar, Crumbs, ToolbarTools } from './panels/Toolbar';
import { WorkspacePanel } from './panels/WorkspacePanel';
import { CommandPalette } from './panels/CommandPalette';
import { ShortcutsPanel } from './panels/ShortcutsPanel';
import { CommentsPanel } from './panels/Comments';
import { useEditor, type Theme } from './context';
import type { SearchAction } from './search';
import { useT, useLang } from '@all-draw/i18n';
import { Icon } from './icons';
import { inLayer } from './ui/layer';
import { mountUiLayer } from './ui/toast';
import './ui/dialog';
import './editor.css';

export interface EditorProps {
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  /** Tema forzado por la app; si no se da, manda el toggle de la barra (persistido en `localStorage('alldraw:theme')`). */
  theme?: Theme;
  /** Layout automático de la vista actual: la app lo conecta (p. ej. a `@all-draw/layout`). Sin él, la opción no aparece. */
  onRequestLayout?: () => void;
}

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
export function Editor({ toolbarLeft, toolbarRight, theme, onRequestLayout }: EditorProps) {
  const ed = useEditor();
  const t = useT();
  const [lang] = useLang(); // las acciones memorizadas se rehacen al cambiar de idioma
  const { readOnly, effectiveTheme, setTheme, registry, run, openView, canvas, selection, setRenaming, workspaceTab, openWorkspacePanel, closeWorkspacePanel, comments } = ed;
  const [searchOpen, setSearchOpen] = useState(false);
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
      if (mod && (key === 'k' || key === 'f') && !e.shiftKey && !e.altKey) { e.preventDefault(); setSearchOpen(o => !o); setKeysOpen(false); return; }
      const tg = e.target as HTMLElement | null;
      const typing = !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable);
      if (e.key === '?' && !typing && !mod) { e.preventDefault(); setKeysOpen(o => !o); setSearchOpen(false); }
      // F2 renombra el único nodo seleccionado aunque el foco no esté en el lienzo (p. ej. tras la paleta de comandos)
      if (e.key === 'F2' && !typing && !readOnly && selection.nodes.length === 1) { e.preventDefault(); setRenaming(selection.nodes[0]!); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [readOnly, selection.nodes, setRenaming, setKeysOpen]);

  const actions = useMemo<SearchAction[]>(() => {
    const packs = registry.allPacks().filter(p => p.id !== 'core');
    const out: SearchAction[] = [];
    if (!readOnly) {
      for (const p of packs) out.push({ id: `new-view:${p.id}`, label: t('Crear vista {name}', { name: p.name }), hint: t('Acción'), keywords: t('nueva vista crear') });
      out.push({ id: 'workspace', label: t('Abrir Espacio (librerías, reglas, personas)'), hint: t('Acción'), keywords: t('librerias reglas personas espacio') });
      if (onRequestLayout) out.push({ id: 'layout', label: t('Layout automático de la vista'), hint: t('Acción'), keywords: t('ordenar colocar layout automatico') });
    }
    out.push({ id: 'fit', label: t('Ajustar a la vista'), hint: 'Ctrl+Shift+F', keywords: t('encuadrar zoom') });
    out.push({ id: 'theme', label: t('Cambiar tema (claro / oscuro)'), hint: t('Acción'), keywords: t('tema oscuro claro') });
    out.push({ id: 'shortcuts', label: t('Atajos de teclado'), hint: '?', keywords: t('ayuda teclas') });
    return out;
  }, [registry, readOnly, onRequestLayout, t, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const onAction = useCallback((id: string) => {
    if (id.startsWith('new-view:')) {
      const notationId = id.slice('new-view:'.length);
      const pack = registry.pack(notationId);
      const v = makeView(t('Nueva vista {name}', { name: pack?.name ?? '' }).trim(), { notationId, kind: pack?.viewKind ?? 'freeform' });
      if (v.kind === 'grid') v.grid = { layers: [{ id: newId('ly'), name: t('Negocio'), color: '#fde68a' }, { id: newId('ly'), name: t('Aplicación'), color: '#bfdbfe' }, { id: newId('ly'), name: t('Tecnología'), color: '#bbf7d0' }], stages: [t('Inicio'), t('Proceso'), t('Fin')].map(n => ({ id: newId('st'), name: n })), stageGroups: [] };
      run({ type: 'set', collection: 'views', id: v.id, value: v });
      openView(v.id);
    }
    else if (id === 'workspace') openWorkspacePanel();
    else if (id === 'layout') onRequestLayout?.();
    else if (id === 'fit') canvas.current?.fitView();
    else if (id === 'theme') setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
    else if (id === 'shortcuts') setKeysOpen(true);
  }, [registry, run, openView, onRequestLayout, canvas, setTheme, effectiveTheme, openWorkspacePanel, t, setKeysOpen]);

  // En la hoja "Añadir" del móvil no hay arrastre: un toque sobre un elemento de la paleta lo suelta en el centro del lienzo
  // reutilizando el mismo `dragstart`/`drop` que en escritorio (DataTransfer sintético), sin tocar la paleta ni el lienzo.
  const tapToAdd = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.ad-pal__item[draggable]');
    if (!item || (e.target as HTMLElement).closest('button, input, a')) return;
    const pane = document.querySelector<HTMLElement>('.ad-canvas .react-flow__pane');
    if (!pane || typeof DataTransfer === 'undefined' || typeof DragEvent === 'undefined') return;
    const dt = new DataTransfer();
    item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const r = pane.getBoundingClientRect();
    pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    setSheet(null);
  }, []);

  const left = readOnly ? toolbarLeft : <>
    {mode !== 'mobile' && <button className="ad-btn" onClick={() => openWorkspacePanel()} title={t('Librerías, reglas de estilo, personas y trazabilidad')}>{t('Espacio')}</button>}
    {toolbarLeft}
  </>;
  const mobile = mode === 'mobile', tablet = mode === 'tablet';
  const showLeft = !mobile && (!tablet || panels.left);
  const showRight = !mobile && (!tablet || panels.right);
  const sheetTitle: Record<Sheet, string> = { views: t('Vistas'), add: t('Añadir'), inspector: t('Inspector'), more: t('Más') };
  return (
    <div className={`ad-editor theme-${effectiveTheme} ad-editor--${mode} ${readOnly ? 'is-readonly' : ''} ${showLeft ? '' : 'is-left-hidden'} ${showRight ? '' : 'is-right-hidden'}`}>
      <Toolbar left={left} right={mobile ? undefined : toolbarRight} onSearch={() => setSearchOpen(true)} onShortcuts={() => setKeysOpen(true)}
        panels={tablet ? panelToggles : undefined} compact={mobile} onMore={() => setSheet(s => (s === 'more' ? null : 'more'))} />
      <div className="ad-editor__body">
        {showLeft && <div className="ad-editor__left"><ViewsPanel />{!readOnly && <Palette />}</div>}
        <main className="ad-editor__main"><Canvas onRequestLayout={onRequestLayout} /><Problems />{comments.open && <CommentsPanel />}</main>
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
          {sheet === 'views' && <ViewsPanel />}
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
