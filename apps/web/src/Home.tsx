import { useEffect, useRef, useState } from 'react';
import { newId, loadInto, generateLargeWorkspace } from '@all-draw/core';
import { listLocalWorkspaces, openLocalWorkspace, deleteLocalWorkspace, type LocalWorkspaceEntry } from '@all-draw/sync';
import { demoWorkspace } from './demo';
import { api, type User, type WorkspaceInfo } from './api';
import { AuthDialog } from './Auth';
import { LangSelect } from './App';
import { createRegistry } from './registry';
import { useT } from '@all-draw/i18n';

export function Home() {
  const t = useT();
  const [list, setList] = useState<LocalWorkspaceEntry[]>([]);
  const [remote, setRemote] = useState<WorkspaceInfo[] | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [serverUp, setServerUp] = useState<boolean>(false);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const refresh = async () => {
    setList((await listLocalWorkspaces()).filter(w => !w.id.startsWith('srv_')));
    const up = await api.available(); setServerUp(up);
    if (up) { const u = await api.me(); setUser(u); setRemote(u ? await api.workspaces().catch(() => []) : null); } else setUser(null);
  };
  useEffect(() => { refresh(); }, []);

  const createLocal = async (ws: ReturnType<typeof demoWorkspace> | null, name?: string) => {
    setBusy(true);
    const id = newId('ws');
    const lw = await openLocalWorkspace(id);
    await lw.whenSynced;
    if (ws) loadInto(lw.store, ws); else lw.store.setMeta({ name: name ?? t('Nuevo espacio'), createdAt: new Date().toISOString() });
    lw.destroy();
    location.hash = `#/w/${id}`;
  };
  const createRemote = async (initial?: unknown, name = t('Nuevo espacio')) => {
    setBusy(true); setErr('');
    try { const w = await api.createWorkspace(name, initial); location.hash = `#/s/${w.id}`; } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    setErr('');
    try {
      const { importAny } = await import('@all-draw/io');
      const { workspace, warnings, format } = await importAny(text, f.name);
      if (warnings.length) console.warn(`Importación ${format}:`, warnings);
      if (user) await createRemote(workspace, workspace.meta.name); else await createLocal(workspace);
    } catch (e) { setErr(t('No se pudo importar: {error}', { error: (e as Error).message })); setBusy(false); }
  };
  /** Espacio grande de prueba (1.000 elementos × 50 vistas), solo con `?bench=1` en la URL. */
  const bench = location.search.includes('bench=1');
  const createBench = () => createLocal(generateLargeWorkspace({ elements: 1000, views: 50, perView: 60, notation: 'archimate', registry: createRegistry() }));
  const upload = async (w: LocalWorkspaceEntry) => {
    setBusy(true);
    const lw = await openLocalWorkspace(w.id); await lw.whenSynced;
    const snap = lw.store.snapshot(); lw.destroy();
    await createRemote(snap, snap.meta.name || w.name);
  };

  return (
    <div className="home">
      <div className="home__lang"><LangSelect /></div>
      <h1>all-draw</h1>
      <p className="lead">{t('Un modelo, muchas notaciones como dimensiones. Los espacios locales viven en este navegador; con una cuenta se guardan en el servidor y se comparten.')}</p>
      <div className="home__actions">
        <button className="btn btn--primary" disabled={busy} onClick={() => user ? createRemote() : createLocal(null)}>{user ? t('Nuevo espacio en el servidor') : t('Nuevo espacio')}</button>
        <button className="btn" disabled={busy} onClick={() => user ? createRemote(demoWorkspace(), 'Demo · Alta de cliente') : createLocal(demoWorkspace())}>{t('Abrir la demo')}</button>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>{t('Importar…')}</button>
        <input ref={file} type="file" aria-label={t('Fichero a importar')} accept=".drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <span style={{ flex: 1 }} />
        {serverUp && user === null && <button className="btn" onClick={() => setAuth(true)}>{t('Entrar / registrarse')}</button>}
        {user && <span className="app-status">{user.name} · <a href="#/keys">{t('claves API')}</a> · <button className="btn btn--ghost" onClick={async () => { await api.logout(); refresh(); }}>{t('salir')}</button></span>}
      </div>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      <p className="app-status" style={{ padding: 0 }}>{t('Formatos: .drawer (Drawer), .alldraw.json, .archimate (Archi), Open Exchange, BPMN 2.0 XML, Structurizr JSON, XState JSON, Mermaid, OpenAPI.')}</p>
      {bench && <p className="app-status" style={{ padding: 0 }}><button className="btn btn--ghost" data-bench="create" disabled={busy} onClick={createBench}>{t('Espacio grande de prueba (1000 × 50)')}</button></p>}
      {remote && <>
        <h2 className="home__section">{t('En el servidor')}</h2>
        <div className="home__list">
          {remote.length === 0 && <p className="home__empty">{t('Todavía no tienes espacios en el servidor.')}</p>}
          {remote.map(w => (
            <div key={w.id} className="home__item" onClick={() => (location.hash = `#/s/${w.id}`)}>
              <div><a className="home__link" href={`#/s/${w.id}`} onClick={e => e.stopPropagation()}>{w.name || t('(sin nombre)')}</a> <small>· {t(w.role)}</small><br /><small>{new Date(w.updatedAt).toLocaleString()}</small></div>
              {w.role === 'owner' && <button className="btn btn--ghost" aria-label={t('Borrar {name} del servidor', { name: w.name || t('espacio sin nombre') })} onClick={async e => { e.stopPropagation(); if (confirm(t('¿Borrar "{name}" del servidor?', { name: w.name }))) { await api.deleteWorkspace(w.id); refresh(); } }}>{t('Borrar')}</button>}
            </div>
          ))}
        </div>
      </>}
      <h2 className="home__section">{t('En este navegador')}</h2>
      <div className="home__list">
        {list.length === 0 && <p className="home__empty">{t('Todavía no hay espacios locales.')}</p>}
        {list.map(w => (
          <div key={w.id} className="home__item" onClick={() => (location.hash = `#/w/${w.id}`)}>
            <div><a className="home__link" href={`#/w/${w.id}`} onClick={e => e.stopPropagation()}>{w.name || t('(sin nombre)')}</a><br /><small>{new Date(w.updatedAt).toLocaleString()}</small></div>
            <span>
              {user && <button className="btn btn--ghost" disabled={busy} aria-label={t('Subir {name} al servidor', { name: w.name || t('espacio sin nombre') })} onClick={e => { e.stopPropagation(); upload(w); }}>{t('Subir al servidor')}</button>}
              <button className="btn btn--ghost" aria-label={t('Borrar {name} de este navegador', { name: w.name || t('espacio sin nombre') })} onClick={async e => { e.stopPropagation(); if (confirm(t('¿Borrar "{name}" de este navegador?', { name: w.name }))) { await deleteLocalWorkspace(w.id); refresh(); } }}>{t('Borrar')}</button>
            </span>
          </div>
        ))}
      </div>
      {auth && <AuthDialog onClose={() => { setAuth(false); refresh(); }} />}
    </div>
  );
}
