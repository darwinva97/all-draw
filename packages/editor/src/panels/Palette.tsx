import { useMemo, useState, type DragEvent } from 'react';
import { paletteFor, orphanElements, type ElementType } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { DND_TYPE, DND_TEMPLATE, DND_ELEMENT } from '../Canvas';

/** Paleta: tipos de la notación de la vista (viewpoint primero), tipos de librerías, componentes reutilizables y elementos existentes. */
export function Palette() {
  const { store, registry, viewId } = useEditor();
  const view = useRecord('views', viewId);
  useAnyChange();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'notation' | 'libs' | 'model'>('notation');
  const pal = useMemo(() => (view ? paletteFor(store, registry, view) : null), [store, registry, view]);
  const others = useMemo(() => registry.allPacks().filter(p => p.id !== 'core' && p.id !== view?.notationId && p.elementTypes.length), [registry, view]);
  const existing = useMemo(() => store.list('elements').filter(e => !e.template), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const orphans = useMemo(() => new Set(orphanElements(store).map(e => e.id)), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s: string) => s.toLowerCase();
  const match = (s: string) => !q || norm(s).includes(norm(q));

  const drag = (kind: string, id: string) => (e: DragEvent) => { e.dataTransfer.setData(kind, id); e.dataTransfer.effectAllowed = 'copy'; };
  const TypeItem = ({ t, dimmed }: { t: ElementType; dimmed?: boolean }) => (
    <div className={`ad-pal__item ${dimmed ? 'is-dimmed' : ''}`} draggable onDragStart={drag(DND_TYPE, t.id)} title={t.doc ?? t.id}>
      <span className="ad-pal__swatch" style={{ background: t.color ?? '#eee' }}>{t.icon ?? ''}</span>
      <span>{t.name}</span>
    </div>
  );
  const byCategory = (types: { type: ElementType; dimmed: boolean }[]) => {
    const groups = new Map<string, { type: ElementType; dimmed: boolean }[]>();
    for (const t of types) if (match(t.type.name)) groups.set(t.type.category ?? 'General', [...(groups.get(t.type.category ?? 'General') ?? []), t]);
    return [...groups.entries()];
  };
  if (!view || !pal) return <aside className="ad-pal"><div className="ad-empty">Sin vista</div></aside>;
  return (
    <aside className="ad-pal">
      <input className="ad-input" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="ad-tabs">
        <button className={tab === 'notation' ? 'is-active' : ''} onClick={() => setTab('notation')}>Notación</button>
        <button className={tab === 'libs' ? 'is-active' : ''} onClick={() => setTab('libs')}>Librerías</button>
        <button className={tab === 'model' ? 'is-active' : ''} onClick={() => setTab('model')}>Modelo</button>
      </div>
      <div className="ad-pal__scroll">
        {tab === 'notation' && <>
          {byCategory(pal.notation).map(([cat, items]) => (
            <details key={cat} open>
              <summary className="ad-pal__cat">{cat}</summary>
              {items.sort((a, b) => Number(a.dimmed) - Number(b.dimmed)).map(t => <TypeItem key={t.type.id} t={t.type} dimmed={t.dimmed} />)}
            </details>
          ))}
          {others.map(p => (
            <details key={p.id}>
              <summary className="ad-pal__cat ad-pal__cat--other">{p.name} <small>otra notación</small></summary>
              {p.elementTypes.filter(t => !t.abstract && match(t.name)).map(t => <TypeItem key={t.id} t={t} dimmed />)}
            </details>
          ))}
        </>}
        {tab === 'libs' && <>
          {pal.libs.length === 0 && pal.templates.length === 0 && <div className="ad-empty">No hay librerías. Importa un fichero .drawer o crea tipos en el panel de librerías.</div>}
          {byCategory(pal.libs).map(([cat, items]) => (
            <details key={cat} open><summary className="ad-pal__cat">{cat}</summary>{items.map(t => <TypeItem key={t.type.id} t={t.type} />)}</details>
          ))}
          {pal.templates.length > 0 && <details open><summary className="ad-pal__cat">Componentes</summary>
            {pal.templates.filter(t => match(t.name)).map(t => (
              <div key={t.id} className="ad-pal__item" draggable onDragStart={drag(DND_TEMPLATE, t.id)} title={t.doc}>
                <span className="ad-pal__swatch" style={{ background: registry.elementType(t.typeId)?.color ?? '#eee' }}>{registry.elementType(t.typeId)?.icon ?? ''}</span>
                <span>{t.name}</span><small>{registry.elementType(t.typeId)?.name}</small>
              </div>
            ))}
          </details>}
        </>}
        {tab === 'model' && <>
          <div className="ad-hint">Arrastra un elemento existente para que aparezca también en esta vista.</div>
          {existing.filter(e => match(e.name)).map(e => (
            <div key={e.id} className={`ad-pal__item ${orphans.has(e.id) ? 'is-orphan' : ''}`} draggable onDragStart={drag(DND_ELEMENT, e.id)} title={e.doc}>
              <span className="ad-pal__swatch" style={{ background: registry.elementType(e.typeId)?.color ?? '#eee' }} />
              <span>{e.name || '(sin nombre)'}</span><small>{registry.elementType(e.typeId)?.name ?? e.typeId}</small>
            </div>
          ))}
        </>}
      </div>
    </aside>
  );
}
