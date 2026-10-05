import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { paletteFor, orphanElements, type ElementType } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
import { useEditor } from '../context';
import { useRecord, useAnyChange } from '../hooks';
import { DND_TYPE, DND_TEMPLATE, DND_ELEMENT, DND_VISUAL } from '../Canvas';
import { Icon, type IconName } from '../icons';
import { promptDialog } from '../ui/dialog';
import { useRoving } from '../ui/roving';
import { TabList, tabPanelProps, useTabIds } from '../ui/tabs';
import { categoryGroups, paletteItemSize, containerNodeIds, addToCanvas, type PaletteDrag } from './palette-helpers';
import { useRecentTypes, useFavoriteTypes, toggleFavoriteType, useCategoryState, isCategoryOpen, setCategoryOpen } from '../prefs';

interface VisualItem { visualType: string; text?: string; src?: string }
/** Elementos que se pintan de golpe en la pestaña Modelo; el resto sale con "mostrar más". */
export const PALETTE_PAGE = 200;
/** Etiquetas en español: se traducen con `t()` al pintarlas (y el texto inicial del nodo también). */
const VISUALS: { label: string; icon: IconName; visualType: string; hint: string }[] = [
  { label: 'Nota', icon: 'note', visualType: 'core:note', hint: 'Texto libre; doble clic para editar' },
  { label: 'Grupo', icon: 'group', visualType: 'core:group', hint: 'Marco que agrupa nodos (se mueven con él)' },
  { label: 'Etiqueta', icon: 'text', visualType: 'core:label', hint: 'Texto sin fondo ni borde' },
];

/** Elementos navegables con flechas dentro de la lista de la paleta (una sola parada de Tab). */
const PAL_NAV = '.ad-pal__item, .ad-pal__scroll summary';
type PalTab = 'notation' | 'libs' | 'model' | 'visual';

/**
 * Paleta: tipos de la notación de la vista (viewpoint primero), tipos de librerías, componentes reutilizables,
 * elementos existentes y nodos visuales. Cada elemento se arrastra al lienzo o se añade con un clic, Intro o
 * Espacio (en un hueco libre cerca del centro del lienzo visible).
 */
export function Palette() {
  const t = useT();
  const { store, registry, viewId } = useEditor();
  const view = useRecord('views', viewId);
  useAnyChange();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<PalTab>('notation');
  const tabIds = useTabIds();
  const scroll = useRef<HTMLDivElement>(null);
  const roving = useRoving(scroll, PAL_NAV);
  const [images, setImages] = useState<{ name: string; src: string }[]>([]);
  const [shown, setShown] = useState(PALETTE_PAGE);
  const file = useRef<HTMLInputElement>(null);
  const pal = useMemo(() => (view ? paletteFor(store, registry, view) : null), [store, registry, view]);
  const others = useMemo(() => registry.allPacks().filter(p => p.id !== 'core' && p.id !== view?.notationId && p.elementTypes.length), [registry, view]);
  const existing = useMemo(() => store.list('elements').filter(e => !e.template), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const orphans = useMemo(() => new Set(orphanElements(store).map(e => e.id)), [store]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (s: string) => s.toLowerCase();
  const match = (s: string) => !q || norm(s).includes(norm(q));
  const recents = useRecentTypes();
  const favorites = useFavoriteTypes();
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const cats = useCategoryState();
  /**
   * Categoría plegable que recuerda si está abierta (por notación, en este navegador). Su contenido solo se monta
   * abierta: las de otras notaciones (cientos de tipos) no cuestan nada mientras están plegadas. Al buscar se abren
   * todas las que tienen resultados.
   */
  const category = (scope: string, key: string, summary: React.ReactNode, defaultOpen: boolean, items: () => React.ReactNode, cls = 'ad-pal__cat') => {
    const open = !!q || isCategoryOpen(cats, scope, key, defaultOpen);
    return (
      <details key={key} open={open} data-cat={key} onToggle={e => { const o = (e.currentTarget as HTMLDetailsElement).open; if (!q && o !== open) setCategoryOpen(scope, key, o); }}>
        <summary className={cls}>{summary}</summary>
        {open && items()}
      </details>
    );
  };

  const drag = (kind: string, id: string) => (e: DragEvent) => { e.dataTransfer.setData(kind, id); e.dataTransfer.effectAllowed = 'copy'; };
  const dragVisual = (item: VisualItem) => drag(DND_VISUAL, JSON.stringify(item));
  /** Clic, Intro o Espacio: lo añade al lienzo como si se soltara en un hueco libre cerca del centro. */
  const add = (payload: PaletteDrag, el: HTMLElement) => {
    if (!viewId) return;
    addToCanvas(el, paletteItemSize(payload, store, registry), containerNodeIds(store, registry, viewId), view?.kind !== 'sequence');
  };
  const addable = (payload: PaletteDrag) => ({
    role: 'button' as const,
    onClick: (e: ReactMouseEvent<HTMLElement>) => { if (!(e.target as HTMLElement).closest('button')) add(payload, e.currentTarget); },
    onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); add(payload, e.currentTarget); }
    },
  });
  const addImageUrl = async () => {
    const url = await promptDialog({ title: t('Añadir una imagen por URL'), label: t('URL de la imagen'), placeholder: 'https://…', inputType: 'url', confirmLabel: t('Añadir'),
      validate: v => (/^(https?:|data:image\/)/i.test(v.trim()) ? null : t('Escribe una dirección que empiece por https://')) });
    if (url?.trim()) setImages(xs => [...xs, { name: url.trim().split('/').pop() || t('imagen'), src: url.trim() }]);
  };
  const addImageFile = async (f: File) => {
    const src = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
    setImages(xs => [...xs, { name: f.name, src }]);
  };
  // Función de pintado (no componente): un componente definido aquí cambiaría de identidad en cada render, React
  // rehará los elementos y el foco del teclado se perdería al añadir un tipo.
  // La estrella va junto al elemento (no dentro: un botón dentro de otro `role="button"` no es accesible) y fuera del
  // orden de Tab; con el teclado, F o * sobre el tipo enfocado lo marca o desmarca.
  const typeItem = (type: ElementType, dimmed?: boolean, keyPrefix = '') => {
    const fav = favSet.has(type.id);
    const { onKeyDown, ...rest } = addable({ kind: DND_TYPE, data: type.id });
    return (
      <div key={keyPrefix + type.id} className="ad-pal__row">
        <div className={`ad-pal__item ${dimmed ? 'is-dimmed' : ''}`} draggable onDragStart={drag(DND_TYPE, type.id)} title={type.doc || undefined} {...rest}
          onKeyDown={e => { if ((e.key === 'f' || e.key === 'F' || e.key === '*') && !e.ctrlKey && !e.metaKey && !e.altKey && e.target === e.currentTarget) { e.preventDefault(); toggleFavoriteType(type.id); return; } onKeyDown(e); }}>
          <span className="ad-pal__swatch" style={{ background: type.color ?? '#eee' }}>{type.icon ?? ''}</span>
          <span className="ad-pal__ellipsis">{type.name}</span>
        </div>
        <button type="button" className={`ad-pal__star ${fav ? 'is-on' : ''}`} tabIndex={-1} aria-pressed={fav}
          aria-label={fav ? t('Quitar «{name}» de favoritos', { name: type.name }) : t('Marcar «{name}» como favorito', { name: type.name })}
          title={fav ? t('Quitar de favoritos (F)') : t('Marcar como favorito (F)')} onClick={() => toggleFavoriteType(type.id)}>
          <Icon name={fav ? 'starFilled' : 'star'} size={13} />
        </button>
      </div>
    );
  };
  /** Tipos de una lista de ids que existen en el registro (los de notaciones o librerías ya quitadas no salen). */
  const typesOf = (ids: string[]) => ids.map(id => registry.elementType(id)).filter((x): x is ElementType => !!x && !x.abstract && match(x.name));
  const outside = (ty: ElementType) => !!ty.notationId && ty.notationId !== view?.notationId && ty.notationId !== 'freeform' && !!registry.pack(ty.notationId);
  /** Grupos por categoría con el nombre (traducido) de la categoría del pack y en su orden. */
  const byCategory = (types: { type: ElementType; dimmed: boolean }[], packId?: string) =>
    categoryGroups(types.filter(it => match(it.type.name)), packId ? registry.pack(packId)?.categories : undefined, t('General'));
  if (!view || !pal) return <aside className="ad-pal"><div className="ad-empty">{t('Sin vista')}</div></aside>;
  return (
    <aside className="ad-pal" aria-label={t('Paleta')}>
      <input className="ad-input" type="search" aria-label={t('Buscar en la paleta')} placeholder={t('Buscar…')} value={q} onChange={e => setQ(e.target.value)} />
      <TabList ids={tabIds} label={t('Secciones de la paleta')} value={tab} onChange={setTab}
        tabs={[{ id: 'notation', label: t('Notación') }, { id: 'libs', label: t('Librerías') }, { id: 'model', label: t('Modelo') }, { id: 'visual', label: t('Visual') }]} />
      <div ref={scroll} className="ad-pal__scroll" {...tabPanelProps(tabIds, tab)} tabIndex={-1} onKeyDown={roving.onKeyDown} onFocus={roving.onFocus}>
        {tab === 'notation' && <>
          {/* Favoritos y recientes: secciones fijas (no `<details>`) encima de las categorías de la notación. */}
          {(() => {
            const favs = typesOf(favorites);
            const recent = typesOf(recents).filter(ty => !favSet.has(ty.id));
            return <>
              {favs.length > 0 && <section className="ad-pal__quick" aria-label={t('Favoritos')}><div className="ad-pal__cat ad-pal__cat--quick"><Icon name="starFilled" size={11} />{t('Favoritos')}</div>{favs.map(ty => typeItem(ty, outside(ty), 'fav:'))}</section>}
              {recent.length > 0 && <section className="ad-pal__quick" aria-label={t('Recientes')}><div className="ad-pal__cat ad-pal__cat--quick"><Icon name="history" size={11} />{t('Recientes')}</div>{recent.map(ty => typeItem(ty, outside(ty), 'recent:'))}</section>}
            </>;
          })()}
          {byCategory(pal.notation, view.notationId).map(({ key, name, items }) =>
            category(view.notationId, key, name, true, () => items.sort((a, b) => Number(a.dimmed) - Number(b.dimmed)).map(it => typeItem(it.type, it.dimmed))))}
          {others.map(p => {
            const types = p.elementTypes.filter(ty => !ty.abstract && match(ty.name));
            if (q && !types.length) return null;
            return category(view.notationId, `other:${p.id}`, <>{p.name} <small>{t('otra notación')}</small></>, false, () => types.map(ty => typeItem(ty, true)), 'ad-pal__cat ad-pal__cat--other');
          })}
        </>}
        {tab === 'libs' && <>
          {pal.libs.length === 0 && pal.templates.length === 0 && <div className="ad-empty">{t('No hay librerías. Importa un fichero .drawer o crea tipos en el panel de librerías.')}</div>}
          {byCategory(pal.libs).map(({ key, name, items }) => category('libs', key, name, true, () => items.map(it => typeItem(it.type))))}
          {pal.templates.length > 0 && <details open><summary className="ad-pal__cat">{t('Componentes')}</summary>
            {pal.templates.filter(tp => match(tp.name)).map(tp => (
              <div key={tp.id} className="ad-pal__item" draggable onDragStart={drag(DND_TEMPLATE, tp.id)} title={tp.doc || undefined} {...addable({ kind: DND_TEMPLATE, data: tp.id })}>
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
              <div key={e.id} className={`ad-pal__item ${orphans.has(e.id) ? 'is-orphan' : ''}`} draggable onDragStart={drag(DND_ELEMENT, e.id)} title={e.doc || undefined} {...addable({ kind: DND_ELEMENT, data: e.id })}>
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
              <div key={v.label} className="ad-pal__item" draggable onDragStart={dragVisual({ visualType: v.visualType, text: t(v.label) })} title={t(v.hint)} {...addable({ kind: DND_VISUAL, data: JSON.stringify({ visualType: v.visualType, text: t(v.label) }) })}>
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
              <div key={i} className="ad-pal__item" draggable onDragStart={dragVisual({ visualType: 'core:image', src: img.src })} title={img.name} {...addable({ kind: DND_VISUAL, data: JSON.stringify({ visualType: 'core:image', src: img.src }) })}>
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
