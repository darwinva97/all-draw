import { useEffect, useRef, useState } from 'react';
import { useEditor, useMeta, Icon, HelpLink, confirmDialog, noticeDialog, toast } from '@all-draw/editor';
import { COLLECTIONS, type Command, type Store, type Workspace } from '@all-draw/core';
import { tn, useT } from '@all-draw/i18n';
import { ioErrorText } from './io-text';
const io = () => import('@all-draw/io');


function download(name: string, data: string | Blob, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
/**
 * Nombre de fichero a partir del nombre del espacio o de la vista: conserva acentos, ñ, espacios y emojis; solo
 * sustituye lo que no admiten los sistemas de ficheros (`/ \ : * ? " < > |` y controles) y los puntos o espacios del
 * principio y del final (Windows).
 */
export const safeFileName = (s: string, fallback: string) =>
  // oxlint-disable-next-line no-control-regex -- los controles tampoco valen en un nombre de fichero
  (s.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, '_').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 120)) || fallback;

/**
 * Sustituir el espacio por otro como **un solo comando** del historial (borra lo que sobra y escribe lo nuevo): así
 * Ctrl+Z / Deshacer recupera el espacio anterior, cosa que `loadInto` (origen `load`) no permitía.
 */
export function replaceWorkspaceCommand(store: Pick<Store, 'ids'>, next: Workspace): Command {
  const commands: Command[] = [];
  for (const c of COLLECTIONS) {
    const incoming = next[c] as Record<string, unknown>;
    for (const id of store.ids(c)) if (!(id in incoming)) commands.push({ type: 'delete', collection: c, id });
    for (const [id, value] of Object.entries(incoming)) commands.push({ type: 'set', collection: c, id, value });
  }
  commands.push({ type: 'meta', patch: { ...next.meta } });
  return { type: 'batch', label: 'import', commands };
}

/** Vista que se abre tras importar: la actual del fichero, o la primera con nodos, o la primera. */
export function firstViewOf(ws: Workspace): string | null {
  const cur = ws.meta.currentViewId;
  if (cur && ws.views[cur]) return cur;
  const withNodes = new Set(Object.values(ws.nodes).map(n => n.viewId));
  const views = Object.values(ws.views);
  return (views.find(v => withNodes.has(v.id)) ?? views[0])?.id ?? null;
}

/** Menú Importar / Exportar de la barra. */
export function ImportExport() {
  const { store, registry, viewId, readOnly, effectiveTheme, run, history, openView } = useEditor();
  const meta = useMeta();
  const t = useT();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const view = viewId ? store.get('views', viewId) : undefined;
  const ws = () => store.snapshot();
  const base = safeFileName(meta.name, t('diagrama')); const vbase = safeFileName(view?.name ?? '', t('vista'));
  /** Avisos de una conversión: un aviso breve con "Ver avisos" que abre la lista completa. */
  const warn = (w: string[], what: string, imported = false) => {
    if (!w.length) return;
    const message = imported ? t('Algunas partes del fichero no tienen equivalente exacto en all-draw.') : t('Algunas partes no tienen equivalente exacto en el formato de destino.');
    toast.warning(tn('{what}: {n} aviso', '{what}: {n} avisos', w.length, { what }), { action: { label: t('Ver avisos'), onClick: () => void noticeDialog({ title: t('Avisos: {what}', { what }), message, items: w }) } });
  };
  /** Exportación sin contenido: un aviso en lugar de descargar un fichero vacío. */
  const nothing = (message: string) => { toast.warning(t('No hay nada que exportar'), { description: message }); };
  const viewIsEmpty = (id: string) => !store.list('nodes').some(n => n.viewId === id);
  const hasNotation = (prefix: string) => store.list('elements').some(e => e.typeId.startsWith(prefix));
  const onFile = async (f: File) => {
    try {
      const { workspace, warnings, formatLabel: format } = await (await io()).importAny(await f.text(), f.name);
      const ok = await confirmDialog({ title: t('¿Sustituir el contenido de este espacio?'), message: t('El fichero «{name}» ({format}) reemplaza todas las vistas y el modelo actuales. Puedes deshacerlo con Ctrl+Z.', { name: f.name, format }), confirmLabel: t('Sustituir'), danger: true });
      if (!ok) return;
      const before = viewId;
      run(replaceWorkspaceCommand(store, workspace));
      openView(firstViewOf(workspace));
      toast.success(t('Importado desde {format}', { format }), {
        description: f.name,
        action: { label: t('Deshacer importación'), onClick: () => { if (history.undo()) openView(before && store.get('views', before) ? before : null); } },
      });
      warn(warnings, t('Importación'), true);
    } catch (e) { toast.error(t('No se pudo importar «{name}»', { name: f.name }), { description: ioErrorText(e) }); }
  };
  const act = (fn: () => Promise<void> | void) => async () => { setOpen(false); try { await fn(); } catch (e) { toast.error(t('No se pudo exportar'), { description: ioErrorText(e) }); } };
  /** Exportación de la vista actual: si está vacía, avisa en lugar de descargar. */
  const vact = (fn: () => Promise<void> | void) => act(async () => { if (view && viewIsEmpty(view.id)) return nothing(t('La vista «{name}» está vacía.', { name: view.name })); await fn(); });
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
        <button role="menuitem" onClick={act(async () => { if (!store.list('views').length) return nothing(t('El espacio no tiene vistas.')); download(`${base}.html`, (await io()).renderStandaloneHtml(store, registry, { title: meta.name }), 'text/html'); })}>{t('HTML autocontenido (todas las vistas)')}</button>
        <button role="menuitem" onClick={act(async () => { if (!hasNotation('archimate:')) return nothing(t('El espacio no tiene elementos ArchiMate.')); const r = (await io()).exportArchimate(ws()); download(`${base}.archimate`, r.text, 'application/xml'); warn(r.warnings, 'Archi (.archimate)'); })}>Archi (.archimate)</button>
        <button role="menuitem" onClick={act(async () => { if (!hasNotation('archimate:')) return nothing(t('El espacio no tiene elementos ArchiMate.')); const r = (await io()).exportOpenExchange(ws()); download(`${base}.oef.xml`, r.text, 'application/xml'); warn(r.warnings, 'ArchiMate Open Exchange'); })}>ArchiMate Open Exchange</button>
        <button role="menuitem" onClick={act(async () => { if (!hasNotation('c4:')) return nothing(t('El espacio no tiene elementos C4.')); const r = (await io()).exportStructurizr(ws()); download(`${base}.structurizr.json`, r.text, 'application/json'); warn(r.warnings, 'Structurizr JSON (C4)'); })}>Structurizr JSON (C4)</button>
        <button role="menuitem" onClick={act(async () => { if (!store.list('views').some(v => v.notationId === 'bpmn')) return nothing(t('El espacio no tiene vistas BPMN.')); const r = await (await io()).exportBpmn(ws()); download(`${base}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>{t('BPMN 2.0 XML (todas las vistas BPMN)')}</button>
        {view && <>
          <div className="menu__title">{t('Exportar la vista «{name}»', { name: view.name })}</div>
          {/* Vista vacía: cada formato avisa en lugar de descargar un dibujo o un fichero vacío. */}
          <button role="menuitem" onClick={vact(async () => download(`${vbase}.svg`, (await io()).renderSvg(store, registry, view.id, { theme: 'dual' }), 'image/svg+xml'))}>{t('SVG (tema claro y oscuro)')}</button>
          <button role="menuitem" onClick={vact(async () => download(`${vbase}.png`, await (await io()).svgToPng((await io()).renderSvg(store, registry, view.id, { theme: effectiveTheme === 'dark' ? 'dark' : 'light' }), 2)))}>PNG (2×)</button>
          <button role="menuitem" onClick={vact(async () => { const r = (await io()).exportMermaid(ws(), view.id); download(`${vbase}.mmd`, r.text); warn(r.warnings, 'Mermaid'); })}>Mermaid</button>
          <button role="menuitem" onClick={vact(async () => { const r = (await io()).exportDrawio(ws(), view.id); download(`${vbase}.drawio`, r.text, 'application/xml'); warn(r.warnings, 'draw.io'); })}>draw.io</button>
          {view.notationId === 'bpmn' && <button role="menuitem" onClick={vact(async () => { const r = await (await io()).exportBpmn(ws(), view.id); download(`${vbase}.bpmn`, typeof r === 'string' ? r : (r as { text: string }).text, 'application/xml'); })}>BPMN 2.0 XML</button>}
          {view.notationId === 'statechart' && <button role="menuitem" onClick={vact(async () => { const r = (await io()).exportXState(ws(), view.id); download(`${vbase}.xstate.json`, r.text, 'application/json'); warn(r.warnings, 'XState JSON'); })}>XState JSON</button>}
        </>}
        <div className="menu__sep" />
        <HelpLink slug="importar-exportar" label={t('Formatos y equivalencias')} className="menu__help" />
      </div>}
    </span>
  );
}
