/**
 * Pantallas de los enlaces que llegan por correo:
 *   - `#/restablecer?token=rst_…`: elegir una contraseña nueva (un solo uso, una hora).
 *   - `#/verificar?token=vfy_…`: confirmar el correo de la cuenta (o el correo nuevo, si se está cambiando).
 * El token se quita de la dirección nada más leerlo (no queda en el historial ni en una captura de pantalla).
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@all-draw/editor';
import { useT } from '@all-draw/i18n';
import { api, ApiError, type User } from './api';
import { AuthDialog, formError } from './Auth';
import './accounts.css';

/** Lee `?token=` del hash una sola vez y lo borra de la barra de direcciones. */
function useHashToken(route: string): string {
  const [token] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('token') ?? '');
  useEffect(() => { try { history.replaceState(null, '', `${location.pathname}${location.search}#/${route}`); } catch { /* sin history */ } }, [route]);
  return token;
}

export function ResetPasswordScreen() {
  const t = useT();
  const token = useHashToken('restablecer');
  const [next, setNext] = useState(''); const [repeat, setRepeat] = useState('');
  const [revokeKeys, setRevokeKeys] = useState(true);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(!token);
  const [auth, setAuth] = useState<null | 'login' | 'forgot'>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (next.trim().length < 8) { setErr(t('La contraseña necesita al menos 8 caracteres que no sean espacios')); return; }
    if (next !== repeat) { setErr(t('Las contraseñas no coinciden')); return; }
    setBusy(true);
    try { const r = await api.resetPassword(token, next, revokeKeys); setDone(r.email); }
    catch (x) { if (x instanceof ApiError && x.code === 'token_invalid') setInvalid(true); else setErr(formError(x, t)); }
    finally { setBusy(false); }
  };
  return (
    <main className="state">
      <div className="state__card" data-testid="reset-screen">
        <span className="state__icon"><Icon name="key" size={22} /></span>
        {done ? <>
          <h1>{t('Contraseña cambiada')}</h1>
          <p role="status">{t('Ya puedes entrar con la contraseña nueva. Se han cerrado todas las sesiones abiertas de {email}.', { email: done })}</p>
          <div className="state__actions"><button type="button" className="btn btn--primary" onClick={() => setAuth('login')}>{t('Entrar')}</button><a className="btn" href="#/">{t('Ir al inicio')}</a></div>
        </> : invalid ? <>
          <h1>{t('Este enlace ya no sirve')}</h1>
          <p role="alert">{t('El enlace no es válido, ya se usó o ha caducado: pide otro')}</p>
          <div className="state__actions"><button type="button" className="btn btn--primary" onClick={() => setAuth('forgot')}>{t('Pedir otro enlace')}</button><a className="btn" href="#/">{t('Ir al inicio')}</a></div>
        </> : <>
          <h1>{t('Elige una contraseña nueva')}</h1>
          <p>{t('Al guardarla se cierran todas las sesiones abiertas de tu cuenta y sus espacios se desconectan.')}</p>
          <form onSubmit={submit} style={{ marginTop: 14 }}>
            <label className="field"><span>{t('Nueva contraseña')}</span><input ref={first} type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={next} onChange={e => setNext(e.target.value)} /></label>
            <label className="field"><span>{t('Repite la nueva contraseña')}</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={revokeKeys} onChange={e => setRevokeKeys(e.target.checked)} /> {t('Revocar también las claves API')}</label>
            <p className="err" role="alert" aria-live="assertive">{err}</p>
            <div className="state__actions"><button className="btn btn--primary" type="submit" disabled={busy || next.trim().length < 8}>{t('Guardar la contraseña')}</button></div>
          </form>
        </>}
      </div>
      {auth && <AuthDialog initialMode={auth} onClose={() => { setAuth(null); void api.sessionUser().catch(() => null).then(u => { if (u) location.hash = '#/'; }); }} />}
    </main>
  );
}

export function VerifyEmailScreen() {
  const t = useT();
  const token = useHashToken('verificar');
  const [state, setState] = useState<{ kind: 'busy' } | { kind: 'ok'; user: User; changed: boolean } | { kind: 'error'; text: string }>(() => (token ? { kind: 'busy' } : { kind: 'error', text: '' }));
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // un solo intento (en desarrollo React monta dos veces y el token es de un solo uso)
    api.verifyEmail(token).then(r => setState({ kind: 'ok', user: r.user, changed: r.changed }), (x: unknown) => setState({ kind: 'error', text: x instanceof ApiError && x.code === 'token_invalid' ? '' : formError(x, t) }));
  }, [token, t]);
  return (
    <main className="state">
      <div className="state__card" data-testid="verify-screen" aria-busy={state.kind === 'busy'}>
        <span className={`state__icon ${state.kind === 'error' ? 'state__icon--danger' : ''}`}><Icon name={state.kind === 'error' ? 'warning' : 'check'} size={22} /></span>
        {state.kind === 'busy' && <><h1>{t('Confirmando tu correo…')}</h1><p role="status">{t('Un momento.')}</p></>}
        {state.kind === 'ok' && <>
          <h1>{t('Correo confirmado')}</h1>
          <p role="status">{state.changed ? t('El correo de tu cuenta ahora es {email}.', { email: state.user.email }) : t('{email} queda verificado.', { email: state.user.email })}</p>
          <div className="state__actions"><a className="btn btn--primary" href="#/">{t('Ir a mis espacios')}</a><a className="btn" href="#/keys">{t('Cuenta')}</a></div>
        </>}
        {state.kind === 'error' && <>
          <h1>{t('Este enlace ya no sirve')}</h1>
          <p role="alert">{state.text || t('El enlace no es válido, ya se usó o ha caducado. Entra y pide otro desde Cuenta.')}</p>
          <div className="state__actions"><a className="btn btn--primary" href="#/keys">{t('Cuenta')}</a><a className="btn" href="#/">{t('Ir al inicio')}</a></div>
        </>}
      </div>
    </main>
  );
}
