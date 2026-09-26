import type { ReactNode } from 'react';
import { useEditor } from '../context';
import { useRecord, useAnyChange } from '../hooks';

/** Barra superior: breadcrumb de navegación, deshacer/rehacer y acciones que inyecta la app. */
export function Toolbar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  const { history, trail, openView, back, registry, readOnly, store } = useEditor();
  useAnyChange();
  const current = useRecord('views', trail[trail.length - 1]);
  return (
    <header className="ad-toolbar">
      {left}
      <nav className="ad-crumbs">
        {trail.length > 1 && <button className="ad-btn" onClick={back} title="Volver (vista anterior)">←</button>}
        {trail.map((id, i) => {
          const v = store.get('views', id);
          return <span key={id + i} className="ad-crumb">{i > 0 && <span className="ad-crumb__sep">›</span>}<button className={`ad-link ${i === trail.length - 1 ? 'is-current' : ''}`} onClick={() => openView(id)}>{v?.name ?? '?'}</button></span>;
        })}
        {current && <span className="ad-crumb__notation" style={{ background: registry.pack(current.notationId)?.color ?? '#999' }}>{registry.pack(current.notationId)?.name}</span>}
      </nav>
      <div className="ad-toolbar__spacer" />
      {!readOnly && <>
        <button className="ad-btn" disabled={!history.canUndo} onClick={() => history.undo()} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="ad-btn" disabled={!history.canRedo} onClick={() => history.redo()} title="Rehacer (Ctrl+Y)">↷</button>
      </>}
      {right}
    </header>
  );
}
