/**
 * Piezas de la pantalla «Cuenta» (`Keys.tsx`) que dependen de las sesiones y del correo:
 *   - `SessionsList`: sesiones activas (navegador y sistema resumidos, IP truncada, último uso) con «Cerrar esta sesión».
 *   - `VerifyNotice`: el correo sin verificar (o el cambio pendiente) y «Reenviar el enlace».
 *   - `EmailPrefsSection`: «Recibir por correo» las menciones e idioma de los correos (sólo si el servidor tiene correo).
 */
import { useCallback, useEffect, useState } from 'react';
import { confirmDialog, toast } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';
import { api, type SessionInfo, type User } from './api';
import { formError } from './Auth';
import './accounts.css';

type T = ReturnType<typeof useT>;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

/** «Firefox en Linux», «Safari en iOS (móvil)», «curl (línea de órdenes)»… */
export function deviceLabel(d: SessionInfo['device'], t: T): string {
  const kind = d.type === 'mobile' ? t('móvil') : d.type === 'tablet' ? t('tableta') : d.type === 'cli' ? t('línea de órdenes') : '';
  const base = d.browser && d.os ? t('{browser} en {os}', { browser: d.browser, os: d.os }) : d.browser ?? d.os ?? t('Navegador desconocido');
  return kind ? `${base} (${kind})` : base;
}

export function SessionsList({ onCurrentClosed }: { onCurrentClosed: () => void }) {
  const t = useT();
  const [list, setList] = useState<SessionInfo[] | null>(null);
  const [err, setErr] = useState('');
  const refresh = useCallback(() => api.sessions().then(setList, x => { setList([]); setErr(formError(x, t)); }), [t]);
  useEffect(() => { void refresh(); }, [refresh]);
  const close = async (s: SessionInfo) => {
    if (!(await confirmDialog({
      title: s.current ? t('¿Cerrar la sesión de este navegador?') : t('¿Cerrar esta sesión?'),
      message: s.current ? t('Saldrás de tu cuenta aquí; los espacios abiertos en este navegador se desconectan.') : t('{device}: se cierra la sesión y sus espacios abiertos se desconectan al momento.', { device: deviceLabel(s.device, t) }),
      confirmLabel: t('Cerrar esta sesión'), danger: true,
    }))) return;
    setErr('');
    try {
      await api.closeSession(s.id);
      if (s.current) { onCurrentClosed(); return; }
      toast.success(t('Sesión cerrada'));
      await refresh();
    } catch (x) { setErr(formError(x, t)); }
  };
  return (
    <>
      <ul className="sessions" aria-label={t('Sesiones activas')} aria-busy={list === null} data-testid="sessions">
        {list === null && <li className="list-empty">{t('Cargando…')}</li>}
        {list?.map(s => <li key={s.id}>
          <div className="sessions__what">
            <b>{deviceLabel(s.device, t)}</b>{s.current && <span className="sessions__tag">{t('esta sesión')}</span>}
            <small>{[s.ip ? t('IP {ip}', { ip: s.ip }) : '', t('abierta {date}', { date: fmt(s.createdAt) }), s.lastUsedAt ? t('último uso {date}', { date: fmt(s.lastUsedAt) }) : ''].filter(Boolean).join(' · ')}</small>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" aria-label={t('Cerrar la sesión de {device}', { device: deviceLabel(s.device, t) })} onClick={() => void close(s)}>{t('Cerrar esta sesión')}</button>
        </li>)}
      </ul>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
    </>
  );
}

export function VerifyNotice({ me, pendingEmail, emailEnabled }: { me: User; pendingEmail: string | null; emailEnabled: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  if (!emailEnabled || (me.emailVerified && !pendingEmail)) return null;
  const resend = async () => {
    setBusy(true); setErr(''); setMsg('');
    try { const r = await api.resendVerification(); setMsg(r.alreadyVerified ? t('Tu correo ya estaba verificado.') : t('Te hemos enviado otro enlace a {email}.', { email: me.email })); }
    catch (x) { setErr(formError(x, t)); }
    finally { setBusy(false); }
  };
  return (
    <div className="notice" role="status" data-testid="verify-notice">
      <div>
        {pendingEmail
          ? <p>{t('Para cambiar el correo a {email}, abre el enlace que te hemos enviado ahí (caduca en 24 horas). Hasta entonces sigues entrando con {current}.', { email: pendingEmail, current: me.email })}</p>
          : <><p>{t('Tu correo {email} está sin verificar. Abre el enlace que te enviamos al crear la cuenta.', { email: me.email })}</p>
            <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void resend()}>{t('Reenviar el enlace')}</button></>}
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}

export function EmailPrefsSection({ me, onChange }: { me: User; onChange: (u: User) => void }) {
  const t = useT();
  const [err, setErr] = useState('');
  const save = async (patch: { notifyEmail?: boolean; locale?: 'es' | 'en' }) => {
    setErr('');
    try { const r = await api.updateAccount(patch); onChange(r.user); toast.success(t('Preferencias guardadas')); }
    catch (x) { setErr(formError(x, t)); }
  };
  return (
    <section aria-labelledby="mailprefs-title">
      <h2 id="mailprefs-title">{t('Correo y notificaciones')}</h2>
      <p className="lead">{t('Las notificaciones salen en la campana de la cabecera. Si lo activas, las menciones en comentarios también te llegan por correo al momento.')}</p>
      <label className="check"><input type="checkbox" checked={me.notifyEmail !== false} onChange={e => void save({ notifyEmail: e.target.checked })} /> {t('Recibir por correo cuando me mencionen')}</label>
      <div className="row" style={{ alignItems: 'center', gap: 8 }}>
        <label htmlFor="mail-lang">{t('Idioma de los correos')}</label>
        <select id="mail-lang" className="input" style={{ width: 'auto' }} value={me.locale ?? 'es'} onChange={e => void save({ locale: e.target.value as 'es' | 'en' })}>
          <option value="es">Español</option><option value="en">English</option>
        </select>
      </div>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
    </section>
  );
}
