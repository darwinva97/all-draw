/**
 * Panel del espacio de trabajo: edición desde la interfaz de librerías (tipos, campos y
 * componentes), reglas de estilo y personas. Es un overlay a pantalla completa con pestañas.
 */
import { useEffect, useState } from 'react';
import { LibrariesTab } from './WorkspaceLibraries';
import { RulesTab } from './WorkspaceRules';
import { PeopleTab } from './WorkspacePeople';

export type WorkspaceTab = 'libraries' | 'rules' | 'people';

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'libraries', label: 'Librerías' }, { id: 'rules', label: 'Reglas' }, { id: 'people', label: 'Personas' },
];

export function WorkspacePanel({ open, onClose, initialTab = 'libraries' }: { open: boolean; onClose: () => void; initialTab?: WorkspaceTab }) {
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ad-ws-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ad-ws-dialog" role="dialog" aria-modal="true" aria-label="Espacio de trabajo">
        <header className="ad-ws-head">
          <strong className="ad-ws-title">Espacio</strong>
          <div className="ad-tabs ad-ws-tabs">
            {TABS.map(t => <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>
          <button className="ad-btn ad-btn--ghost ad-ws-close" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">×</button>
        </header>
        <div className="ad-ws-body">
          {tab === 'libraries' && <LibrariesTab />}
          {tab === 'rules' && <RulesTab />}
          {tab === 'people' && <PeopleTab />}
        </div>
      </div>
    </div>
  );
}
