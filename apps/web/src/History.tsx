import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Role, type SnapshotInfo } from './api';
import { useDialog } from './Auth';
import { Canvas, EditorProvider, HelpLink, Icon, confirmDialog, toast, useCollection, useEditor } from '@all-draw/editor';
import { History as CommandHistory, MemoryStore, parseWorkspace, type Store, type Workspace } from '@all-draw/core';
import { diffWorkspaces, isEmptyDiff, publishNotice, type DiffGroup, type DiffItem, type WorkspaceDiff } from '@all-draw/sync';
import { reportError } from './notify';
import { createRegistry } from './registry';
import { versionDate } from './Collab';
import { useLang, useT } from '@all-draw/i18n';

export { CollabBridge } from './Collab';

const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

/**
 * Diálogo "Historial": instantáneas del espacio en el servidor (ver, comparar, crear, restaurar, descargar, borrar).
 * Se abre desde la barra del editor, así que está dentro de su `EditorProvider`: de ahí salen el estado actual (para
 * comparar) y la presencia (para avisar a los demás al restaurar). «Ver» sustituye la lista por la vista previa.
 */
export function HistoryDialog({ id, role, onClose }: { id: string; role: Role; onClose: () => void }) {
  const t = useT();
  const { store, presence } = useEditor();
  const [preview, setPreview] = useState<{ snap: SnapshotInfo; ws: Workspace } | null>(null);
  const canEdit = role !== 'viewer';
  /** Restaura y avisa a los demás conectados (por awareness: «X ha restaurado la versión de …»). `true` si se restauró. */
  const restore = async (s: SnapshotInfo): Promise<boolean> => {
    if (!(await confirmDialog({ title: t('¿Restaurar el estado del {date}?', { date: versionDate(s.createdAt) }), message: t('El estado actual se guarda antes como instantánea automática, así que puedes volver atrás.'), confirmLabel: t('Restaurar') }))) return false;
    try {
      await api.restoreSnapshot(id, s.id);
      if (presence) publishNotice(presence.awareness, { kind: 'restore', at: s.createdAt, by: presence.me.name });
      toast.success(t('Instantánea restaurada'));
      return true;
    } catch (e) { reportError(e, { title: t('No se pudo restaurar la instantánea') }); return false; }
  };
  if (preview) {
    return (
      <div className="modal" onClick={() => setPreview(null)}>
        <SnapshotPreview snap={preview.snap} ws={preview.ws} current={store} canEdit={canEdit}
          onRestore={async () => { if (await restore(preview.snap)) setPreview(null); }} onClose={() => setPreview(null)} />
      </div>
    );
  }
  return <HistoryList id={id} role={role} onClose={onClose} onView={(snap, ws) => setPreview({ snap, ws })} restore={restore} />;
}

/** `null` = automática (cada 30 min de actividad o antes de restaurar); `""` = guardada a mano sin etiqueta. */
function kindOf(t: ReturnType<typeof useT>, s: SnapshotInfo): string { return s.label === null ? t('Automática') : s.label === '' ? t('Manual, sin etiqueta') : s.label; }

function HistoryList({ id, role, onClose, onView, restore }: { id: string; role: Role; onClose: () => void; onView: (s: SnapshotInfo, ws: Workspace) => void; restore: (s: SnapshotInfo) => Promise<boolean> }) {
  const t = useT();
  const box = useDialog(onClose);
  const [items, setItems] = useState<SnapshotInfo[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = role !== 'viewer';
  const refresh = (): Promise<void> => api.snapshots(id).then(setItems).catch(e => { setItems([]); reportError(e, { title: t('No se pudo cargar el historial'), retry: () => void refresh() }); });
  useEffect(() => { refresh(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (f: () => Promise<void>, title: string) => { setBusy(true); try { await f(); } catch (e) { reportError(e, { title }); } finally { setBusy(false); } };
  const create = (e: React.FormEvent) => { e.preventDefault(); void run(async () => { await api.createSnapshot(id, label.trim() || undefined); setLabel(''); toast.success(t('Instantánea creada')); await refresh(); }, t('No se pudo crear la instantánea')); };
  const view = (s: SnapshotInfo) => void run(async () => { onView(s, parseWorkspace(await api.snapshot(id, s.id))); }, t('No se pudo abrir la instantánea'));
  const download = (s: SnapshotInfo) => void run(async () => {
    const ws = await api.snapshot(id, s.id);
    const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${id}-${s.createdAt.replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(a.href);
  }, t('No se pudo descargar la instantánea'));
  const remove = async (s: SnapshotInfo) => {
    if (!(await confirmDialog({ title: t('¿Borrar esta instantánea?'), message: describe(s), danger: true }))) return;
    void run(async () => { await api.deleteSnapshot(id, s.id); toast.success(t('Instantánea borrada')); await refresh(); }, t('No se pudo borrar la instantánea'));
  };
  const describe = (s: SnapshotInfo) => `${kindOf(t, s)} · ${versionDate(s.createdAt)}`;
  return (
    <div className="modal" onClick={onClose}>
      <div ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="history-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h2 id="history-title">{t('Historial')}</h2>
        <p className="modal__lead">{t('El servidor guarda una instantánea automática cada 30 minutos de actividad y antes de cada restauración; las etiquetadas no se podan.')}</p>
        {canEdit && <form className="row" onSubmit={create}>
          <label htmlFor="snap-label" className="visually-hidden">{t('Etiqueta de la instantánea')}</label>
          <input id="snap-label" className="input" style={{ flex: 1, minWidth: 180 }} placeholder={t('Etiqueta (opcional)')} maxLength={120} value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn btn--primary" type="submit" disabled={busy}>{t('Crear instantánea')}</button>
        </form>}
        <ul className="share__list" aria-label={t('Instantáneas')} aria-busy={items === null}>
          {items === null && <li className="list-empty">{t('Cargando…')}</li>}
          {items?.length === 0 && <li className="list-empty">{t('Todavía no hay instantáneas. Crea una antes de un cambio grande para poder volver.')}</li>}
          {items?.map(s => <li key={s.id} className="row">
            <span className="share__what" style={{ display: 'block' }}>
              <strong>{s.label ? s.label : <em>{kindOf(t, s)}</em>}</strong> <small>{versionDate(s.createdAt)}</small><br />
              <small>{s.author ? s.author.name : t('sistema')} · {fmtSize(s.size)}</small>
            </span>
            <button className="btn" disabled={busy} aria-label={t('Ver {what}', { what: describe(s) })} onClick={() => view(s)}><Icon name="eye" size={14} />{t('Ver')}</button>
            {canEdit && <button className="btn" disabled={busy} aria-label={t('Restaurar {what}', { what: describe(s) })} onClick={() => void run(async () => { if (await restore(s)) await refresh(); }, t('No se pudo restaurar la instantánea'))}><Icon name="replay" size={14} />{t('Restaurar')}</button>}
            <button className="btn btn--ghost" disabled={busy} aria-label={t('Descargar JSON de {what}', { what: describe(s) })} onClick={() => download(s)}><Icon name="download" size={14} />{t('Descargar JSON')}</button>
            {role === 'owner' && <button className="btn btn--ghost" disabled={busy} aria-label={t('Borrar {what}', { what: describe(s) })} onClick={() => void remove(s)}>{t('Borrar')}</button>}
          </li>)}
        </ul>
        <div className="modal__foot"><HelpLink slug="historial" /><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cerrar')}</button></div>
      </div>
    </div>
  );
}

/**
 * Vista previa de solo lectura de una instantánea: su propio `EditorProvider` sobre un `MemoryStore` (con un registro
 * de notaciones aparte, para que sus librerías no se mezclen con las del espacio abierto), un selector de vistas y el
 * lienzo. «Comparar con la actual» resume qué ha cambiado desde entonces.
 */
function SnapshotPreview({ snap, ws, current, canEdit, onRestore, onClose }: {
  snap: SnapshotInfo; ws: Workspace; current: Store; canEdit: boolean; onRestore: () => Promise<void>; onClose: () => void;
}) {
  const t = useT();
  const title = kindOf(t, snap);
  const [lang] = useLang();
  const box = useDialog(onClose);
  const store = useMemo(() => new MemoryStore(structuredClone(ws)), [ws]);
  const history = useMemo(() => new CommandHistory(store), [store]);
  const registry = useMemo(() => createRegistry(lang), [lang]);
  const [diff, setDiff] = useState<WorkspaceDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const firstView = ws.meta.currentViewId && ws.views[ws.meta.currentViewId] ? ws.meta.currentViewId : Object.values(ws.views).sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null;
  return (
    <div ref={box} className="modal__box snap-preview" role="dialog" aria-modal="true" aria-labelledby="snap-preview-title" tabIndex={-1} onClick={e => e.stopPropagation()} data-testid="snapshot-preview"
      style={{ width: 'min(1200px, 96vw)', height: 'min(860px, 90dvh)', maxHeight: 'none', display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      <EditorProvider store={store} history={history} registry={registry} initialViewId={firstView} readOnly>
        <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h2 id="snap-preview-title" style={{ margin: 0 }}>{t('Versión del {date}', { date: versionDate(snap.createdAt) })}</h2>
            <small className="modal__lead" style={{ margin: 0 }}>{title}{snap.author ? ` · ${snap.author.name}` : ''} · {t('Solo lectura')}</small>
          </div>
          <PreviewViewPicker />
          <button className="btn" aria-pressed={!!diff} onClick={() => setDiff(d => (d ? null : diffWorkspaces(ws, current.snapshot())))}><Icon name="swap" size={14} />{t('Comparar con la actual')}</button>
          {canEdit && <button className="btn btn--primary" disabled={busy} onClick={() => { setBusy(true); void onRestore().finally(() => setBusy(false)); }}><Icon name="replay" size={14} />{t('Restaurar esta versión')}</button>}
          <button className="btn btn--ghost" onClick={onClose}>{t('Cerrar')}</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
          <div className="snap-preview__canvas" style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column', border: '1px solid var(--ad-border, var(--line))', borderRadius: 10, overflow: 'hidden' }}>
            {firstView ? <Canvas /> : <p className="list-empty" style={{ padding: 16 }}>{t('Esta versión no tiene vistas.')}</p>}
          </div>
          {diff && <DiffPanel diff={diff} />}
        </div>
      </EditorProvider>
    </div>
  );
}

/** Selector de vista de la vista previa (dentro de su propio `EditorProvider`). */
function PreviewViewPicker() {
  const t = useT();
  const { viewId, openView } = useEditor();
  const views = useCollection('views');
  const sorted = useMemo(() => [...views].sort((a, b) => a.name.localeCompare(b.name)), [views]);
  if (sorted.length < 2) return null;
  return (
    <label className="row" style={{ gap: 6, alignItems: 'center' }}>
      <span className="visually-hidden">{t('Vista')}</span>
      <select className="input" style={{ maxWidth: 240 }} value={viewId ?? ''} aria-label={t('Vista')} onChange={e => openView(e.target.value)}>
        {sorted.map(v => <option key={v.id} value={v.id}>{v.name || v.id}</option>)}
      </select>
    </label>
  );
}

const MAX_ITEMS = 40;

/** Resumen «Comparar con la actual»: lo que ha cambiado desde la versión hasta ahora. */
function DiffPanel({ diff }: { diff: WorkspaceDiff }) {
  const t = useT();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { ref.current?.focus(); }, [diff]);
  const keyName: Record<string, string> = {
    name: t('nombre'), doc: t('documentación'), fields: t('campos'), props: t('propiedades'), features: t('rasgos'), tags: t('etiquetas'),
    typeId: t('tipo'), ports: t('pines'), profiles: t('perfiles'), from: t('origen'), to: t('destino'), mappings: t('correspondencias'),
    style: t('estilo'), content: t('contenido'), kind: t('tipo de vista'), notationId: t('notación'), grid: t('rejilla'), rootElementId: t('elemento raíz'),
  };
  const group = (title: string, g: DiffGroup) => {
    const total = g.added.length + g.removed.length + g.changed.length;
    if (!total) return null;
    const list = (label: string, items: DiffItem[], cls: string) => items.length > 0 && <>
      <div className={`snap-diff__label ${cls}`}>{label} ({items.length})</div>
      <ul className="snap-diff__list">
        {items.slice(0, MAX_ITEMS).map(i => <li key={i.id}>{i.name}{i.was !== undefined && <small> {t('(antes «{name}»)', { name: i.was })}</small>}{i.keys?.length ? <small> · {i.keys.map(k => keyName[k] ?? k).join(', ')}</small> : null}</li>)}
        {items.length > MAX_ITEMS && <li><small>{t('… y {n} más', { n: items.length - MAX_ITEMS })}</small></li>}
      </ul>
    </>;
    return (
      <section>
        <h3 style={{ fontSize: 14, margin: '10px 0 4px' }}>{title}</h3>
        {list(t('Añadidos desde entonces'), g.added, 'is-added')}
        {list(t('Borrados desde entonces'), g.removed, 'is-removed')}
        {list(t('Cambiados desde entonces'), g.changed, 'is-changed')}
      </section>
    );
  };
  return (
    <aside ref={ref} tabIndex={-1} aria-label={t('Diferencias con el estado actual')} data-testid="snapshot-diff"
      style={{ width: 'min(340px, 40%)', overflow: 'auto', borderLeft: '1px solid var(--ad-border, var(--line))', paddingLeft: 12, fontSize: 13 }}>
      <p className="modal__lead" style={{ marginTop: 0 }}>{t('Qué ha cambiado desde esta versión hasta ahora. Restaurarla deshace estos cambios.')}</p>
      {isEmptyDiff(diff) && <p>{t('No hay diferencias: el espacio está igual que en esta versión.')}</p>}
      {group(t('Elementos'), diff.elements)}
      {group(t('Relaciones'), diff.relations)}
      {group(t('Vistas'), diff.views)}
      {diff.meta && <p><small>{t('También cambió el nombre o la descripción del espacio.')}</small></p>}
      {diff.other > 0 && <p><small>{t('Y {n} cambios más en librerías, personas, reglas o comentarios.', { n: diff.other })}</small></p>}
    </aside>
  );
}
