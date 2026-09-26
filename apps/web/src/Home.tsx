import { useEffect, useRef, useState } from 'react';
import { newId, loadInto } from '@all-draw/core';
import { listLocalWorkspaces, openLocalWorkspace, deleteLocalWorkspace, type LocalWorkspaceEntry } from '@all-draw/sync';
import { importDrawer, importWorkspace } from '@all-draw/io';
import { demoWorkspace } from './demo';

export function Home() {
  const [list, setList] = useState<LocalWorkspaceEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => listLocalWorkspaces().then(setList);
  useEffect(() => { refresh(); }, []);

  const createFrom = async (ws: ReturnType<typeof demoWorkspace> | null, name?: string) => {
    setBusy(true);
    const id = newId('ws');
    const lw = await openLocalWorkspace(id);
    await lw.whenSynced;
    if (ws) loadInto(lw.store, ws); else lw.store.setMeta({ name: name ?? 'Nuevo espacio', createdAt: new Date().toISOString() });
    lw.destroy();
    location.hash = `#/w/${id}`;
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    try {
      if (f.name.endsWith('.drawer')) { const { workspace, warnings } = importDrawer(text); if (warnings.length) console.warn('Importación .drawer:', warnings); await createFrom(workspace); }
      else await createFrom(importWorkspace(text));
    } catch (e) { alert(`No se pudo importar: ${(e as Error).message}`); setBusy(false); }
  };

  return (
    <div className="home">
      <h1>all-draw</h1>
      <p className="lead">Un modelo, muchas notaciones como dimensiones. Todo se guarda en este navegador; exporta a fichero cuando quieras.</p>
      <div className="home__actions">
        <button className="btn btn--primary" disabled={busy} onClick={() => createFrom(null)}>Nuevo espacio</button>
        <button className="btn" disabled={busy} onClick={() => createFrom(demoWorkspace())}>Abrir la demo (alta de cliente en 5 dimensiones)</button>
        <button className="btn" disabled={busy} onClick={() => file.current?.click()}>Importar .drawer / .alldraw.json</button>
        <input ref={file} type="file" accept=".drawer,.json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      <div className="home__list">
        {list.length === 0 && <p style={{ color: '#6b7280' }}>Todavía no hay espacios en este navegador.</p>}
        {list.map(w => (
          <div key={w.id} className="home__item" onClick={() => (location.hash = `#/w/${w.id}`)}>
            <div><div>{w.name || '(sin nombre)'}</div><small>{new Date(w.updatedAt).toLocaleString()}</small></div>
            <button className="btn btn--ghost" onClick={async e => { e.stopPropagation(); if (confirm(`¿Borrar "${w.name}" de este navegador?`)) { await deleteLocalWorkspace(w.id); refresh(); } }}>Borrar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
