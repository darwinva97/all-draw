import { useEffect, useRef, useState } from 'react';
import { useEditor, useMeta } from '@all-draw/editor';
import { loadInto } from '@all-draw/core';
const io = () => import('@all-draw/io');

function download(name: string, data: string | Blob, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const safe = (s: string) => (s || 'diagrama').replace(/[^\w\-]+/g, '_');

/** Menú Importar / Exportar de la barra. */
export function ImportExport() {
  const { store, registry, viewId, readOnly, effectiveTheme } = useEditor();
  const meta = useMeta();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const view = viewId ? store.get('views', viewId) : undefined;
  const ws = () => store.snapshot();
  const base = safe(meta.name); const vbase = safe(view?.name ?? 'vista');
  const warn = (w: string[]) => { if (w.length) alert(`Avisos:\n${w.slice(0, 12).join('\n')}${w.length > 12 ? `\n… y ${w.length - 12} más` : ''}`); };
  const onFile = async (f: File) => {
    try {
      const { workspace, warnings, format } = await (await io()).importAny(await f.text(), f.name);
      if (confirm(`Fichero ${format}. Esto sustituye el contenido de este espacio. ¿Continuar?`)) { loadInto(store, workspace); warn(warnings); }
    } catch (e) { alert(`No se pudo importar: ${(e as Error).message}`); }
  };
  const act = (fn: () => Promise<void> | void) => async () => { setOpen(false); try { await fn(); } catch (e) { alert((e as Error).message); } };
  // Al abrir: foco en la primera opción; Escape cierra y devuelve el foco al botón; flechas recorren las opciones.
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);
  return (
    <span style={{ position: 'relative' }}>
      <button ref={trigger} className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>Importar / Exportar ▾</button>
      <input ref={file} type="file" aria-label="Fichero a importar" accept=".drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {open && <div ref={menu} className="menu" role="menu" aria-label="Importar / Exportar" onMouseLeave={() => setOpen(false)}>
        {!readOnly && <><div className="menu__title">Importar (sustituye el espacio)</div>
          <button role="menuitem" onClick={() => { setOpen(false); file.current?.click(); }}>.drawer, .alldraw.json, .archimate, OEF, BPMN, Structurizr, XState, Mermaid, OpenAPI…</button></>}
        <div className="menu__title">Exportar el espacio</div>
        <button role="menuitem" onClick={act(async () => download(`${base}.alldraw.json`, (await io()).exportWorkspace(ws()), 'application/json'))}>JSON de all-draw</button>
        <button role="menuitem" onClick={act(async () => download(`${base}.html`, (await io()).renderStandaloneHtml(store, registry, { title: meta.name }), 'text/html'))}>HTML autocontenido (todas las vistas)</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportArchimate(ws()); download(`${base}.archimate`, r.text, 'application/xml'); warn(r.warnings); })}>Archi (.archimate)</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportOpenExchange(ws()); download(`${base}.oef.xml`, r.text, 'application/xml'); warn(r.warnings); })}>ArchiMate Open Exchange</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportStructurizr(ws()); download(`${base}.structurizr.json`, r.text, 'application/json'); warn(r.warnings); })}>Structurizr JSON (C4)</button>
        <button role="menuitem" onClick={act(async () => { const r = await (await io()).exportBpmn(ws()); download(`${base}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>BPMN 2.0 XML (todas las vistas BPMN)</button>
        {view && <>
          <div className="menu__title">Exportar la vista «{view.name}»</div>
          <button role="menuitem" onClick={act(async () => download(`${vbase}.svg`, (await io()).renderSvg(store, registry, view.id, { theme: 'dual' }), 'image/svg+xml'))}>SVG (tema claro y oscuro)</button>
          <button role="menuitem" onClick={act(async () => download(`${vbase}.png`, await (await io()).svgToPng((await io()).renderSvg(store, registry, view.id, { theme: effectiveTheme === 'dark' ? 'dark' : 'light' }), 2)))}>PNG (2×)</button>
          <button role="menuitem" onClick={act(async () => { const r = (await io()).exportMermaid(ws(), view.id); download(`${vbase}.mmd`, r.text); warn(r.warnings); })}>Mermaid</button>
          <button role="menuitem" onClick={act(async () => { const r = (await io()).exportDrawio(ws(), view.id); download(`${vbase}.drawio`, r.text, 'application/xml'); warn(r.warnings); })}>draw.io</button>
          {view.notationId === 'bpmn' && <button role="menuitem" onClick={act(async () => { const r = await (await io()).exportBpmn(ws(), view.id); download(`${vbase}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>BPMN 2.0 XML</button>}
          {view.notationId === 'statechart' && <button role="menuitem" onClick={act(async () => { const r = (await io()).exportXState(ws(), view.id); download(`${vbase}.xstate.json`, r.text, 'application/json'); warn(r.warnings); })}>XState JSON</button>}
        </>}
      </div>}
    </span>
  );
}
