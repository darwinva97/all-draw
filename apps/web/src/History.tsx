import { useEffect, useState } from 'react';
import { api, type Role, type SnapshotInfo } from './api';
import { useDialog } from './Auth';
import { HelpLink, Icon, confirmDialog, toast } from '@all-draw/editor';
import { reportError } from './notify';
import { useT } from '@all-draw/i18n';

const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

/** Diálogo "Historial": instantáneas del espacio en el servidor (crear, restaurar, descargar, borrar). */
export function HistoryDialog({ id, role, onClose }: { id: string; role: Role; onClose: () => void }) {
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
  const restore = async (s: SnapshotInfo) => {
    if (!(await confirmDialog({ title: t('¿Restaurar el estado del {date}?', { date: new Date(s.createdAt).toLocaleString() }), message: t('El estado actual se guarda antes como instantánea automática, así que puedes volver atrás.'), confirmLabel: t('Restaurar') }))) return;
    void run(async () => { await api.restoreSnapshot(id, s.id); toast.success(t('Instantánea restaurada')); await refresh(); }, t('No se pudo restaurar la instantánea'));
  };
  const download = (s: SnapshotInfo) => void run(async () => {
    const ws = await api.snapshot(id, s.id);
    const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${id}-${s.createdAt.replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(a.href);
  }, t('No se pudo descargar la instantánea'));
  const remove = async (s: SnapshotInfo) => {
    if (!(await confirmDialog({ title: t('¿Borrar esta instantánea?'), message: describe(s), danger: true }))) return;
    void run(async () => { await api.deleteSnapshot(id, s.id); toast.success(t('Instantánea borrada')); await refresh(); }, t('No se pudo borrar la instantánea'));
  };
  const describe = (s: SnapshotInfo) => `${s.label ?? t('Automática')} · ${new Date(s.createdAt).toLocaleString()}`;
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
              <strong>{s.label ?? <em>{t('Automática')}</em>}</strong> <small>{new Date(s.createdAt).toLocaleString()}</small><br />
              <small>{s.author ? s.author.name : t('sistema')} · {fmtSize(s.size)}</small>
            </span>
            {canEdit && <button className="btn" disabled={busy} aria-label={t('Restaurar {what}', { what: describe(s) })} onClick={() => void restore(s)}><Icon name="replay" size={14} />{t('Restaurar')}</button>}
            <button className="btn btn--ghost" disabled={busy} aria-label={t('Descargar JSON de {what}', { what: describe(s) })} onClick={() => download(s)}><Icon name="download" size={14} />{t('Descargar JSON')}</button>
            {role === 'owner' && <button className="btn btn--ghost" disabled={busy} aria-label={t('Borrar {what}', { what: describe(s) })} onClick={() => void remove(s)}>{t('Borrar')}</button>}
          </li>)}
        </ul>
        <div className="modal__foot"><HelpLink slug="historial" /><span className="spacer" /><button className="btn" onClick={onClose}>{t('Cerrar')}</button></div>
      </div>
    </div>
  );
}
