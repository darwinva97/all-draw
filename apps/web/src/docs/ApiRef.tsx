/**
 * Lista de endpoints de la API, leída en tiempo de ejecución de `/api/openapi.json` (la del propio servidor), agrupada
 * por etiqueta con método, ruta y resumen. Si el servidor no expone la API (desarrollo sin servidor), lo dice y
 * enlaza a la de producción.
 */
import { useEffect, useState } from 'react';
import { useT } from '@all-draw/i18n';

interface Operation { method: string; path: string; summary: string; description: string; tag: string; deprecated: boolean }
interface Group { tag: string; description: string; ops: Operation[] }

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
const PROD = 'https://alldraw.bezenti.com/api/openapi.json';

type Spec = {
  tags?: { name: string; description?: string }[];
  paths?: Record<string, Partial<Record<string, { summary?: string; description?: string; tags?: string[]; deprecated?: boolean }>>>;
};

export function groupOperations(spec: Spec, other: string): Group[] {
  const groups = new Map<string, Group>();
  for (const tg of spec.tags ?? []) groups.set(tg.name, { tag: tg.name, description: tg.description ?? '', ops: [] });
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const m of METHODS) {
      const op = item?.[m];
      if (!op) continue;
      const tag = op.tags?.[0] ?? other;
      if (!groups.has(tag)) groups.set(tag, { tag, description: '', ops: [] });
      groups.get(tag)!.ops.push({ method: m.toUpperCase(), path, summary: op.summary ?? '', description: op.description ?? '', tag, deprecated: !!op.deprecated });
    }
  }
  return [...groups.values()].filter(g => g.ops.length);
}

export function ApiRef() {
  const t = useT();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; groups: Group[]; title: string; version: string }>({ status: 'loading' });
  const [filter, setFilter] = useState('');
  useEffect(() => {
    let alive = true;
    fetch('/api/openapi.json', { headers: { accept: 'application/json' } })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('json')) throw new Error(t('el servidor no devolvió JSON'));
        return r.json() as Promise<Spec & { info?: { title?: string; version?: string } }>;
      })
      .then(spec => { if (alive) setState({ status: 'ok', groups: groupOperations(spec, t('otros')), title: spec.info?.title ?? 'API', version: spec.info?.version ?? '' }); })
      .catch((e: Error) => { if (alive) setState({ status: 'error', message: e.message }); });
    return () => { alive = false; };
  }, [t]);

  if (state.status === 'loading') return <p className="docs-api__state" role="status">{t('Cargando la referencia de la API…')}</p>;
  if (state.status === 'error') return (
    <div className="docs-api__state docs-api__state--error" role="status">
      <p>{t('No se pudo leer /api/openapi.json en este servidor ({error}).', { error: state.message })}</p>
      <p>{t('Consulta la referencia de producción:')} <a href={PROD} target="_blank" rel="noopener noreferrer">{PROD}</a></p>
    </div>
  );
  const q = filter.trim().toLowerCase();
  const groups = state.groups.map(g => ({ ...g, ops: g.ops.filter(o => !q || `${o.method} ${o.path} ${o.summary} ${o.tag}`.toLowerCase().includes(q)) })).filter(g => g.ops.length);
  const total = state.groups.reduce((n, g) => n + g.ops.length, 0);
  return (
    <div className="docs-api">
      <div className="docs-api__head">
        <p><strong>{state.title}</strong> {state.version && <code>v{state.version}</code>} <span className="docs-api__count">{t('{n} endpoints', { n: total })}</span> <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">openapi.json</a></p>
        <label className="docs-api__filter">
          <span className="visually-hidden">{t('Filtrar endpoints')}</span>
          <input type="search" placeholder={t('Filtrar endpoints')} value={filter} onChange={e => setFilter(e.target.value)} />
        </label>
      </div>
      {groups.length === 0 && <p className="docs-api__state">{t('Ningún endpoint coincide con «{q}».', { q: filter })}</p>}
      {groups.map(g => (
        <section key={g.tag} className="docs-api__group" aria-label={g.tag}>
          <h4 className="docs-api__tag">{g.tag}{g.description && <small>{g.description}</small>}</h4>
          <ul>
            {g.ops.map(o => (
              <li key={`${o.method} ${o.path}`} className={o.deprecated ? 'is-deprecated' : undefined}>
                <span className={`docs-api__method docs-api__method--${o.method.toLowerCase()}`}>{o.method}</span>
                <code className="docs-api__path">{o.path}</code>
                <span className="docs-api__summary">{o.summary}{o.deprecated && <em> {t('(obsoleto)')}</em>}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
