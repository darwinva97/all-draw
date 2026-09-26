import { useEffect, useRef, useState } from 'react';
import { api } from './api';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento común de los diálogos modales: foco inicial en el primer control, trampa de foco
 * (Tab/Shift+Tab no salen de la caja), cierre con Escape y devolución del foco al abrirlo.
 */
export function useDialog(onClose: () => void) {
  const box = useRef<HTMLFormElement & HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const el = box.current; if (!el) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!el.contains(document.activeElement)) (focusables()[0] ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); opener?.focus?.(); };
  }, []);
  return box;
}

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const box = useDialog(onClose);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { if (mode === 'login') await api.login(email, password); else await api.register(email, name, password); onClose(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form ref={box} className="modal__box" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2 id="auth-title">{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h2>
        <label className="field"><span>Correo</span><input type="email" name="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus /></label>
        {mode === 'register' && <label className="field"><span>Nombre</span><input name="name" autoComplete="name" required value={name} onChange={e => setName(e.target.value)} /></label>}
        <label className="field"><span>Contraseña</span><input type="password" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <div className="err" role="alert" aria-live="assertive">{err}</div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn--primary" disabled={busy} type="submit">{mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
          <button className="btn btn--ghost" type="button" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}</button>
          <span style={{ flex: 1 }} /><button className="btn btn--ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </form>
    </div>
  );
}
