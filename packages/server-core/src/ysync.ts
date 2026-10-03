/**
 * Protocolo y-websocket con roles, independiente de la implementación de WebSocket: la conexión
 * es un `SyncSocket` mínimo (`send`, `close`, `isOpen`) y el runtime entrega los eventos llamando
 * a `onMessage`/`onClose`. Lo usan `ws` en Node y `WebSocketPair` (con hibernación) en Cloudflare.
 *
 * Un `viewer` recibe todo pero sus cambios se descartan; se le contesta con un mensaje de
 * autorización (tipo 2, `permissionDenied`) cuya razón es `{"error":"read-only"}` — el cliente
 * y-websocket lo registra como aviso y la interfaz puede leerlo del `provider`.
 */
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import type { DocConnection, LiveDoc } from './docs';
import type { Role } from './store/types';

export const MSG_SYNC = 0, MSG_AWARENESS = 1, MSG_AUTH = 2;
export const READ_ONLY_REASON = JSON.stringify({ error: 'read-only' });
/** Razón del `permissionDenied` cuando un update se descarta porque el espacio llegó a `MAX_DOC_BYTES`. */
export const quotaReason = (limit: number) => JSON.stringify({ error: 'doc_too_large', limit });

export interface SyncSocket extends DocConnection {
  send(data: Uint8Array): void;
  isOpen(): boolean;
}

export interface SyncHandlers {
  onMessage(data: Uint8Array): void;
  onClose(): void;
}

function send(live: LiveDoc, conn: SyncSocket, buf: Uint8Array) {
  if (!conn.isOpen()) return closeConn(live, conn);
  try { conn.send(buf); } catch { closeConn(live, conn); }
}

export function closeConn(live: LiveDoc, conn: SyncSocket) {
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
    if (origin && typeof origin === 'object') { const ids = live.conns.get(origin as SyncSocket); if (ids) { for (const c of added) ids.add(c); for (const c of removed) ids.delete(c); } }
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_AWARENESS);
    encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(live.awareness, changed));
    const buf = encoding.toUint8Array(enc);
    for (const c of live.conns.keys()) send(live, c as SyncSocket, buf);
  });
  live.doc.on('update', (update: Uint8Array, origin: unknown) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeUpdate(enc, update);
    const buf = encoding.toUint8Array(enc);
    for (const c of live.conns.keys()) if (c !== origin) send(live, c as SyncSocket, buf);
  });
}

/** ¿El update trae algo (estructuras o borrados)? Los step2 vacíos del handshake no cuentan. */
function hasContent(update: Uint8Array): boolean {
  try { const d = Y.decodeUpdate(update); return d.structs.length > 0 || d.ds.clients.size > 0; } catch { return true; }
}

function deniedMessage(reason: string): Uint8Array {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_AUTH);
  encoding.writeVarUint(enc, 0); // permissionDenied
  encoding.writeVarString(enc, reason);
  return encoding.toUint8Array(enc);
}

/**
 * Mensaje de sync recibido (ya sin el byte de tipo); devuelve la respuesta (vacía si no hay).
 * Los updates (step2 o update) se aplican sólo si la conexión puede escribir y el doc no se pasa de
 * `live.maxBytes` (`live.accepts`); si no, se descartan y se avisa con `permissionDenied`.
 */
export function handleSyncMessage(live: LiveDoc, conn: SyncSocket, dec: decoding.Decoder, canWrite: boolean): Uint8Array | null {
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_SYNC);
  const t = decoding.readVarUint(dec);
  if (t === syncProtocol.messageYjsSyncStep1) syncProtocol.readSyncStep1(dec, enc, live.doc);
  else if (t === syncProtocol.messageYjsSyncStep2 || t === syncProtocol.messageYjsUpdate) {
    const update = decoding.readVarUint8Array(dec);
    if (!canWrite) { if (hasContent(update)) send(live, conn, deniedMessage(READ_ONLY_REASON)); }
    else if (!live.accepts(update)) send(live, conn, deniedMessage(quotaReason(live.maxBytes)));
    else {
      try { Y.applyUpdate(live.doc, update, conn); } catch (e) { console.error('ws update inválido', e); }
    }
  } else throw new Error(`mensaje de sync desconocido: ${t}`);
  return encoding.length(enc) > 1 ? encoding.toUint8Array(enc) : null;
}

/** Registra la conexión en el doc, manda el handshake inicial y devuelve los manejadores de eventos. */
export function attachConnection(conn: SyncSocket, live: LiveDoc, role: Role): SyncHandlers {
  wire(live);
  live.conns.set(conn, new Set());
  const canWrite = role !== 'viewer';

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

  return {
    onMessage(data: Uint8Array) {
      try {
        const dec = decoding.createDecoder(data);
        switch (decoding.readVarUint(dec)) {
          case MSG_SYNC: { const reply = handleSyncMessage(live, conn, dec, canWrite); if (reply) send(live, conn, reply); break; }
          case MSG_AWARENESS: awarenessProtocol.applyAwarenessUpdate(live.awareness, decoding.readVarUint8Array(dec), conn); break;
        }
      } catch (e) { console.error('ws mensaje inválido', e); }
    },
    onClose() { closeConn(live, conn); },
  };
}
