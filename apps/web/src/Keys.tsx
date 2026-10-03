import { useEffect, useRef, useState } from 'react';
import { api, type AdminUser, type ApiKey, type Quotas, type User } from './api';
import { useT } from '@all-draw/i18n';
import { Icon, confirmDialog, toast } from '@all-draw/editor';
import { AppFooter, AppHeader, UserMenu } from './Chrome';
import { formError } from './Auth';
import './pwa';

/** Pantalla "Cuenta" (`#/keys`): claves API, cambio de contraseña y, para administradores, las cuentas del servidor. */
export function KeysScreen() {
  const t = useT();
  const [me, setMe] = useState<User | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]); const [name, setName] = useState(''); const [created, setCreated] = useState<ApiKey | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => api.keys().then(setKeys).catch(() => setKeys([]));
  useEffect(() => { refresh(); api.me().then(setMe); }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { setCreated(await api.createKey(name.trim())); setName(''); refresh(); } catch (x) { setErr(formError(x, t)); }
  };
  const logout = async () => { try { await api.logout(); } catch { /* ya sin sesión */ } location.hash = '#/'; };
  return (
    <div className="page">
      <AppHeader right={me && <UserMenu user={me} onLogout={logout} />} />
      <main className="page__main account">
      <a className="btn btn--ghost btn--sm" href="#/" style={{ marginBottom: 12 }}><Icon name="arrowLeft" size={14} />{t('Mis espacios')}</a>
      <h1>{t('Cuenta')}</h1>
      <h2>{t('Claves API')}</h2>
      <p className="lead">{t('Para agentes y scripts: cabecera')} <code>Authorization: Bearer &lt;{t('clave')}&gt;</code>. {t('Documentación en')} <a href="/api/openapi.json">/api/openapi.json</a>. {t('Servidor MCP:')} <code>pnpm --filter @all-draw/server mcp</code> {t('con')} <code>ALLDRAW_URL</code> {t('y')} <code>ALLDRAW_API_KEY</code>.</p>
      <form className="row" onSubmit={create}>
        <label htmlFor="key-name" className="visually-hidden">{t('Nombre de la clave')}</label>
        <input id="key-name" className="input" placeholder={t('Nombre de la clave')} maxLength={80} value={name} onChange={e => setName(e.target.value)} />
        <button className="btn btn--primary" disabled={!name.trim()} type="submit">{t('Crear')}</button>
      </form>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      {created?.key && <p className="ok" role="status">{t('Copia la clave ahora, no se vuelve a mostrar:')} <code>{created.key}</code></p>}
      <div className="home__list">
        {keys.map(k => <div key={k.id} className="home__item"><div>{k.name} <small>{k.prefix}…</small><br /><small>{t('creada {date}', { date: new Date(k.createdAt).toLocaleString() })}{k.lastUsedAt ? ` · ${t('usada {date}', { date: new Date(k.lastUsedAt).toLocaleString() })}` : ''}</small></div><button className="btn btn--ghost" aria-label={t('Revocar la clave {name}', { name: k.name })} onClick={async () => { if (!(await confirmDialog({ title: t('¿Revocar la clave «{name}»?', { name: k.name }), message: t('Los agentes y scripts que la usen dejarán de tener acceso.'), confirmLabel: t('Revocar'), danger: true }))) return; await api.deleteKey(k.id); toast.success(t('Clave revocada')); refresh(); }}>{t('Revocar')}</button></div>)}
      </div>
      {me && <ProfileSection me={me} onChange={setMe} />}
      <PasswordSection onKeysChanged={refresh} />
      {me && <DataSection />}
      {me?.isAdmin && <AdminUsers meId={me.id} />}
      </main>
      <AppFooter />
    </div>
  );
}

function PasswordSection({ onKeysChanged }: { onKeysChanged: () => void }) {
  const t = useT();
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [repeat, setRepeat] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  // Casillas «Revocar también las claves API»: marcadas por defecto (quien cierra sesiones suele temer un robo de sesión).
  const [pwKeys, setPwKeys] = useState(true); const [allKeys, setAllKeys] = useState(true);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (next.trim().length < 8) { setErr(t('La contraseña necesita al menos 8 caracteres que no sean espacios')); return; }
    if (next !== repeat) { setErr(t('Las contraseñas no coinciden')); return; }
    if (next === current) { setErr(t('La contraseña nueva tiene que ser distinta de la actual')); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next, pwKeys);
      setMsg(pwKeys ? t('Contraseña cambiada. Se han cerrado las demás sesiones y revocado tus claves API.') : t('Contraseña cambiada; las demás sesiones se han cerrado.'));
      setCurrent(''); setNext(''); setRepeat('');
      if (pwKeys) onKeysChanged();
    }
    catch (x) { setErr(formError(x, t)); }
    finally { setBusy(false); }
  };
  const closeAll = async () => {
    setErr('');
    if (!(await confirmDialog({
      title: t('¿Cerrar todas las sesiones?'),
      message: allKeys
        ? t('Se cierra la sesión en todos los navegadores, también en este, y los espacios abiertos se desconectan al momento. Tus claves API también se revocan.')
        : t('Se cierra la sesión en todos los navegadores, también en este, y los espacios abiertos se desconectan al momento. Tus claves API siguen funcionando.'),
      confirmLabel: t('Cerrar todas las sesiones'), danger: true,
    }))) return;
    try { await api.logoutAll(allKeys); location.hash = '#/'; location.reload(); } catch (x) { setErr(formError(x, t)); }
  };
  return (
    <section aria-labelledby="pw-title">
      <h2 id="pw-title">{t('Cambiar contraseña')}</h2>
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <label className="field"><span>{t('Contraseña actual')}</span><input type="password" autoComplete="current-password" required maxLength={200} value={current} onChange={e => setCurrent(e.target.value)} /></label>
        <label className="field"><span>{t('Nueva contraseña')}</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={next} onChange={e => setNext(e.target.value)} /></label>
        <label className="field"><span>{t('Repite la nueva contraseña')}</span><input type="password" autoComplete="new-password" required minLength={8} maxLength={200} value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={pwKeys} onChange={e => setPwKeys(e.target.checked)} /> {t('Revocar también las claves API')}</label>
        <p className="hint">{t('Las demás sesiones se cierran siempre y sus espacios abiertos se desconectan. Los agentes y scripts que usen tus claves dejarán de tener acceso si las revocas.')}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn--primary" type="submit" disabled={busy || !current || next.trim().length < 8}>{t('Cambiar')}</button>
        </div>
        <p className="err" role="alert" aria-live="assertive">{err}</p>
        <p className="ok" role="status" aria-live="polite">{msg}</p>
      </form>
      <h2 id="sessions-title">{t('Sesiones')}</h2>
      <p className="lead">{t('Cierra la sesión en todos los navegadores, incluido este, y desconecta al momento los espacios que tengan abiertos.')}</p>
      <div className="row" role="group" aria-labelledby="sessions-title">
        <label className="check"><input type="checkbox" checked={allKeys} onChange={e => setAllKeys(e.target.checked)} /> {t('Revocar también las claves API')}</label>
        <button className="btn" type="button" onClick={() => void closeAll()}>{t('Cerrar todas las sesiones')}</button>
      </div>
    </section>
  );
}

function AdminUsers({ meId }: { meId: string }) {
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  const [err, setErr] = useState('');
  const [revokeKeys, setRevokeKeys] = useState(true);
  const refresh = () => api.adminUsers().then(setUsers).catch(x => setErr((x as Error).message));
  useEffect(() => { refresh(); }, []);
  const doReset = async (u: AdminUser) => {
    const message = revokeKeys
      ? t('Se cerrarán sus sesiones (sus espacios abiertos se desconectan), se revocarán sus claves API y tendrás que darle la contraseña temporal.')
      : t('Se cerrarán sus sesiones (sus espacios abiertos se desconectan) y tendrás que darle la contraseña temporal. Sus claves API seguirán funcionando.');
    if (!(await confirmDialog({ title: t('¿Restablecer la contraseña de {email}?', { email: u.email }), message, confirmLabel: t('Restablecer'), danger: true }))) return;
    try { setReset({ id: u.id, password: await api.adminReset(u.id, revokeKeys) }); } catch (x) { setErr(formError(x, t)); }
  };
  return (
    <section aria-labelledby="users-title">
      <h2 id="users-title">{t('Usuarios del servidor')}</h2>
      <label className="check"><input type="checkbox" checked={revokeKeys} onChange={e => setRevokeKeys(e.target.checked)} /> {t('Al restablecer una contraseña, revocar también las claves API de esa cuenta')}</label>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      <div className="home__list">
        {users.map(u => <div key={u.id} className="home__item">
          <div>{u.name} <small>{u.email}</small>{u.isAdmin && <small> · {t('administrador')}</small>}<br /><small>{t('creada {date}', { date: new Date(u.createdAt).toLocaleString() })}</small>
            {reset?.id === u.id && <p className="ok" role="status">{t('Contraseña temporal (cópiala ahora):')} <code>{reset.password}</code></p>}
          </div>
          {u.id !== meId && <button className="btn btn--ghost" aria-label={t('Restablecer la contraseña de {email}', { email: u.email })} onClick={() => doReset(u)}>{t('Restablecer')}</button>}
          {u.id !== meId && <button className="btn btn--ghost" aria-label={u.isAdmin ? t('Quitar administrador a {email}', { email: u.email }) : t('Hacer administrador a {email}', { email: u.email })}
            onClick={async () => { setErr(''); try { await api.adminSetAdmin(u.id, !u.isAdmin); refresh(); } catch (x) { setErr((x as Error).message); } }}>{u.isAdmin ? t('Quitar administrador') : t('Hacer administrador')}</button>}
        </div>)}
      </div>
    </section>
  );
}

const formatMB = (n: number) => `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`;

/** Nombre y email (cambiar el email pide la contraseña) y cuotas de la cuenta. */
function ProfileSection({ me, onChange }: { me: User; onChange: (u: User) => void }) {
  const t = useT();
  const [name, setName] = useState(me.name); const [email, setEmail] = useState(me.email); const [password, setPassword] = useState('');
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api.account().then(r => setQuotas(r.quotas), () => setQuotas(null)); }, []);
  const emailChanged = email.trim().toLowerCase() !== me.email;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      const user = await api.updateMe({ ...(name.trim() !== me.name ? { name: name.trim() } : {}), ...(emailChanged ? { email: email.trim(), password } : {}) });
      onChange(user); setPassword(''); setMsg(t('Datos guardados.'));
    } catch (x) { setErr(formError(x, t)); }
    finally { setBusy(false); }
  };
  return (
    <section aria-labelledby="profile-title">
      <h2 id="profile-title">{t('Perfil')}</h2>
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <label className="field"><span>{t('Nombre')}</span><input autoComplete="name" required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="field"><span>{t('Correo')}</span><input type="email" autoComplete="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} /></label>
        {emailChanged && <label className="field"><span>{t('Contraseña actual (para cambiar el correo)')}</span><input type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></label>}
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn--primary" type="submit" disabled={busy || !name.trim() || (name.trim() === me.name && !emailChanged) || (emailChanged && !password)}>{t('Guardar')}</button>
        </div>
        <p className="err" role="alert" aria-live="assertive">{err}</p>
        <p className="ok" role="status" aria-live="polite">{msg}</p>
      </form>
      {quotas && <p className="lead"><small>
        {quotas.workspaces.limit === null ? t('Espacios propios: {used} (sin límite)', { used: quotas.workspaces.used }) : t('Espacios propios: {used} de {limit}', { used: quotas.workspaces.used, limit: quotas.workspaces.limit })}
        {quotas.docBytes.limit !== null && <> · {t('Tamaño máximo por espacio: {size}', { size: formatMB(quotas.docBytes.limit) })}</>}
      </small></p>}
    </section>
  );
}

/** "Tus datos": exportar todo (JSON) y eliminar la cuenta (con la contraseña). */
function DataSection() {
  const t = useT();
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false); const [password, setPassword] = useState('');
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const wasDeleting = useRef(false);
  // Al cancelar, el foco vuelve a «Eliminar cuenta…» (el formulario se lo había llevado con autoFocus).
  useEffect(() => { if (wasDeleting.current && !deleting) deleteBtn.current?.focus(); wasDeleting.current = deleting; }, [deleting]);
  const doExport = async () => {
    setErr(''); setBusy(true);
    try { await api.exportData(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const doDelete = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.deleteAccount(password); location.hash = '#/'; location.reload(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <section aria-labelledby="data-title">
      <h2 id="data-title">{t('Tus datos')}</h2>
      <p className="lead">{t('Descarga un JSON con tu cuenta, tus claves API (sin el secreto), tus espacios con su contenido, miembros y enlaces, y la lista de espacios compartidos contigo.')}</p>
      <div className="row">
        <button className="btn" type="button" disabled={busy} onClick={doExport}>{t('Exportar mis datos')}</button>
        {!deleting && <button ref={deleteBtn} className="btn btn--ghost" type="button" onClick={() => { setDeleting(true); setErr(''); }}>{t('Eliminar cuenta…')}</button>}
      </div>
      {deleting && <form onSubmit={doDelete} style={{ maxWidth: 480, marginTop: 12 }} aria-labelledby="delete-title">
        <h3 id="delete-title">{t('Eliminar la cuenta')}</h3>
        <p>{t('Se borran tu cuenta, tus sesiones, tus claves API y tu acceso a los espacios de otros. Cada espacio tuyo pasa al editor más antiguo que tenga; los que no tienen editores se borran. No se puede deshacer: exporta antes tus datos si los quieres conservar.')}</p>
        <label className="field"><span>{t('Tu contraseña')}</span><input type="password" autoComplete="current-password" required autoFocus maxLength={200} value={password} onChange={e => setPassword(e.target.value)} /></label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" style={{ background: '#b91c1c', borderColor: '#b91c1c', color: '#fff' }} type="submit" disabled={busy || !password}>{t('Eliminar mi cuenta definitivamente')}</button>
          <button className="btn btn--ghost" type="button" onClick={() => { setDeleting(false); setPassword(''); setErr(''); }}>{t('Cancelar')}</button>
        </div>
      </form>}
      <p className="err" role="alert" aria-live="assertive">{err}</p>
    </section>
  );
}
