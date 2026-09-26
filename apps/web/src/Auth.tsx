import { useState } from 'react';
import { api } from './api';

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { if (mode === 'login') await api.login(email, password); else await api.register(email, name, password); onClose(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form className="modal__box" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</h2>
        <label className="field"><span>Correo</span><input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoFocus /></label>
        {mode === 'register' && <label className="field"><span>Nombre</span><input required value={name} onChange={e => setName(e.target.value)} /></label>}
        <label className="field"><span>Contraseña</span><input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn--primary" disabled={busy} type="submit">{mode === 'login' ? 'Entrar' : 'Registrarme'}</button>
          <button className="btn btn--ghost" type="button" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}</button>
          <span style={{ flex: 1 }} /><button className="btn btn--ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </form>
    </div>
  );
}
