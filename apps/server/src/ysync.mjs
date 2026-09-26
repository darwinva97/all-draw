/**
 * Sincronización Yjs por WebSocket (protocolo y-websocket) con el mismo `yjs` que usa el cliente.
 * Reimplementación compacta del servidor de referencia para evitar instancias dobles de Yjs.
 */
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MSG_SYNC = 0, MSG_AWARENESS = 1;
const PING_MS = 30000;

/** @type {Map<string, SharedDoc>} */
export const docs = new Map();
let persistence = null;
export function setPersistence(p) { persistence = p; }

class SharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true });
    this.name = name;
    /** @type {Map<import('ws').WebSocket, Set<number>>} */
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);
    this.awareness.on('update', ({ added, updated, removed }, conn) => {
      const changed = added.concat(updated, removed);
      if (conn !== null) { const ids = this.conns.get(conn); if (ids) { for (const c of added) ids.add(c); for (const c of removed) ids.delete(c); } }
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
      const buf = encoding.toUint8Array(enc);
      for (const c of this.conns.keys()) send(this, c, buf);
    });
    this.on('update', (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeUpdate(enc, update);
      const buf = encoding.toUint8Array(enc);
      for (const c of this.conns.keys()) if (c !== origin) send(this, c, buf);
    });
  }
}

export function getDoc(name) {
  let d = docs.get(name);
  if (!d) { d = new SharedDoc(name); persistence?.bindState(name, d); docs.set(name, d); }
  return d;
}

function send(doc, conn, buf) {
  if (conn.readyState !== 0 && conn.readyState !== 1) return close(doc, conn);
  try { conn.send(buf, err => err && close(doc, conn)); } catch { close(doc, conn); }
}

function close(doc, conn) {
  const ids = doc.conns.get(conn);
  if (ids) {
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, [...ids], null);
    if (doc.conns.size === 0 && persistence) persistence.writeState(doc.name, doc).then(() => { doc.destroy(); docs.delete(doc.name); });
  }
  try { conn.close(); } catch { /* ya cerrada */ }
}

export function setupConnection(conn, room) {
  conn.binaryType = 'arraybuffer';
  const doc = getDoc(room);
  doc.conns.set(conn, new Set());
  conn.on('message', (data) => {
    try {
      const dec = decoding.createDecoder(new Uint8Array(data));
      const enc = encoding.createEncoder();
      switch (decoding.readVarUint(dec)) {
        case MSG_SYNC:
          encoding.writeVarUint(enc, MSG_SYNC);
          syncProtocol.readSyncMessage(dec, enc, doc, conn);
          if (encoding.length(enc) > 1) send(doc, conn, encoding.toUint8Array(enc));
          break;
        case MSG_AWARENESS:
          awarenessProtocol.applyAwarenessUpdate(doc.awareness, decoding.readVarUint8Array(dec), conn);
          break;
      }
    } catch (e) { console.error(e); }
  });
  let alive = true;
  const ping = setInterval(() => { if (!alive) { close(doc, conn); clearInterval(ping); } else if (doc.conns.has(conn)) { alive = false; try { conn.ping(); } catch { close(doc, conn); } } }, PING_MS);
  conn.on('pong', () => { alive = true; });
  conn.on('close', () => { close(doc, conn); clearInterval(ping); });
  const enc = encoding.createEncoder();
  encoding.writeVarUint(enc, MSG_SYNC);
  syncProtocol.writeSyncStep1(enc, doc);
  send(doc, conn, encoding.toUint8Array(enc));
  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const e2 = encoding.createEncoder();
    encoding.writeVarUint(e2, MSG_AWARENESS);
    encoding.writeVarUint8Array(e2, awarenessProtocol.encodeAwarenessUpdate(doc.awareness, [...states.keys()]));
    send(doc, conn, encoding.toUint8Array(e2));
  }
}
