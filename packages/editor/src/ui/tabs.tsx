/**
 * Pestañas accesibles (patrón WAI-ARIA "tabs" con activación automática): `role=tablist/tab/tabpanel`,
 * solo la pestaña activa está en el orden de Tab, ← → Inicio Fin cambian de pestaña y mueven el foco.
 *
 *   const ids = useTabIds();
 *   <TabList ids={ids} label={t('Secciones')} tabs={[{ id: 'a', label: 'A' }, …]} value={tab} onChange={setTab} />
 *   <div {...tabPanelProps(ids, tab)}>…</div>
 */
import { useId, useRef, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { moveIndex } from './roving';

export interface TabDef<T extends string> { id: T; label: ReactNode; title?: string }
export interface TabIds { base: string }

/** Base de ids estable para enlazar pestañas y panel. */
export function useTabIds(): TabIds { return { base: `ad${useId().replace(/[^\w-]/g, '')}` }; }

export const tabId = (ids: TabIds, id: string) => `${ids.base}-tab-${id}`;
export const panelId = (ids: TabIds) => `${ids.base}-panel`;

/** Atributos del panel de la pestaña `active`. */
export function tabPanelProps(ids: TabIds, active: string) {
  return { role: 'tabpanel' as const, id: panelId(ids), 'aria-labelledby': tabId(ids, active), tabIndex: 0 };
}

export function TabList<T extends string>({ ids, tabs, value, onChange, label, className = 'ad-tabs' }: {
  ids: TabIds; tabs: TabDef<T>[]; value: T; onChange: (id: T) => void; label: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const i = tabs.findIndex(tb => tb.id === value);
    const j = moveIndex(e.key, i, tabs.length, 'horizontal');
    if (j === null) return;
    e.preventDefault();
    const next = tabs[j]!;
    onChange(next.id);
    ref.current?.ownerDocument.getElementById(tabId(ids, next.id))?.focus();
  };
  return (
    <div ref={ref} className={className} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map(tb => {
        const on = tb.id === value;
        return <button key={tb.id} type="button" role="tab" id={tabId(ids, tb.id)} aria-selected={on} aria-controls={panelId(ids)} tabIndex={on ? 0 : -1}
          className={on ? 'is-active' : ''} title={tb.title} onClick={() => onChange(tb.id)}>{tb.label}</button>;
      })}
    </div>
  );
}
