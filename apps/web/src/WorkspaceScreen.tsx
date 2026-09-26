import { useEffect, useMemo, useState } from 'react';
import { EditorProvider, Editor, useEditor, useMeta, useCollection } from '@all-draw/editor';
import { openLocalWorkspace, type LocalWorkspace, type RemoteConnection } from '@all-draw/sync';
import { traceCoverage, type Validator } from '@all-draw/core';
import { createRegistry, bindLibraries } from './registry';
import { connectRoom, takeShareToken } from './share';
import { api, setBearer, type WorkspaceInfo, type ShareLink } from './api';
import { ImportExport } from './ImportExport';
import { HistoryDialog } from './History';
import { useDialog } from './Auth';
import { LangSelect } from './App';
import { useT, useLang } from '@all-draw/i18n';

const BASE_VALIDATORS: Validator[] = [traceCoverage];
/** Los validadores pesados (geometría, bpmnlint) se cargan bajo demanda para no engordar el paquete inicial. */
async function loadValidators(): Promise<Validator[]> {
  const [{ geometryLint }, { BPMNLINT_VALIDATORS }] = await Promise.all([import('@all-draw/layout'), import('@all-draw/io')]);
  return [geometryLint, ...BPMNLINT_VALIDATORS, traceCoverage];
}
/** Número y color estables durante la sesión; el nombre por defecto se traduce al abrir el espacio. */
const ME_N = Math.floor(Math.random() * 900 + 100);
const ME_COLOR = `hsl(${Math.floor(Math.random() * 360)} 70% 45%)`;

export function WorkspaceScreen({ id, mode, viewId }: { id: string; mode: 'local' | 'server'; viewId: string | null }) {
  const [lw, setLw] = useState<LocalWorkspace | null>(null);
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [conn, setConn] = useState<RemoteConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const [lang] = useLang();
  const registry = useMemo(() => createRegistry(lang), [lang]);
  const me = useMemo(() => ({ name: localStorage.getItem('alldraw:me') ?? t('Anónimo {n}', { n: ME_N }), color: ME_COLOR }), [t]);
  const [validators, setValidators] = useState<Validator[]>(BASE_VALIDATORS);
  useEffect(() => { loadValidators().then(setValidators); }, []);
  const localId = mode === 'server' ? `srv_${id}` : id;

  useEffect(() => {
    let alive = true; let handle: LocalWorkspace | null = null; let unbind = () => {}; let c: RemoteConnection | null = null;
    (async () => {
      const token = mode === 'server' ? takeShareToken(id) : null;
      if (mode === 'server') {
        setBearer(token);
        try { const i = await api.workspace(id); if (alive) setInfo(i); } catch (e) { if (alive) setError((e as Error).message); return; }
      }
      const w = await openLocalWorkspace(localId);
      await w.whenSynced;
      if (!alive) { w.destroy(); return; }
      handle = w; unbind = bindLibraries(registry, w.store); setLw(w);
      if (mode === 'server') { c = connectRoom(w.doc, id, token ?? undefined); setConn(c); }
    })();
    return () => { alive = false; unbind(); c?.disconnect(); handle?.destroy(); setBearer(null); };
  }, [id, mode, localId, registry]);

  if (error) return <div className="home"><h1>{t('No se pudo abrir')}</h1><p className="err" role="alert">{error}</p><a className="btn" href="#/">{t('Volver')}</a></div>;
  if (!lw || (mode === 'server' && !info)) return <div className="home" role="status" aria-live="polite">{t('Abriendo…')}</div>;
  const readOnly = mode === 'server' && info?.role === 'viewer';
  const initial = viewId ?? lw.store.meta().currentViewId ?? lw.store.list('views')[0]?.id ?? null;
  const onLayout = async () => {
    const vid = lw.store.meta().currentViewId; if (!vid) return;
    const v = lw.store.get('views', vid); if (!v) return;
    const { layoutView, autoLayoutDefaults } = await import('@all-draw/layout');
    lw.history.run(await layoutView(lw.store, registry, vid, autoLayoutDefaults(v.notationId)));
  };
  return (
    <EditorProvider store={lw.store} history={lw.history} registry={registry} initialViewId={initial} readOnly={readOnly} validators={validators}
      presence={conn ? { awareness: conn.awareness, me } : undefined}>
      <Editor toolbarLeft={<LeftTools />} toolbarRight={<RightTools lw={lw} id={id} mode={mode} info={info} conn={conn} />} onRequestLayout={readOnly ? undefined : onLayout} />
    </EditorProvider>
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
    <a className="btn btn--ghost" href="#/" title={t('Todos los espacios')} aria-label={t('Todos los espacios')}>☰</a>
    <input className="app-name" aria-label={t('Nombre del espacio')} value={meta.name} disabled={readOnly} onChange={e => store.setMeta({ name: e.target.value, updatedAt: new Date().toISOString() })} />
  </>;
}

function RightTools({ lw, id, mode, info, conn }: { lw: LocalWorkspace; id: string; mode: 'local' | 'server'; info: WorkspaceInfo | null; conn: RemoteConnection | null }) {
  const t = useT();
  const [status, setStatus] = useState('connecting');
  const [share, setShare] = useState(false);
  const [history, setHistory] = useState(false);
  useEffect(() => { if (!conn) return; const t = setInterval(() => setStatus(conn.status()), 1000); return () => clearInterval(t); }, [conn]);
  const upload = async () => {
    try { const snap = lw.store.snapshot(); const w = await api.createWorkspace(snap.meta.name || t('Espacio'), snap); location.hash = `#/s/${w.id}`; }
    catch (e) { alert(t('Necesitas una cuenta en el servidor: {error}', { error: (e as Error).message })); }
  };
  return <>
    {mode === 'server'
      ? <span className="app-status" role="status" aria-live="polite" title={t('Sincronizado con el servidor')}>{status === 'connected' ? `● ${t('en línea')}` : status === 'connecting' ? `◌ ${t('conectando…')}` : `○ ${t('sin conexión (se sincroniza al volver)')}`} · {info?.role ? t(info.role) : ''}</span>
      : <span className="app-status" role="status">{t('guardado en este navegador')}</span>}
    <ImportExport />
    {mode === 'server' && info && <button className="btn" aria-haspopup="dialog" onClick={() => setHistory(true)}>{t('Historial')}</button>}
    {mode === 'server' && info?.role === 'owner' && <button className="btn btn--primary" aria-haspopup="dialog" onClick={() => setShare(true)}>{t('Compartir')}</button>}
    {mode === 'local' && <button className="btn btn--primary" onClick={upload} title={t('Copia este espacio al servidor para compartirlo')}>{t('Subir al servidor')}</button>}
    <LangSelect className="lang-select--bar" />
    {share && <ShareDialog id={id} onClose={() => setShare(false)} />}
    {history && info && <HistoryDialog id={id} role={info.role} onClose={() => setHistory(false)} />}
  </>;
}

function ShareDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [msg, setMsg] = useState('');
  const box = useDialog(onClose);
  const t = useT();
  const refresh = () => api.links(id).then(setLinks).catch(() => setLinks([]));
  useEffect(() => { refresh(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async (role: 'editor' | 'viewer') => { try { await api.createLink(id, role); setMsg(role === 'editor' ? t('Enlace de edición creado') : t('Enlace de lectura creado')); refresh(); } catch (e) { setMsg((e as Error).message); } };
  const copy = async (l: ShareLink) => { try { await navigator.clipboard?.writeText(l.url); setMsg(t('Enlace copiado al portapapeles')); } catch { setMsg(t('No se pudo copiar; el enlace es {url}', { url: l.url })); } };
  const label = (l: ShareLink) => t('{kind} del {date}', { kind: l.role === 'editor' ? t('edición') : t('lectura'), date: new Date(l.createdAt).toLocaleString() });
  return (
    <div className="modal" onClick={onClose}>
      <div ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h2 id="share-title">{t('Compartir')}</h2>
        <p className="app-status" style={{ padding: 0 }}>{t('Quien tenga un enlace de edición edita a la vez contigo; el de lectura solo ve. Puedes revocarlos cuando quieras.')}</p>
        <div className="row"><button className="btn btn--primary" onClick={() => create('editor')}>{t('Nuevo enlace de edición')}</button><button className="btn" onClick={() => create('viewer')}>{t('Nuevo enlace de lectura')}</button></div>
        <ul className="share__list" aria-label={t('Enlaces compartidos')}>
          {links.map(l => <li key={l.token} className="row"><span style={{ flex: 1 }}><span aria-hidden="true">{l.role === 'editor' ? '✎' : '👁'}</span> {l.role === 'editor' ? t('edición') : t('lectura')} <small>{new Date(l.createdAt).toLocaleString()}</small></span><button className="btn" aria-label={t('Copiar enlace de {label}', { label: label(l) })} onClick={() => copy(l)}>{t('Copiar enlace')}</button><button className="btn btn--ghost" aria-label={t('Revocar enlace de {label}', { label: label(l) })} onClick={async () => { await api.deleteLink(id, l.token); setMsg(t('Enlace revocado')); refresh(); }}>{t('Revocar')}</button></li>)}
        </ul>
        <p className="app-status" role="status" aria-live="polite" style={{ padding: 0, minHeight: '1.2em' }}>{msg}</p>
        <div className="row" style={{ marginTop: 12 }}><span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>{t('Cerrar')}</button></div>
      </div>
    </div>
  );
}
