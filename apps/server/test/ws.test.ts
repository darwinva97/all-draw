import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { SYNC_PROTOCOL, YjsStore } from '@all-draw/sync';
import { makeElement } from '@all-draw/core';
import { register, startServer, until, wait, type TestServer } from './helpers';

let s: TestServer;
let owner: Awaited<ReturnType<typeof register>>;
let wsId: string;
let viewerToken: string, editorToken: string;
const providers: WebsocketProvider[] = [];

function connect(room: string, token: string | undefined, doc = new Y.Doc()) {
  const p = new WebsocketProvider(s.wsUrl, room, doc, { params: token ? { token } : {}, WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket, disableBc: true, maxBackoffTime: 500 });
  p.awareness.setLocalStateField('proto', SYNC_PROTOCOL); // como `connectRemote`: sin esperar a la puerta de versión
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

  it('un cliente de la app anterior (presencia sin `proto`) se cierra con 4426 sin recibir el documento', async () => {
    const doc = new Y.Doc();
    const p = new WebsocketProvider(s.wsUrl, wsId, doc, { params: { token: owner.token }, WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket, disableBc: true, connect: false });
    providers.push(p);
    p.awareness.setLocalStateField('name', 'Pestaña vieja'); // como el editor anterior: nombre y color, sin versión
    const closed = new Promise<number>(r => p.on('connection-close', (ev: { code: number } | null) => { if (ev) r(ev.code); }));
    p.connect();
    expect(await closed).toBe(4426);
    expect(doc.getMap('meta').size).toBe(0); // no le llegó nada del espacio
    expect(p.synced).toBe(false);
    p.destroy();
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

describe('revocar acceso con el WebSocket abierto', () => {
  /** Socket crudo ya abierto + promesa con el código de cierre. */
  const open = async (room: string, token: string) => {
    const w = new WebSocket(`${s.wsUrl}/${room}?token=${token}`);
    const closed = new Promise<{ code: number; reason: string }>(r => w.on('close', (code: number, reason: Buffer) => r({ code, reason: reason.toString() })));
    w.on('error', () => {});
    await new Promise<void>((r, j) => { w.once('open', () => r()); w.once('close', c => j(new Error(`cerrado ${c}`))); });
    return { w, closed };
  };
  const code = (url: string) => new Promise<number>(r => { const w = new WebSocket(url); w.on('close', (c: number) => r(c)); w.on('error', () => {}); });

  it('revocar el enlace desconecta (4401) a quien lo tiene abierto, y ya no puede volver a entrar', async () => {
    const id = (await owner.api.post('/api/workspaces', { name: 'Revocar' })).body.id as string;
    const tok = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const other = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const a = await open(id, tok);
    const b = await open(id, other);
    expect((await owner.api.del(`/api/workspaces/${id}/links/${tok}`)).status).toBe(204);
    expect(await a.closed).toEqual({ code: 4401, reason: 'enlace revocado' });
    expect(b.w.readyState).toBe(WebSocket.OPEN);
    expect(await code(`${s.wsUrl}/${id}?token=${tok}`)).toBe(4401);
    b.w.close();
  });

  it('bajar a un miembro de editor a viewer cierra con 4205; y-websocket reconecta y sus cambios ya se descartan', async () => {
    const id = (await owner.api.post('/api/workspaces', { name: 'Roles' })).body.id as string;
    const bea = await register(s.url, `bea-${Date.now()}@example.com`);
    await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'editor' });
    const o = connect(id, owner.token); await synced(o.provider);
    const b = connect(id, bea.token); await synced(b.provider);
    const closes: number[] = [];
    b.provider.on('connection-close', (ev: { code: number } | null) => { if (ev) closes.push(ev.code); });
    const before = makeElement('freeform:box', 'Como editora');
    b.store.set('elements', before.id, before);
    await until(() => o.store.get('elements', before.id) !== undefined);

    expect((await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'viewer' })).status).toBe(200);
    await until(() => closes.includes(4205));
    await until(() => b.provider.wsconnected && b.provider.synced);
    const after = makeElement('freeform:box', 'Ya como lectora');
    b.store.set('elements', after.id, after);
    await wait(400);
    expect(o.store.get('elements', after.id)).toBeUndefined();
    expect((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.elements[after.id]).toBeUndefined();

    // Quitarlo del todo: 4401 y las reconexiones siguen rechazadas
    expect((await owner.api.del(`/api/workspaces/${id}/members/${bea.user.id}`)).status).toBe(204);
    await until(() => closes.includes(4401));
    b.provider.destroy();
  });

  it('borrar el espacio cierra con 4410', async () => {
    const id = (await owner.api.post('/api/workspaces', { name: 'Borrar' })).body.id as string;
    const a = await open(id, owner.token);
    expect((await owner.api.del(`/api/workspaces/${id}`)).status).toBe(204);
    expect((await a.closed).code).toBe(4410);
  });

  it('borrar la cuenta cierra (4401) sus conexiones a espacios ajenos', async () => {
    const id = (await owner.api.post('/api/workspaces', { name: 'Ajeno' })).body.id as string;
    const eva = await register(s.url, `eva-${Date.now()}@example.com`);
    await owner.api.put(`/api/workspaces/${id}/members/${eva.user.id}`, { role: 'editor' });
    const a = await open(id, eva.token);
    const r = await fetch(`${s.url}/api/auth/account`, { method: 'DELETE', headers: { authorization: `Bearer ${eva.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'contraseña-larga' }) });
    expect(r.status).toBe(200);
    expect((await a.closed).code).toBe(4401);
  });
});

describe('sesiones cerradas cortan el WebSocket (QA 8 y 9)', () => {
  const closeCode = (url: string) => {
    const w = new WebSocket(url);
    const opened = new Promise<void>((r, j) => { w.on('open', () => r()); w.on('error', j); });
    const closed = new Promise<number>(r => w.on('close', (c: number) => r(c)));
    w.on('error', () => {});
    return { w, opened, closed };
  };
  it('cerrar sesión corta ese navegador (4402); cerrar todas, el resto; la API key sólo con revokeKeys', async () => {
    const a = await register(s.url, `sesiones-${Date.now()}@example.com`);
    const id = (await a.api.post('/api/workspaces', { name: 'Sesiones' })).body.id as string;
    const login = async () => (await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: a.user.email, password: 'contraseña-larga' }) }).then(r => r.json()) as { token: string }).token;
    const t2 = await login(), t3 = await login();
    const key = (await a.api.post('/api/keys', { name: 'agente' })).body.key as string;
    const c1 = closeCode(`${s.wsUrl}/${id}?token=${a.token}`), c2 = closeCode(`${s.wsUrl}/${id}?token=${t2}`), ck = closeCode(`${s.wsUrl}/${id}?token=${key}`);
    await Promise.all([c1.opened, c2.opened, ck.opened]);
    expect((await a.api.post('/api/auth/logout')).status).toBe(204);
    expect(await c1.closed).toBe(4402);
    // Cerrar todas (desde la tercera sesión) sin la casilla: cae la segunda, la clave sigue
    expect((await fetch(`${s.url}/api/auth/sessions`, { method: 'DELETE', headers: { authorization: `Bearer ${t3}` } })).status).toBe(204);
    expect(await c2.closed).toBe(4402);
    await wait(50);
    expect(ck.w.readyState).toBe(WebSocket.OPEN);
    // Con la casilla, también la clave
    const t4 = await login();
    expect((await fetch(`${s.url}/api/auth/sessions?revokeKeys=true`, { method: 'DELETE', headers: { authorization: `Bearer ${t4}` } })).status).toBe(204);
    expect(await ck.closed).toBe(4402);
    expect(await closeCode(`${s.wsUrl}/${id}?token=${key}`).closed).toBe(4401);
  });
});
