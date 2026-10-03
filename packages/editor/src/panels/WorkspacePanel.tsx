/**
 * Panel del espacio de trabajo: edición desde la interfaz de librerías (tipos, campos y
 * componentes), reglas de estilo, personas y trazabilidad entre notaciones. Es un overlay a pantalla completa con pestañas.
 */
import { useEffect, useState } from 'react';
import { useT } from '@all-draw/i18n';
import { LibrariesTab } from './WorkspaceLibraries';
import { RulesTab } from './WorkspaceRules';
import { PeopleTab } from './WorkspacePeople';
import { TracesTab } from './WorkspaceTraces';
import { Icon } from '../icons';
import { useModal } from '../ui/modal';
import { TabList, tabPanelProps, useTabIds } from '../ui/tabs';
import { HelpLink } from './HelpLink';

export type WorkspaceTab = 'libraries' | 'rules' | 'people' | 'traces';

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: 'libraries', label: 'Librerías' }, { id: 'rules', label: 'Reglas' }, { id: 'people', label: 'Personas' }, { id: 'traces', label: 'Trazabilidad' },
];
/** Capítulo de la documentación de cada pestaña. */
const HELP: Record<WorkspaceTab, [string, string?]> = { libraries: ['librerias-reglas-personas'], rules: ['librerias-reglas-personas'], people: ['librerias-reglas-personas'], traces: ['conceptos', 'trazas'] };

export function WorkspacePanel({ open, onClose, initialTab = 'libraries' }: { open: boolean; onClose: () => void; initialTab?: WorkspaceTab }) {
  const t = useT();
  const [tab, setTab] = useState<WorkspaceTab>(initialTab);
  const tabIds = useTabIds();
  // Foco atrapado mientras está abierto, Escape cierra y el foco vuelve al botón (o atajo) que lo abrió.
  const box = useModal(open, onClose);
  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);
  if (!open) return null;
  return (
    <div className="ad-ws-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} className="ad-ws-dialog" role="dialog" aria-modal="true" aria-label={t('Espacio de trabajo')}>
        <header className="ad-ws-head">
          <strong className="ad-ws-title">{t('Espacio')}</strong>
          <TabList ids={tabIds} className="ad-tabs ad-ws-tabs" label={t('Secciones del espacio')} value={tab} onChange={setTab} tabs={TABS.map(tb => ({ id: tb.id, label: t(tb.label) }))} />
          <HelpLink slug={HELP[tab][0]} anchor={HELP[tab][1]} className="ad-ws-help" />
          <button className="ad-btn ad-btn--ghost ad-ws-close" onClick={onClose} title={t('Cerrar (Esc)')} aria-label={t('Cerrar')}><Icon name="close" size={14} /></button>
        </header>
        <div className="ad-ws-body" {...tabPanelProps(tabIds, tab)} tabIndex={-1}>
          {tab === 'libraries' && <LibrariesTab />}
          {tab === 'rules' && <RulesTab />}
          {tab === 'people' && <PeopleTab />}
          {tab === 'traces' && <TracesTab onNavigate={onClose} />}
        </div>
      </div>
    </div>
  );
}
