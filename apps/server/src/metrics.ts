/**
 * Métricas en memoria del proceso y su exposición en formato de texto de Prometheus (`GET /metrics`).
 *
 *   alldraw_http_requests_total{method,route,status}        contador
 *   alldraw_http_request_duration_seconds{route,quantile}   resumen: p50 y p95 de las últimas 1024 peticiones por ruta
 *   alldraw_ws_rejected_total{reason}                       WebSockets rechazados (límites, permisos, apagado)
 *   alldraw_client_errors_total                             informes de `POST /api/client-errors`
 *   + gauges que calcula quien llama a `render` (docs vivos, conexiones WS, tamaño de la BD, memoria, uptime)
 *
 * Las rutas se normalizan (`/api/workspaces/:id/snapshots/:sid`) para que la cardinalidad no dependa de los ids.
 */

const RESERVOIR = 1024;
const MAX_ROUTES = 200;

/** Segmentos que van detrás de estos se tratan como ids. */
const PARAM_AFTER = new Set(['workspaces', 'snapshots', 'keys', 'members', 'links', 'users', 'views', 'webhooks', 'embeds']);

/** `/api/workspaces/ws_1/views/v_2/svg?x` → `/api/workspaces/:id/views/:id/svg`; estáticos → `static`. */
export function routeOf(rawPath: string): string {
  const q = rawPath.search(/[?#]/);
  const p = q >= 0 ? rawPath.slice(0, q) : rawPath;
  if (p === '/healthz' || p === '/metrics' || p === '/.well-known/security.txt' || p === '/mcp') return p;
  if (p.startsWith('/embed/')) return p.endsWith('.svg') ? '/embed/:id/:id.svg' : '/embed/:id/:id';
  if (!p.startsWith('/api/') && p !== '/api') return 'static';
  const segs = p.split('/');
  for (let i = 1; i < segs.length; i++) if (PARAM_AFTER.has(segs[i - 1]!) && segs[i]) segs[i] = ':id';
  return segs.join('/');
}

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labels = (l: Record<string, string | number>) => `{${Object.entries(l).map(([k, v]) => `${k}="${esc(String(v))}"`).join(',')}}`;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i]!;
}

export interface Gauge { name: string; help: string; value: number; labels?: Record<string, string> }

export class Metrics {
  private requests = new Map<string, { method: string; route: string; status: number; n: number }>();
  private latency = new Map<string, { samples: number[]; next: number; sum: number; count: number }>();
  private wsRejected = new Map<string, number>();
  clientErrors = 0;

  /** Registra una petición HTTP terminada. */
  observe(method: string, path: string, status: number, ms: number): void {
    let route = routeOf(path);
    if (status === 404 && route !== 'static') route = 'unmatched';
    if (!this.latency.has(route) && this.latency.size >= MAX_ROUTES) route = 'other';
    const key = `${method} ${route} ${status}`;
    const r = this.requests.get(key);
    if (r) r.n++; else this.requests.set(key, { method, route, status, n: 1 });
    let l = this.latency.get(route);
    if (!l) { l = { samples: [], next: 0, sum: 0, count: 0 }; this.latency.set(route, l); }
    const s = ms / 1000;
    if (l.samples.length < RESERVOIR) l.samples.push(s); else { l.samples[l.next] = s; l.next = (l.next + 1) % RESERVOIR; }
    l.sum += s; l.count++;
  }

  wsRejection(reason: string): void { this.wsRejected.set(reason, (this.wsRejected.get(reason) ?? 0) + 1); }

  /** p50/p95 en segundos de una ruta (tests y diagnóstico). */
  percentiles(route: string): { p50: number; p95: number; count: number } {
    const l = this.latency.get(route);
    if (!l) return { p50: 0, p95: 0, count: 0 };
    const sorted = [...l.samples].sort((a, b) => a - b);
    return { p50: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), count: l.count };
  }

  render(gauges: Gauge[] = []): string {
    const out: string[] = [];
    out.push('# HELP alldraw_http_requests_total Peticiones HTTP por método, ruta normalizada y estado.', '# TYPE alldraw_http_requests_total counter');
    for (const r of [...this.requests.values()].sort((a, b) => a.route.localeCompare(b.route) || a.status - b.status)) {
      out.push(`alldraw_http_requests_total${labels({ method: r.method, route: r.route, status: r.status })} ${r.n}`);
    }
    out.push('# HELP alldraw_http_request_duration_seconds Latencia por ruta (p50 y p95 de las últimas 1024 peticiones).', '# TYPE alldraw_http_request_duration_seconds summary');
    for (const route of [...this.latency.keys()].sort()) {
      const l = this.latency.get(route)!;
      const sorted = [...l.samples].sort((a, b) => a - b);
      for (const q of [0.5, 0.95]) out.push(`alldraw_http_request_duration_seconds${labels({ route, quantile: q })} ${quantile(sorted, q).toFixed(6)}`);
      out.push(`alldraw_http_request_duration_seconds_sum${labels({ route })} ${l.sum.toFixed(6)}`);
      out.push(`alldraw_http_request_duration_seconds_count${labels({ route })} ${l.count}`);
    }
    out.push('# HELP alldraw_ws_rejected_total WebSockets rechazados por motivo.', '# TYPE alldraw_ws_rejected_total counter');
    for (const [reason, n] of [...this.wsRejected].sort()) out.push(`alldraw_ws_rejected_total${labels({ reason })} ${n}`);
    out.push('# HELP alldraw_client_errors_total Errores informados por la app web.', '# TYPE alldraw_client_errors_total counter', `alldraw_client_errors_total ${this.clientErrors}`);
    const seen = new Set<string>();
    for (const g of gauges) {
      if (!seen.has(g.name)) { out.push(`# HELP ${g.name} ${g.help}`, `# TYPE ${g.name} gauge`); seen.add(g.name); }
      out.push(`${g.name}${g.labels ? labels(g.labels) : ''} ${Number.isFinite(g.value) ? g.value : 0}`);
    }
    return out.join('\n') + '\n';
  }
}
