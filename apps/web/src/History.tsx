import { useEffect, useState } from 'react';
import { api, type Role, type SnapshotInfo } from './api';
import { useDialog } from './Auth';
import { useT } from '@all-draw/i18n';

const fmtSize = (n: number) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

/** Diálogo "Historial": instantáneas del espacio en el servidor (crear, restaurar, descargar, borrar). */
export function HistoryDialog({ id, role, onClose }: { id: string; role: Role; onClose: () => void }) {
  const t = useT();
  const box = useDialog(onClose);
  const [items, setItems] = useState<SnapshotInfo[] | null>(null);
  const [label, setLabel] = useState('');
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const canEdit = role !== 'viewer';
  const refresh = () => api.snapshots(id).then(setItems).catch(e => { setItems([]); setMsg((e as Error).message); });
  useEffect(() => { refresh(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (f: () => Promise<void>) => { setBusy(true); setMsg(''); try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } };
  const create = (e: React.FormEvent) => { e.preventDefault(); run(async () => { await api.createSnapshot(id, label.trim() || undefined); setLabel(''); setMsg(t('Instantánea creada')); await refresh(); }); };
  const restore = (s: SnapshotInfo) => {
    if (!confirm(t('¿Restaurar el espacio al estado del {date}? El estado actual se guarda antes como instantánea automática.', { date: new Date(s.createdAt).toLocaleString() }))) return;
    run(async () => { await api.restoreSnapshot(id, s.id); setMsg(t('Instantánea restaurada')); await refresh(); });
  };
  const download = (s: SnapshotInfo) => run(async () => {
    const ws = await api.snapshot(id, s.id);
    const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${id}-${s.createdAt.replace(/[:.]/g, '-')}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  const remove = (s: SnapshotInfo) => { if (!confirm(t('¿Borrar esta instantánea?'))) return; run(async () => { await api.deleteSnapshot(id, s.id); await refresh(); }); };
  const describe = (s: SnapshotInfo) => `${s.label ?? t('Automática')} · ${new Date(s.createdAt).toLocaleString()}`;
  return (
    <div className="modal" onClick={onClose}>
      <div ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="history-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <h2 id="history-title">{t('Historial')}</h2>
        <p className="app-status" style={{ padding: 0 }}>{t('El servidor guarda una instantánea automática cada 30 minutos de actividad y antes de cada restauración; las etiquetadas no se podan.')}</p>
        {canEdit && <form className="row" onSubmit={create}>
          <label htmlFor="snap-label" className="visually-hidden">{t('Etiqueta de la instantánea')}</label>
          <input id="snap-label" className="field" placeholder={t('Etiqueta (opcional)')} maxLength={120} value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn btn--primary" type="submit" disabled={busy}>{t('Crear instantánea')}</button>
        </form>}
        <ul className="share__list" aria-label={t('Instantáneas')} aria-busy={items === null}>
          {items === null && <li className="app-status">{t('Cargando…')}</li>}
          {items?.length === 0 && <li className="app-status">{t('Todavía no hay instantáneas.')}</li>}
          {items?.map(s => <li key={s.id} className="row">
            <span style={{ flex: 1 }}>
              <strong>{s.label ?? <em>{t('Automática')}</em>}</strong> <small>{new Date(s.createdAt).toLocaleString()}</small><br />
              <small>{s.author ? s.author.name : t('sistema')} · {fmtSize(s.size)}</small>
            </span>
            {canEdit && <button className="btn" disabled={busy} aria-label={t('Restaurar {what}', { what: describe(s) })} onClick={() => restore(s)}>{t('Restaurar')}</button>}
            <button className="btn btn--ghost" disabled={busy} aria-label={t('Descargar JSON de {what}', { what: describe(s) })} onClick={() => download(s)}>{t('Descargar JSON')}</button>
            {role === 'owner' && <button className="btn btn--ghost" disabled={busy} aria-label={t('Borrar {what}', { what: describe(s) })} onClick={() => remove(s)}>{t('Borrar')}</button>}
          </li>)}
        </ul>
        <p className="app-status" role="status" aria-live="polite" style={{ padding: 0, minHeight: '1.2em' }}>{msg}</p>
        <div className="row" style={{ marginTop: 12 }}><span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>{t('Cerrar')}</button></div>
      </div>
    </div>
  );
}
