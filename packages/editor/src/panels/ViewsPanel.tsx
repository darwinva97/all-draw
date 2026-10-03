import { useState } from 'react';
import { makeView, newId, type Dimension, type View } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useCollection } from '../hooks';
import { crossTraceCount } from './traces-helpers';
import { Icon } from '../icons';
import { confirmDialog } from '../ui/dialog';

/** Vistas agrupadas por notación, dimensiones, y creación de vistas. */
export function ViewsPanel() {
  const t = useT();
  const { registry, run, viewId, openView, readOnly, store, openWorkspacePanel } = useEditor();
  const views = useCollection('views');
  useCollection('relations');
  const traceCount = crossTraceCount(store, registry);
  const dims = useCollection('dimensions');
  const [creating, setCreating] = useState(false);
  const packs = registry.allPacks().filter(p => p.id !== 'core');
  const groups = new Map<string, View[]>();
  for (const v of views) groups.set(v.notationId, [...(groups.get(v.notationId) ?? []), v]);

  const create = (notationId: string, viewpointId?: string) => {
    const pack = registry.pack(notationId);
    const v = makeView(t('Nueva vista {pack}', { pack: pack?.name ?? '' }).trim(), { notationId, kind: pack?.viewKind ?? 'freeform', viewpointId });
    if (v.kind === 'grid') v.grid = { layers: [{ id: newId('ly'), name: t('Negocio'), color: '#fde68a' }, { id: newId('ly'), name: t('Aplicación'), color: '#bfdbfe' }, { id: newId('ly'), name: t('Tecnología'), color: '#bbf7d0' }], stages: [t('Inicio'), t('Proceso'), t('Fin')].map(n => ({ id: newId('st'), name: n })), stageGroups: [] };
    run({ type: 'set', collection: 'views', id: v.id, value: v });
    openView(v.id); setCreating(false);
  };
  const addDimension = (d: Omit<Dimension, 'id'>) => run({ type: 'set', collection: 'dimensions', id: newId('dim'), value: { id: newId('dim'), ...d } });

  return (
    <aside className="ad-views" aria-label={t('Vistas y dimensiones')}>
      <div className="ad-views__head"><span>{t('Vistas')}</span>{!readOnly && <button className="ad-btn" aria-label={t('Nueva vista')} title={t('Nueva vista')} aria-expanded={creating} onClick={() => setCreating(c => !c)}><Icon name="plus" /></button>}</div>
      {creating && <div className="ad-views__new">
        {packs.map(p => <button key={p.id} className="ad-popover__item" onClick={() => create(p.id)}><span className="ad-dot" style={{ background: p.color ?? '#999' }} />{p.name}</button>)}
      </div>}
      <div className="ad-views__scroll">
        {views.length === 0 && <div className="ad-empty">{t('Sin vistas todavía. Crea la primera con el botón +.')}</div>}
        {[...groups.entries()].map(([nid, vs]) => (
          <details key={nid} open>
            <summary className="ad-pal__cat"><span className="ad-dot" style={{ background: registry.pack(nid)?.color ?? '#999' }} />{registry.pack(nid)?.name ?? nid} <small>{vs.length}</small></summary>
            {vs.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
              <div key={v.id} className={`ad-views__item ${v.id === viewId ? 'is-active' : ''}`} onClick={() => openView(v.id)} title={v.doc}>
                <span>{v.rootElementId ? <Icon name="diamond" size={12} className="ad-views__detail" /> : null}{v.name || t('(sin nombre)')}</span>
                {!readOnly && <button className="ad-btn ad-btn--ghost" aria-label={t('Borrar la vista {name}', { name: v.name || t('sin nombre') })} title={t('Borrar la vista')} onClick={async e => { e.stopPropagation(); if (await confirmDialog({ title: t('¿Borrar la vista "{name}"?', { name: v.name }), message: t('Los elementos siguen en el modelo y en las demás vistas.'), danger: true })) { run({ type: 'deleteView', id: v.id }); if (v.id === viewId) openView(null); } }}><Icon name="close" size={14} /></button>}
              </div>
            ))}
          </details>
        ))}
        <details open className="ad-views__dims">
          <summary className="ad-pal__cat">{t('Dimensiones')} <small>{dims.length}</small></summary>
          <div className="ad-hint">{t('Ejes por los que se navega desde cualquier nodo (botón derecho → "Abrir en otra dimensión").')}</div>
          {dims.map(d => <div key={d.id} className="ad-views__item"><span><span className="ad-dot" style={{ background: d.color ?? registry.pack(d.notationId)?.color ?? '#999' }} />{d.name} <small>{registry.pack(d.notationId)?.name}{d.viewpointId ? ` · ${d.viewpointId}` : ''}</small></span>
            {!readOnly && <button className="ad-btn ad-btn--ghost" aria-label={t('Quitar la dimensión {name}', { name: d.name })} title={t('Quitar la dimensión')} onClick={() => run({ type: 'delete', collection: 'dimensions', id: d.id })}><Icon name="close" size={14} /></button>}</div>)}
          {!readOnly && <div className="ad-row">
            <select className="ad-input" aria-label={t('Añadir dimensión')} defaultValue="" onChange={e => { const [nid, vp] = e.target.value.split('|'); if (nid) { const p = registry.pack(nid); addDimension({ name: vp ? `${p?.name} · ${p?.viewpoints.find(v => v.id === vp)?.name}` : p?.name ?? nid, notationId: nid, viewpointId: vp || undefined, color: p?.color }); e.target.value = ''; } }}>
              <option value="">{t('Añadir dimensión…')}</option>
              {packs.map(p => <optgroup key={p.id} label={p.name}><option value={p.id}>{p.name} {t('(todo)')}</option>{p.viewpoints.map(v => <option key={v.id} value={`${p.id}|${v.id}`}>{v.name}</option>)}</optgroup>)}
            </select>
          </div>}
        </details>
        <details>
          <summary className="ad-pal__cat">{t('Modelo')} <small>{t('{n} elementos', { n: store.list('elements').filter(e => !e.template).length })} · {t('{n} relaciones', { n: store.list('relations').length })}</small></summary>
          <div className="ad-hint">{t('Los elementos viven una vez en el modelo y aparecen en muchas vistas. Pestaña "Modelo" de la paleta para reutilizarlos.')}</div>
          {readOnly
            ? <div className="ad-tr-count">{t('{n} trazas entre dimensiones', { n: traceCount })}</div>
            : <button className="ad-link ad-tr-count" title={t('Abrir la matriz de trazabilidad')} onClick={() => openWorkspacePanel('traces')}><Icon name="trace" size={14} />{t('{n} trazas entre dimensiones', { n: traceCount })}</button>}
        </details>
      </div>
    </aside>
  );
}
