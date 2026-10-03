/**
 * Compone el `http.Server`: API Hono bajo `/api` y `/healthz`, estáticos de la app web con
 * fallback SPA para el resto, y WebSocket Yjs en `/ws/<workspaceId>?token=…` sobre el mismo servidor.
 *
 * Además (producción): log de accesos JSON (una línea por petición), `/metrics` (Prometheus, sólo local o
 * con `METRICS_TOKEN`), `/.well-known/security.txt`, límites de WebSocket por IP y por espacio, timeouts
 * de cabeceras y cuerpos, y cierre ordenado (`close()`: deja de aceptar, cierra los sockets con 1012,
 * guarda los docs vivos).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createApi } from './api';
import { archiveWriter } from './archive';
import {
  SAFE_ID, SECURITY_TXT_PATH, authorizeConnection, credentialsFromRequest, isTrustedOrigin, jsonLogger, makeHasher, redactPath, requestHost, safeEqualString,
  securityHeaders, securityTxt, truncateIp, type BuildInfo, type ConnIdentity, type Logger, type Principal,
} from './auth';
import { buildInfo } from './build';
import type { Config } from './config';
import { DocManager, LocalDocHost } from './docs';
import { Metrics } from './metrics';
import type { Role, WorkspaceStore } from './store/types';
import { setupConnection } from './ysync';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain' };

/** Timeouts del `http.Server` (las conexiones WebSocket, una vez aceptadas, no los heredan: `ws` pone el socket sin timeout). */
export const HTTP_TIMEOUTS = { headersTimeout: 15_000, requestTimeout: 60_000, keepAliveTimeout: 10_000 };
/** Código de cierre de WebSocket al apagar (RFC 6455 «service restart»): y-websocket reconecta solo. */
export const WS_RESTART = 1012;
/** Cierre por límite de conexiones (por IP o por espacio). */
export const WS_TOO_MANY = 4429;

export interface App {
  server: http.Server;
  docs: DocManager;
  metrics: Metrics;
  logger: Logger;
  /** Deja de aceptar, cierra WebSockets (1012), guarda los documentos y para el servidor. */
  close(): Promise<void>;
}

export interface AppOptions {
  logger?: Logger;
  build?: BuildInfo;
}

type SizedStore = WorkspaceStore & { dbSizeBytes?: () => number | Promise<number> };

export function createApp(config: Config, store: WorkspaceStore, opts: AppOptions = {}): App {
  const metrics = new Metrics();
  const base = opts.logger ?? jsonLogger({ level: config.logLevel, write: line => process.stdout.write(line + '\n') });
  // Cuenta los informes de errores del cliente para `/metrics` sin acoplar la API a las métricas.
  const log: Logger['log'] = (l, m, f) => { if (m === 'client-error') metrics.clientErrors++; base.log(l, m, f); };
  const logger: Logger = { level: base.level, log, debug: (m, f) => log('debug', m, f), info: (m, f) => log('info', m, f), warn: (m, f) => log('warn', m, f), error: (m, f) => log('error', m, f) };
  const dbKind = typeof (store as SizedStore).dbSizeBytes === 'function' ? (config.databaseUrl ? 'postgres' : 'sqlite') : 'memory';
  const build = opts.build ?? buildInfo(dbKind);

  const hash = makeHasher(config.sessionSecret);
  const docs = new DocManager(store, { maxDocBytes: config.maxDocBytes });
  /** Identidad de cada petición (la resuelve la API) para el log de accesos. */
  const who = new WeakMap<http.IncomingMessage, string>();
  const userLabel = (p: Principal | null) => (p ? (p.kind === 'user' ? p.user.id : 'link') : 'anon');
  const api = createApi({
    store, docs: new LocalDocHost(docs), hash, config, logger, build,
    archiveWorkspace: archiveWriter(config.backupDir),
    onIdentity: (c, p) => { const inc = (c.env as { incoming?: http.IncomingMessage } | undefined)?.incoming; if (inc) who.set(inc, userLabel(p)); },
  });
  const apiListener = getRequestListener(api.fetch);
  const staticDir = path.resolve(config.staticDir);
  const isHttps = (req: http.IncomingMessage) => config.cookieSecure || req.headers['x-forwarded-proto'] === 'https';
  const headersOf = (req: http.IncomingMessage) => ({ get: (n: string) => { const v = req.headers[n.toLowerCase()]; return (Array.isArray(v) ? v[0] : v) ?? null; } });
  const hostOf = (req: http.IncomingMessage) => requestHost(headersOf(req), new URL(req.url ?? '/', 'http://x'));
  const secHeaders = (req: http.IncomingMessage) => securityHeaders({ https: isHttps(req), host: hostOf(req) });
  /** IP del cliente: la primera de `x-forwarded-for` (Caddy la pone) o la del socket. */
  const ipOf = (req: http.IncomingMessage) => headersOf(req).get('x-forwarded-for')?.split(',')[0]?.trim() || headersOf(req).get('x-real-ip') || req.socket.remoteAddress || 'unknown';
  /** Petición local de verdad: desde loopback y sin cabeceras de proxy (Caddy también conecta desde 127.0.0.1). */
  const isLocal = (req: http.IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') && !req.headers['x-forwarded-for'] && !req.headers['x-real-ip'];
  const publicBase = (req: http.IncomingMessage) => config.publicUrl ?? `${isHttps(req) ? 'https' : 'http'}://${hostOf(req)}`;

  const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let p: string;
    try { p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''); } catch { res.writeHead(400); return res.end(); }
    let file = path.join(staticDir, p);
    if (!file.startsWith(staticDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('sin app web compilada (STATIC_DIR)'); }
    const immutable = /\/assets\//.test(file);
    res.writeHead(200, { ...secHeaders(req), 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  };

  const gauges = async () => {
    let dbBytes = 0;
    try { dbBytes = Number(await (store as SizedStore).dbSizeBytes?.()) || 0; } catch { /* sin dato */ }
    const mem = process.memoryUsage();
    return [
      { name: 'alldraw_docs_live', help: 'Documentos Yjs abiertos en memoria.', value: docs.size },
      { name: 'alldraw_ws_connections', help: 'Conexiones WebSocket abiertas.', value: wss.clients.size },
      { name: 'alldraw_db_size_bytes', help: 'Tamaño de la base de datos (SQLite: fichero + WAL; Postgres: pg_database_size).', value: dbBytes },
      { name: 'alldraw_uptime_seconds', help: 'Segundos desde el arranque.', value: Math.round(process.uptime()) },
      { name: 'alldraw_process_resident_memory_bytes', help: 'Memoria residente del proceso.', value: mem.rss },
      { name: 'alldraw_process_heap_used_bytes', help: 'Heap de V8 en uso.', value: mem.heapUsed },
      { name: 'alldraw_build_info', help: 'Versión y commit desplegados (valor siempre 1).', value: 1, labels: { version: build.version, commit: build.commit ?? 'unknown', db: build.db } },
    ];
  };

  const serveMetrics = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const auth = headersOf(req).get('authorization');
    const byToken = !!config.metricsToken && !!auth?.toLowerCase().startsWith('bearer ') && safeEqualString(auth.slice(7).trim(), config.metricsToken);
    if (!isLocal(req) && !byToken) { res.writeHead(403, { 'content-type': 'text/plain' }); return res.end('sólo desde 127.0.0.1 o con METRICS_TOKEN\n'); }
    const body = metrics.render(await gauges());
    res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  };

  const server = http.createServer((req, res) => {
    const t0 = performance.now();
    const u = req.url ?? '/';
    res.on('close', () => {
      const ms = Math.round((performance.now() - t0) * 10) / 10;
      const status = res.statusCode;
      metrics.observe(req.method ?? 'GET', u, status, ms);
      const quiet = u === '/healthz' || u === '/metrics';
      logger.log(status >= 500 ? 'error' : quiet ? 'debug' : 'info', 'http', {
        method: req.method, path: redactPath(u), status, ms, user: who.get(req) ?? 'anon', ip: truncateIp(ipOf(req)),
        ...(res.writableFinished ? {} : { aborted: true }),
      });
    });
    if (u === '/metrics') { void serveMetrics(req, res).catch(e => { logger.error('metrics', { err: e }); if (!res.headersSent) res.writeHead(500); res.end(); }); return; }
    if (u === SECURITY_TXT_PATH) {
      res.writeHead(200, { ...secHeaders(req), 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' });
      return res.end(securityTxt(publicBase(req)));
    }
    if (u === '/healthz' || u.startsWith('/api/') || u === '/api') {
      for (const [k, v] of Object.entries(secHeaders(req))) res.setHeader(k, v);
      return apiListener(req, res);
    }
    return serveStatic(req, res);
  });
  server.headersTimeout = HTTP_TIMEOUTS.headersTimeout;
  server.requestTimeout = HTTP_TIMEOUTS.requestTimeout;
  server.keepAliveTimeout = HTTP_TIMEOUTS.keepAliveTimeout;
  server.maxHeadersCount = 100;

  // Sesiones caducadas: limpieza periódica (además de la oportunista en cada login).
  const purge = setInterval(() => { void store.purgeExpiredSessions().catch(e => logger.error('purga de sesiones', { err: e })); }, 60 * 60_000);
  purge.unref();

  let draining = false;
  const perIp = new Map<string, number>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/ws/')) return socket.destroy();
    const id = url.pathname.slice(4);
    const ip = ipOf(req);
    // Identidad y doc se resuelven ANTES de aceptar el socket: el cliente manda su sync step1 nada
    // más abrirse y, si el listener de `message` se registrara tras un `await`, ese mensaje se perdería.
    void (async () => {
      let outcome: { live: Awaited<ReturnType<DocManager['get']>>; role: Role; identity: ConnIdentity } | { close: number; reason: string; metric: string };
      try {
        if (draining) outcome = { close: WS_RESTART, reason: 'servidor reiniciando', metric: 'shutdown' };
        else if (!SAFE_ID.test(id)) outcome = { close: 4400, reason: 'id no válido', metric: 'bad_id' };
        else if (config.maxWsPerIp > 0 && (perIp.get(ip) ?? 0) >= config.maxWsPerIp) outcome = { close: WS_TOO_MANY, reason: 'demasiadas conexiones desde esta dirección', metric: 'per_ip' };
        else {
          const headers = headersOf(req);
          const cred = credentialsFromRequest(headers, url);
          // Con cookie, el WebSocket sólo se acepta desde el propio origen (el navegador manda la cookie desde cualquier web).
          if (cred.source === 'cookie' && headers.get('origin') && !isTrustedOrigin(headers, url)) outcome = { close: 4403, reason: 'origen no permitido', metric: 'origin' };
          else {
            const auth = await authorizeConnection({ store, hash }, cred.token, id);
            if ('close' in auth) outcome = { ...auth, metric: auth.close === 4404 ? 'not_found' : 'unauthorized' };
            else {
              const live = await docs.get(id);
              outcome = config.maxWsPerWorkspace > 0 && live.conns.size >= config.maxWsPerWorkspace
                ? { close: WS_TOO_MANY, reason: 'demasiadas conexiones a este espacio', metric: 'per_workspace' }
                : { live, role: auth.role, identity: auth.identity };
            }
          }
        }
      } catch (e) { logger.error('ws', { err: e, path: redactPath(req.url ?? '') }); outcome = { close: 1011, reason: 'error', metric: 'error' }; }
      if (socket.destroyed) return;
      wss.handleUpgrade(req, socket, head, ws => {
        if ('close' in outcome) {
          metrics.wsRejection(outcome.metric);
          logger.log(outcome.metric === 'error' ? 'error' : 'info', 'ws rechazado', { code: outcome.close, reason: outcome.metric, path: redactPath(req.url ?? ''), ip: truncateIp(ip) });
          return ws.close(outcome.close, outcome.reason);
        }
        perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
        ws.once('close', () => { const n = (perIp.get(ip) ?? 1) - 1; if (n <= 0) perIp.delete(ip); else perIp.set(ip, n); });
        setupConnection(ws, outcome.live, outcome.role, outcome.identity);
      });
    })();
  });

  return {
    server, docs, metrics, logger,
    async close() {
      if (draining) return;
      draining = true;
      clearInterval(purge);
      // 1. No más conexiones nuevas (las ya abiertas siguen hasta acabar o hasta el timeout).
      const closed = new Promise<void>(r => server.close(() => r()));
      // 2. Clientes WebSocket: cierre 1012 (reconectarán contra el proceso nuevo) y docs guardados.
      await docs.closeAll(WS_RESTART, 'servidor reiniciando');
      for (const c of wss.clients) c.close(WS_RESTART, 'servidor reiniciando');
      for (let i = 0; i < 25 && wss.clients.size > 0; i++) await new Promise(r => setTimeout(r, 20));
      for (const c of wss.clients) c.terminate();
      // 3. HTTP: corta las keep-alive ociosas y, si alguna petición se eterniza, todas a los 3 s.
      server.closeIdleConnections();
      const force = setTimeout(() => server.closeAllConnections(), 3000);
      await closed;
      clearTimeout(force);
    },
  };
}
