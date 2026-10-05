/**
 * Lógica pura del monitor (sin APIs de Workers, la prueban los tests de Node): qué cuenta como caída, la máquina de
 * estados de los avisos (caído tras N fallos seguidos, recuperado al primer acierto), los textos de ntfy y la página
 * de estado (HTML autocontenido, sin JS ni recursos externos).
 */

export interface Target { id: string; name: string; url: string }

/** Resultado de una comprobación de `GET /api/status`. */
export interface CheckResult {
  target: string;
  ts: number;
  ok: boolean;
  /** Código HTTP (0 si no hubo respuesta). */
  status: number;
  /** Latencia total de la petición en ms. */
  ms: number;
  /** `db.ok` de la respuesta (`null` si no llegó a leerse). */
  dbOk: boolean | null;
  error: string | null;
}

export interface TargetState { fails: number; down: boolean; since: number | null }
export type Transition = { kind: 'down'; target: string; since: number; fails: number; error: string } | { kind: 'up'; target: string; since: number; downForMs: number };

/** Interpreta la respuesta de `/api/status`: sana si es 200, `status: "ok"` y la BD responde. */
export function judge(status: number, body: unknown): { ok: boolean; dbOk: boolean | null; error: string | null } {
  const b = (body && typeof body === 'object' ? body : {}) as { status?: unknown; db?: { ok?: unknown } };
  const dbOk = typeof b.db?.ok === 'boolean' ? b.db.ok : null;
  if (status !== 200) return { ok: false, dbOk, error: `HTTP ${status}${dbOk === false ? ' (BD sin respuesta)' : ''}` };
  if (b.status !== 'ok') return { ok: false, dbOk, error: `estado «${String(b.status ?? 'sin JSON')}»` };
  if (dbOk === false) return { ok: false, dbOk, error: 'la BD no responde' };
  return { ok: true, dbOk, error: null };
}

/**
 * Aplica una comprobación al estado de un destino. Avisa de caída cuando llega a `threshold` fallos seguidos (una sola
 * vez) y de recuperación en el primer acierto tras una caída avisada. `since` es el primer fallo de la racha.
 */
export function step(prev: TargetState, r: CheckResult, threshold: number): { state: TargetState; transition: Transition | null } {
  if (r.ok) {
    if (prev.down) return { state: { fails: 0, down: false, since: null }, transition: { kind: 'up', target: r.target, since: prev.since ?? r.ts, downForMs: r.ts - (prev.since ?? r.ts) } };
    return { state: { fails: 0, down: false, since: null }, transition: null };
  }
  const fails = prev.fails + 1;
  const since = prev.since ?? r.ts;
  if (!prev.down && fails >= threshold) return { state: { fails, down: true, since }, transition: { kind: 'down', target: r.target, since, fails, error: r.error ?? 'error' } };
  return { state: { fails, down: prev.down, since }, transition: null };
}

export const fmtDuration = (ms: number) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rest = m % 60;
  return h < 48 ? `${h} h${rest ? ` ${rest} min` : ''}` : `${Math.round(h / 24)} días`;
};
export const fmtUtc = (ts: number) => `${new Date(ts).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** Aviso de ntfy para una transición (título, texto, prioridad 1-5, etiquetas). */
export function alertFor(t: Transition, target: Target, pageUrl: string | null, label = ''): { title: string; message: string; priority: number; tags: string[]; click?: string } {
  const prefix = label ? `[${label}] ` : '';
  if (t.kind === 'down') {
    return {
      title: `${prefix}all-draw caído: ${target.name}`,
      message: `${target.url}\n${t.error} · ${t.fails} comprobaciones seguidas fallidas desde ${fmtUtc(t.since)}.`,
      priority: 5, tags: ['rotating_light'], ...(pageUrl ? { click: pageUrl } : {}),
    };
  }
  return {
    title: `${prefix}all-draw recuperado: ${target.name}`,
    message: `${target.url}\nVuelve a responder tras ${fmtDuration(t.downForMs)} (desde ${fmtUtc(t.since)}).`,
    priority: 3, tags: ['white_check_mark'], ...(pageUrl ? { click: pageUrl } : {}),
  };
}

/** Lista de destinos de la variable `TARGETS` (JSON `[{id, name, url}]`). */
export function parseTargets(raw: string | undefined): Target[] {
  let list: unknown;
  try { list = JSON.parse(raw ?? '[]'); } catch { throw new Error('TARGETS no es JSON válido'); }
  if (!Array.isArray(list) || list.some(t => !t || typeof t.id !== 'string' || typeof t.url !== 'string')) throw new Error('TARGETS: se esperaba [{ id, name, url }]');
  return (list as Target[]).map(t => ({ id: t.id, name: typeof t.name === 'string' ? t.name : t.id, url: t.url }));
}

// ---------------------------------------------------------------- Página de estado

export interface Bucket { from: number; total: number; ok: number }
export interface TargetSummary {
  target: Target;
  down: boolean;
  last: { ts: number; ok: boolean; status: number; ms: number; error: string | null } | null;
  uptime24h: number | null;
  uptime7d: number | null;
  /** Latencia media de las comprobaciones correctas en 24 h (ms). */
  avgMs24h: number | null;
  /** 24 tramos de una hora, del más antiguo al más reciente. */
  hours: Bucket[];
}
export interface Incident { target: string; started: number; ended: number | null; reason: string }
export interface Summary { generatedAt: number; targets: TargetSummary[]; incidents: Incident[] }

type Lang = 'es' | 'en';
const TEXT = {
  es: {
    title: 'Estado de all-draw', ok: 'Funciona', down: 'Caído', nodata: 'Sin datos', uptime24: 'Disponibilidad 24 h', uptime7: '7 días',
    latency: 'Latencia media 24 h', last: 'Última comprobación', incidents: 'Últimos incidentes', none: 'Sin incidentes registrados.',
    ongoing: 'en curso', lasted: 'duró', hours: 'Últimas 24 horas (una barra por hora)', every: 'Se comprueba cada 5 minutos desde Cloudflare; se considera caído tras 2 fallos seguidos.',
    updated: 'Actualizado', allOk: 'Todos los servicios funcionan', someDown: 'Hay servicios caídos', app: 'Ir a all-draw', role: { vps: 'principal', cloudflare: 'copia de respaldo de solo lectura' },
  },
  en: {
    title: 'all-draw status', ok: 'Operational', down: 'Down', nodata: 'No data', uptime24: 'Uptime 24 h', uptime7: '7 days',
    latency: 'Average latency 24 h', last: 'Last check', incidents: 'Recent incidents', none: 'No incidents recorded.',
    ongoing: 'ongoing', lasted: 'lasted', hours: 'Last 24 hours (one bar per hour)', every: 'Checked every 5 minutes from Cloudflare; considered down after 2 failures in a row.',
    updated: 'Updated', allOk: 'All services operational', someDown: 'Some services are down', app: 'Go to all-draw', role: { vps: 'main', cloudflare: 'read-only backup copy' },
  },
} as const;

export const pickLang = (acceptLanguage: string | null): Lang => (/^\s*es\b/i.test(acceptLanguage ?? '') || !/\ben\b/i.test(acceptLanguage ?? '') ? 'es' : 'en');

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const pct = (v: number | null, lang: Lang) => (v === null ? '—' : `${new Intl.NumberFormat(lang, { minimumFractionDigits: v < 1 ? 2 : 0, maximumFractionDigits: v < 1 ? 2 : 0 }).format(Math.floor(v * 10_000) / 100)} %`);

/** Página de estado completa (HTML autocontenido: estilos en línea, sin scripts; se recarga sola cada minuto). */
export function renderPage(s: Summary, lang: Lang, appUrl: string): string {
  const T = TEXT[lang];
  const anyDown = s.targets.some(t => t.down);
  const names = new Map(s.targets.map(t => [t.target.id, t.target.name]));
  const rows = s.targets.map(t => {
    const state = t.last === null ? 'nodata' : t.down ? 'down' : 'ok';
    const bars = t.hours.map(b => {
      const cls = b.total === 0 ? 'nd' : b.ok === b.total ? 'up' : b.ok === 0 ? 'dn' : 'pt';
      const tip = `${fmtUtc(b.from)} · ${b.total ? `${b.ok}/${b.total}` : T.nodata}`;
      return `<i class="${cls}" title="${esc(tip)}"></i>`;
    }).join('');
    const role = (T.role as Record<string, string>)[t.target.id];
    return `<section class="card">
  <header><span class="dot ${state}" aria-hidden="true"></span><h2>${esc(t.target.name)}</h2><span class="badge ${state}">${T[state as 'ok' | 'down' | 'nodata']}</span></header>
  <p class="url">${esc(t.target.url.replace(/\/api\/status$/, ''))}${role ? ` · ${esc(role)}` : ''}</p>
  <dl>
    <div><dt>${T.uptime24}</dt><dd>${pct(t.uptime24h, lang)}</dd></div>
    <div><dt>${T.uptime7}</dt><dd>${pct(t.uptime7d, lang)}</dd></div>
    <div><dt>${T.latency}</dt><dd>${t.avgMs24h === null ? '—' : `${Math.round(t.avgMs24h)} ms`}</dd></div>
    <div><dt>${T.last}</dt><dd>${t.last ? `${fmtUtc(t.last.ts).slice(11)} · ${t.last.ok ? `${t.last.ms} ms` : esc(t.last.error ?? 'error')}` : '—'}</dd></div>
  </dl>
  <div class="bars" role="img" aria-label="${T.hours}">${bars}</div>
</section>`;
  }).join('\n');
  const incidents = s.incidents.length
    ? `<ul class="inc">${s.incidents.map(i => `<li><b>${esc(names.get(i.target) ?? i.target)}</b> · ${fmtUtc(i.started)} · ${i.ended === null ? `<span class="badge down">${T.ongoing}</span>` : `${T.lasted} ${fmtDuration(i.ended - i.started)}`}<br><span class="muted">${esc(i.reason)}</span></li>`).join('')}</ul>`
    : `<p class="muted">${T.none}</p>`;
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><meta name="robots" content="noindex">
<title>${anyDown ? '⚠ ' : ''}${T.title}</title>
<style>
:root{color-scheme:light dark;--bg:#f5f6f8;--card:#fff;--line:#e2e5ea;--text:#16191f;--muted:#5b6472;--ok:#1f8a4c;--dn:#c92a2a;--pt:#b86e00;--nd:#d5d9e0}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#161a22;--line:#262b36;--text:#e6e8ec;--muted:#9aa3b2;--ok:#5fd08f;--dn:#ff7b7b;--pt:#f3b44c;--nd:#2c323d}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0;flex:1}
.summary{margin:0 0 24px;font-weight:600;color:${anyDown ? 'var(--dn)' : 'var(--ok)'}}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 16px}
.card header{display:flex;align-items:center;gap:10px}.url{margin:4px 0 12px;color:var(--muted);font-size:13px;word-break:break-all}
.dot{width:10px;height:10px;border-radius:50%;background:var(--nd)}.dot.ok{background:var(--ok)}.dot.down{background:var(--dn)}
.badge{font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;border:1px solid currentColor}.badge.ok{color:var(--ok)}.badge.down{color:var(--dn)}.badge.nodata{color:var(--muted)}
dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px 16px;margin:0 0 12px}dt{font-size:12px;color:var(--muted)}dd{margin:0;font-weight:600;font-variant-numeric:tabular-nums}
.bars{display:grid;grid-template-columns:repeat(24,1fr);gap:2px;height:28px}.bars i{border-radius:2px;background:var(--nd)}.bars .up{background:var(--ok)}.bars .dn{background:var(--dn)}.bars .pt{background:var(--pt)}
h3{font-size:15px;margin:28px 0 8px}.inc{list-style:none;margin:0;padding:0}.inc li{padding:8px 0;border-top:1px solid var(--line);font-size:14px}
.muted{color:var(--muted)}footer{margin-top:28px;font-size:13px;color:var(--muted)}a{color:inherit}
</style></head>
<body><main>
<h1>${T.title}</h1>
<p class="summary">${anyDown ? T.someDown : T.allOk}</p>
${rows}
<h3>${T.incidents}</h3>
${incidents}
<footer><p>${T.every}</p><p>${T.updated}: ${fmtUtc(s.generatedAt)} · <a href="${esc(appUrl)}">${T.app}</a> · <a href="/api/status.json">JSON</a></p></footer>
</main></body></html>`;
}
