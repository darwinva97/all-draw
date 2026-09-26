/**
 * Servidor mínimo de all-draw: sirve la app compilada (apps/web/dist) y sincroniza documentos Yjs
 * por WebSocket en /ws/<sala>, guardándolos en disco (un fichero de update por sala).
 * Agnóstico de despliegue: Node en VPS hoy; el mismo protocolo (y-websocket) vale para un Durable Object.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupConnection, setPersistence } from './ysync.mjs';

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4002);
const DATA = process.env.DATA_DIR ?? path.resolve(process.env.HOME ?? '.', '.alldraw-data');
const STATIC = process.env.STATIC_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
fs.mkdirSync(DATA, { recursive: true });

const safe = (name) => /^[A-Za-z0-9_\-:.]{1,120}$/.test(name);
const fileOf = (name) => path.join(DATA, `${name}.yupdate`);
const timers = new Map();

setPersistence({
  bindState: (docName, ydoc) => {
    if (!safe(docName)) return;
    const f = fileOf(docName);
    if (fs.existsSync(f)) { try { Y.applyUpdate(ydoc, fs.readFileSync(f)); } catch (e) { console.error('no se pudo cargar', docName, e); } }
    ydoc.on('update', () => {
      clearTimeout(timers.get(docName));
      timers.set(docName, setTimeout(() => fs.writeFile(f, Y.encodeStateAsUpdate(ydoc), () => {}), 500));
    });
  },
  writeState: async (docName, ydoc) => { if (safe(docName)) fs.writeFileSync(fileOf(docName), Y.encodeStateAsUpdate(ydoc)); },
});

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(STATIC, p);
  if (!file.startsWith(STATIC)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC, 'index.html');
  const ext = path.extname(file);
  const immutable = /\/assets\//.test(file);
  res.writeHead(200, { 'content-type': MIME[ext] ?? 'application/octet-stream', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });
wss.on('connection', (ws, req) => {
  const room = (req.url ?? '').replace(/^\/ws\//, '').split('?')[0];
  if (!safe(room)) return ws.close(1008, 'sala no válida');
  setupConnection(ws, room);
});
server.on('upgrade', (req, socket, head) => {
  if (!(req.url ?? '').startsWith('/ws/')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

server.listen(PORT, HOST, () => console.log(`all-draw en http://${HOST}:${PORT} · datos en ${DATA} · estáticos en ${STATIC}`));
