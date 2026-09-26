import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorProvider, Editor, useEditor, useMeta, useCollection } from '@all-draw/editor';
import { openLocalWorkspace, type LocalWorkspace } from '@all-draw/sync';
import { exportWorkspace, importDrawer, importWorkspace } from '@all-draw/io';
import { loadInto } from '@all-draw/core';
import { createRegistry, bindLibraries } from './registry';
import { connectRoom, roomFromHash } from './share';
import type { RemoteConnection } from '@all-draw/sync';

export function WorkspaceScreen({ id, viewId }: { id: string; viewId: string | null }) {
  const [lw, setLw] = useState<LocalWorkspace | null>(null);
  const registry = useMemo(() => createRegistry(), []);
  useEffect(() => {
    let alive = true; let handle: LocalWorkspace | null = null; let unbind = () => {};
    openLocalWorkspace(id).then(async w => {
      await w.whenSynced;
      if (!alive) { w.destroy(); return; }
      handle = w; unbind = bindLibraries(registry, w.store); setLw(w);
    });
    return () => { alive = false; unbind(); handle?.destroy(); };
  }, [id, registry]);
  if (!lw) return <div className="home">Abriendo…</div>;
  const initial = viewId ?? lw.store.meta().currentViewId ?? lw.store.list('views')[0]?.id ?? null;
  return (
    <EditorProvider store={lw.store} history={lw.history} registry={registry} initialViewId={initial}>
      <Editor toolbarLeft={<LeftTools />} toolbarRight={<RightTools lw={lw} id={id} />} />
    </EditorProvider>
  );
}

function LeftTools() {
  const { store, viewId, openView } = useEditor();
  const meta = useMeta();
  const views = useCollection('views');
  useEffect(() => { if (viewId && meta.currentViewId !== viewId) store.setMeta({ currentViewId: viewId }); }, [viewId, meta.currentViewId, store]);
  // Si el espacio llega por sincronización después de abrirlo vacío, abre su vista actual
  useEffect(() => { if (!viewId && views.length) openView((meta.currentViewId && store.get('views', meta.currentViewId)) ? meta.currentViewId : views[0]!.id); }, [viewId, views, meta.currentViewId, store, openView]);
  return <>
    <a className="btn btn--ghost" href="#/" title="Todos los espacios">☰</a>
    <input className="app-name" value={meta.name} onChange={e => store.setMeta({ name: e.target.value, updatedAt: new Date().toISOString() })} />
  </>;
}

function RightTools({ lw, id }: { lw: LocalWorkspace; id: string }) {
  const { store } = useEditor();
  const meta = useMeta();
  const file = useRef<HTMLInputElement>(null);
  const [conn, setConn] = useState<RemoteConnection | null>(null);
  const [status, setStatus] = useState<string>('local');
  const wsId = id;
  const roomKey = `alldraw:room:${wsId}`;
  useEffect(() => {
    const room = roomFromHash() ?? localStorage.getItem(roomKey);
    if (!room) return;
    const c = connectRoom(lw.doc, room);
    setConn(c); localStorage.setItem(roomKey, room);
    const t = setInterval(() => setStatus(c.status()), 1000);
    return () => { clearInterval(t); c.disconnect(); setConn(null); };
  }, [lw, roomKey]);
  const share = () => {
    if (conn) { if (confirm('¿Dejar de sincronizar en línea? El espacio sigue en este navegador.')) { localStorage.removeItem(roomKey); location.hash = location.hash.split('?')[0]!; location.reload(); } return; }
    const room = wsId;
    localStorage.setItem(roomKey, room);
    location.hash = `${location.hash.split('?')[0]}?room=${encodeURIComponent(room)}`;
    location.reload();
  };
  const copyLink = () => { navigator.clipboard?.writeText(location.href); };
  const download = () => {
    const blob = new Blob([exportWorkspace(store.snapshot())], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${(meta.name || 'espacio').replace(/[^\w\-]+/g, '_')}.alldraw.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  const onFile = async (f: File) => {
    const text = await f.text();
    try {
      const ws = f.name.endsWith('.drawer') ? importDrawer(text).workspace : importWorkspace(text);
      if (confirm('Esto sustituye el contenido de este espacio por el del fichero. ¿Continuar?')) loadInto(store, ws);
    } catch (e) { alert(`No se pudo importar: ${(e as Error).message}`); }
  };
  return <>
    <span className="app-status" title={conn ? 'Sincronizado con el servidor: cualquiera con el enlace edita a la vez' : 'Solo en este navegador'}>{conn ? (status === 'connected' ? '● en línea' : status === 'connecting' ? '◌ conectando…' : '○ sin conexión (se sincroniza al volver)') : 'guardado en este navegador'}</span>
    {conn && <button className="btn" onClick={copyLink} title="Copiar enlace para colaborar">Copiar enlace</button>}
    <button className={`btn ${conn ? '' : 'btn--primary'}`} onClick={share}>{conn ? 'Dejar de compartir' : 'Compartir en línea'}</button>
    <button className="btn" onClick={() => file.current?.click()} title="Sustituir por un fichero">Importar</button>
    <button className="btn" onClick={download} title="Descargar JSON">Exportar</button>
    <input ref={file} type="file" accept=".drawer,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  </>;
}
