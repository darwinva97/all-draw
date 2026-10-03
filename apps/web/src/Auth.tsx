import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type RegistrationMode } from './api';
import { useT } from '@all-draw/i18n';
import { inLayer } from '@all-draw/editor';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento común de los diálogos modales: foco inicial en el primer control, trampa de foco
 * (Tab/Shift+Tab no salen de la caja), cierre con Escape y devolución del foco al abrirlo.
 */
export function useDialog(onClose: () => void) {
  const box = useRef<HTMLFormElement & HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  // Quién abrió el diálogo, leído en el primer render: antes de que un `autoFocus` de dentro mueva el foco (fallo 21).
  const openerRef = useRef<HTMLElement | null | undefined>(undefined);
  if (openerRef.current === undefined) openerRef.current = typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null;
  useEffect(() => {
    const el = box.current; if (!el) return;
    const opener = openerRef.current;
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!el.contains(document.activeElement)) (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (inLayer(e)) return; // un diálogo propio (confirmar, avisos) encima manda
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); if (opener?.isConnected) opener.focus(); };
  }, []);
  return box;
}

/** Nombre visible de un campo del servidor (para «Revisa: correo, nombre»). */
const FIELD_LABEL: Record<string, string> = { email: 'Correo', name: 'Nombre', password: 'Contraseña', current: 'Contraseña actual', inviteCode: 'Código de invitación' };
/**
 * Texto de un error de los formularios de cuenta: si el servidor rechazó campos concretos (`code: 'validation'`), cuáles;
 * si no, su mensaje.
 */
export function formError(x: unknown, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (x instanceof ApiError && x.code === 'validation' && x.fields?.length) return t('Revisa: {fields}', { fields: x.fields.map(f => FIELD_LABEL[f] ? t(FIELD_LABEL[f]) : f).join(', ') });
  return (x as Error).message;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function AuthDialog({ onClose, initialMode = 'login' }: { onClose: () => void; initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [invite, setInvite] = useState('');
  const [website, setWebsite] = useState(''); // trampa para bots: una persona no lo ve ni lo rellena
  const [registration, setRegistration] = useState<RegistrationMode>('open');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const box = useDialog(onClose);
  const t = useT();
  useEffect(() => { api.authConfig().then(setRegistration); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    // Lo que el servidor rechazaría, dicho antes y en palabras (fallo 29)
    if (!EMAIL_RE.test(email.trim())) { setErr(t('Escribe un correo completo, por ejemplo nombre@dominio.com')); return; }
    if (mode === 'register' && !name.trim()) { setErr(t('Escribe tu nombre')); return; }
    if (mode === 'register' && password.trim().length < 8) { setErr(t('La contraseña necesita al menos 8 caracteres que no sean espacios')); return; }
    setBusy(true);
    try { if (mode === 'login') await api.login(email.trim(), password); else await api.register(email.trim(), name.trim(), password, registration === 'invite' ? invite : undefined, website || undefined); onClose(); }
    catch (x) { setErr(formError(x, t)); setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2 id="auth-title">{mode === 'login' ? t('Entrar') : t('Crear cuenta')}</h2>
        <p className="modal__lead">{mode === 'login' ? t('Tus espacios del servidor te esperan en cualquier navegador.') : t('Con una cuenta guardas los espacios en el servidor y los compartes con tu equipo.')}</p>
        <label className="field"><span>{t('Correo')}</span><input type="email" name="email" autoComplete="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} autoFocus /></label>
        {mode === 'register' && <label className="field"><span>{t('Nombre')}</span><input name="name" autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>}
        <label className="field"><span>{t('Contraseña')}</span><input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {mode === 'register' && registration === 'invite' && <label className="field"><span>{t('Código de invitación')}</span><input name="invite" autoComplete="off" required maxLength={200} value={invite} onChange={e => setInvite(e.target.value)} /></label>}
        {mode === 'register' && <div className="hp-field" aria-hidden="true"><label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label></div>}
        {mode === 'register' && registration === 'closed' && <p className="err" role="status">{t('El registro está cerrado en este servidor.')}</p>}
        <div className="err" role="alert" aria-live="assertive">{err}</div>
        <div className="modal__foot">
          <button className="btn btn--primary" disabled={busy || (mode === 'register' && registration === 'closed')} type="submit">{mode === 'login' ? t('Entrar') : t('Registrarme')}</button>
          <button className="btn btn--ghost" type="button" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>{mode === 'login' ? t('No tengo cuenta') : t('Ya tengo cuenta')}</button>
          <span className="spacer" /><button className="btn btn--ghost" type="button" onClick={onClose}>{t('Cerrar')}</button>
        </div>
      </form>
    </div>
  );
}
