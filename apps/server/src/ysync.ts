/**
 * Adaptador del protocolo y-websocket (`@all-draw/server-core/ysync`) a la librería `ws` de Node:
 * envuelve el socket como `SyncSocket`, entrega los eventos y mantiene el ping/pong de keepalive.
 */
import type { WebSocket } from 'ws';
import { attachConnection, closeConn, type ConnIdentity, type LiveDoc, type Role, type SyncSocket } from '@all-draw/server-core';

export { MSG_AUTH, MSG_AWARENESS, MSG_SYNC, READ_ONLY_REASON } from '@all-draw/server-core';
const PING_MS = 30_000;

/** `identity` (usuario o enlace con el que entró) permite cerrarla al revocar ese acceso (`LocalDocHost.revoke`). */
export function setupConnection(ws: WebSocket, live: LiveDoc, role: Role, identity?: ConnIdentity): SyncSocket {
  ws.binaryType = 'arraybuffer';
  const conn: SyncSocket = {
    ...(identity ? { identity } : {}),
    isOpen: () => ws.readyState === ws.CONNECTING || ws.readyState === ws.OPEN,
    send: buf => ws.send(buf, err => { if (err) closeConn(live, conn); }),
    close: (code, reason) => { try { ws.close(code, reason); } catch { /* ya cerrada */ } },
  };
  const h = attachConnection(conn, live, role);
  ws.on('message', (data: ArrayBuffer | Buffer) => h.onMessage(new Uint8Array(data as ArrayBuffer)));

  let alive = true;
  const ping = setInterval(() => {
    if (!alive) { closeConn(live, conn); clearInterval(ping); return; }
    if (!live.conns.has(conn)) { clearInterval(ping); return; }
    alive = false;
    try { ws.ping(); } catch { closeConn(live, conn); }
  }, PING_MS);
  ws.on('pong', () => { alive = true; });
  ws.on('close', () => { h.onClose(); clearInterval(ping); });
  ws.on('error', () => { h.onClose(); clearInterval(ping); });
  return conn;
}
