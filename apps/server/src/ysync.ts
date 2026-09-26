/**
 * Protocolo y-websocket sobre `ws`, con roles: un `viewer` recibe todo pero sus cambios se
 * descartan; se le contesta con un mensaje de autorización (tipo 2, `permissionDenied`) cuya
 * razón es `{"error":"read-only"}` — el cliente y-websocket lo registra como aviso y la interfaz
 * puede leerlo del `provider`.
 */
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { WebSocket } from 'ws';
import type { LiveDoc } from './docs';
import type { Role } from './store/types';

export const MSG_SYNC = 0, MSG_AWARENESS = 1, MSG_AUTH = 2;
const PING_MS = 30_000;
export const READ_ONLY_REASON = JSON.stringify({ error: 'read-only' });

function send(live: LiveDoc, conn: WebSocket, buf: Uint8Array) {
  if (conn.readyState !== conn.CONNECTING && conn.readyState !== conn.OPEN) return closeConn(live, conn);
  try { conn.send(buf, err => { if (err) closeConn(live, conn); }); } catch { closeConn(live, conn); }
}

function closeConn(live: LiveDoc, conn: WebSocket) {
  const ids = live.conns.get(conn);
  if (ids) {
    live.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(live.awareness, [...ids], null);
    live.touch();
  }
  try { conn.close(); } catch { /* ya cerrada */ }
}

/** Difusores por doc (se instalan una vez). */
const wired = new WeakSet<LiveDoc>();
function wire(live: LiveDoc) {
  if (wired.has(live)) return;
  wired.add(live);
  live.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    const changed = added.concat(updated, removed);
    if (origin && typeof origin === 'object') { const ids = live.conns.get(origin); if (ids) { for (const c of added) ids.add(c); for (const c of removed) ids.delete(c); } }
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_AWARENESS);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(live.awareness, changed));
    const buf = encoding.toUint8Array(enc);
    for (const c of live.conns.keys()) send(live, c as WebSocket, buf);
  });
  live.doc.on('update', (update: Uint8Array, origin: unknown) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeUpdate(enc, update);
    const buf = encoding.toUint8Array(enc);
    for (const c of live.conns.keys()) if (c !== origin) send(live, c as WebSocket, buf);
  });
}

/** ¿El update trae algo (estructuras o borrados)? Los step2 vacíos del handshake no cuentan. */
function hasContent(update: Uint8Array): boolean {
  try { const d = Y.decodeUpdate(update); return d.structs.length > 0 || d.ds.clients.size > 0; } catch { return true; }
}

function readOnlyMessage(): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_AUTH);
  encoding.writeVarUint(enc, 0); // permissionDenied
  encoding.writeVarString(enc, READ_ONLY_REASON);
  return encoding.toUint8Array(enc);
}

export function setupConnection(conn: WebSocket, live: LiveDoc, role: Role): void {
  wire(live);
  conn.binaryType = 'arraybuffer';
  live.conns.set(conn, new Set());
  const canWrite = role !== 'viewer';

  conn.on('message', (data: ArrayBuffer | Buffer) => {
    try {
      const dec = decoding.createDecoder(new Uint8Array(data as ArrayBuffer));
      const enc = encoding.createEncoder();
      switch (decoding.readVarUint(dec)) {
        case MSG_SYNC: {
          encoding.writeVarUint(enc, MSG_SYNC);
          if (canWrite) {
            syncProtocol.readSyncMessage(dec, enc, live.doc, conn);
          } else {
            const t = decoding.readVarUint(dec);
            if (t === syncProtocol.messageYjsSyncStep1) syncProtocol.readSyncStep1(dec, enc, live.doc);
            else { // step2 o update: se descarta
              const update = decoding.readVarUint8Array(dec);
              if (hasContent(update)) send(live, conn, readOnlyMessage());
            }
          }
          if (encoding.length(enc) > 1) send(live, conn, encoding.toUint8Array(enc));
          break;
        }
        case MSG_AWARENESS:
          awarenessProtocol.applyAwarenessUpdate(live.awareness, decoding.readVarUint8Array(dec), conn);
          break;
      }
    } catch (e) { console.error('ws mensaje inválido', e); }
  });

  let alive = true;
  const ping = setInterval(() => {
    if (!alive) { closeConn(live, conn); clearInterval(ping); return; }
    if (!live.conns.has(conn)) { clearInterval(ping); return; }
    alive = false;
    try { conn.ping(); } catch { closeConn(live, conn); }
  }, PING_MS);
  conn.on('pong', () => { alive = true; });
  conn.on('close', () => { closeConn(live, conn); clearInterval(ping); });
  conn.on('error', () => { closeConn(live, conn); clearInterval(ping); });

  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_SYNC);
  syncProtocol.writeSyncStep1(enc, live.doc);
  send(live, conn, encoding.toUint8Array(enc));
  const states = live.awareness.getStates();
  if (states.size > 0) {
    const e2 = encoding.createEncoder();
    encoding.writeVarUint(e2, MSG_AWARENESS);
    encoding.writeVarUint8Array(e2, awarenessProtocol.encodeAwarenessUpdate(live.awareness, [...states.keys()]));
    send(live, conn, encoding.toUint8Array(e2));
  }
}
