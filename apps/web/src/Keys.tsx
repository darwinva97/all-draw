import { useEffect, useState } from 'react';
import { api, type AdminUser, type ApiKey, type User } from './api';
import { useT } from '@all-draw/i18n';

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
    try { setCreated(await api.createKey(name)); setName(''); refresh(); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="home">
      <h1>{t('Cuenta')}</h1>
      <h2>{t('Claves API')}</h2>
      <p className="lead">{t('Para agentes y scripts: cabecera')} <code>Authorization: Bearer &lt;{t('clave')}&gt;</code>. {t('Documentación en')} <a href="/api/openapi.json">/api/openapi.json</a>. {t('Servidor MCP:')} <code>pnpm --filter @all-draw/server mcp</code> {t('con')} <code>ALLDRAW_URL</code> {t('y')} <code>ALLDRAW_API_KEY</code>.</p>
      <form className="row" onSubmit={create}>
        <label htmlFor="key-name" className="visually-hidden">{t('Nombre de la clave')}</label>
        <input id="key-name" className="field" placeholder={t('Nombre de la clave')} value={name} onChange={e => setName(e.target.value)} />
        <button className="btn btn--primary" disabled={!name} type="submit">{t('Crear')}</button>
        <a className="btn" href="#/">{t('Volver')}</a>
      </form>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      {created?.key && <p className="ok" role="status">{t('Copia la clave ahora, no se vuelve a mostrar:')} <code>{created.key}</code></p>}
      <div className="home__list">
        {keys.map(k => <div key={k.id} className="home__item"><div>{k.name} <small>{k.prefix}…</small><br /><small>{t('creada {date}', { date: new Date(k.createdAt).toLocaleString() })}{k.lastUsedAt ? ` · ${t('usada {date}', { date: new Date(k.lastUsedAt).toLocaleString() })}` : ''}</small></div><button className="btn btn--ghost" aria-label={t('Revocar la clave {name}', { name: k.name })} onClick={async () => { await api.deleteKey(k.id); refresh(); }}>{t('Revocar')}</button></div>)}
      </div>
      <PasswordSection />
      {me?.isAdmin && <AdminUsers meId={me.id} />}
    </div>
  );
}

function PasswordSection() {
  const t = useT();
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [repeat, setRepeat] = useState('');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (next !== repeat) { setErr(t('Las contraseñas no coinciden')); return; }
    setBusy(true);
    try { await api.changePassword(current, next); setMsg(t('Contraseña cambiada; las demás sesiones se han cerrado.')); setCurrent(''); setNext(''); setRepeat(''); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  const closeAll = async () => { try { await api.logoutAll(); location.hash = '#/'; location.reload(); } catch (x) { setErr((x as Error).message); } };
  return (
    <section aria-labelledby="pw-title">
      <h2 id="pw-title">{t('Cambiar contraseña')}</h2>
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <label className="field"><span>{t('Contraseña actual')}</span><input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></label>
        <label className="field"><span>{t('Nueva contraseña')}</span><input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} /></label>
        <label className="field"><span>{t('Repite la nueva contraseña')}</span><input type="password" autoComplete="new-password" required minLength={8} value={repeat} onChange={e => setRepeat(e.target.value)} /></label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn--primary" type="submit" disabled={busy || !current || next.length < 8}>{t('Cambiar')}</button>
          <button className="btn btn--ghost" type="button" onClick={closeAll} title={t('Cierra la sesión en todos los navegadores, incluido este')}>{t('Cerrar todas las sesiones')}</button>
        </div>
        <p className="err" role="alert" aria-live="assertive">{err}</p>
        <p className="ok" role="status" aria-live="polite">{msg}</p>
      </form>
    </section>
  );
}

function AdminUsers({ meId }: { meId: string }) {
  const t = useT();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => api.adminUsers().then(setUsers).catch(x => setErr((x as Error).message));
  useEffect(() => { refresh(); }, []);
  const doReset = async (u: AdminUser) => {
    if (!confirm(t('¿Restablecer la contraseña de {email}? Se cerrarán sus sesiones y tendrás que darle la contraseña temporal.', { email: u.email }))) return;
    try { setReset({ id: u.id, password: await api.adminReset(u.id) }); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <section aria-labelledby="users-title">
      <h2 id="users-title">{t('Usuarios del servidor')}</h2>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      <div className="home__list">
        {users.map(u => <div key={u.id} className="home__item">
          <div>{u.name} <small>{u.email}</small>{u.isAdmin && <small> · {t('administrador')}</small>}<br /><small>{t('creada {date}', { date: new Date(u.createdAt).toLocaleString() })}</small>
            {reset?.id === u.id && <p className="ok" role="status">{t('Contraseña temporal (cópiala ahora):')} <code>{reset.password}</code></p>}
          </div>
          {u.id !== meId && <button className="btn btn--ghost" aria-label={t('Restablecer la contraseña de {email}', { email: u.email })} onClick={() => doReset(u)}>{t('Restablecer')}</button>}
        </div>)}
      </div>
    </section>
  );
}
