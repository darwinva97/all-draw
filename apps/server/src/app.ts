/**
 * Compone el `http.Server`: API Hono bajo `/api` y `/healthz`, estáticos de la app web con
 * fallback SPA para el resto, y WebSocket Yjs en `/ws/<workspaceId>?token=…` sobre el mismo servidor.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { createApi } from './api';
import { SAFE_ID, authorizeConnection, credentialsFromRequest, isTrustedOrigin, makeHasher, requestHost, securityHeaders } from './auth';
import type { Config } from './config';
import { DocManager, LocalDocHost } from './docs';
import type { Role, WorkspaceStore } from './store/types';
import { setupConnection } from './ysync';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain' };

export interface App {
  server: http.Server;
  docs: DocManager;
  /** Cierra WebSockets, guarda documentos y para el servidor. */
  close(): Promise<void>;
}

export function createApp(config: Config, store: WorkspaceStore): App {
  const hash = makeHasher(config.sessionSecret);
  const docs = new DocManager(store);
  const api = createApi({ store, docs: new LocalDocHost(docs), hash, config });
  const apiListener = getRequestListener(api.fetch);
  const staticDir = path.resolve(config.staticDir);
  const isHttps = (req: http.IncomingMessage) => config.cookieSecure || req.headers['x-forwarded-proto'] === 'https';
  const headersOf = (req: http.IncomingMessage) => ({ get: (n: string) => { const v = req.headers[n.toLowerCase()]; return (Array.isArray(v) ? v[0] : v) ?? null; } });
  const secHeaders = (req: http.IncomingMessage) => securityHeaders({ https: isHttps(req), host: requestHost(headersOf(req), new URL(req.url ?? '/', 'http://x')) });

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

  const server = http.createServer((req, res) => {
    const u = req.url ?? '/';
    if (u === '/healthz' || u.startsWith('/api/') || u === '/api') {
      for (const [k, v] of Object.entries(secHeaders(req))) res.setHeader(k, v);
      return apiListener(req, res);
    }
    return serveStatic(req, res);
  });

  // Sesiones caducadas: limpieza periódica (además de la oportunista en cada login).
  const purge = setInterval(() => { void store.purgeExpiredSessions().catch(e => console.error('purga de sesiones', e)); }, 60 * 60_000);
  purge.unref();

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/ws/')) return socket.destroy();
    const id = url.pathname.slice(4);
    // Identidad y doc se resuelven ANTES de aceptar el socket: el cliente manda su sync step1 nada
    // más abrirse y, si el listener de `message` se registrara tras un `await`, ese mensaje se perdería.
    void (async () => {
      let outcome: { live: Awaited<ReturnType<DocManager['get']>>; role: Role } | { close: number; reason: string };
      try {
        if (!SAFE_ID.test(id)) outcome = { close: 4400, reason: 'id no válido' };
        else {
          const headers = headersOf(req);
          const cred = credentialsFromRequest(headers, url);
          // Con cookie, el WebSocket sólo se acepta desde el propio origen (el navegador manda la cookie desde cualquier web).
          if (cred.source === 'cookie' && headers.get('origin') && !isTrustedOrigin(headers, url)) outcome = { close: 4403, reason: 'origen no permitido' };
          else {
            const auth = await authorizeConnection({ store, hash }, cred.token, id);
            outcome = 'close' in auth ? auth : { live: await docs.get(id), role: auth.role };
          }
        }
      } catch (e) { console.error('ws', e); outcome = { close: 1011, reason: 'error' }; }
      if (socket.destroyed) return;
      wss.handleUpgrade(req, socket, head, ws => {
        if ('close' in outcome) return ws.close(outcome.close, outcome.reason);
        setupConnection(ws, outcome.live, outcome.role);
      });
    })();
  });

  return {
    server, docs,
    async close() {
      clearInterval(purge);
      await docs.closeAll();
      for (const c of wss.clients) c.terminate();
      await new Promise<void>(r => server.close(() => r()));
    },
  };
}
