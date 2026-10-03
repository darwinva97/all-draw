/**
 * Centro de documentación (`#/docs…`). Se carga con `lazy()` desde `App.tsx`, así que nada de esto (ni el manual) entra
 * en el paquete inicial del editor. Rutas y anclas: ver `README.md` y `links.ts`.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { LANGS, useLang, useT, type Lang } from '@all-draw/i18n';
import { CHAPTERS, GROUPS, chapterOf, editUrl, loadChapter, type ChapterDef, type LoadedChapter } from './chapters';
import { docHref, isDocSlug, parseDocsHash, type DocSlug } from './links';
import { headingsOf, highlight, inlineText, parseMarkdown, renderBlocks, uniqueIds, type Block } from './markdown';
import { buildIndex, search, termsOf, type Hit } from './search';
import { NotationIndex, NotationRef } from './NotationRef';
import { ApiRef } from './ApiRef';
import { Icon } from './icons';
import { createRegistry } from '../registry';
import './docs.css';

const THEME_KEY = 'alldraw:theme';
type ThemeMode = 'system' | 'light' | 'dark';

function readTheme(): ThemeMode {
  try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}

/** Mismo tema que el editor (`localStorage('alldraw:theme')`: sistema → claro → oscuro). */
function useDocsTheme(): { mode: ThemeMode; dark: boolean; cycle: () => void } {
  const [mode, setMode] = useState<ThemeMode>(readTheme);
  const mq = useMemo(() => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null), []);
  const [sys, setSys] = useState(() => !!mq?.matches);
  useEffect(() => {
    if (!mq) return;
    const f = () => setSys(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, [mq]);
  const cycle = useCallback(() => setMode(m => {
    const next: ThemeMode = m === 'system' ? 'light' : m === 'light' ? 'dark' : 'system';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* sin almacenamiento */ }
    return next;
  }), []);
  const dark = mode === 'dark' || (mode === 'system' && sys);
  useEffect(() => {
    const root = document.documentElement, body = document.body;
    const prev = { scheme: root.style.colorScheme, bg: body.style.background };
    root.style.colorScheme = dark ? 'dark' : 'light';
    body.style.background = dark ? '#0f1115' : '#fbfbfc';
    return () => { root.style.colorScheme = prev.scheme; body.style.background = prev.bg; };
  }, [dark]);
  return { mode, dark, cycle };
}

const titleOf = (t: (s: string) => string, c: ChapterDef | undefined, slug: string) => (c ? t(c.title) : slug);

// ---------------------------------------------------------------- Pantalla
export default function DocsScreen({ hash }: { hash: string }) {
  const t = useT();
  const [lang, setLang] = useLang();
  const route = parseDocsHash(hash) ?? { slug: '', anchor: null, q: null };
  const { mode, dark, cycle } = useDocsTheme();
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => { setNavOpen(false); }, [route.slug, route.anchor]);
  useEffect(() => {
    if (!navOpen) return;
    navRef.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus();
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [navOpen]);
  useEffect(() => () => { document.title = 'all-draw'; }, []);

  const themeLabel = mode === 'system' ? t('Tema: sistema') : mode === 'light' ? t('Tema: claro') : t('Tema: oscuro');
  return (
    <div className={`docs ${dark ? 'docs--dark' : 'docs--light'} ${navOpen ? 'is-nav-open' : ''}`}>
      <button type="button" className="docs-skip" onClick={() => mainRef.current?.focus()}>{t('Saltar al contenido')}</button>
      <header className="docs-header">
        <button type="button" className="docs-iconbtn docs-header__menu" aria-expanded={navOpen} aria-controls="docs-nav" onClick={() => setNavOpen(o => !o)} aria-label={navOpen ? t('Cerrar el índice') : t('Abrir el índice')}>
          <Icon name={navOpen ? 'close' : 'menu'} />
        </button>
        <a className="docs-brand" href="#/" title={t('Volver a la aplicación')}>
          <span className="docs-brand__mark" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20"><rect x="1.5" y="3" width="7" height="5" rx="1.2" /><rect x="11.5" y="12" width="7" height="5" rx="1.2" /><path d="M5 8v4.5h6.5" fill="none" /></svg></span>
          all-draw
        </a>
        <a className="docs-header__section" href={docHref()}>{t('Documentación')}</a>
        <SearchBox lang={lang} />
        <div className="docs-header__tools">
          <label className="visually-hidden" htmlFor="docs-lang">{t('Idioma')}</label>
          <select id="docs-lang" className="docs-select" value={lang} onChange={e => setLang(e.target.value as Lang)}>
            {LANGS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button type="button" className="docs-iconbtn" onClick={cycle} aria-label={themeLabel} title={themeLabel}>
            <Icon name={mode === 'system' ? 'system' : mode === 'light' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>
      <div className="docs-layout">
        <div className="docs-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
        <nav id="docs-nav" ref={navRef} className="docs-sidebar" aria-label={t('Capítulos del manual')}>
          <Sidebar current={route.slug} lang={lang} />
        </nav>
        <main ref={mainRef} className="docs-main" id="docs-content" tabIndex={-1}>
          {route.slug === ''
            ? <IndexPage />
            : isDocSlug(route.slug)
              ? <ChapterPage key={route.slug} slug={route.slug} anchor={route.anchor} q={route.q} lang={lang} />
              : <NotFound slug={route.slug} />}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Barra lateral
function Sidebar({ current, lang }: { current: string; lang: Lang }) {
  const t = useT();
  const colors = useMemo(() => { const reg = createRegistry(lang); return new Map(reg.allPacks().map(p => [p.id, p.color ?? '#94a3b8'])); }, [lang]);
  return (
    <>
      <a className={`docs-nav__home ${current === '' ? 'is-current' : ''}`} href={docHref()} aria-current={current === '' ? 'page' : undefined}><Icon name="book" />{t('Portada')}</a>
      {GROUPS.map(g => (
        <section key={g.id} className="docs-nav__group" aria-labelledby={`nav-${g.id}`}>
          <h2 id={`nav-${g.id}`} className="docs-nav__title">{t(g.name)}</h2>
          <ul>
            {CHAPTERS.filter(c => c.group === g.id).map(c => (
              <li key={c.slug} className={c.packId ? 'docs-nav__pack' : undefined}>
                <a href={docHref(c.slug)} aria-current={current === c.slug ? 'page' : undefined} className={current === c.slug ? 'is-current' : undefined}>
                  {c.packId && <span className="docs-nav__dot" style={{ background: colors.get(c.packId) }} aria-hidden="true" />}
                  {t(c.title)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- Portada
function ChapterList() {
  const t = useT();
  return (
    <div className="docs-index__groups">
      {GROUPS.map(g => {
        const list = CHAPTERS.filter(c => c.group === g.id);
        const main = g.id === 'notations' ? list.filter(c => !c.packId) : list;
        const packs = g.id === 'notations' ? list.filter(c => c.packId) : [];
        return (
          <section key={g.id} className="docs-index__group" aria-labelledby={`idx-${g.id}`}>
            <h2 id={`idx-${g.id}`}>{t(g.name)}</h2>
            <ul>
              {main.map(c => <li key={c.slug}><a href={docHref(c.slug)}>{t(c.title)}</a><p>{t(c.summary)}</p></li>)}
            </ul>
            {packs.length > 0 && <p className="docs-index__packs">{packs.map(c => <a key={c.slug} href={docHref(c.slug)}>{t(c.title)}</a>)}</p>}
          </section>
        );
      })}
    </div>
  );
}

function IndexPage() {
  const t = useT();
  useEffect(() => { document.title = `${t('Documentación')} | all-draw`; window.scrollTo(0, 0); }, [t]);
  return (
    <div className="docs-index">
      <header className="docs-index__hero">
        <h1>{t('Documentación de all-draw')}</h1>
        <p>{t('Un elemento, muchas notaciones. Aquí aprendes a modelar una vez y a ver lo mismo como proceso, arquitectura, estados o datos, a colaborar y a sacar tus diagramas de la herramienta.')}</p>
        <p className="docs-index__start">
          <a className="docs-btn docs-btn--primary" href={docHref('primeros-pasos')}>{t('Empieza por aquí')}</a>
          <a className="docs-btn" href={docHref('conceptos')}>{t('Entiende los conceptos')}</a>
          <a className="docs-btn" href={docHref('faq')}>{t('Preguntas frecuentes')}</a>
        </p>
      </header>
      <ChapterList />
    </div>
  );
}

function NotFound({ slug }: { slug: string }) {
  const t = useT();
  useEffect(() => { document.title = `${t('Página no encontrada')} | all-draw`; }, [t]);
  return (
    <article className="docs-article">
      <h1 className="docs-h docs-h1">{t('Página no encontrada')}</h1>
      <p>{t('No hay ningún capítulo «{slug}». Puede que el enlace sea antiguo.', { slug })}</p>
      <p><a className="docs-btn docs-btn--primary" href={docHref()}>{t('Ir al índice de la documentación')}</a></p>
    </article>
  );
}

// ---------------------------------------------------------------- Capítulo
function directiveRenderer(name: string, arg: string): ReactNode {
  switch (name) {
    case 'notation-ref': return <NotationRef packId={arg.trim()} />;
    case 'notation-index': return <NotationIndex />;
    case 'api-ref': return <ApiRef />;
    case 'chapters': return <ChapterList />;
    default: return null;
  }
}

function ChapterPage({ slug, anchor, q, lang }: { slug: DocSlug; anchor: string | null; q: string | null; lang: Lang }) {
  const t = useT();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' } | { status: 'error'; message: string } | { status: 'ok'; ch: LoadedChapter }>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState(s => (s.status === 'ok' ? s : { status: 'loading' }));
    loadChapter(lang, slug)
      .then(ch => { if (alive) setState(ch ? { status: 'ok', ch } : { status: 'missing' }); })
      .catch((e: Error) => { if (alive) setState({ status: 'error', message: e.message }); });
    return () => { alive = false; };
  }, [lang, slug]);

  const def = chapterOf(slug);
  const blocks = useMemo<Block[]>(() => {
    if (state.status === 'ok') return uniqueIds(parseMarkdown(state.ch.source));
    // Página de notación sin texto propio: título + referencia generada.
    if (state.status === 'missing' && def?.packId) return [{ t: 'h', level: 1, text: t(def.title), id: 'top' }, { t: 'directive', name: 'notation-ref', arg: def.packId }];
    return [];
  }, [state, def, t]);
  const h1 = blocks.find(b => b.t === 'h' && b.level === 1) as Extract<Block, { t: 'h' }> | undefined;
  const title = h1 ? inlineText(h1.text) : titleOf(t, def, slug);
  const terms = useMemo(() => (q ? termsOf(q) : []), [q]);
  const ready = state.status === 'ok' || (state.status === 'missing' && !!def?.packId);

  useEffect(() => { if (ready) document.title = `${title} | all-draw`; }, [ready, title]);
  // Al cambiar de capítulo, arriba; con ancla, a la sección (después de pintar).
  useEffect(() => {
    if (!ready) return;
    const id = anchor;
    requestAnimationFrame(() => {
      const target = id ? document.getElementById(id) : null;
      if (target) { target.scrollIntoView({ block: 'start' }); target.focus({ preventScroll: true }); }
      else if (terms.length) document.querySelector('.docs-article .docs-mark')?.scrollIntoView({ block: 'center' });
      else window.scrollTo(0, 0);
    });
  }, [ready, anchor, terms]);

  if (state.status === 'loading') return <div className="docs-article docs-article--loading" role="status" aria-live="polite"><span className="docs-skeleton docs-skeleton--h1" /><span className="docs-skeleton" /><span className="docs-skeleton" /><span className="visually-hidden">{t('Cargando…')}</span></div>;
  if (state.status === 'error') return <article className="docs-article"><h1 className="docs-h docs-h1">{titleOf(t, def, slug)}</h1><p className="docs-error" role="alert">{t('No se pudo cargar este capítulo ({error}). Comprueba la conexión y recarga la página.', { error: state.message })}</p></article>;
  if (!ready) return <NotFound slug={slug} />;

  const ch = state.status === 'ok' ? state.ch : null;
  const ctx = { file: ch?.file ?? `${slug}.md`, slug, terms, directive: directiveRenderer };
  const toc = headingsOf(blocks);
  const h1Index = blocks.findIndex(b => b.t === 'h' && b.level === 1);
  const shownToc = toc.length > 28 ? toc.filter(h => h.level === 2) : toc;
  const idx = CHAPTERS.findIndex(c => c.slug === slug);
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  const group = GROUPS.find(g => g.id === def?.group);
  return (
    <div className="docs-page">
      <article className="docs-article" lang={ch?.lang ?? 'es'}>
        {group && <p className="docs-crumb"><a href={docHref()}>{t('Documentación')}</a><span aria-hidden="true">/</span>{t(group.name)}</p>}
        {ch?.fallback && <p className="docs-fallback" role="note" lang={lang}><Icon name="info" />{t('Este capítulo todavía no está traducido; se muestra la versión en español.')}</p>}
        {terms.length > 0 && <p className="docs-hl-bar" lang={lang}>{t('Resaltando «{q}»', { q: q ?? '' })} <a href={docHref(slug, anchor ?? undefined)}>{t('Quitar resaltado')}</a></p>}
        {renderBlocks(blocks.slice(0, h1Index + 1), ctx)}
        {shownToc.length > 2 && <details className="docs-toc-inline" lang={lang}><summary>{t('En esta página')}</summary><TocList items={shownToc} slug={slug} /></details>}
        {renderBlocks(blocks.slice(h1Index + 1), ctx)}
        <footer className="docs-article__foot" lang={lang}>
          {ch && <a href={editUrl(ch.file)} target="_blank" rel="noopener noreferrer"><Icon name="edit" />{t('Editar en GitHub')}</a>}
          <button type="button" className="docs-linkbtn" onClick={() => window.print()}>{t('Imprimir')}</button>
        </footer>
        <nav className="docs-pager" aria-label={t('Capítulo anterior y siguiente')} lang={lang}>
          {prev ? <a className="docs-pager__prev" href={docHref(prev.slug)} rel="prev"><small><Icon name="prev" />{t('Anterior')}</small><span>{t(prev.title)}</span></a> : <span />}
          {next ? <a className="docs-pager__next" href={docHref(next.slug)} rel="next"><small>{t('Siguiente')}<Icon name="next" /></small><span>{t(next.title)}</span></a> : <span />}
        </nav>
      </article>
      {shownToc.length > 1 && <aside className="docs-toc" aria-label={t('En esta página')} lang={lang}><p className="docs-toc__title">{t('En esta página')}</p><TocList items={shownToc} slug={slug} spy /></aside>}
    </div>
  );
}

function TocList({ items, slug, spy }: { items: { id: string; text: string; level: number }[]; slug: DocSlug; spy?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!spy) return;
    let raf = 0;
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const update = () => {
      raf = 0;
      let cur: string | null = els[0]?.id ?? null;
      for (const el of els) { if (el.getBoundingClientRect().top < 120) cur = el.id; else break; }
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && els.length) cur = els[els.length - 1]!.id;
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [items, spy]);
  return (
    <ul className="docs-toc__list">
      {items.map(i => <li key={i.id} className={`docs-toc__l${i.level}`}><a href={docHref(slug, i.id)} className={active === i.id ? 'is-active' : undefined} aria-current={active === i.id ? 'location' : undefined}>{i.text}</a></li>)}
    </ul>
  );
}

// ---------------------------------------------------------------- Búsqueda
function hitHref(h: Hit, q: string): string { return docHref(h.section.slug as DocSlug, h.section.id ?? undefined, q.trim()); }

function SearchBox({ lang }: { lang: Lang }) {
  const t = useT();
  const id = useId().replace(/:/g, '');
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (!q.trim()) { setHits(null); return; }
    let alive = true;
    const timer = setTimeout(() => {
      buildIndex(lang).then(sections => { if (alive) { setHits(search(sections, q)); setActive(0); } }).catch(() => { if (alive) setHits([]); });
    }, 90);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, lang]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable);
      if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); input.current?.focus(); input.current?.select(); }
    };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, []);
  const go = (h: Hit | undefined) => { if (!h) return; location.hash = hitHref(h, q); setOpen(false); setQ(''); input.current?.blur(); };
  const terms = termsOf(q);
  const show = open && q.trim().length > 0;
  const chapterTitle = (slug: string, fallback: string) => { const c = chapterOf(slug); return c ? t(c.title) : fallback; };
  return (
    <div className="docs-search" role="search" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <Icon name="search" className="docs-search__icon" />
      <label htmlFor={`${id}-q`} className="visually-hidden">{t('Buscar en la documentación')}</label>
      <input
        ref={input} id={`${id}-q`} type="search" autoComplete="off" spellCheck={false}
        placeholder={t('Buscar en la documentación')}
        role="combobox" aria-expanded={show} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={show && hits?.length ? `${id}-o${active}` : undefined}
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min((hits?.length ?? 1) - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); go(hits?.[active]); }
          else if (e.key === 'Escape') { if (q) setQ(''); else input.current?.blur(); setOpen(false); }
        }}
      />
      <kbd className="docs-search__kbd" aria-hidden="true">/</kbd>
      {show && (
        <div className="docs-search__pop">
          <ul id={`${id}-list`} role="listbox" aria-label={t('Resultados de la búsqueda')}>
            {hits === null && <li className="docs-search__msg" role="presentation">{t('Buscando…')}</li>}
            {hits?.length === 0 && <li className="docs-search__msg" role="presentation">{t('Nada coincide con «{q}». Prueba con otra palabra o mira el glosario.', { q })}</li>}
            {hits?.map((h, i) => (
              <li key={`${h.section.slug}#${h.section.id ?? ''}`} id={`${id}-o${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : undefined}
                onMouseEnter={() => setActive(i)} onMouseDown={e => { if (e.button === 0) { e.preventDefault(); go(h); } }}>
                <a href={hitHref(h, q)} tabIndex={-1}>
                  <span className="docs-search__where">{chapterTitle(h.section.slug, h.section.chapter)}{h.section.id && <> <span aria-hidden="true">/</span> {highlight(h.section.heading, terms)}</>}</span>
                  <span className="docs-search__snip">{highlight(h.snippet, terms)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
