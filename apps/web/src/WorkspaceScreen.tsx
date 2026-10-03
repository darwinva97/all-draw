import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorProvider, Editor, HelpLink, Icon, useEditor, useMeta, useCollection, confirmDialog, toast, type PresenceMe } from '@all-draw/editor';
import { listLocalWorkspaces, localWorkspaceRole, openLocalWorkspace, setLocalWorkspaceRole, type LocalWorkspace, type RemoteConnection } from '@all-draw/sync';
import { traceCoverage, type Validator } from '@all-draw/core';
import { createRegistry, bindLibraries } from './registry';
import { connectRoom, takeShareToken } from './share';
import { api, setBearer, ApiError, type WorkspaceInfo, type ShareLink } from './api';
import { ImportExport } from './ImportExport';
import { HistoryDialog } from './History';
import { AuthDialog, useDialog } from './Auth';
import { LangSelect } from './App';
import { HelpMenu } from './HelpMenu';
import { roleLabel } from './Chrome';
import { Tour, editorTourSteps, tourSeen } from './Tour';
import { docHref } from './help';
import { reportError } from './notify';
import { useT, useLang } from '@all-draw/i18n';
import './pwa';

const BASE_VALIDATORS: Validator[] = [traceCoverage];
/** Los validadores pesados (geometría, bpmnlint) se cargan bajo demanda para no engordar el paquete inicial. */
async function loadValidators(): Promise<Validator[]> {
  const [{ geometryLint }, { BPMNLINT_VALIDATORS }] = await Promise.all([import('@all-draw/layout'), import('@all-draw/io')]);
  return [geometryLint, ...BPMNLINT_VALIDATORS, traceCoverage];
}
const docsHref = (slug: string, anchor?: string) => docHref(slug as Parameters<typeof docHref>[0], anchor);

/** `noCopy`: sin red y sin copia de este espacio en el navegador (nunca se abrió aquí). */
type OpenError = { kind: 'auth' | 'forbidden' | 'missing' | 'offline' | 'other'; detail: string; noCopy?: boolean };
/** Acceso perdido con el espacio abierto: revocado (enlace, permiso, cuenta) o espacio borrado. */
type Lost = 'revoked' | 'deleted';
function classify(e: unknown): OpenError {
  const detail = e instanceof Error ? e.message : String(e);
  if (e instanceof ApiError) {
    if (e.network) return { kind: 'offline', detail };
    if (e.status === 401) return { kind: 'auth', detail };
    if (e.status === 403) return { kind: 'forbidden', detail };
    if (e.status === 404) return { kind: 'missing', detail };
  }
  if (e instanceof TypeError) return { kind: 'offline', detail };
  return { kind: 'other', detail };
}

// ---------------------------------------------------------------- identidad en presencia y comentarios
/** Mismo almacén que el panel de comentarios del editor: nombre local (sin cuenta), generado una vez y editable. */
const ME_KEY = 'alldraw:me';
/** Último usuario con sesión (id y nombre): para firmar presencia y comentarios si se abre sin conexión. */
const ACCOUNT_KEY = 'alldraw:account';
type Account = { id: string; name: string };

/** Color estable derivado de un texto (id de usuario o nombre local): el mismo en cada recarga y en cada equipo. */
export function stableColor(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `hsl(${(h >>> 0) % 360} 65% 42%)`;
}
function readStore(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function writeStore(key: string, v: string | null) { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* sin almacenamiento */ } }
/** Nombre local: el guardado o, la primera vez, `generate()` (se guarda para que no cambie al recargar). */
export function localMeName(generate: () => string): string {
  const v = readStore(ME_KEY)?.trim();
  if (v) return v;
  const name = generate();
  writeStore(ME_KEY, name);
  return name;
}
function cachedAccount(): Account | null {
  try { const a = JSON.parse(readStore(ACCOUNT_KEY) ?? 'null') as Account | null; return a && typeof a.id === 'string' && typeof a.name === 'string' ? a : null; } catch { return null; }
}

/**
 * Quién soy en un espacio del servidor: con sesión, la cuenta (`name`, `userId` y color derivado del id); sin cuenta
 * (enlace compartido), el nombre local estable de `localStorage('alldraw:me')`, que se relee si cambia en otra pestaña.
 */
function useMe(enabled: boolean): PresenceMe {
  const t = useT();
  const [account, setAccount] = useState<Account | null>(null);
  const [local, setLocal] = useState(() => localMeName(() => t('Anónimo {n}', { n: 100 + Math.floor(Math.random() * 900) })));
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.sessionUser().then(u => {
      if (!alive) return;
      const a = u ? { id: u.id, name: u.name || u.email } : null;
      setAccount(a); writeStore(ACCOUNT_KEY, a ? JSON.stringify(a) : null);
    }, () => { if (alive) setAccount(cachedAccount()); }); // sin red: la última cuenta conocida
    return () => { alive = false; };
  }, [enabled]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === ME_KEY || e.key === null) setLocal(localMeName(() => t('Anónimo {n}', { n: 100 + Math.floor(Math.random() * 900) }))); };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, [t]);
  return useMemo(() => (account ? { name: account.name, color: stableColor(account.id), userId: account.id } : { name: local, color: stableColor(local) }), [account, local]);
}

/** Códigos de cierre del WebSocket (ver `@all-draw/server-core/ysync`). */
const WS_LOST: Record<number, Lost> = { 4401: 'revoked', 4403: 'revoked', 4404: 'deleted', 4410: 'deleted' };
const WS_ROLE_CHANGED = 4205;
/** Cada cuánto se reintenta abrir con el servidor un espacio abierto sin conexión (además del evento `online`). */
const OFFLINE_RETRY_MS = 15_000;

export function WorkspaceScreen({ id, mode, viewId }: { id: string; mode: 'local' | 'server'; viewId: string | null }) {
  const [lw, setLw] = useState<LocalWorkspace | null>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [conn, setConn] = useState<RemoteConnection | null>(null);
  const [error, setError] = useState<OpenError | null>(null);
  /** Abierto desde la copia local porque el servidor no respondía: se conecta al volver la red. */
  const [offline, setOffline] = useState(false);
  const [lost, setLost] = useState<Lost | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tour, setTour] = useState(false);
  const t = useT();
  const tRef = useRef(t); tRef.current = t;
  const [lang] = useLang();
  const registry = useMemo(() => createRegistry(lang), [lang]);
  const me = useMe(mode === 'server');
  const [validators, setValidators] = useState<Validator[]>(BASE_VALIDATORS);
  useEffect(() => { loadValidators().then(setValidators, () => { /* sin red: quedan los básicos */ }); }, []);
  const localId = mode === 'server' ? `srv_${id}` : id;

  useEffect(() => {
    let alive = true; let handle: LocalWorkspace | null = null; let unbind = () => {}; let c: RemoteConnection | null = null;
    let stopRetry = () => {};
    setError(null); setLost(null); setOffline(false);
    /** Acceso perdido con el espacio abierto: se deja de sincronizar, se olvida el rol guardado y se avisa. */
    const lose = (why: Lost) => {
      if (!alive) return;
      stopRetry();
      c?.provider.disconnect();
      setLocalWorkspaceRole(localId, null); // ya no se abrirá sin conexión con un permiso que no tiene
      setLost(why);
    };
    const remember = (i: WorkspaceInfo) => { if (!alive) return; setInfo(i); setLocalWorkspaceRole(localId, i.role); };
    /** Vuelve a pedir el rol (tras un cierre 4205 «rol cambiado»); si ya no hay acceso, lo dice. Devuelve el rol nuevo. */
    const refreshRole = async (prev: string | undefined): Promise<string | undefined> => {
      try {
        const i = await api.workspace(id);
        remember(i);
        if (alive && i.role !== prev) toast.info(tRef.current('Tus permisos en este espacio han cambiado: ahora {role}.', { role: roleLabel(tRef.current, i.role) }));
        return i.role;
      } catch (e) {
        const k = classify(e).kind;
        if (k === 'auth' || k === 'forbidden') lose('revoked'); else if (k === 'missing') lose('deleted');
        return prev; // sin red: el proveedor reintenta solo
      }
    };
    (async () => {
      const token = mode === 'server' ? takeShareToken(id) : null;
      let first: WorkspaceInfo | null = null;
      if (mode === 'server') {
        setBearer(token);
        try { first = await api.workspace(id); }
        catch (e) {
          if (!alive) return;
          const err = classify(e);
          // Sin red: se abre la copia de este navegador (si la hay) con el último rol conocido.
          const role = err.kind === 'offline' ? localWorkspaceRole(localId) : null;
          if (!role) {
            if (err.kind === 'auth' || err.kind === 'forbidden' || err.kind === 'missing') setLocalWorkspaceRole(localId, null);
            setError(err.kind === 'offline' ? { ...err, noCopy: true } : err);
            return;
          }
          setInfo({ id, name: '', ownerId: '', createdAt: '', updatedAt: '', role });
          setOffline(true);
        }
        if (first && alive) setInfo(first);
      } else if (!(await listLocalWorkspaces()).some(w => w.id === id)) {
        // Abrir un id desconocido crearía un espacio vacío: mejor decirlo.
        if (alive) setError({ kind: 'missing', detail: id });
        return;
      }
      const w = await openLocalWorkspace(localId);
      await w.whenSynced;
      if (!alive) { w.destroy(); return; }
      handle = w; unbind = bindLibraries(registry, w.store); setLw(w);
      if (mode !== 'server') return;
      if (first) setLocalWorkspaceRole(localId, first.role);
      const room = connectRoom(w.doc, id, token ?? undefined, { connect: !!first });
      c = room;
      let role: string | undefined = first?.role;
      room.provider.on('connection-close', (ev: { code: number } | null) => {
        const code = ev?.code;
        if (code === undefined) return;
        if (WS_LOST[code]) lose(WS_LOST[code]);
        else if (code === WS_ROLE_CHANGED) void refreshRole(role).then(r => { role = r; });
      });
      setConn(room);
      if (first) return;
      // Abierto sin conexión: al volver la red (o cada 15 s) se comprueba el acceso y se conecta.
      let busy = false;
      const retry = async () => {
        if (busy || !alive) return;
        busy = true;
        try {
          const i = await api.workspace(id);
          if (!alive) return;
          stopRetry();
          remember(i); role = i.role;
          setOffline(false);
          room.connect();
        } catch (e) {
          const k = classify(e).kind;
          if (k === 'auth' || k === 'forbidden') lose('revoked'); else if (k === 'missing') lose('deleted');
        } finally { busy = false; }
      };
      const onOnline = () => { void retry(); };
      addEventListener('online', onOnline);
      const timer = setInterval(onOnline, OFFLINE_RETRY_MS);
      stopRetry = () => { removeEventListener('online', onOnline); clearInterval(timer); };
    })();
    return () => { alive = false; stopRetry(); unbind(); c?.disconnect(); handle?.destroy(); setBearer(null); };
  }, [id, mode, localId, registry, attempt]);

  useEffect(() => { if (lw && !tourSeen()) { const h = setTimeout(() => setTour(true), 700); return () => clearTimeout(h); } }, [lw]);
  useEffect(() => { const n = lw?.store.meta().name; document.title = n ? `${n} · all-draw` : 'all-draw'; return () => { document.title = 'all-draw'; }; }, [lw]);
  const retry = useCallback(() => setAttempt(a => a + 1), []);

  if (error) return <OpenErrorScreen error={error} mode={mode} onRetry={retry} />;
  if (!lw || (mode === 'server' && !info)) return <WorkspaceSkeleton />;
  const readOnly = !!lost || (mode === 'server' && info?.role === 'viewer');
  const initial = viewId ?? lw.store.meta().currentViewId ?? lw.store.list('views')[0]?.id ?? null;
  const onLayout = async () => {
    const vid = lw.store.meta().currentViewId; if (!vid) return;
    const v = lw.store.get('views', vid); if (!v) return;
    try {
      const { layoutView, autoLayoutDefaults } = await import('@all-draw/layout');
      lw.history.run(await layoutView(lw.store, registry, vid, autoLayoutDefaults(v.notationId)));
    } catch (e) { reportError(e, { title: t('No se pudo colocar la vista automáticamente') }); }
  };
  return (
    <EditorProvider store={lw.store} history={lw.history} registry={registry} initialViewId={initial} readOnly={readOnly} validators={validators}
      presence={conn ? { awareness: conn.awareness, me } : undefined} docsHref={docsHref}>
      <Editor toolbarLeft={<LeftTools />} toolbarRight={<RightTools lw={lw} id={id} mode={mode} info={info} conn={conn} offline={offline} lost={!!lost} onTour={() => setTour(true)} />} onRequestLayout={readOnly ? undefined : onLayout} />
      {tour && !lost && <Tour steps={editorTourSteps(mode)} onClose={() => setTour(false)} />}
      {lost && <LostAccessDialog why={lost} />}
    </EditorProvider>
  );
}

/** Aviso al perder el acceso con el espacio abierto (enlace revocado, permiso quitado, espacio borrado). */
function LostAccessDialog({ why }: { why: Lost }) {
  const t = useT();
  const home = useRef<HTMLAnchorElement>(null);
  useEffect(() => { home.current?.focus(); }, []);
  return (
    <div className="modal">
      <div className="modal__box" role="alertdialog" aria-modal="true" aria-labelledby="lost-title" aria-describedby="lost-text" data-testid="lost-access">
        <h2 id="lost-title">{why === 'deleted' ? t('Este espacio se ha borrado') : t('Ya no tienes acceso a este espacio')}</h2>
        <p id="lost-text" className="modal__lead">{why === 'deleted'
          ? t('Quien lo administra lo ha borrado del servidor. Lo que ves ya no se sincroniza.')
          : t('Han revocado el enlace o tu permiso. Lo que ves ya no se sincroniza y los cambios que no se hubieran enviado no llegarán al servidor.')}</p>
        <div className="modal__foot"><HelpLink slug="compartir-y-colaborar" /><span className="spacer" /><a ref={home} className="btn btn--primary" href="#/"><Icon name="spaces" size={14} />{t('Volver al inicio')}</a></div>
      </div>
    </div>
  );
}

/** Mientras se abre el espacio: la silueta del editor, para que no salte la disposición. */
function WorkspaceSkeleton() {
  const t = useT();
  return (
    <div className="ws-skel" role="status" aria-live="polite" aria-label={t('Abriendo el espacio…')}>
      <div className="ws-skel__bar"><span className="skel" style={{ width: 28, height: 22 }} /><span className="skel" style={{ width: 160, height: 14 }} /><span style={{ flex: 1 }} /><span className="skel" style={{ width: 120, height: 22 }} /><span className="skel" style={{ width: 84, height: 22 }} /></div>
      <div className="ws-skel__body">
        <div className="ws-skel__side">{[70, 90, 60, 80].map((w, i) => <span key={i} className="skel" style={{ width: `${w}%`, height: 12 }} />)}<span className="skel" style={{ height: 120, marginTop: 12 }} /></div>
        <div className="ws-skel__canvas"><div className="ws-skel__msg"><span className="spinner" aria-hidden="true" />{t('Abriendo el espacio…')}</div></div>
        <div className="ws-skel__side">{[50, 85, 65].map((w, i) => <span key={i} className="skel" style={{ width: `${w}%`, height: 12 }} />)}</div>
      </div>
    </div>
  );
}

function OpenErrorScreen({ error, mode, onRetry }: { error: OpenError; mode: 'local' | 'server'; onRetry: () => void }) {
  const t = useT();
  const [auth, setAuth] = useState(false);
  const copy: Record<OpenError['kind'], { title: string; text: string; icon: 'key' | 'cloudOff' | 'search' | 'warning' }> = {
    auth: { title: t('Entra para abrir este espacio'), text: t('Es un espacio del servidor y no hay una sesión abierta en este navegador. Entra con tu cuenta o abre el enlace que te compartieron.'), icon: 'key' },
    forbidden: { title: t('No tienes acceso a este espacio'), text: t('Pide a quien lo creó que te comparta un enlace, o entra con la cuenta que tiene acceso.'), icon: 'key' },
    missing: { title: t('Este espacio no existe'), text: mode === 'local' ? t('No está guardado en este navegador. Los espacios locales solo existen donde se crearon; puede que se borrasen los datos del navegador.') : t('Puede que lo hayan borrado o que el enlace esté incompleto.'), icon: 'search' },
    offline: { title: t('Sin conexión con el servidor'), text: error.noCopy && mode === 'server'
      ? t('Este espacio no se ha abierto antes en este navegador, así que no hay copia para trabajar sin conexión. Vuelve a intentarlo cuando tengas red.')
      : t('No se pudo comprobar el espacio. Revisa la conexión y vuelve a intentarlo; los espacios de este navegador siguen disponibles.'), icon: 'cloudOff' },
    other: { title: t('No se pudo abrir el espacio'), text: t('El servidor respondió con un error. Vuelve a intentarlo en un momento.'), icon: 'warning' },
  };
  const c = copy[error.kind];
  return (
    <main className="state">
      <div className="state__card" role="alert">
        <span className={`state__icon ${error.kind === 'other' ? 'state__icon--danger' : ''}`}><Icon name={c.icon} size={22} /></span>
        <h1>{c.title}</h1>
        <p>{c.text}</p>
        {error.kind === 'other' && <p className="state__detail">{error.detail}</p>}
        <div className="state__actions">
          {error.kind === 'auth' && <button type="button" className="btn btn--primary" onClick={() => setAuth(true)}>{t('Entrar')}</button>}
          {(error.kind === 'offline' || error.kind === 'other') && <button type="button" className="btn btn--primary" onClick={onRetry}><Icon name="replay" />{t('Reintentar')}</button>}
          <a className={`btn ${error.kind === 'missing' || error.kind === 'forbidden' ? 'btn--primary' : ''}`} href="#/"><Icon name="spaces" />{t('Ir a mis espacios')}</a>
        </div>
      </div>
      {auth && <AuthDialog onClose={() => { setAuth(false); onRetry(); }} />}
    </main>
  );
}

function LeftTools() {
  const { store, viewId, openView, readOnly } = useEditor();
  const t = useT();
  const meta = useMeta();
  const views = useCollection('views');
  useEffect(() => { if (viewId && meta.currentViewId !== viewId && !readOnly) store.setMeta({ currentViewId: viewId }); }, [viewId, meta.currentViewId, store, readOnly]);
  useEffect(() => { if (!viewId && views.length) openView((meta.currentViewId && store.get('views', meta.currentViewId)) ? meta.currentViewId : views[0]!.id); }, [viewId, views, meta.currentViewId, store, openView]);
  return <>
    <a className="btn btn--ghost btn--icon" href="#/" title={t('Todos los espacios')} aria-label={t('Todos los espacios')}><Icon name="spaces" /></a>
    <input className="app-name" aria-label={t('Nombre del espacio')} value={meta.name} disabled={readOnly} onChange={e => store.setMeta({ name: e.target.value, updatedAt: new Date().toISOString() })} />
  </>;
}

function RightTools({ lw, id, mode, info, conn, offline, lost, onTour }: { lw: LocalWorkspace; id: string; mode: 'local' | 'server'; info: WorkspaceInfo | null; conn: RemoteConnection | null; offline: boolean; lost: boolean; onTour: () => void }) {
  const t = useT();
  const [status, setStatus] = useState('connecting');
  const [share, setShare] = useState(false);
  const [history, setHistory] = useState(false);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (!conn) return; const h = setInterval(() => setStatus(conn.status()), 1000); return () => clearInterval(h); }, [conn]);
  const upload = async () => {
    setUploading(true);
    try { const snap = lw.store.snapshot(); const w = await api.createWorkspace(snap.meta.name || t('Espacio'), snap); toast.success(t('Subido al servidor'), { description: t('Ahora puedes compartirlo desde «Compartir».') }); location.hash = `#/s/${w.id}`; }
    catch (e) {
      setUploading(false);
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) toast.error(t('Necesitas una cuenta para subirlo'), { description: t('Entra o regístrate desde el inicio y vuelve a pulsar «Subir al servidor».'), action: { label: t('Ir al inicio'), onClick: () => { location.hash = '#/'; } } });
      else reportError(e, { title: t('No se pudo subir al servidor'), retry: () => void upload() });
    }
  };
  const state = lost ? { cls: 'is-off', text: t('sin acceso') }
    : offline ? { cls: 'is-off', text: t('sin conexión — los cambios se sincronizarán') }
    : status === 'connected' ? { cls: 'is-on', text: t('en línea') } : status === 'connecting' ? { cls: 'is-wait', text: t('conectando…') } : { cls: 'is-off', text: t('sin conexión (se sincroniza al volver)') };
  const online = !offline && !lost;
  return <>
    {mode === 'server'
      ? <span className="app-status" role="status" aria-live="polite" title={offline ? t('Abierto con la copia de este navegador; se sincroniza al volver la conexión') : t('Sincronizado con el servidor')}><span className={`sync-dot ${state.cls}`} aria-hidden="true" />{state.text}{info?.role && !lost ? ` · ${roleLabel(t, info.role)}` : ''}</span>
      : <span className="app-status" role="status" title={t('Se guarda solo, también sin conexión')}><Icon name="device" size={14} />{t('guardado en este navegador')}</span>}
    <ImportExport />
    {mode === 'server' && info && online && <button className="btn" aria-haspopup="dialog" onClick={() => setHistory(true)}><Icon name="history" size={14} />{t('Historial')}</button>}
    {mode === 'server' && info?.role === 'owner' && online && <button className="btn btn--primary" data-tour="share" aria-haspopup="dialog" onClick={() => setShare(true)}><Icon name="share" size={14} />{t('Compartir')}</button>}
    {mode === 'local' && <button className="btn btn--primary" data-tour="share" disabled={uploading} onClick={() => void upload()} title={t('Copia este espacio al servidor para compartirlo')}><Icon name="upload" size={14} />{uploading ? t('Subiendo…') : t('Subir al servidor')}</button>}
    <LangSelect className="lang-select--bar" />
    <HelpMenu onTour={onTour} />
    {share && <ShareDialog id={id} onClose={() => setShare(false)} />}
    {history && info && <HistoryDialog id={id} role={info.role} onClose={() => setHistory(false)} />}
  </>;
}

function ShareDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useDialog(onClose);
  const t = useT();
  const refresh = useCallback(() => api.links(id).then(setLinks).catch(e => { setLinks([]); reportError(e, { title: t('No se pudieron cargar los enlaces'), retry: () => void refresh() }); }), [id, t]);
  useEffect(() => { void refresh(); }, [refresh]);
  const create = async (role: 'editor' | 'viewer') => {
    setBusy(true);
    try {
      const l = await api.createLink(id, role);
      await refresh();
      try { await navigator.clipboard?.writeText(l.url); toast.success(role === 'editor' ? t('Enlace de edición creado y copiado') : t('Enlace de lectura creado y copiado')); }
      catch { toast.success(role === 'editor' ? t('Enlace de edición creado') : t('Enlace de lectura creado')); }
    } catch (e) { reportError(e, { title: t('No se pudo crear el enlace'), retry: () => void create(role) }); }
    finally { setBusy(false); }
  };
  const copy = async (l: ShareLink) => { try { await navigator.clipboard?.writeText(l.url); toast.success(t('Enlace copiado al portapapeles')); } catch { toast.info(t('No se pudo copiar; el enlace es {url}', { url: l.url }), { duration: 15000 }); } };
  const revoke = async (l: ShareLink) => {
    if (!(await confirmDialog({ title: t('¿Revocar este enlace?'), message: t('Quien lo tenga dejará de poder abrir el espacio. Las personas conectadas ahora se desconectan.'), confirmLabel: t('Revocar'), danger: true }))) return;
    try { await api.deleteLink(id, l.token); toast.success(t('Enlace revocado')); await refresh(); } catch (e) { reportError(e, { title: t('No se pudo revocar el enlace') }); }
  };
  const label = (l: ShareLink) => t('{kind} del {date}', { kind: l.role === 'editor' ? t('edición') : t('lectura'), date: new Date(l.createdAt).toLocaleString() });
  return (
    <div className="modal" onClick={onClose}>
      <div ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h2 id="share-title">{t('Compartir')}</h2>
        <p className="modal__lead">{t('Quien tenga un enlace de edición edita a la vez contigo; el de lectura solo ve. Puedes revocarlos cuando quieras.')}</p>
        <div className="row"><button className="btn btn--primary" disabled={busy} onClick={() => void create('editor')}><Icon name="edit" size={14} />{t('Nuevo enlace de edición')}</button><button className="btn" disabled={busy} onClick={() => void create('viewer')}><Icon name="eye" size={14} />{t('Nuevo enlace de lectura')}</button></div>
        <ul className="share__list" aria-label={t('Enlaces compartidos')} aria-busy={links === null}>
          {links === null && <li className="list-empty">{t('Cargando…')}</li>}
          {links?.length === 0 && <li className="list-empty">{t('Todavía no hay enlaces. Crea uno y se copiará al portapapeles.')}</li>}
          {links?.map(l => <li key={l.token}>
            <span className="share__what"><Icon name={l.role === 'editor' ? 'edit' : 'eye'} size={14} />{l.role === 'editor' ? t('edición') : t('lectura')} <small>{new Date(l.createdAt).toLocaleString()}</small></span>
            <button className="btn btn--sm" aria-label={t('Copiar enlace de {label}', { label: label(l) })} onClick={() => void copy(l)}><Icon name="copy" size={14} />{t('Copiar enlace')}</button>
            <button className="btn btn--ghost btn--sm" aria-label={t('Revocar enlace de {label}', { label: label(l) })} onClick={() => void revoke(l)}>{t('Revocar')}</button>
          </li>)}
        </ul>
        <div className="modal__foot"><HelpLink slug="compartir-y-colaborar" /><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cerrar')}</button></div>
      </div>
    </div>
  );
}
