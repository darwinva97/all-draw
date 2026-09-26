import { useMemo, useRef, useState, type DragEvent } from 'react';
import { paletteFor, orphanElements, type ElementType } from '@all-draw/core';
import { useEditor } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { DND_TYPE, DND_TEMPLATE, DND_ELEMENT, DND_VISUAL } from '../Canvas';

interface VisualItem { visualType: string; text?: string; src?: string }
const VISUALS: { label: string; icon: string; item: VisualItem; hint: string }[] = [
  { label: 'Nota', icon: '🗒', item: { visualType: 'core:note', text: 'Nota' }, hint: 'Texto libre; doble clic para editar' },
  { label: 'Grupo', icon: '▢', item: { visualType: 'core:group', text: 'Grupo' }, hint: 'Marco que agrupa nodos (se mueven con él)' },
  { label: 'Etiqueta', icon: 'T', item: { visualType: 'core:label', text: 'Etiqueta' }, hint: 'Texto sin fondo ni borde' },
];

/** Paleta: tipos de la notación de la vista (viewpoint primero), tipos de librerías, componentes reutilizables, elementos existentes y nodos visuales. */
export function Palette() {
  const { store, registry, viewId } = useEditor();
  const view = useRecord('views', viewId);
  useAnyChange();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'notation' | 'libs' | 'model' | 'visual'>('notation');
  const [images, setImages] = useState<{ name: string; src: string }[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const pal = useMemo(() => (view ? paletteFor(store, registry, view) : null), [store, registry, view]);
  const others = useMemo(() => registry.allPacks().filter(p => p.id !== 'core' && p.id !== view?.notationId && p.elementTypes.length), [registry, view]);
  const existing = useMemo(() => store.list('elements').filter(e => !e.template), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const orphans = useMemo(() => new Set(orphanElements(store).map(e => e.id)), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s: string) => s.toLowerCase();
  const match = (s: string) => !q || norm(s).includes(norm(q));

  const drag = (kind: string, id: string) => (e: DragEvent) => { e.dataTransfer.setData(kind, id); e.dataTransfer.effectAllowed = 'copy'; };
  const dragVisual = (item: VisualItem) => drag(DND_VISUAL, JSON.stringify(item));
  const addImageUrl = () => {
    const url = prompt('URL de la imagen');
    if (url?.trim()) setImages(xs => [...xs, { name: url.trim().split('/').pop() || 'imagen', src: url.trim() }]);
  };
  const addImageFile = async (f: File) => {
    const src = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    setImages(xs => [...xs, { name: f.name, src }]);
  };
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
    <aside className="ad-pal" aria-label="Paleta">
      <input className="ad-input" type="search" aria-label="Buscar en la paleta" placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} />
      <div className="ad-tabs" role="tablist" aria-label="Secciones de la paleta">
        <button role="tab" aria-selected={tab === 'notation'} className={tab === 'notation' ? 'is-active' : ''} onClick={() => setTab('notation')}>Notación</button>
        <button role="tab" aria-selected={tab === 'libs'} className={tab === 'libs' ? 'is-active' : ''} onClick={() => setTab('libs')}>Librerías</button>
        <button role="tab" aria-selected={tab === 'model'} className={tab === 'model' ? 'is-active' : ''} onClick={() => setTab('model')}>Modelo</button>
        <button role="tab" aria-selected={tab === 'visual'} className={tab === 'visual' ? 'is-active' : ''} onClick={() => setTab('visual')}>Visual</button>
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
        {tab === 'visual' && <>
          <div className="ad-hint">Nodos sin elemento del modelo: solo viven en esta vista.</div>
          <details open><summary className="ad-pal__cat">Visual</summary>
            {VISUALS.filter(v => match(v.label)).map(v => (
              <div key={v.label} className="ad-pal__item" draggable onDragStart={dragVisual(v.item)} title={v.hint}>
                <span className="ad-pal__swatch ad-pal__swatch--visual">{v.icon}</span><span>{v.label}</span>
              </div>
            ))}
          </details>
          <details open><summary className="ad-pal__cat">Imágenes</summary>
            <div className="ad-row">
              <button className="ad-btn" onClick={addImageUrl} title="Añadir una imagen por URL">＋ URL</button>
              <button className="ad-btn" onClick={() => file.current?.click()} title="Añadir una imagen desde un fichero (se guarda incrustada)">＋ Fichero</button>
              <input ref={file} type="file" aria-label="Imagen desde un fichero" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void addImageFile(f); e.target.value = ''; }} />
            </div>
            {images.length === 0 && <div className="ad-hint">Añade una imagen y arrástrala al lienzo.</div>}
            {images.filter(i => match(i.name)).map((img, i) => (
              <div key={i} className="ad-pal__item" draggable onDragStart={dragVisual({ visualType: 'core:image', src: img.src })} title={img.name}>
                <img className="ad-pal__thumb" src={img.src} alt="" /><span className="ad-pal__ellipsis">{img.name}</span>
                <button className="ad-btn ad-btn--ghost" onClick={() => setImages(xs => xs.filter((_, j) => j !== i))} title="Quitar de la paleta" aria-label={`Quitar ${img.name} de la paleta`}>×</button>
              </div>
            ))}
          </details>
        </>}
      </div>
    </aside>
  );
}
