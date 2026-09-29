/** API + Durable Objects en workerd: cuentas en el `RegistryDO` (proyecto `do`) o en D1 (proyecto `d1`), contenido y WebSocket en `WorkspaceDO`. */
import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { exampleWorkspace, makeElement } from '@all-draw/core';

const BASE = 'https://alldraw.test';
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
const client = (token?: string) => {
  const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
  return {
    get: (p: string) => SELF.fetch(BASE + p, { headers: headers() }).then(j),
    del: (p: string) => SELF.fetch(BASE + p, { method: 'DELETE', headers: headers() }).then(j),
    post: (p: string, body?: unknown) => SELF.fetch(BASE + p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
    put: (p: string, body: unknown) => SELF.fetch(BASE + p, { method: 'PUT', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body) }).then(j),
  };
};
async function register(email: string) {
  const r = await client().post('/api/auth/register', { email, name: email.split('@')[0], password: 'contraseña-larga' });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  return { token: r.body.token as string, user: r.body.user as { id: string; isAdmin: boolean }, api: client(r.body.token) };
}
/** Abre el WebSocket contra el worker y devuelve el socket cliente ya aceptado más una cola de mensajes. */
async function openWs(id: string, token?: string) {
  const res = await SELF.fetch(`${BASE}/ws/${id}${token ? `?token=${token}` : ''}`, { headers: { upgrade: 'websocket' } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!;
  const messages: Uint8Array[] = [];
  const closed = new Promise<{ code: number; reason: string }>(r => ws.addEventListener('close', (e: { code: number; reason: string }) => r({ code: e.code, reason: e.reason })));
  // En workerd el cliente puede recibir binarios como ArrayBuffer o como Blob
  ws.addEventListener('message', (e: { data: unknown }) => { void (async () => { const d = e.data; if (d instanceof ArrayBuffer) messages.push(new Uint8Array(d)); else if (d instanceof Blob) messages.push(new Uint8Array(await d.arrayBuffer())); })(); });
  ws.accept();
  const next = async (pred: (m: Uint8Array) => boolean = () => true, ms = 5000) => {
    const t0 = Date.now();
    for (;;) { const i = messages.findIndex(pred); if (i >= 0) return messages.splice(i, 1)[0]!; if (Date.now() - t0 > ms) throw new Error('timeout esperando mensaje'); await new Promise(r => setTimeout(r, 10)); }
  };
  return { ws, next, closed, messages };
}
const step1 = (doc: Y.Doc) => { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeSyncStep1(enc, doc); return encoding.toUint8Array(enc); };
const updateMsg = (u: Uint8Array) => { const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeUpdate(enc, u); return encoding.toUint8Array(enc); };

describe(`worker: API con registro en ${env.DB ? 'D1' : 'RegistryDO'} + WorkspaceDO`, () => {
  it('healthz, registro (primer usuario admin), me', async () => {
    expect(await (await SELF.fetch(`${BASE}/healthz`)).text()).toBe('ok');
    const a = await register('ana@example.com');
    expect(a.user.isAdmin).toBe(true);
    expect((await a.api.get('/api/auth/me')).body.user.email).toBe('ana@example.com');
    expect((await register('bea@example.com')).user.isAdmin).toBe(false);
    expect((await client().post('/api/auth/login', { email: 'ana@example.com', password: 'contraseña-larga' })).status).toBe(200);
  });

  it('espacio con initial en el DO: snapshot, commands, validate, svg, permisos, borrar', async () => {
    const owner = await register('owner@example.com');
    const other = await register('other@example.com');
    const w = await owner.api.post('/api/workspaces', { initial: exampleWorkspace() });
    expect(w.status).toBe(201);
    const id = w.body.id as string;
    const snap = await owner.api.get(`/api/workspaces/${id}/snapshot`);
    expect(snap.status).toBe(200);
    expect(Object.keys(snap.body.elements)).toEqual(['el_alta', 'el_crm']);
    expect((await other.api.get(`/api/workspaces/${id}/snapshot`)).status).toBe(403);
    const el = makeElement('freeform:box', 'Nueva');
    const cmd = await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el.id, value: el }] });
    expect(cmd.status).toBe(200);
    expect(cmd.body.applied).toBe(1);
    expect((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.elements[el.id].name).toBe('Nueva');
    expect((await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'patch', collection: 'elements', id: 'nope', patch: { name: 'x' } }] })).status).toBe(422);
    expect((await owner.api.get(`/api/workspaces/${id}/validate`)).body.summary).toBeDefined();
    const viewId = Object.keys(snap.body.views)[0]!;
    const svg = await SELF.fetch(`${BASE}/api/workspaces/${id}/views/${viewId}/svg`, { headers: { authorization: `Bearer ${owner.token}` } });
    expect(svg.status).toBe(200);
    expect(await svg.text()).toContain('<svg');
    expect((await owner.api.get(`/api/workspaces/${id}/views/v_nope/svg`)).status).toBe(404);
    expect((await owner.api.put(`/api/workspaces/${id}/members/${other.user.id}`, { role: 'viewer' })).status).toBe(200);
    expect((await other.api.get(`/api/workspaces/${id}`)).body.role).toBe('viewer');
    expect((await other.api.del(`/api/workspaces/${id}`)).status).toBe(403);
    expect((await owner.api.del(`/api/workspaces/${id}`)).status).toBe(204);
    expect((await owner.api.get(`/api/workspaces/${id}`)).status).toBe(404);
  });

  it('WebSocket: 4401 sin token, 4404 si no existe; sync y broadcast entre clientes; viewer sólo lee', async () => {
    const owner = await register('ws@example.com');
    const id = (await owner.api.post('/api/workspaces', { name: 'Sala' })).body.id as string;
    expect((await (await openWs(id)).closed).code).toBe(4401);
    expect((await (await openWs('ws_nope', owner.token)).closed).code).toBe(4404);

    const a = await openWs(id, owner.token);
    const first = await a.next();
    expect(first[0]).toBe(0); // sync step1 del servidor
    const docA = new Y.Doc();
    a.ws.send(step1(docA));
    const reply = await a.next(m => m[0] === 0 && m[1] === 1); // step2
    const dec = decoding.createDecoder(reply); decoding.readVarUint(dec); decoding.readVarUint(dec);
    Y.applyUpdate(docA, decoding.readVarUint8Array(dec));
    expect(docA.getMap('meta').get('name')).toBe('Sala');

    // Un viewer por enlace conectado: recibe lo del dueño, lo suyo se descarta con read-only
    const linkToken = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const v = await openWs(id, linkToken);
    await v.next();
    const el = makeElement('freeform:box', 'Del dueño');
    docA.getMap('elements').set(el.id, el);
    a.ws.send(updateMsg(Y.encodeStateAsUpdate(docA)));
    const bcast = await v.next(m => m[0] === 0 && m[1] === 2);
    expect(bcast.length).toBeGreaterThan(5);
    const intruso = new Y.Doc(); intruso.getMap('elements').set('el_hack', { id: 'el_hack' });
    v.ws.send(updateMsg(Y.encodeStateAsUpdate(intruso)));
    const denied = await v.next(m => m[0] === 2);
    const d2 = decoding.createDecoder(denied); decoding.readVarUint(d2); decoding.readVarUint(d2);
    expect(JSON.parse(decoding.readVarString(d2))).toEqual({ error: 'read-only' });

    // REST ve lo del dueño (y no lo del viewer) y un comando REST llega por el socket
    const snap = await owner.api.get(`/api/workspaces/${id}/snapshot`);
    expect(snap.body.elements[el.id]).toBeDefined();
    expect(snap.body.elements['el_hack']).toBeUndefined();
    await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'meta', patch: { description: 'vía REST' } }] });
    const fromRest = await a.next(m => m[0] === 0 && m[1] === 2);
    expect(fromRest.length).toBeGreaterThan(5);
    a.ws.close(1000, 'fin'); v.ws.close(1000, 'fin');
  });
});
