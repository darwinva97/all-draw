import type { ReactNode } from 'react';
import { useT } from '@all-draw/i18n';
import { useEditor, type Theme } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { usePeers, initials } from '../presence';
import { CommentsToolButton } from './Comments';
import { Icon, type IconName } from '../icons';

/** Paneles laterales colapsables (rango tableta): estado y conmutadores. */
export interface PanelToggles {
  left: boolean;
  right: boolean;
  toggleLeft(): void;
  toggleRight(): void;
}

export interface ToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  onSearch?: () => void;
  onShortcuts?: () => void;
  /** Rango tableta: botones para mostrar/ocultar Vistas+Paleta y el Inspector. */
  panels?: PanelToggles;
  /** Móvil: barra reducida (nombre, deshacer/rehacer y menú "⋯"); el resto va en la hoja "Más". */
  compact?: boolean;
  onMore?: () => void;
}

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
/** Claves en español; se traducen con `t()` al pintarlas. */
const THEME_LABEL: Record<Theme, string> = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };
const THEME_ICON: Record<Theme, IconName> = { system: 'contrast', light: 'sun', dark: 'moon' };

/** Breadcrumb de navegación entre vistas (con la etiqueta de la notación actual). */
export function Crumbs() {
  const t = useT();
  const { trail, openView, back, registry, store } = useEditor();
  useAnyChange();
  const current = useRecord('views', trail[trail.length - 1]);
  return (
    <nav className="ad-crumbs" aria-label={t('Ruta de vistas')}>
      {trail.length > 1 && <button className="ad-btn" onClick={back} title={t('Volver (vista anterior)')} aria-label={t('Volver a la vista anterior')}><Icon name="arrowLeft" /></button>}
      {trail.map((id, i) => {
        const v = store.get('views', id);
        return <span key={id + i} className="ad-crumb">{i > 0 && <span className="ad-crumb__sep"><Icon name="chevronRight" size={12} /></span>}<button className={`ad-link ${i === trail.length - 1 ? 'is-current' : ''}`} aria-current={i === trail.length - 1 ? 'page' : undefined} onClick={() => openView(id)}>{v?.name ?? '?'}</button></span>;
      })}
      {current && <span className="ad-crumb__notation" style={{ background: registry.pack(current.notationId)?.color ?? '#999' }}>{registry.pack(current.notationId)?.name}</span>}
    </nav>
  );
}

/** Herramientas comunes: presencia, búsqueda, rejilla, tema y atajos. Van en la barra (escritorio/tableta) o en la hoja "Más" (móvil). */
export function ToolbarTools({ onSearch, onShortcuts, labels }: { onSearch?: () => void; onShortcuts?: () => void; /** Con texto junto al icono (hoja móvil). */ labels?: boolean }) {
  const t = useT();
  const { readOnly, store, presence, theme, setTheme, snap, setSnap } = useEditor();
  const peers = usePeers(presence?.awareness);
  const lbl = (s: string) => (labels ? <span className="ad-btn__label">{s}</span> : null);
  return <>
    {presence && (
      <div className="ad-presence" role="group" aria-label={t('Personas conectadas')} title={[t('{name} (tú)', { name: presence.me.name }), ...peers.map(p => p.name)].join(', ')}>
        <span className="ad-avatar is-me" style={{ background: presence.me.color }} title={t('{name} (tú)', { name: presence.me.name })}>{initials(presence.me.name)}</span>
        {peers.slice(0, 6).map(p => <span key={p.clientId} className="ad-avatar" style={{ background: p.color }} title={`${p.name}${p.viewId ? ` · ${store.get('views', p.viewId)?.name ?? ''}` : ''}`}>{initials(p.name)}</span>)}
        {peers.length > 6 && <span className="ad-avatar ad-avatar--more">+{peers.length - 6}</span>}
      </div>
    )}
    <CommentsToolButton labels={labels} />
    {onSearch && <button className="ad-btn" onClick={onSearch} title={t('Buscar (Ctrl+K)')} aria-label={t('Buscar (Ctrl+K)')} aria-haspopup="dialog"><Icon name="search" />{lbl(t('Buscar'))}</button>}
    {!readOnly && <button className={`ad-btn ${snap ? 'is-on' : ''}`} onClick={() => setSnap(!snap)} title={snap ? t('Ajuste a rejilla de 8 px activado (Alt lo desactiva mientras se pulsa)') : t('Ajuste a rejilla desactivado')} aria-pressed={snap} aria-label={t('Ajuste a rejilla')}><Icon name="snap" />{lbl(t('Rejilla'))}</button>}
    <button className="ad-btn" onClick={() => setTheme(THEME_NEXT[theme])} title={`${t(THEME_LABEL[theme])} · ${t('clic para cambiar')}`} aria-label={`${t(THEME_LABEL[theme])} · ${t('cambiar tema')}`}><Icon name={THEME_ICON[theme]} />{lbl(t(THEME_LABEL[theme]))}</button>
    {onShortcuts && <button className="ad-btn" onClick={onShortcuts} title={t('Atajos de teclado (?)')} aria-label={t('Atajos de teclado')} aria-haspopup="dialog"><Icon name="keyboard" />{lbl(t('Atajos'))}</button>}
  </>;
}

/** Barra superior: breadcrumb de navegación, deshacer/rehacer, presencia, tema, rejilla y acciones que inyecta la app. */
export function Toolbar({ left, right, onSearch, onShortcuts, panels, compact, onMore }: ToolbarProps) {
  const t = useT();
  const { history, readOnly } = useEditor();
  useAnyChange();
  const undoRedo = !readOnly && <>
    <button className="ad-btn" disabled={!history.canUndo} onClick={() => history.undo()} title={t('Deshacer (Ctrl+Z)')} aria-label={t('Deshacer (Ctrl+Z)')}><Icon name="undo" /></button>
    <button className="ad-btn" disabled={!history.canRedo} onClick={() => history.redo()} title={t('Rehacer (Ctrl+Y)')} aria-label={t('Rehacer (Ctrl+Y)')}><Icon name="redo" /></button>
  </>;
  if (compact) {
    return (
      <header className="ad-toolbar ad-toolbar--compact">
        {left}
        <div className="ad-toolbar__spacer" />
        {undoRedo}
        <button className="ad-btn" onClick={onMore} title={t('Más opciones')} aria-label={t('Más opciones')} aria-haspopup="dialog"><Icon name="more" /></button>
      </header>
    );
  }
  return (
    <header className="ad-toolbar">
      {panels && <button className={`ad-btn ad-btn--panel ${panels.left ? 'is-on' : ''}`} onClick={panels.toggleLeft} aria-pressed={panels.left} title={t('Mostrar u ocultar vistas y paleta')} aria-label={t('Mostrar u ocultar vistas y paleta')}><Icon name="panelLeft" /></button>}
      {left}
      <Crumbs />
      <div className="ad-toolbar__spacer" />
      <ToolbarTools onSearch={onSearch} onShortcuts={onShortcuts} />
      {undoRedo}
      {right}
      {panels && <button className={`ad-btn ad-btn--panel ${panels.right ? 'is-on' : ''}`} onClick={panels.toggleRight} aria-pressed={panels.right} title={t('Mostrar u ocultar el inspector')} aria-label={t('Mostrar u ocultar el inspector')}><Icon name="panelRight" /></button>}
    </header>
  );
}
