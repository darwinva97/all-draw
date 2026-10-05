/**
 * Campana del centro de notificaciones (cabecera de la app y barra del editor): contador de las no leídas y lista
 * con enlace a lo notificado (menciones en comentarios, espacios compartidos contigo, cambios de rol, versiones
 * restauradas en tus espacios). Sólo aparece con sesión; se actualiza cada minuto con la pestaña visible.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getLang, useT } from '@all-draw/i18n';
import { api, ApiError, type NotificationInfo } from './api';
import './accounts.css';

const POLL_MS = 60_000;
type T = ReturnType<typeof useT>;

function relative(iso: string, now = Date.now()): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return '';
  const s = Math.round((d - now) / 1000), abs = Math.abs(s);
  try {
    const rtf = new Intl.RelativeTimeFormat(getLang(), { numeric: 'auto', style: 'short' });
    if (abs < 45) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  } catch { /* sin Intl */ }
  return new Date(d).toLocaleDateString();
}
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const roleText = (t: T, r: string) => (r === 'owner' ? t('propietario') : r === 'editor' ? t('puede editar') : r === 'viewer' ? t('solo lectura') : r);

/** Frase de una notificación (y un detalle opcional) en el idioma de la interfaz. */
export function describeNotification(n: NotificationInfo, t: T): { text: string; detail: string } {
  const p = n.payload;
  const ws = str(p.workspaceName) || t('Sin nombre'), actor = str(p.actorName);
  switch (n.kind) {
    case 'mention': return { text: actor ? t('{actor} te ha mencionado en «{ws}»', { actor, ws }) : t('Te han mencionado en «{ws}»', { ws }), detail: str(p.excerpt) };
    case 'shared': return { text: actor ? t('{actor} ha compartido contigo «{ws}»', { actor, ws }) : t('Te han compartido «{ws}»', { ws }), detail: roleText(t, str(p.role)) };
    case 'role': return str(p.role) === 'owner'
      ? { text: t('Ahora eres propietario de «{ws}»', { ws }), detail: actor ? t('Te lo ha pasado {actor}', { actor }) : '' }
      : { text: t('Tu rol en «{ws}» ha cambiado', { ws }), detail: t('Ahora: {role}', { role: roleText(t, str(p.role)) }) };
    case 'restored': return { text: actor ? t('{actor} ha restaurado una versión de «{ws}»', { actor, ws }) : t('Alguien con un enlace ha restaurado una versión de «{ws}»', { ws }), detail: str(p.snapshotLabel) };
    default: return { text: ws, detail: '' };
  }
}

function BellIcon() {
  return (
    <svg className="ad-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/** `null` = sin sesión o sin servidor: no se pinta nada. */
export function NotificationBell({ className = '' }: { className?: string }) {
  const t = useT();
  const [data, setData] = useState<{ list: NotificationInfo[]; unread: number } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const stopped = useRef(false);
  const load = useCallback(() => {
    if (stopped.current) return;
    api.notifications(30).then(r => { if (alive.current) setData({ list: r.notifications, unread: r.unread }); }, (e: unknown) => {
      // Sin sesión (o con una API key / enlace): fuera la campana y no se vuelve a preguntar hasta recargar.
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.status === 404)) { stopped.current = true; if (alive.current) setData(null); }
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    load();
    const tick = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive.current = false; clearInterval(tick); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    load();
    box.current?.querySelector<HTMLElement>('.bell__panel a, .bell__panel button')?.focus();
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open, load]);
  if (!data) return null;
  const markRead = (ids?: string[]) => {
    const now = new Date().toISOString();
    setData(d => d && { list: d.list.map(n => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)), unread: ids ? Math.max(0, d.unread - d.list.filter(n => ids.includes(n.id) && !n.readAt).length) : 0 });
    api.markNotificationsRead(ids).then(r => setData(d => d && { ...d, unread: r.unread }), () => { /* se reintenta al recargar */ });
  };
  const label = data.unread ? t('Notificaciones ({n} sin leer)', { n: data.unread }) : t('Notificaciones');
  return (
    <div className={`bell ${className}`} ref={box}>
      <button ref={trigger} type="button" className="btn btn--ghost btn--icon bell__btn" aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(o => !o)} data-testid="bell">
        <BellIcon />{data.unread > 0 && <span className="bell__count" aria-hidden="true">{data.unread > 99 ? '99+' : data.unread}</span>}
      </button>
      {open && <div className="bell__panel" role="dialog" aria-label={t('Notificaciones')}>
        <div className="bell__head">
          <h2>{t('Notificaciones')}</h2>
          {data.unread > 0 && <button type="button" className="btn btn--ghost btn--sm" onClick={() => markRead()}>{t('Marcar todo como leído')}</button>}
        </div>
        {data.list.length === 0
          ? <p className="bell__empty">{t('No tienes notificaciones. Aquí verás cuándo te mencionan, te comparten un espacio o cambian tu rol.')}</p>
          : <ul className="bell__list">{data.list.map(n => {
            const { text, detail } = describeNotification(n, t);
            const body = <><span className="bell__dot" aria-hidden="true" /><span><span className="bell__text">{text}</span><span className="bell__meta">{detail ? `${detail} · ` : ''}{relative(n.createdAt)}{n.readAt ? '' : ` · ${t('sin leer')}`}</span></span></>;
            return <li key={n.id}>{n.href
              ? <a className={`bell__item ${n.readAt ? '' : 'is-unread'}`} href={n.href} onClick={() => { if (!n.readAt) markRead([n.id]); setOpen(false); }}>{body}</a>
              : <button type="button" className={`bell__item ${n.readAt ? '' : 'is-unread'}`} onClick={() => { if (!n.readAt) markRead([n.id]); }}>{body}</button>}</li>;
          })}</ul>}
      </div>}
    </div>
  );
}
