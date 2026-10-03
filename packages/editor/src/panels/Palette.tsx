import { useMemo, useRef, useState, type DragEvent } from 'react';
import { paletteFor, orphanElements, type ElementType } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { DND_TYPE, DND_TEMPLATE, DND_ELEMENT, DND_VISUAL } from '../Canvas';
import { Icon, type IconName } from '../icons';
import { promptDialog } from '../ui/dialog';

interface VisualItem { visualType: string; text?: string; src?: string }
/** Elementos que se pintan de golpe en la pestaña Modelo; el resto sale con "mostrar más". */
export const PALETTE_PAGE = 200;
/** Etiquetas en español: se traducen con `t()` al pintarlas (y el texto inicial del nodo también). */
const VISUALS: { label: string; icon: IconName; visualType: string; hint: string }[] = [
  { label: 'Nota', icon: 'note', visualType: 'core:note', hint: 'Texto libre; doble clic para editar' },
  { label: 'Grupo', icon: 'group', visualType: 'core:group', hint: 'Marco que agrupa nodos (se mueven con él)' },
  { label: 'Etiqueta', icon: 'text', visualType: 'core:label', hint: 'Texto sin fondo ni borde' },
];

/** Paleta: tipos de la notación de la vista (viewpoint primero), tipos de librerías, componentes reutilizables, elementos existentes y nodos visuales. */
export function Palette() {
  const t = useT();
  const { store, registry, viewId } = useEditor();
  const view = useRecord('views', viewId);
  useAnyChange();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'notation' | 'libs' | 'model' | 'visual'>('notation');
  const [images, setImages] = useState<{ name: string; src: string }[]>([]);
  const [shown, setShown] = useState(PALETTE_PAGE);
  const file = useRef<HTMLInputElement>(null);
  const pal = useMemo(() => (view ? paletteFor(store, registry, view) : null), [store, registry, view]);
  const others = useMemo(() => registry.allPacks().filter(p => p.id !== 'core' && p.id !== view?.notationId && p.elementTypes.length), [registry, view]);
  const existing = useMemo(() => store.list('elements').filter(e => !e.template), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const orphans = useMemo(() => new Set(orphanElements(store).map(e => e.id)), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s: string) => s.toLowerCase();
  const match = (s: string) => !q || norm(s).includes(norm(q));

  const drag = (kind: string, id: string) => (e: DragEvent) => { e.dataTransfer.setData(kind, id); e.dataTransfer.effectAllowed = 'copy'; };
  const dragVisual = (item: VisualItem) => drag(DND_VISUAL, JSON.stringify(item));
  const addImageUrl = async () => {
    const url = await promptDialog({ title: t('Añadir una imagen por URL'), label: t('URL de la imagen'), placeholder: 'https://…', inputType: 'url', confirmLabel: t('Añadir'),
      validate: v => (/^(https?:|data:image\/)/i.test(v.trim()) ? null : t('Escribe una dirección que empiece por https://')) });
    if (url?.trim()) setImages(xs => [...xs, { name: url.trim().split('/').pop() || t('imagen'), src: url.trim() }]);
  };
  const addImageFile = async (f: File) => {
    const src = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    setImages(xs => [...xs, { name: f.name, src }]);
  };
  const TypeItem = ({ type, dimmed }: { type: ElementType; dimmed?: boolean }) => (
    <div className={`ad-pal__item ${dimmed ? 'is-dimmed' : ''}`} draggable onDragStart={drag(DND_TYPE, type.id)} title={type.doc ?? type.id}>
      <span className="ad-pal__swatch" style={{ background: type.color ?? '#eee' }}>{type.icon ?? ''}</span>
      <span>{type.name}</span>
    </div>
  );
  const byCategory = (types: { type: ElementType; dimmed: boolean }[]) => {
    const groups = new Map<string, { type: ElementType; dimmed: boolean }[]>();
    const general = t('General');
    for (const it of types) if (match(it.type.name)) groups.set(it.type.category ?? general, [...(groups.get(it.type.category ?? general) ?? []), it]);
    return [...groups.entries()];
  };
  if (!view || !pal) return <aside className="ad-pal"><div className="ad-empty">{t('Sin vista')}</div></aside>;
  return (
    <aside className="ad-pal" aria-label={t('Paleta')}>
      <input className="ad-input" type="search" aria-label={t('Buscar en la paleta')} placeholder={t('Buscar…')} value={q} onChange={e => setQ(e.target.value)} />
      <div className="ad-tabs" role="tablist" aria-label={t('Secciones de la paleta')}>
        <button role="tab" aria-selected={tab === 'notation'} className={tab === 'notation' ? 'is-active' : ''} onClick={() => setTab('notation')}>{t('Notación')}</button>
        <button role="tab" aria-selected={tab === 'libs'} className={tab === 'libs' ? 'is-active' : ''} onClick={() => setTab('libs')}>{t('Librerías')}</button>
        <button role="tab" aria-selected={tab === 'model'} className={tab === 'model' ? 'is-active' : ''} onClick={() => setTab('model')}>{t('Modelo')}</button>
        <button role="tab" aria-selected={tab === 'visual'} className={tab === 'visual' ? 'is-active' : ''} onClick={() => setTab('visual')}>{t('Visual')}</button>
      </div>
      <div className="ad-pal__scroll">
        {tab === 'notation' && <>
          {byCategory(pal.notation).map(([cat, items]) => (
            <details key={cat} open>
              <summary className="ad-pal__cat">{cat}</summary>
              {items.sort((a, b) => Number(a.dimmed) - Number(b.dimmed)).map(it => <TypeItem key={it.type.id} type={it.type} dimmed={it.dimmed} />)}
            </details>
          ))}
          {others.map(p => (
            <details key={p.id}>
              <summary className="ad-pal__cat ad-pal__cat--other">{p.name} <small>{t('otra notación')}</small></summary>
              {p.elementTypes.filter(ty => !ty.abstract && match(ty.name)).map(ty => <TypeItem key={ty.id} type={ty} dimmed />)}
            </details>
          ))}
        </>}
        {tab === 'libs' && <>
          {pal.libs.length === 0 && pal.templates.length === 0 && <div className="ad-empty">{t('No hay librerías. Importa un fichero .drawer o crea tipos en el panel de librerías.')}</div>}
          {byCategory(pal.libs).map(([cat, items]) => (
            <details key={cat} open><summary className="ad-pal__cat">{cat}</summary>{items.map(it => <TypeItem key={it.type.id} type={it.type} />)}</details>
          ))}
          {pal.templates.length > 0 && <details open><summary className="ad-pal__cat">{t('Componentes')}</summary>
            {pal.templates.filter(tp => match(tp.name)).map(tp => (
              <div key={tp.id} className="ad-pal__item" draggable onDragStart={drag(DND_TEMPLATE, tp.id)} title={tp.doc}>
                <span className="ad-pal__swatch" style={{ background: registry.elementType(tp.typeId)?.color ?? '#eee' }}>{registry.elementType(tp.typeId)?.icon ?? ''}</span>
                <span>{tp.name}</span><small>{registry.elementType(tp.typeId)?.name}</small>
              </div>
            ))}
          </details>}
        </>}
        {tab === 'model' && (() => {
          const filtered = existing.filter(e => match(e.name));
          return <>
            <div className="ad-hint">{t('Arrastra un elemento existente para que aparezca también en esta vista.')}</div>
            {filtered.slice(0, shown).map(e => (
              <div key={e.id} className={`ad-pal__item ${orphans.has(e.id) ? 'is-orphan' : ''}`} draggable onDragStart={drag(DND_ELEMENT, e.id)} title={e.doc}>
                <span className="ad-pal__swatch" style={{ background: registry.elementType(e.typeId)?.color ?? '#eee' }} />
                <span>{e.name || t('(sin nombre)')}</span><small>{registry.elementType(e.typeId)?.name ?? e.typeId}</small>
              </div>
            ))}
            {filtered.length > shown && <button className="ad-btn ad-pal__more" onClick={() => setShown(n => n + PALETTE_PAGE)}>{t('Mostrar más ({n} de {total})', { n: shown, total: filtered.length })}</button>}
          </>;
        })()}
        {tab === 'visual' && <>
          <div className="ad-hint">{t('Nodos sin elemento del modelo: solo viven en esta vista.')}</div>
          <details open><summary className="ad-pal__cat">{t('Visual')}</summary>
            {VISUALS.filter(v => match(t(v.label))).map(v => (
              <div key={v.label} className="ad-pal__item" draggable onDragStart={dragVisual({ visualType: v.visualType, text: t(v.label) })} title={t(v.hint)}>
                <span className="ad-pal__swatch ad-pal__swatch--visual"><Icon name={v.icon} size={14} /></span><span>{t(v.label)}</span>
              </div>
            ))}
          </details>
          <details open><summary className="ad-pal__cat">{t('Imágenes')}</summary>
            <div className="ad-row">
              <button className="ad-btn" onClick={addImageUrl} title={t('Añadir una imagen por URL')}><Icon name="link" size={14} />URL</button>
              <button className="ad-btn" onClick={() => file.current?.click()} title={t('Añadir una imagen desde un fichero (se guarda incrustada)')}><Icon name="plus" size={14} />{t('Fichero')}</button>
              <input ref={file} type="file" aria-label={t('Imagen desde un fichero')} accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void addImageFile(f); e.target.value = ''; }} />
            </div>
            {images.length === 0 && <div className="ad-hint">{t('Añade una imagen y arrástrala al lienzo.')}</div>}
            {images.filter(i => match(i.name)).map((img, i) => (
              <div key={i} className="ad-pal__item" draggable onDragStart={dragVisual({ visualType: 'core:image', src: img.src })} title={img.name}>
                <img className="ad-pal__thumb" src={img.src} alt="" /><span className="ad-pal__ellipsis">{img.name}</span>
                <button className="ad-btn ad-btn--ghost" onClick={() => setImages(xs => xs.filter((_, j) => j !== i))} title={t('Quitar de la paleta')} aria-label={t('Quitar {name} de la paleta', { name: img.name })}><Icon name="close" size={14} /></button>
              </div>
            ))}
          </details>
        </>}
      </div>
    </aside>
  );
}
