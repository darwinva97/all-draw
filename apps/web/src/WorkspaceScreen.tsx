import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorProvider, Editor, useEditor, useMeta } from '@all-draw/editor';
import { openLocalWorkspace, type LocalWorkspace } from '@all-draw/sync';
import { exportWorkspace, importDrawer, importWorkspace } from '@all-draw/io';
import { loadInto } from '@all-draw/core';
import { createRegistry, bindLibraries } from './registry';

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
      <Editor toolbarLeft={<LeftTools />} toolbarRight={<RightTools lw={lw} />} />
    </EditorProvider>
  );
}

function LeftTools() {
  const { store, viewId } = useEditor();
  const meta = useMeta();
  useEffect(() => { if (viewId && meta.currentViewId !== viewId) store.setMeta({ currentViewId: viewId }); }, [viewId, meta.currentViewId, store]);
  return <>
    <a className="btn btn--ghost" href="#/" title="Todos los espacios">☰</a>
    <input className="app-name" value={meta.name} onChange={e => store.setMeta({ name: e.target.value, updatedAt: new Date().toISOString() })} />
  </>;
}

function RightTools({ lw }: { lw: LocalWorkspace }) {
  const { store } = useEditor();
  const meta = useMeta();
  const file = useRef<HTMLInputElement>(null);
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
  void lw;
  return <>
    <span className="app-status">guardado en este navegador</span>
    <button className="btn" onClick={() => file.current?.click()} title="Sustituir por un fichero">Importar</button>
    <button className="btn" onClick={download} title="Descargar JSON">Exportar</button>
    <input ref={file} type="file" accept=".drawer,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
  </>;
}
