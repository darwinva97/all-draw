import { useEffect, useState } from 'react';
import { api, type ApiKey } from './api';

export function KeysScreen() {
  const [keys, setKeys] = useState<ApiKey[]>([]); const [name, setName] = useState(''); const [created, setCreated] = useState<ApiKey | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => api.keys().then(setKeys).catch(() => setKeys([]));
  useEffect(() => { refresh(); }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try { setCreated(await api.createKey(name)); setName(''); refresh(); } catch (x) { setErr((x as Error).message); }
  };
  return (
    <div className="home">
      <h1>Claves API</h1>
      <p className="lead">Para agentes y scripts: cabecera <code>Authorization: Bearer &lt;clave&gt;</code>. Documentación en <a href="/api/openapi.json">/api/openapi.json</a>. Servidor MCP: <code>pnpm --filter @all-draw/server mcp</code> con <code>ALLDRAW_URL</code> y <code>ALLDRAW_API_KEY</code>.</p>
      <form className="row" onSubmit={create}>
        <label htmlFor="key-name" className="visually-hidden">Nombre de la clave</label>
        <input id="key-name" className="field" placeholder="Nombre de la clave" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn btn--primary" disabled={!name} type="submit">Crear</button>
        <a className="btn" href="#/">Volver</a>
      </form>
      <p className="err" role="alert" aria-live="assertive">{err}</p>
      {created?.key && <p className="ok" role="status">Copia la clave ahora, no se vuelve a mostrar: <code>{created.key}</code></p>}
      <div className="home__list">
        {keys.map(k => <div key={k.id} className="home__item"><div>{k.name} <small>{k.prefix}…</small><br /><small>creada {new Date(k.createdAt).toLocaleString()}{k.lastUsedAt ? ` · usada ${new Date(k.lastUsedAt).toLocaleString()}` : ''}</small></div><button className="btn btn--ghost" aria-label={`Revocar la clave ${k.name}`} onClick={async () => { await api.deleteKey(k.id); refresh(); }}>Revocar</button></div>)}
      </div>
    </div>
  );
}
