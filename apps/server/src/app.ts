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
import { makeHasher, resolveToken, roleFor, tokenFromRequest } from './auth';
import type { Config } from './config';
import { DocManager } from './docs';
import type { WorkspaceStore } from './store/types';
import { setupConnection } from './ysync';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain' };
const SAFE_ID = /^[A-Za-z0-9_\-:.]{1,120}$/;

export interface App {
  server: http.Server;
  docs: DocManager;
  /** Cierra WebSockets, guarda documentos y para el servidor. */
  close(): Promise<void>;
}

export function createApp(config: Config, store: WorkspaceStore): App {
  const hash = makeHasher(config.sessionSecret);
  const docs = new DocManager(store);
  const api = createApi({ store, docs, hash, config });
  const apiListener = getRequestListener(api.fetch);
  const staticDir = path.resolve(config.staticDir);

  const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let p: string;
    try { p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''); } catch { res.writeHead(400); return res.end(); }
    let file = path.join(staticDir, p);
    if (!file.startsWith(staticDir)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(staticDir, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('sin app web compilada (STATIC_DIR)'); }
    const immutable = /\/assets\//.test(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  };

  const server = http.createServer((req, res) => {
    const u = req.url ?? '/';
    if (u === '/healthz' || u.startsWith('/api/') || u === '/api') return apiListener(req, res);
    return serveStatic(req, res);
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/ws/')) return socket.destroy();
    const id = url.pathname.slice(4);
    wss.handleUpgrade(req, socket, head, async ws => {
      try {
        if (!SAFE_ID.test(id)) return ws.close(4400, 'id no válido');
        const headers = { get: (n: string) => (req.headers[n.toLowerCase()] as string | undefined) ?? null };
        const principal = await resolveToken({ store, hash }, tokenFromRequest(headers, url));
        if (!(await store.getWorkspace(id))) return ws.close(4404, 'el espacio no existe');
        const role = await roleFor(store, principal, id);
        if (!role) return ws.close(4401, 'sin permiso');
        const live = await docs.get(id);
        setupConnection(ws, live, role);
      } catch (e) { console.error('ws', e); try { ws.close(1011, 'error'); } catch { /* nada */ } }
    });
  });

  return {
    server, docs,
    async close() {
      await docs.closeAll();
      for (const c of wss.clients) c.terminate();
      await new Promise<void>(r => server.close(() => r()));
    },
  };
}
