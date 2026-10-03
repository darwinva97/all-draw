import { useEffect, useRef, useState } from 'react';
import { useEditor, useMeta, Icon, HelpLink, confirmDialog, noticeDialog, toast } from '@all-draw/editor';
import { loadInto } from '@all-draw/core';
import { useT } from '@all-draw/i18n';
const io = () => import('@all-draw/io');

function download(name: string, data: string | Blob, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const safe = (s: string, fallback: string) => (s || fallback).replace(/[^\w\-]+/g, '_');

/** Menú Importar / Exportar de la barra. */
export function ImportExport() {
  const { store, registry, viewId, readOnly, effectiveTheme } = useEditor();
  const meta = useMeta();
  const t = useT();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const view = viewId ? store.get('views', viewId) : undefined;
  const ws = () => store.snapshot();
  const base = safe(meta.name, t('diagrama')); const vbase = safe(view?.name ?? '', t('vista'));
  /** Avisos de una conversión: un aviso breve con "Ver avisos" que abre la lista completa. */
  const warn = (w: string[], what: string) => {
    if (!w.length) return;
    toast.warning(t('{what}: {n} avisos', { what, n: w.length }), { action: { label: t('Ver avisos'), onClick: () => void noticeDialog({ title: t('Avisos: {what}', { what }), message: t('Algunas partes no tienen equivalente exacto en el formato de destino.'), items: w }) } });
  };
  const onFile = async (f: File) => {
    try {
      const { workspace, warnings, format } = await (await io()).importAny(await f.text(), f.name);
      const ok = await confirmDialog({ title: t('¿Sustituir el contenido de este espacio?'), message: t('El fichero «{name}» ({format}) reemplaza todas las vistas y el modelo actuales. Puedes deshacerlo con Ctrl+Z.', { name: f.name, format }), confirmLabel: t('Sustituir'), danger: true });
      if (!ok) return;
      loadInto(store, workspace);
      toast.success(t('Importado desde {format}', { format }), { description: f.name });
      warn(warnings, t('Importación'));
    } catch (e) { toast.error(t('No se pudo importar «{name}»', { name: f.name }), { description: (e as Error).message }); }
  };
  const act = (fn: () => Promise<void> | void) => async () => { setOpen(false); try { await fn(); } catch (e) { toast.error(t('No se pudo exportar'), { description: (e as Error).message }); } };
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
      <button ref={trigger} className="btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{t('Importar / Exportar')}<Icon name="chevronDown" size={14} /></button>
      <input ref={file} type="file" aria-label={t('Fichero a importar')} accept=".drawer,.json,.archimate,.xml,.bpmn,.mmd,.yaml,.yml" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {open && <div ref={menu} className="menu" role="menu" aria-label={t('Importar / Exportar')} onMouseLeave={() => setOpen(false)}>
        {!readOnly && <><div className="menu__title">{t('Importar (sustituye el espacio)')}</div>
          <button role="menuitem" onClick={() => { setOpen(false); file.current?.click(); }}>.drawer, .alldraw.json, .archimate, OEF, BPMN, Structurizr, XState, Mermaid, OpenAPI…</button></>}
        <div className="menu__title">{t('Exportar el espacio')}</div>
        <button role="menuitem" onClick={act(async () => download(`${base}.alldraw.json`, (await io()).exportWorkspace(ws()), 'application/json'))}>{t('JSON de all-draw')}</button>
        <button role="menuitem" onClick={act(async () => download(`${base}.html`, (await io()).renderStandaloneHtml(store, registry, { title: meta.name }), 'text/html'))}>{t('HTML autocontenido (todas las vistas)')}</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportArchimate(ws()); download(`${base}.archimate`, r.text, 'application/xml'); warn(r.warnings, 'Archi (.archimate)'); })}>Archi (.archimate)</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportOpenExchange(ws()); download(`${base}.oef.xml`, r.text, 'application/xml'); warn(r.warnings, 'ArchiMate Open Exchange'); })}>ArchiMate Open Exchange</button>
        <button role="menuitem" onClick={act(async () => { const r = (await io()).exportStructurizr(ws()); download(`${base}.structurizr.json`, r.text, 'application/json'); warn(r.warnings, 'Structurizr JSON (C4)'); })}>Structurizr JSON (C4)</button>
        <button role="menuitem" onClick={act(async () => { const r = await (await io()).exportBpmn(ws()); download(`${base}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>{t('BPMN 2.0 XML (todas las vistas BPMN)')}</button>
        {view && <>
          <div className="menu__title">{t('Exportar la vista «{name}»', { name: view.name })}</div>
          <button role="menuitem" onClick={act(async () => download(`${vbase}.svg`, (await io()).renderSvg(store, registry, view.id, { theme: 'dual' }), 'image/svg+xml'))}>{t('SVG (tema claro y oscuro)')}</button>
          <button role="menuitem" onClick={act(async () => download(`${vbase}.png`, await (await io()).svgToPng((await io()).renderSvg(store, registry, view.id, { theme: effectiveTheme === 'dark' ? 'dark' : 'light' }), 2)))}>PNG (2×)</button>
          <button role="menuitem" onClick={act(async () => { const r = (await io()).exportMermaid(ws(), view.id); download(`${vbase}.mmd`, r.text); warn(r.warnings, 'Mermaid'); })}>Mermaid</button>
          <button role="menuitem" onClick={act(async () => { const r = (await io()).exportDrawio(ws(), view.id); download(`${vbase}.drawio`, r.text, 'application/xml'); warn(r.warnings, 'draw.io'); })}>draw.io</button>
          {view.notationId === 'bpmn' && <button role="menuitem" onClick={act(async () => { const r = await (await io()).exportBpmn(ws(), view.id); download(`${vbase}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>BPMN 2.0 XML</button>}
          {view.notationId === 'statechart' && <button role="menuitem" onClick={act(async () => { const r = (await io()).exportXState(ws(), view.id); download(`${vbase}.xstate.json`, r.text, 'application/json'); warn(r.warnings, 'XState JSON'); })}>XState JSON</button>}
        </>}
        <div className="menu__sep" />
        <HelpLink slug="importar-exportar" label={t('Formatos y equivalencias')} className="menu__help" />
      </div>}
    </span>
  );
}
