import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { YjsStore } from '@all-draw/sync';
import { makeElement } from '@all-draw/core';
import { register, startServer, until, wait, type TestServer } from './helpers';

let s: TestServer;
let owner: Awaited<ReturnType<typeof register>>;
let wsId: string;
let viewerToken: string, editorToken: string;
const providers: WebsocketProvider[] = [];

function connect(room: string, token: string | undefined, doc = new Y.Doc()) {
  const p = new WebsocketProvider(s.wsUrl, room, doc, { params: token ? { token } : {}, WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket, disableBc: true, maxBackoffTime: 500 });
  providers.push(p);
  return { doc, provider: p, store: new YjsStore(doc) };
}
const synced = (p: WebsocketProvider) => new Promise<void>(r => { if (p.synced) r(); else p.on('sync', (ok: boolean) => ok && r()); });

beforeAll(async () => {
  s = await startServer();
  owner = await register(s.url, 'owner@example.com');
  const w = await owner.api.post('/api/workspaces', { name: 'Sala' });
  wsId = w.body.id;
  viewerToken = (await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer' })).body.token;
  editorToken = (await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'editor' })).body.token;
});
afterAll(async () => { for (const p of providers) p.destroy(); await s.close(); });

describe('websocket con roles', () => {
  it('sin token o con token malo → cierre 4401; espacio inexistente → 4404', async () => {
    const code = (url: string) => new Promise<number>(r => { const w = new WebSocket(url); w.on('close', (c: number) => r(c)); w.on('error', () => {}); });
    expect(await code(`${s.wsUrl}/${wsId}`)).toBe(4401);
    expect(await code(`${s.wsUrl}/${wsId}?token=ads_falso`)).toBe(4401);
    expect(await code(`${s.wsUrl}/ws_nope?token=${owner.token}`)).toBe(4404);
  });

  it('owner escribe y el viewer lo ve; lo que escribe el viewer se descarta y recibe read-only', async () => {
    const o = connect(wsId, owner.token);
    await synced(o.provider);
    const v = connect(wsId, viewerToken);
    await synced(v.provider);

    // Owner → viewer
    const el = makeElement('freeform:box', 'Del dueño');
    o.store.set('elements', el.id, el);
    await until(() => v.store.get('elements', el.id) !== undefined);

    // Viewer intenta escribir: capturamos el mensaje de auth (tipo 2) que devuelve el servidor
    const denied: string[] = [];
    const rawWs = v.provider.ws as unknown as { addEventListener(t: string, f: (ev: { data: ArrayBuffer }) => void): void };
    rawWs.addEventListener('message', ev => {
      const dec = decoding.createDecoder(new Uint8Array(ev.data));
      if (decoding.readVarUint(dec) === 2) { decoding.readVarUint(dec); denied.push(decoding.readVarString(dec)); }
    });
    const intruso = makeElement('freeform:box', 'Del viewer');
    v.store.set('elements', intruso.id, intruso);
    await until(() => denied.length > 0);
    expect(JSON.parse(denied[0]!)).toEqual({ error: 'read-only' });
    await wait(300);
    expect(o.store.get('elements', intruso.id)).toBeUndefined();
    // Ni la API lo ve
    const snap = await owner.api.get(`/api/workspaces/${wsId}/snapshot`);
    expect(snap.body.elements[intruso.id]).toBeUndefined();
    expect(snap.body.elements[el.id]).toBeDefined();

    // Un tercer cliente (editor por enlace) tampoco recibe lo del viewer, sí lo del dueño
    const e = connect(wsId, editorToken);
    await synced(e.provider);
    expect(e.store.get('elements', el.id)).toBeDefined();
    expect(e.store.get('elements', intruso.id)).toBeUndefined();
    const deEditor = makeElement('freeform:box', 'Del editor');
    e.store.set('elements', deEditor.id, deEditor);
    await until(() => o.store.get('elements', deEditor.id) !== undefined && v.store.get('elements', deEditor.id) !== undefined);
  });

  it('commands por REST llegan al instante a los clientes conectados', async () => {
    const o = connect(wsId, owner.token);
    await synced(o.provider);
    const r = await owner.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'meta', patch: { description: 'vía REST' } }] });
    expect(r.status).toBe(200);
    await until(() => o.store.meta().description === 'vía REST');
  });

  it('un update crudo de viewer (mensaje sync tipo update) también se descarta', async () => {
    const raw = new WebSocket(`${s.wsUrl}/${wsId}?token=${viewerToken}`);
    await new Promise(r => raw.on('open', r));
    const local = new Y.Doc();
    local.getMap('elements').set('el_hack', { id: 'el_hack', typeId: 'freeform:box', name: 'hack' });
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 0);
    syncProtocol.writeUpdate(enc, Y.encodeStateAsUpdate(local));
    raw.send(encoding.toUint8Array(enc));
    await wait(300);
    const snap = await owner.api.get(`/api/workspaces/${wsId}/snapshot`);
    expect(snap.body.elements['el_hack']).toBeUndefined();
    raw.close();
  });

  it('persistencia: el doc se guarda en el store (debounce) y sobrevive a la descarga', async () => {
    await wait(700);
    const saved = await s.store.loadDoc(wsId);
    expect(saved).not.toBeNull();
    const d = new Y.Doc(); Y.applyUpdate(d, saved!);
    expect(d.getMap('meta').get('description')).toBe('vía REST');
  });
});
