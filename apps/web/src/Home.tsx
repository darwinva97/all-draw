/**
 * Inicio (`#/`): galería de plantillas y espacios (servidor y este navegador) con búsqueda, orden y miniatura de
 * la vista principal. Importar con el botón o soltando un fichero en la página. Sin sesión y sin espacios
 * locales se muestra la portada.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { generateLargeWorkspace, type Workspace } from '@all-draw/core';
import { listLocalWorkspaces, openLocalWorkspace, deleteLocalWorkspace, type LocalWorkspaceEntry } from '@all-draw/sync';
import { Icon, confirmDialog, noticeDialog, toast } from '@all-draw/editor';
import { tn, useLang, useT, type Lang } from '@all-draw/i18n';
import { api, cachedAccount, type User, type WorkspaceInfo } from './api';
import { AuthDialog } from './Auth';
import { AppFooter, AppHeader, UserMenu, initialsOf, roleLabel } from './Chrome';
import { Landing } from './Landing';
import { createRegistry, PACKS, PACK_COLORS, localizePack } from './registry';
import { TEMPLATES, type Template } from './templates';
import { createLocalWorkspace, createServerWorkspace } from './spaces';
import { localThumb, workspaceThumb, type ThumbTheme } from './thumbs';
import { useEffectiveTheme } from './theme';
import { reportError } from './notify';
import { ioErrorText } from './io-text';
import './pwa';

const IMPORT_ACCEPT = '.drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml';
type Sort = 'recent' | 'name';
const SORT_KEY = 'alldraw:home-sort';

/** "hace 5 min", "ayer", "12 mar"… en el idioma activo. */
export function fmtWhen(iso: string, lang: Lang, now = Date.now()): string {
  const d = new Date(iso); const s = (d.getTime() - now) / 1000;
  if (Number.isNaN(d.getTime())) return '';
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const a = Math.abs(s);
  if (a < 60) return rtf.format(0, 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

/** `forceHome`: sin sesión ni espacios locales, el inicio en vez de la portada (`#/espacios`, enlazado desde la portada). */
export function Home({ forceHome = false }: { forceHome?: boolean } = {}) {
  const t = useT();
  const [lang] = useLang();
  const [local, setLocal] = useState<LocalWorkspaceEntry[]>([]);
  const [cached, setCached] = useState<Set<string>>(new Set());
  const [remote, setRemote] = useState<WorkspaceInfo[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverUp, setServerUp] = useState(false);
  /** Sin conexión con el servidor (no «sin servidor»): con una sesión previa no se muestra la portada (fallo 56). */
  const [offline, setOffline] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(() => (localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'recent'));
  const [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const all = await listLocalWorkspaces();
    setLocal(all.filter(w => !w.id.startsWith('srv_')));
    setCached(new Set(all.filter(w => w.id.startsWith('srv_')).map(w => w.id.slice(4))));
    // Una sola petición dice si hay servidor y quién soy (200 también sin sesión: sin 401 en la consola, fallo 65).
    const probe = await api.probe();
    setServerUp(probe.up); setOffline(probe.offline);
    if (probe.up) {
      const u = probe.user; setUser(u);
      if (u) {
        try { setRemote(await api.workspaces()); }
        catch (e) { setRemote([]); reportError(e, { title: t('No se pudieron cargar tus espacios del servidor'), retry: () => void refresh() }); }
      } else setRemote(null);
    } else if (probe.offline && cachedAccount()) {
      // Sin red y con sesión la última vez: los espacios del servidor que se abrieron aquí siguen a mano (copia local).
      setUser(null);
      setRemote(all.filter(w => w.id.startsWith('srv_') && w.role).map(w => ({ id: w.id.slice(4), name: w.name, ownerId: '', createdAt: w.updatedAt, updatedAt: w.updatedAt, role: w.role! })));
    } else { setUser(null); setRemote(null); }
    setLoaded(true);
  }, [t]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { localStorage.setItem(SORT_KEY, sort); }, [sort]);

  const open = (hash: string) => { location.hash = hash; };
  const createFrom = async (ws: Workspace, key: string) => {
    setBusy(key);
    try { open(user ? `#/s/${await createServerWorkspace(ws)}` : `#/w/${await createLocalWorkspace(ws)}`); }
    catch (e) { setBusy(null); reportError(e, { title: t('No se pudo crear el espacio'), retry: () => void createFrom(ws, key) }); }
  };
  const createTemplate = (tpl: Template) => createFrom(tpl.build(t), tpl.id);

  const onFile = async (f: File) => {
    setBusy('import');
    try {
      const { importAny, formatLabel } = await import('@all-draw/io');
      const { workspace, warnings, format: fmt } = await importAny(await f.text(), f.name);
      const format = t(formatLabel(fmt));
      if (warnings.length) {
        toast.warning(tn('Importado desde {format} con {n} aviso', 'Importado desde {format} con {n} avisos', warnings.length, { format }), {
          description: f.name, action: { label: t('Ver avisos'), onClick: () => void noticeDialog({ title: t('Avisos de la importación'), message: t('El fichero se importó, pero algunas partes no tienen equivalente exacto.'), items: warnings }) },
        });
      } else toast.success(t('Importado desde {format}', { format }), { description: f.name });
      await createFrom(workspace, 'import');
    } catch (e) {
      setBusy(null);
      toast.error(t('No se pudo importar «{name}»', { name: f.name }), { description: ioErrorText(e) });
    }
  };

  // Importar soltando un fichero en cualquier parte de la página.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true); };
    const over = (e: DragEvent) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; } };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const drop = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setDragging(false); const f = e.dataTransfer?.files[0]; if (f) void onFile(f); };
    addEventListener('dragenter', enter); addEventListener('dragover', over); addEventListener('dragleave', leave); addEventListener('drop', drop);
    return () => { removeEventListener('dragenter', enter); removeEventListener('dragover', over); removeEventListener('dragleave', leave); removeEventListener('drop', drop); };
  }); // se rehace en cada render para usar el `onFile` actual (con el usuario y el idioma vigentes)

  /** Espacio grande de prueba (1.000 elementos × 50 vistas), solo con `?bench=1` en la URL. */
  const bench = location.search.includes('bench=1');
  const createBench = () => createFrom(generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', registry: createRegistry() }), 'bench');

  const upload = async (w: LocalWorkspaceEntry) => {
    setBusy(w.id);
    try {
      const lw = await openLocalWorkspace(w.id); await lw.whenSynced;
      const snap = lw.store.snapshot(); lw.destroy();
      if (!snap.meta.name) snap.meta.name = w.name;
      open(`#/s/${await createServerWorkspace(snap)}`);
    } catch (e) { setBusy(null); reportError(e, { title: t('No se pudo subir al servidor'), retry: () => void upload(w) }); }
  };
  const removeLocal = async (w: LocalWorkspaceEntry) => {
    if (!(await confirmDialog({ title: t('¿Borrar "{name}" de este navegador?', { name: w.name || t('(sin nombre)') }), message: t('Se borra la copia de este navegador. No se puede deshacer.'), danger: true }))) return;
    await deleteLocalWorkspace(w.id); toast.success(t('Espacio borrado')); void refresh();
  };
  const removeRemote = async (w: WorkspaceInfo) => {
    if (!(await confirmDialog({ title: t('¿Borrar "{name}" del servidor?', { name: w.name || t('(sin nombre)') }), message: t('Lo pierden también las personas con quien lo compartiste. Las instantáneas se borran con él.'), danger: true }))) return;
    try { await api.deleteWorkspace(w.id); toast.success(t('Espacio borrado')); void refresh(); }
    catch (e) { reportError(e, { title: t('No se pudo borrar el espacio'), retry: () => void removeRemote(w) }); }
  };
  const logout = async () => { try { await api.logout(); } catch (e) { reportError(e); } void refresh(); };

  const match = (name: string) => !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());
  const order = <T extends { name: string; updatedAt: string }>(xs: T[]) => [...xs].filter(x => match(x.name || '')).sort(sort === 'name'
    ? (a, b) => (a.name || '').localeCompare(b.name || '', lang)
    : (a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const localShown = useMemo(() => order(local), [local, q, sort, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const remoteShown = useMemo(() => (remote ? order(remote) : null), [remote, q, sort, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = local.length + (remote?.length ?? 0);

  if (!loaded) return <div className="page" aria-busy="true" />;
  const offlineAccount = offline && !user ? cachedAccount() : null;
  if (!user && !offlineAccount && local.length === 0 && !forceHome && !bench) return <Landing serverUp={serverUp} user={null} onAuthed={() => void refresh()} />;

  const headerRight = user
    ? <UserMenu user={user} onLogout={logout} />
    : serverUp && <button type="button" className="btn btn--ghost" onClick={() => setAuth(true)}>{t('Entrar / registrarse')}</button>;
  return (
    <div className="page">
      <AppHeader right={headerRight} />
      <main className="page__main">
        <div className="home__title">
          <div>
            <h1>{t('Tus espacios')}</h1>
            <p>{user ? t('Los espacios del servidor se sincronizan y se comparten; los de este navegador funcionan sin cuenta.') : t('Se guardan en este navegador y funcionan sin conexión. Con una cuenta, además, se sincronizan y se comparten.')}</p>
            {offlineAccount && <p className="home__offline" role="status"><Icon name="cloudOff" size={14} />{t('Sin conexión con el servidor. Los espacios del servidor que abriste en este navegador siguen disponibles; los cambios se sincronizan al volver la red.')}</p>}
          </div>
          <div className="home__title-actions">
            <button type="button" className="btn" disabled={!!busy} onClick={() => file.current?.click()} title={t('Formatos: .drawer (Drawer), .alldraw.json, .archimate (Archi), Open Exchange, BPMN 2.0 XML, Structurizr JSON, XState JSON, Mermaid, OpenAPI.')}>
              <Icon name="fileImport" />{busy === 'import' ? t('Importando…') : t('Importar…')}
            </button>
            <input ref={file} type="file" aria-label={t('Fichero a importar')} accept={IMPORT_ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
          </div>
        </div>
        {bench && <p className="app-status"><button className="btn btn--ghost" data-bench="create" disabled={!!busy} onClick={createBench}>{t('Espacio grande de prueba (1000 × 50)')}</button></p>}

        <TemplateGallery busy={busy} collapsedByDefault={total > 0} onPick={createTemplate} server={!!user} />

        {remoteShown && <section className="sect" aria-labelledby="h-remote">
          <div className="sect__head">
            <h2 id="h-remote"><Icon name="cloud" />{t('En el servidor')} <span className="count">{remote!.length}</span></h2>
            <span className="spacer" />
            <ListTools q={q} setQ={setQ} sort={sort} setSort={setSort} />
          </div>
          {remote!.length === 0
            ? <Empty icon="cloud" title={t('Todavía no tienes espacios en el servidor')} text={t('Crea uno desde una plantilla o sube uno de este navegador: se sincroniza y lo puedes compartir.')} />
            : remoteShown.length === 0 ? <NoMatches q={q} onClear={() => setQ('')} />
            : <div className="ws-grid">{remoteShown.map(w => (
              <WsCard key={w.id} href={`#/s/${w.id}`} name={w.name} updatedAt={w.updatedAt} lang={lang}
                thumb={cached.has(w.id) ? (th) => localThumb(`srv_${w.id}`, w.updatedAt, lang, th) : null}
                badge={roleLabel(t, w.role)}
                actions={w.role === 'owner' && !offlineAccount && <button type="button" className="btn btn--ghost" aria-label={t('Borrar {name} del servidor', { name: w.name || t('espacio sin nombre') })} title={t('Borrar del servidor')} onClick={() => void removeRemote(w)}><Icon name="trash" /></button>} />
            ))}</div>}
        </section>}

        <section className="sect" aria-labelledby="h-local">
          <div className="sect__head">
            <h2 id="h-local"><Icon name="device" />{t('En este navegador')} <span className="count">{local.length}</span></h2>
            <span className="spacer" />
            {!remoteShown && <ListTools q={q} setQ={setQ} sort={sort} setSort={setSort} />}
          </div>
          {local.length === 0
            ? <Empty icon="device" title={t('Nada guardado en este navegador')} text={user ? t('Los espacios que crees sin cuenta aparecerán aquí. Los tuyos están en el servidor.') : t('Crea un espacio desde una plantilla o importa un fichero para empezar.')} />
            : localShown.length === 0 ? <NoMatches q={q} onClear={() => setQ('')} />
            : <div className="ws-grid">{localShown.map(w => (
              <WsCard key={w.id} href={`#/w/${w.id}`} name={w.name} updatedAt={w.updatedAt} lang={lang}
                thumb={(th) => localThumb(w.id, w.updatedAt, lang, th)}
                actions={<>
                  {user && <button type="button" className="btn btn--ghost" disabled={!!busy} aria-label={t('Subir {name} al servidor', { name: w.name || t('espacio sin nombre') })} title={t('Subir al servidor')} onClick={() => void upload(w)}><Icon name="upload" /></button>}
                  <button type="button" className="btn btn--ghost" aria-label={t('Borrar {name} de este navegador', { name: w.name || t('espacio sin nombre') })} title={t('Borrar de este navegador')} onClick={() => void removeLocal(w)}><Icon name="trash" /></button>
                </>} />
            ))}</div>}
        </section>
      </main>
      <AppFooter />
      {dragging && <div className="dropzone" aria-hidden="true"><div className="dropzone__card"><Icon name="fileImport" size={28} /><strong>{t('Suelta el fichero para importarlo')}</strong><span>{t('Se crea un espacio nuevo con su contenido. Drawer, Archi, BPMN, Structurizr, Mermaid, XState, OpenAPI o JSON de all-draw.')}</span></div></div>}
      {auth && <AuthDialog onClose={() => { setAuth(false); void refresh(); }} />}
    </div>
  );
}

function ListTools({ q, setQ, sort, setSort }: { q: string; setQ: (v: string) => void; sort: Sort; setSort: (s: Sort) => void }) {
  const t = useT();
  return (
    <div className="sect__tools">
      <label className="input-icon"><Icon name="search" /><span className="visually-hidden">{t('Buscar espacios')}</span>
        <input className="input" type="search" placeholder={t('Buscar espacios…')} value={q} onChange={e => setQ(e.target.value)} /></label>
      <label className="visually-hidden" htmlFor="home-sort">{t('Ordenar')}</label>
      <select id="home-sort" className="lang-select" value={sort} onChange={e => setSort(e.target.value as Sort)}>
        <option value="recent">{t('Recientes primero')}</option>
        <option value="name">{t('Por nombre')}</option>
      </select>
    </div>
  );
}

function Empty({ icon, title, text, children }: { icon: 'cloud' | 'device' | 'search'; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon"><Icon name={icon} size={20} /></span>
      <div><p className="empty__title">{title}</p><p>{text}</p></div>
      {children && <div className="empty__actions">{children}</div>}
    </div>
  );
}
function NoMatches({ q, onClear }: { q: string; onClear: () => void }) {
  const t = useT();
  return <Empty icon="search" title={t('Ningún espacio coincide con «{q}»', { q })} text={t('Prueba con otra palabra o borra la búsqueda.')}><button type="button" className="btn" onClick={onClear}>{t('Borrar la búsqueda')}</button></Empty>;
}

/** Miniatura perezosa: se calcula cuando la tarjeta entra en pantalla. */
function useLazyThumb(make: ((theme: ThumbTheme) => Promise<string | null>) | null, deps: unknown[]) {
  const theme = useEffectiveTheme();
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null | undefined>(make ? undefined : null);
  useEffect(() => {
    if (!make) { setUrl(null); return; }
    const el = ref.current; if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      make(theme).then(u => { if (alive) setUrl(u); }, () => { if (alive) setUrl(null); });
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [theme, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, url };
}

function WsCard({ href, name, updatedAt, lang, thumb, badge, actions }: { href: string; name: string; updatedAt: string; lang: Lang; thumb: ((theme: ThumbTheme) => Promise<string | null>) | null; badge?: string; actions?: ReactNode }) {
  const t = useT();
  const { ref, url } = useLazyThumb(thumb, [href, updatedAt, lang]);
  const label = name || t('(sin nombre)');
  return (
    <article className="ws">
      <div className="ws__thumb" ref={ref} aria-hidden="true">
        {url ? <img src={url} alt="" draggable={false} /> : url === undefined ? <span className="skel" /> : name.trim() ? <span className="ws__mono">{initialsOf(name)}</span> : <span className="ws__mono"><Icon name="template" size={28} /></span>}
      </div>
      <div className="ws__body">
        <div className="ws__info">
          <a className="ws__link" href={href}>{label}</a>
          <div className="ws__meta">{badge && <span className="ws__role">{badge}</span>}<time dateTime={updatedAt} title={new Date(updatedAt).toLocaleString(lang)}>{t('Editado {when}', { when: fmtWhen(updatedAt, lang) })}</time></div>
        </div>
        {actions && <div className="ws__actions">{actions}</div>}
      </div>
    </article>
  );
}

const TPL_MIN = 204, TPL_GAP = 14;
function TemplateGallery({ busy, collapsedByDefault, onPick, server }: { busy: string | null; collapsedByDefault: boolean; onPick: (tpl: Template) => void; server: boolean }) {
  const t = useT();
  const [lang] = useLang();
  const [all, setAll] = useState(!collapsedByDefault);
  const [cols, setCols] = useState(5);
  const grid = useRef<HTMLDivElement>(null);
  const colors = useMemo(() => Object.fromEntries(PACKS.map(p => { const lp = localizePack(p, lang); return [p.id, { name: lp.name, color: PACK_COLORS[p.id] ?? p.color ?? '#888' }]; })), [lang]);
  useLayoutEffect(() => {
    const el = grid.current; if (!el) return;
    const ro = new ResizeObserver(() => { const w = el.clientWidth; setCols(Math.max(2, Math.floor((w + TPL_GAP) / (TPL_MIN + TPL_GAP)))); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const visible = all ? TEMPLATES : TEMPLATES.slice(0, cols <= 2 ? 4 : cols);
  return (
    <section className="sect" aria-labelledby="h-create">
      <div className="sect__head">
        <h2 id="h-create"><Icon name="template" />{t('Crear un espacio')}</h2>
        <span className="spacer" />
        <span className="app-status">{server ? t('Se crea en el servidor') : t('Se crea en este navegador')}</span>
      </div>
      <div className="tpl-grid" ref={grid}>
        {visible.map(tpl => <TemplateCard key={tpl.id} tpl={tpl} busy={busy} onPick={onPick} colors={colors} />)}
      </div>
      {visible.length < TEMPLATES.length || all ? (
        <button type="button" className="btn btn--ghost tpl__more" aria-expanded={all} onClick={() => setAll(a => !a)}>
          <Icon name={all ? 'chevronDown' : 'chevronRight'} />{all ? t('Ver menos plantillas') : t('Ver las {n} plantillas', { n: TEMPLATES.length })}
        </button>
      ) : null}
    </section>
  );
}

function TemplateCard({ tpl, busy, onPick, colors }: { tpl: Template; busy: string | null; onPick: (tpl: Template) => void; colors: Record<string, { name: string; color: string }> }) {
  const t = useT();
  const [lang] = useLang();
  const { ref, url } = useLazyThumb(tpl.id === 'blank' ? null : (theme) => workspaceThumb(`tpl:${tpl.id}`, tpl.build(t), lang, theme), [tpl.id, lang]);
  const name = t(tpl.name);
  const label = tpl.id === 'demo' ? t('Abrir la demo: {name}', { name }) : t('Crear desde la plantilla «{name}»', { name });
  return (
    <button type="button" className="tpl" disabled={!!busy} aria-busy={busy === tpl.id} aria-label={label} title={t(tpl.description)} onClick={() => onPick(tpl)}>
      <div className="tpl__thumb" ref={ref} aria-hidden="true">
        {tpl.id === 'blank' ? <span className="tpl__blank"><Icon name="plus" size={22} /></span>
          : url ? <img src={url} alt="" draggable={false} /> : url === undefined ? <span className="skel" /> : null}
      </div>
      <div className="tpl__body">
        <span className="tpl__name">{busy === tpl.id ? t('Creando…') : name}</span>
        <span className="tpl__desc">{t(tpl.description)}</span>
        <span className="tpl__chips">{tpl.notations.slice(0, 3).map(n => <span key={n} className="chip"><span className="chip__dot" style={{ background: colors[n]?.color }} />{colors[n]?.name ?? n}</span>)}{tpl.notations.length > 3 && <span className="chip">+{tpl.notations.length - 3}</span>}</span>
      </div>
    </button>
  );
}
