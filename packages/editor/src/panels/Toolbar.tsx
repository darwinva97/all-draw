import type { ReactNode } from 'react';
import { useEditor, type Theme } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { usePeers, initials } from '../presence';

export interface ToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  onSearch?: () => void;
  onShortcuts?: () => void;
}

const THEME_NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<Theme, string> = { system: 'Tema: sistema', light: 'Tema: claro', dark: 'Tema: oscuro' };
const THEME_ICON: Record<Theme, string> = { system: '◐', light: '☀', dark: '☾' };

/** Barra superior: breadcrumb de navegación, deshacer/rehacer, presencia, tema, rejilla y acciones que inyecta la app. */
export function Toolbar({ left, right, onSearch, onShortcuts }: ToolbarProps) {
  const { history, trail, openView, back, registry, readOnly, store, presence, theme, setTheme, snap, setSnap } = useEditor();
  useAnyChange();
  const current = useRecord('views', trail[trail.length - 1]);
  const peers = usePeers(presence?.awareness);
  return (
    <header className="ad-toolbar">
      {left}
      <nav className="ad-crumbs" aria-label="Ruta de vistas">
        {trail.length > 1 && <button className="ad-btn" onClick={back} title="Volver (vista anterior)" aria-label="Volver a la vista anterior">←</button>}
        {trail.map((id, i) => {
          const v = store.get('views', id);
          return <span key={id + i} className="ad-crumb">{i > 0 && <span className="ad-crumb__sep">›</span>}<button className={`ad-link ${i === trail.length - 1 ? 'is-current' : ''}`} aria-current={i === trail.length - 1 ? 'page' : undefined} onClick={() => openView(id)}>{v?.name ?? '?'}</button></span>;
        })}
        {current && <span className="ad-crumb__notation" style={{ background: registry.pack(current.notationId)?.color ?? '#999' }}>{registry.pack(current.notationId)?.name}</span>}
      </nav>
      <div className="ad-toolbar__spacer" />
      {presence && (
        <div className="ad-presence" role="group" aria-label="Personas conectadas" title={[presence.me.name + ' (tú)', ...peers.map(p => p.name)].join(', ')}>
          <span className="ad-avatar is-me" style={{ background: presence.me.color }} title={`${presence.me.name} (tú)`}>{initials(presence.me.name)}</span>
          {peers.slice(0, 6).map(p => <span key={p.clientId} className="ad-avatar" style={{ background: p.color }} title={`${p.name}${p.viewId ? ` · ${store.get('views', p.viewId)?.name ?? ''}` : ''}`}>{initials(p.name)}</span>)}
          {peers.length > 6 && <span className="ad-avatar ad-avatar--more">+{peers.length - 6}</span>}
        </div>
      )}
      {onSearch && <button className="ad-btn" onClick={onSearch} title="Buscar (Ctrl+K)" aria-label="Buscar (Ctrl+K)" aria-haspopup="dialog">⌕</button>}
      {!readOnly && <button className={`ad-btn ${snap ? 'is-on' : ''}`} onClick={() => setSnap(!snap)} title={snap ? 'Ajuste a rejilla de 8 px activado (Alt lo desactiva mientras se pulsa)' : 'Ajuste a rejilla desactivado'} aria-pressed={snap} aria-label="Ajuste a rejilla">⌗</button>}
      <button className="ad-btn" onClick={() => setTheme(THEME_NEXT[theme])} title={`${THEME_LABEL[theme]} · clic para cambiar`} aria-label={`${THEME_LABEL[theme]} · cambiar tema`}>{THEME_ICON[theme]}</button>
      {onShortcuts && <button className="ad-btn" onClick={onShortcuts} title="Atajos de teclado (?)" aria-label="Atajos de teclado" aria-haspopup="dialog">?</button>}
      {!readOnly && <>
        <button className="ad-btn" disabled={!history.canUndo} onClick={() => history.undo()} title="Deshacer (Ctrl+Z)" aria-label="Deshacer (Ctrl+Z)">↶</button>
        <button className="ad-btn" disabled={!history.canRedo} onClick={() => history.redo()} title="Rehacer (Ctrl+Y)" aria-label="Rehacer (Ctrl+Y)">↷</button>
      </>}
      {right}
    </header>
  );
}
