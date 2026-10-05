/**
 * Formato de registros 2 en el servidor: puerta de versión del protocolo (los clientes de la app anterior no reciben
 * nada del documento y se cierran con 4426), migración al cargar un doc antiguo y restaurar con diff.
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { Awareness, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { COLLECTIONS, exampleWorkspace, parseWorkspace, type Workspace } from '@all-draw/core';
import { SYNC_PROTOCOL, YjsStore } from '@all-draw/sync';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { DocManager, PROTOCOL_GATE_MS, WS_UPGRADE_REQUIRED } from '../src/docs';
import { MSG_AWARENESS, MSG_SYNC, attachConnection, type SyncSocket } from '../src/ysync';

function fakeConn() {
  const out = { sent: [] as Uint8Array[], closed: null as null | { code?: number; reason?: string } };
  const conn: SyncSocket = { send: b => { out.sent.push(b); }, isOpen: () => out.closed === null, close: (code, reason) => { out.closed ??= { code, reason }; } };
  return Object.assign(out, { conn });
}
function awarenessMsg(state: Record<string, unknown>): Uint8Array {
  const aw = new Awareness(new Y.Doc());
  aw.setLocalState(state);
  const e = encoding.createEncoder();
  encoding.writeVarUint(e, MSG_AWARENESS);
  encoding.writeVarUint8Array(e, encodeAwarenessUpdate(aw, [aw.clientID]));
  return encoding.toUint8Array(e);
}
function step1(doc: Y.Doc): Uint8Array { const e = encoding.createEncoder(); encoding.writeVarUint(e, MSG_SYNC); syncProtocol.writeSyncStep1(e, doc); return encoding.toUint8Array(e); }
/** Aplica a `doc` los step2/update recibidos. */
function applyReceived(doc: Y.Doc, sent: Uint8Array[]) {
  for (const b of sent) {
    const d = decoding.createDecoder(b);
    if (decoding.readVarUint(d) !== MSG_SYNC) continue;
    const t = decoding.readVarUint(d);
    if (t === syncProtocol.messageYjsSyncStep2 || t === syncProtocol.messageYjsUpdate) Y.applyUpdate(doc, decoding.readVarUint8Array(d));
  }
}
function legacyUpdate(ws: Workspace): Uint8Array {
  const d = new Y.Doc();
  d.transact(() => {
    for (const c of COLLECTIONS) for (const [id, v] of Object.entries(ws[c])) d.getMap(c).set(id, structuredClone(v));
    for (const [k, v] of Object.entries(ws.meta)) if (v !== undefined) d.getMap('meta').set(k, v);
  });
  return Y.encodeStateAsUpdate(d);
}

describe('puerta de versión del protocolo', () => {
  it('cliente nuevo (awareness con proto): se le manda todo en cuanto lo dice', async () => {
    const docs = new DocManager(new MemoryWorkspaceStore());
    const live = await docs.get('w');
    live.store.setMeta({ name: 'Sala' });
    const c = fakeConn();
    const h = attachConnection(c.conn, live, 'editor');
    const client = new Y.Doc();
    h.onMessage(step1(client));
    expect(c.sent).toHaveLength(0); // retenido
    h.onMessage(awarenessMsg({ proto: SYNC_PROTOCOL, name: 'Ana' }));
    expect(c.sent.length).toBeGreaterThanOrEqual(2); // step1 del servidor + step2 con el doc (+ awareness)
    applyReceived(client, c.sent);
    expect(new YjsStore(client).meta().name).toBe('Sala');
    expect(c.closed).toBeNull();
    // ya admitida: lo siguiente llega directo
    const n = c.sent.length;
    live.store.setMeta({ name: 'Otra' });
    expect(c.sent.length).toBeGreaterThan(n);
    h.onClose();
    await docs.closeAll();
  });

  it('cliente de la app anterior (presencia sin proto): 4426 sin recibir nada del documento', async () => {
    const docs = new DocManager(new MemoryWorkspaceStore());
    const live = await docs.get('w');
    live.store.setMeta({ name: 'Secreto' });
    const c = fakeConn();
    const h = attachConnection(c.conn, live, 'editor');
    h.onMessage(step1(new Y.Doc()));
    h.onMessage(awarenessMsg({ name: 'Viejo', color: '#f00' }));
    expect(c.closed?.code).toBe(WS_UPGRADE_REQUIRED);
    expect(c.sent).toHaveLength(0);
    expect(live.conns.has(c.conn)).toBe(false);
    expect([...live.awareness.getStates().values()].some(s => (s as { name?: string }).name === 'Viejo')).toBe(false);
    // y un proto antiguo, igual
    const d = fakeConn();
    const h2 = attachConnection(d.conn, live, 'editor');
    h2.onMessage(awarenessMsg({ proto: 1, name: 'x' }));
    expect(d.closed?.code).toBe(WS_UPGRADE_REQUIRED);
    await docs.closeAll();
  });

  it('cliente sin awareness (scripts, tests): se admite al pasar PROTOCOL_GATE_MS', async () => {
    const docs = new DocManager(new MemoryWorkspaceStore());
    const live = await docs.get('w');
    const c = fakeConn();
    const h = attachConnection(c.conn, live, 'editor');
    h.onMessage(step1(new Y.Doc()));
    h.onMessage(awarenessMsg({})); // vacío: aún no se sabe
    expect(c.sent).toHaveLength(0);
    await new Promise(r => setTimeout(r, PROTOCOL_GATE_MS + 100));
    expect(c.sent.length).toBeGreaterThan(0);
    expect(c.closed).toBeNull();
    expect(c.conn.protocol).toBe(0);
    h.onClose();
    await docs.closeAll();
  });
});

describe('migración del formato de registros en el servidor', () => {
  it('un doc en formato 1 se migra al cargarlo, con instantánea previa; el contenido no cambia', async () => {
    const store = new MemoryWorkspaceStore();
    const ws = exampleWorkspace();
    await store.saveDoc('w', legacyUpdate(ws));
    const docs = new DocManager(store);
    const live = await docs.get('w');
    expect(live.store.legacyCount()).toBe(0);
    expect(live.store.metaMap.get('recordFormat')).toBe(2);
    expect(JSON.stringify(live.store.snapshot())).toBe(JSON.stringify(parseWorkspace(ws)));
    const snaps = await store.listSnapshots('w');
    expect(snaps).toHaveLength(1);
    expect(snaps[0]!.label).toBeNull();
    // Se guarda migrado
    await live.flush();
    const d = new Y.Doc(); Y.applyUpdate(d, (await store.loadDoc('w'))!);
    expect(new YjsStore(d).legacyCount()).toBe(0);
    // La instantánea (formato 1) se restaura bien sobre el doc migrado
    live.store.set('elements', 'el_alta', { ...live.store.get('elements', 'el_alta')!, name: 'Cambiado' });
    await live.restoreSnapshot(snaps[0]!.id, null);
    expect(live.store.get('elements', 'el_alta')!.name).toBe(ws.elements['el_alta']!.name);
    expect(live.store.legacyCount()).toBe(0);
    await docs.closeAll();
  });

  it('un doc ya migrado no se vuelve a tocar al cargar', async () => {
    const store = new MemoryWorkspaceStore();
    const s = new YjsStore();
    s.setMeta({ name: 'Nuevo' });
    await store.saveDoc('w', Y.encodeStateAsUpdate(s.doc));
    const docs = new DocManager(store);
    const live = await docs.get('w');
    expect(live.isDirty).toBe(false);
    expect(await store.listSnapshots('w')).toHaveLength(0);
    await docs.closeAll();
  });
});
