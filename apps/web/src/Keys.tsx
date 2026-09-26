import { useEffect, useState } from 'react';
import { api, type ApiKey } from './api';

export function KeysScreen() {
  const [keys, setKeys] = useState<ApiKey[]>([]); const [name, setName] = useState(''); const [created, setCreated] = useState<ApiKey | null>(null);
  const refresh = () => api.keys().then(setKeys).catch(() => setKeys([]));
  useEffect(() => { refresh(); }, []);
  return (
    <div className="home">
      <h1>Claves API</h1>
      <p className="lead">Para agentes y scripts: cabecera <code>Authorization: Bearer &lt;clave&gt;</code>. Documentación en <a href="/api/openapi.json">/api/openapi.json</a>. Servidor MCP: <code>pnpm --filter @all-draw/server mcp</code> con <code>ALLDRAW_URL</code> y <code>ALLDRAW_API_KEY</code>.</p>
      <div className="row"><input className="field" placeholder="Nombre de la clave" value={name} onChange={e => setName(e.target.value)} /><button className="btn btn--primary" disabled={!name} onClick={async () => { setCreated(await api.createKey(name)); setName(''); refresh(); }}>Crear</button><a className="btn" href="#/">Volver</a></div>
      {created?.key && <p className="err" style={{ color: '#16a34a' }}>Copia la clave ahora, no se vuelve a mostrar: <code>{created.key}</code></p>}
      <div className="home__list">
        {keys.map(k => <div key={k.id} className="home__item"><div>{k.name} <small>{k.prefix}…</small><br /><small>creada {new Date(k.createdAt).toLocaleString()}{k.lastUsedAt ? ` · usada ${new Date(k.lastUsedAt).toLocaleString()}` : ''}</small></div><button className="btn btn--ghost" onClick={async () => { await api.deleteKey(k.id); refresh(); }}>Revocar</button></div>)}
      </div>
    </div>
  );
}
