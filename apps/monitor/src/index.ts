/**
 * Monitor externo de all-draw (Cloudflare Worker con cron cada 5 minutos):
 *
 *   scheduled  → `GET /api/status` de cada destino de `TARGETS` (estado, latencia, BD), lo guarda en el Durable Object
 *                `MonitorDO` (SQLite: historial de 8 días, estado y incidentes) y avisa por ntfy (`NTFY_TOPIC`, secreto)
 *                al caer (`FAIL_THRESHOLD` fallos seguidos, 2) y al recuperarse. Los avisos pasan por una bandeja de
 *                salida en el DO: ntfy.sh limita por IP y las de Cloudflare son compartidas (a veces responde 429), así
 *                que lo que no sale se reintenta en la misma ejecución y en las siguientes (hasta 3 horas).
 *   GET /                → página de estado pública (HTML autocontenido): disponibilidad 24 h / 7 días, latencia, últimos incidentes.
 *   GET /api/status.json → lo mismo en JSON.
 *   GET /healthz         → `ok`.
 *
 * El rate limit `RL_PAGE` (opcional) protege la página y el DO de recargas abusivas. Lógica pura en `logic.ts`.
 */
import { DurableObject } from 'cloudflare:workers';
import { alertFor, fmtUtc, judge, parseTargets, pickLang, renderPage, step, type Bucket, type CheckResult, type Incident, type Summary, type Target, type TargetState, type Transition } from './logic';

export interface Env {
  MONITOR: DurableObjectNamespace<MonitorDO>;
  /** JSON `[{ id, name, url }]` con las URLs de `/api/status` a vigilar. */
  TARGETS: string;
  /** Fallos seguidos para dar un destino por caído (2). */
  FAIL_THRESHOLD?: string;
  /** Tema privado de ntfy (`wrangler secret put NTFY_TOPIC`). Sin él no se avisa. */
  NTFY_TOPIC?: string;
  /** Servidor de ntfy (por defecto https://ntfy.sh). */
  NTFY_URL?: string;
  /** URL pública de esta página (para el enlace de los avisos). */
  PAGE_URL?: string;
  /** Enlace «Ir a all-draw» de la página. */
  APP_URL?: string;
  /** Prefijo de los avisos (p. ej. `prueba local`), para distinguir pruebas. */
  MONITOR_LABEL?: string;
  /** Tiempo máximo de cada comprobación en ms (10000). */
  CHECK_TIMEOUT_MS?: string;
  RL_PAGE?: RateLimit;
}

const HOUR = 3_600_000, DAY = 24 * HOUR;
const KEEP_CHECKS_MS = 8 * DAY;
const KEEP_INCIDENTS_MS = 90 * DAY;
/** Un aviso que no sale en 3 horas se descarta (ya no sirve de nada). */
const OUTBOX_MAX_MS = 3 * HOUR;

type Alert = ReturnType<typeof alertFor>;
interface PendingAlert { id: number; created: number; attempts: number; alert: Alert }

export class MonitorDO extends DurableObject<Env> {
  private sql: SqlStorage;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS checks (ts INTEGER NOT NULL, target TEXT NOT NULL, ok INTEGER NOT NULL, status INTEGER NOT NULL, ms INTEGER NOT NULL, db_ok INTEGER, error TEXT);
      CREATE INDEX IF NOT EXISTS checks_target_ts ON checks(target, ts);
      CREATE TABLE IF NOT EXISTS state (target TEXT PRIMARY KEY, fails INTEGER NOT NULL, down INTEGER NOT NULL, since INTEGER);
      CREATE TABLE IF NOT EXISTS incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, started INTEGER NOT NULL, ended INTEGER, reason TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS incidents_started ON incidents(started);
      CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER NOT NULL, alert TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0);
    `);
  }

  /** Mete avisos en la bandeja de salida y devuelve todos los pendientes (los nuevos y los que fallaron antes). */
  queueAlerts(alerts: Alert[], now: number): PendingAlert[] {
    for (const a of alerts) this.sql.exec('INSERT INTO outbox (created, alert) VALUES (?, ?)', now, JSON.stringify(a));
    return this.sql.exec<{ id: number; created: number; alert: string; attempts: number }>('SELECT id, created, alert, attempts FROM outbox ORDER BY id').toArray()
      .map(r => ({ id: r.id, created: r.created, attempts: r.attempts, alert: JSON.parse(r.alert) as Alert }));
  }

  /** Quita los entregados; a los demás les suma un intento y descarta los que llevan más de `OUTBOX_MAX_MS`. Devuelve los descartados. */
  settleAlerts(delivered: number[], failed: number[], now: number): number {
    for (const id of delivered) this.sql.exec('DELETE FROM outbox WHERE id = ?', id);
    for (const id of failed) this.sql.exec('UPDATE outbox SET attempts = attempts + 1 WHERE id = ?', id);
    return this.sql.exec('DELETE FROM outbox WHERE created < ?', now - OUTBOX_MAX_MS).rowsWritten;
  }

  /** Guarda las comprobaciones, actualiza el estado y los incidentes; devuelve las transiciones (para avisar). */
  record(results: CheckResult[], threshold: number): Transition[] {
    const out: Transition[] = [];
    this.ctx.storage.transactionSync(() => {
      for (const r of results) {
        this.sql.exec('INSERT INTO checks (ts, target, ok, status, ms, db_ok, error) VALUES (?, ?, ?, ?, ?, ?, ?)', r.ts, r.target, r.ok ? 1 : 0, r.status, r.ms, r.dbOk === null ? null : r.dbOk ? 1 : 0, r.error);
        const row = this.sql.exec<{ fails: number; down: number; since: number | null }>('SELECT fails, down, since FROM state WHERE target = ?', r.target).toArray()[0];
        const prev: TargetState = row ? { fails: row.fails, down: !!row.down, since: row.since } : { fails: 0, down: false, since: null };
        const { state, transition } = step(prev, r, threshold);
        this.sql.exec('INSERT INTO state (target, fails, down, since) VALUES (?, ?, ?, ?) ON CONFLICT(target) DO UPDATE SET fails = excluded.fails, down = excluded.down, since = excluded.since', r.target, state.fails, state.down ? 1 : 0, state.since);
        if (transition?.kind === 'down') this.sql.exec('INSERT INTO incidents (target, started, reason) VALUES (?, ?, ?)', r.target, transition.since, transition.error);
        if (transition?.kind === 'up') this.sql.exec('UPDATE incidents SET ended = ? WHERE target = ? AND ended IS NULL', r.ts, r.target);
        if (transition) out.push(transition);
      }
      const now = results[0]?.ts ?? Date.now();
      this.sql.exec('DELETE FROM checks WHERE ts < ?', now - KEEP_CHECKS_MS);
      this.sql.exec('DELETE FROM incidents WHERE ended IS NOT NULL AND ended < ?', now - KEEP_INCIDENTS_MS);
    });
    return out;
  }

  summary(targets: Target[], now = Date.now()): Summary {
    const uptime = (id: string, since: number) => {
      const r = this.sql.exec<{ n: number; ok: number | null }>('SELECT COUNT(*) AS n, SUM(ok) AS ok FROM checks WHERE target = ? AND ts >= ?', id, since).one();
      return r.n ? Number(r.ok ?? 0) / r.n : null;
    };
    const firstHour = Math.floor(now / HOUR) * HOUR - 23 * HOUR;
    return {
      generatedAt: now,
      targets: targets.map(t => {
        const last = this.sql.exec<{ ts: number; ok: number; status: number; ms: number; error: string | null }>('SELECT ts, ok, status, ms, error FROM checks WHERE target = ? ORDER BY ts DESC LIMIT 1', t.id).toArray()[0];
        const st = this.sql.exec<{ down: number }>('SELECT down FROM state WHERE target = ?', t.id).toArray()[0];
        const avg = this.sql.exec<{ ms: number | null }>('SELECT AVG(ms) AS ms FROM checks WHERE target = ? AND ok = 1 AND ts >= ?', t.id, now - DAY).one().ms;
        const byHour = new Map(this.sql.exec<{ h: number; n: number; ok: number }>('SELECT (ts / 3600000) AS h, COUNT(*) AS n, SUM(ok) AS ok FROM checks WHERE target = ? AND ts >= ? GROUP BY h', t.id, firstHour).toArray().map(r => [Number(r.h), r]));
        const hours: Bucket[] = Array.from({ length: 24 }, (_, i) => {
          const from = firstHour + i * HOUR, b = byHour.get(from / HOUR);
          return { from, total: b ? Number(b.n) : 0, ok: b ? Number(b.ok) : 0 };
        });
        return {
          target: t, down: !!st?.down,
          last: last ? { ts: last.ts, ok: !!last.ok, status: last.status, ms: last.ms, error: last.error } : null,
          uptime24h: uptime(t.id, now - DAY), uptime7d: uptime(t.id, now - 7 * DAY), avgMs24h: avg === null ? null : Number(avg), hours,
        };
      }),
      incidents: this.sql.exec<{ target: string; started: number; ended: number | null; reason: string }>('SELECT target, started, ended, reason FROM incidents ORDER BY started DESC LIMIT 20').toArray()
        .map((i): Incident => ({ target: i.target, started: i.started, ended: i.ended, reason: i.reason })),
    };
  }
}

/** Comprueba un destino: `GET` con tiempo límite; latencia hasta tener el cuerpo. */
export async function checkTarget(t: Target, timeoutMs: number, fetcher: typeof fetch = fetch): Promise<CheckResult> {
  const ts = Date.now(), t0 = performance.now();
  try {
    const res = await fetcher(t.url, { headers: { 'user-agent': 'all-draw-monitor/1 (+https://github.com/darwinva97/all-draw)', accept: 'application/json', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    const body = await res.json().catch(() => null);
    const ms = Math.round(performance.now() - t0);
    return { target: t.id, ts, ms, status: res.status, ...judge(res.status, body) };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    // workerd da «internal error; reference = …» cuando no resuelve el nombre o no conecta.
    const error = name === 'TimeoutError' || name === 'AbortError' ? `sin respuesta en ${Math.round(timeoutMs / 1000)} s` : /internal error/i.test(msg) ? 'error de red (DNS o conexión)' : `error de red: ${msg}`.slice(0, 200);
    return { target: t.id, ts, ms, status: 0, ok: false, dbOk: null, error };
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Manda un aviso a ntfy con hasta 3 intentos (0, 2 y 6 s) si responde 429/5xx o falla la red. `true` si salió. */
async function sendAlert(env: Env, p: PendingAlert, now: number): Promise<boolean> {
  if (!env.NTFY_TOPIC) { console.log(JSON.stringify({ level: 'warn', msg: 'sin NTFY_TOPIC: aviso no enviado', title: p.alert.title })); return true; }
  const late = now - p.created > 4 * 60_000 ? `\n(aviso con retraso: se generó a las ${fmtUtc(p.created)})` : '';
  let status = 0;
  for (const wait of [0, 2000, 6000]) {
    if (wait) await sleep(wait);
    try {
      const res = await fetch((env.NTFY_URL || 'https://ntfy.sh').replace(/\/$/, ''), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topic: env.NTFY_TOPIC, ...p.alert, message: p.alert.message + late }),
      });
      status = res.status;
      if (res.ok) break;
      if (status !== 429 && status < 500) break; // 4xx distinto de 429: reintentar no arregla nada
    } catch { status = 0; }
  }
  const ok = status >= 200 && status < 300;
  console.log(JSON.stringify({ level: ok ? 'info' : 'error', msg: 'aviso ntfy', title: p.alert.title, status, attempts: p.attempts + 1 }));
  return ok;
}

const monitor = (env: Env) => env.MONITOR.get(env.MONITOR.idFromName('monitor'));

export async function runChecks(env: Env): Promise<{ results: CheckResult[]; transitions: Transition[] }> {
  const targets = parseTargets(env.TARGETS);
  const timeout = Number(env.CHECK_TIMEOUT_MS) || 10_000;
  const results = await Promise.all(targets.map(t => checkTarget(t, timeout)));
  const stub = monitor(env);
  const transitions = await stub.record(results, Math.max(1, Number(env.FAIL_THRESHOLD) || 2));
  const now = Date.now();
  const pending = await stub.queueAlerts(transitions.map(tr => alertFor(tr, targets.find(t => t.id === tr.target)!, env.PAGE_URL || null, env.MONITOR_LABEL || '')), now);
  const delivered: number[] = [], failed: number[] = [];
  for (const p of pending) ((await sendAlert(env, p, now)) ? delivered : failed).push(p.id);
  if (pending.length) {
    const dropped = await stub.settleAlerts(delivered, failed, now);
    if (dropped) console.log(JSON.stringify({ level: 'error', msg: 'avisos descartados tras 3 horas sin poder enviarlos', dropped }));
  }
  console.log(JSON.stringify({ level: 'info', msg: 'comprobación', results: results.map(r => ({ t: r.target, ok: r.ok, status: r.status, ms: r.ms, ...(r.error ? { error: r.error } : {}) })), transitions: transitions.map(t => `${t.target}:${t.kind}`) }));
  return { results, transitions };
}

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=31536000',
};

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runChecks(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('usa GET', { status: 405, headers: { allow: 'GET, HEAD' } });
    if (url.pathname === '/healthz') return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (url.pathname !== '/' && url.pathname !== '/api/status.json') return new Response('no existe', { status: 404, headers: SECURITY_HEADERS });
    const ip = request.headers.get('cf-connecting-ip');
    if (env.RL_PAGE && ip) {
      const { success } = await env.RL_PAGE.limit({ key: `page:${ip}` }).catch(() => ({ success: true }));
      if (!success) return new Response('Demasiadas peticiones; espera un minuto', { status: 429, headers: { 'retry-after': '60', ...SECURITY_HEADERS } });
    }
    const summary = await monitor(env).summary(parseTargets(env.TARGETS));
    const cache = { 'cache-control': 'public, max-age=30' };
    if (url.pathname === '/api/status.json') return Response.json(summary, { headers: { ...cache, 'access-control-allow-origin': '*', ...SECURITY_HEADERS } });
    const html = renderPage(summary, pickLang(request.headers.get('accept-language')), env.APP_URL || 'https://alldraw.bezenti.com');
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', ...cache, ...SECURITY_HEADERS } });
  },
} satisfies ExportedHandler<Env>;
