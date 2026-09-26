import { useEffect, useRef, useState } from 'react';
import { newId, loadInto } from '@all-draw/core';
import { listLocalWorkspaces, openLocalWorkspace, deleteLocalWorkspace, type LocalWorkspaceEntry } from '@all-draw/sync';
import { demoWorkspace } from './demo';
import { api, type User, type WorkspaceInfo } from './api';
import { AuthDialog } from './Auth';

export function Home() {
  const [list, setList] = useState<LocalWorkspaceEntry[]>([]);
  const [remote, setRemote] = useState<WorkspaceInfo[] | null>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [serverUp, setServerUp] = useState<boolean>(false);
  const [auth, setAuth] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (ws) loadInto(lw.store, ws); else lw.store.setMeta({ name: name ?? 'Nuevo espacio', createdAt: new Date().toISOString() });
    lw.destroy();
    location.hash = `#/w/${id}`;
  };
  const createRemote = async (initial?: unknown, name = 'Nuevo espacio') => {
    setBusy(true);
    try { const w = await api.createWorkspace(name, initial); location.hash = `#/s/${w.id}`; } catch (e) { alert((e as Error).message); setBusy(false); }
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    try {
      const { importAny } = await import('@all-draw/io');
      const { workspace, warnings, format } = await importAny(text, f.name);
      if (warnings.length) console.warn(`Importación ${format}:`, warnings);
      if (user) await createRemote(workspace, workspace.meta.name); else await createLocal(workspace);
    } catch (e) { alert(`No se pudo importar: ${(e as Error).message}`); setBusy(false); }
  };
  const upload = async (w: LocalWorkspaceEntry) => {
    setBusy(true);
    const lw = await openLocalWorkspace(w.id); await lw.whenSynced;
    const snap = lw.store.snapshot(); lw.destroy();
    await createRemote(snap, snap.meta.name || w.name);
  };

  return (
    <div className="home">
      <h1>all-draw</h1>
      <p className="lead">Un modelo, muchas notaciones como dimensiones. Los espacios locales viven en este navegador; con una cuenta se guardan en el servidor y se comparten.</p>
      <div className="home__actions">
        <button className="btn btn--primary" disabled={busy} onClick={() => user ? createRemote() : createLocal(null)}>Nuevo espacio{user ? ' en el servidor' : ''}</button>
        <button className="btn" disabled={busy} onClick={() => user ? createRemote(demoWorkspace(), 'Demo · Alta de cliente') : createLocal(demoWorkspace())}>Abrir la demo</button>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>Importar…</button>
        <input ref={file} type="file" accept=".drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <span style={{ flex: 1 }} />
        {serverUp && user === null && <button className="btn" onClick={() => setAuth(true)}>Entrar / registrarse</button>}
        {user && <span className="app-status">{user.name} · <a href="#/keys">claves API</a> · <button className="btn btn--ghost" onClick={async () => { await api.logout(); refresh(); }}>salir</button></span>}
      </div>
      <p className="app-status" style={{ padding: 0 }}>Formatos: .drawer (Drawer), .alldraw.json, .archimate (Archi), Open Exchange, BPMN 2.0 XML, Structurizr JSON, XState JSON, Mermaid, OpenAPI.</p>
      {remote && <>
        <div className="home__section">En el servidor</div>
        <div className="home__list">
          {remote.length === 0 && <p style={{ color: '#6b7280' }}>Todavía no tienes espacios en el servidor.</p>}
          {remote.map(w => (
            <div key={w.id} className="home__item" onClick={() => (location.hash = `#/s/${w.id}`)}>
              <div><div>{w.name || '(sin nombre)'} <small>· {w.role}</small></div><small>{new Date(w.updatedAt).toLocaleString()}</small></div>
              {w.role === 'owner' && <button className="btn btn--ghost" onClick={async e => { e.stopPropagation(); if (confirm(`¿Borrar "${w.name}" del servidor?`)) { await api.deleteWorkspace(w.id); refresh(); } }}>Borrar</button>}
            </div>
          ))}
        </div>
      </>}
      <div className="home__section">En este navegador</div>
      <div className="home__list">
        {list.length === 0 && <p style={{ color: '#6b7280' }}>Todavía no hay espacios locales.</p>}
        {list.map(w => (
          <div key={w.id} className="home__item" onClick={() => (location.hash = `#/w/${w.id}`)}>
            <div><div>{w.name || '(sin nombre)'}</div><small>{new Date(w.updatedAt).toLocaleString()}</small></div>
            <span>
              {user && <button className="btn btn--ghost" disabled={busy} onClick={e => { e.stopPropagation(); upload(w); }}>Subir al servidor</button>}
              <button className="btn btn--ghost" onClick={async e => { e.stopPropagation(); if (confirm(`¿Borrar "${w.name}" de este navegador?`)) { await deleteLocalWorkspace(w.id); refresh(); } }}>Borrar</button>
            </span>
          </div>
        ))}
      </div>
      {auth && <AuthDialog onClose={() => { setAuth(false); refresh(); }} />}
    </div>
  );
}
