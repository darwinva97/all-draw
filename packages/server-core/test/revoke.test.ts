/**
 * Revocar un acceso cierra los WebSockets que ya estaban abiertos con él: enlace revocado, miembro quitado o con otro
 * rol, espacio borrado, cuenta borrada y cambio de dueño. Conexiones simuladas (`SyncSocket` en memoria) sobre el
 * `DocManager` de la API en memoria.
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import { makeApi } from './helpers';
import { authorizeConnection, makeHasher } from '../src/auth';
import { MSG_SYNC, WS_DELETED, WS_REVOKED, WS_ROLE_CHANGED, attachConnection, revokeConnections, type SyncSocket } from '../src/ysync';
import { sessionIdOf, type ConnIdentity } from '../src/docs';

const PW = 'contraseña-larga';
type T = ReturnType<typeof makeApi>;

/** Conexión falsa registrada en el doc vivo con su identidad; `closed` guarda el código de cierre. */
async function connect(t: T, id: string, identity: ConnIdentity, role: 'owner' | 'editor' | 'viewer' = 'editor') {
  const live = await t.docs.get(id);
  const out = { closed: null as null | { code?: number; reason?: string }, live, handlers: null as unknown as ReturnType<typeof attachConnection> };
  const conn: SyncSocket = { identity, send() {}, isOpen: () => out.closed === null, close: (code, reason) => { out.closed ??= { code, reason }; } };
  out.handlers = attachConnection(conn, live, role);
  return Object.assign(out, { conn });
}
const updateMsg = (u: Uint8Array) => { const e = encoding.createEncoder(); encoding.writeVarUint(e, MSG_SYNC); syncProtocol.writeUpdate(e, u); return encoding.toUint8Array(e); };

describe('revocar accesos cierra los WebSockets abiertos', () => {
  it('authorizeConnection devuelve la identidad: usuario (sesión) o enlace', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const link = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const ctx = { store: t.store, hash: makeHasher(null) };
    expect(await authorizeConnection(ctx, a.token, id)).toEqual({ role: 'owner', identity: { userId: a.user.id, linkToken: null, sessionId: sessionIdOf(await ctx.hash(a.token)), keyId: null }, expiresAt: null });
    const key = (await a.api.post('/api/keys', { name: 'agente' })).body as { id: string; key: string };
    expect(await authorizeConnection(ctx, key.key, id)).toEqual({ role: 'owner', identity: { userId: a.user.id, linkToken: null, sessionId: null, keyId: key.id }, expiresAt: null });
    expect(await authorizeConnection(ctx, link, id)).toEqual({ role: 'viewer', identity: { userId: null, linkToken: link }, expiresAt: null });
    const until = new Date(Date.now() + 3_600_000).toISOString();
    const temp = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor', expiresAt: until })).body.token as string;
    expect(await authorizeConnection(ctx, temp, id)).toMatchObject({ role: 'editor', expiresAt: until });
    expect(await authorizeConnection(ctx, null, id)).toMatchObject({ close: 4401 });
    await t.close();
  });

  it('revocar un enlace cierra (4401) sólo las conexiones de ese enlace y lo que mandan después se descarta', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const l1 = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const l2 = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'editor' })).body.token as string;
    const c1 = await connect(t, id, { userId: null, linkToken: l1 });
    const c1b = await connect(t, id, { userId: null, linkToken: l1 });
    const c2 = await connect(t, id, { userId: null, linkToken: l2 });
    const owner = await connect(t, id, { userId: a.user.id, linkToken: null }, 'owner');
    expect((await a.api.del(`/api/workspaces/${id}/links/${l1}`)).status).toBe(204);
    expect(c1.closed).toEqual({ code: WS_REVOKED, reason: 'enlace revocado' });
    expect(c1b.closed?.code).toBe(WS_REVOKED);
    expect(c2.closed).toBeNull();
    expect(owner.closed).toBeNull();
    expect(c1.live.conns.has(c1.conn)).toBe(false);
    // Un update rezagado del socket revocado no llega al doc
    const d = new Y.Doc(); d.getMap('meta').set('name', 'hack');
    c1.handlers.onMessage(updateMsg(Y.encodeStateAsUpdate(d)));
    expect(c1.live.doc.getMap('meta').get('name')).toBe('S');
    // y uno del enlace vigente sí
    const ok = new Y.Doc(); ok.getMap('meta').set('description', 'sigue');
    c2.handlers.onMessage(updateMsg(Y.encodeStateAsUpdate(ok)));
    expect(c2.live.doc.getMap('meta').get('description')).toBe('sigue');
    await t.close();
  });

  it('cambiar el rol de un miembro cierra con 4205 (reconecta con el rol nuevo); el mismo rol no; quitarlo cierra con 4401', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    expect((await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' })).status).toBe(200);
    let cb = await connect(t, id, { userId: b.user.id, linkToken: null });
    const ca = await connect(t, id, { userId: a.user.id, linkToken: null }, 'owner');
    expect((await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' })).status).toBe(200);
    expect(cb.closed).toBeNull();
    expect((await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'viewer' })).status).toBe(200);
    expect(cb.closed).toEqual({ code: WS_ROLE_CHANGED, reason: 'rol cambiado' });
    // Al reconectar, el servidor le da el rol nuevo
    expect(await authorizeConnection({ store: t.store, hash: makeHasher(null) }, b.token, id)).toMatchObject({ role: 'viewer' });
    cb = await connect(t, id, { userId: b.user.id, linkToken: null }, 'viewer');
    expect((await a.api.del(`/api/workspaces/${id}/members/${b.user.id}`)).status).toBe(204);
    expect(cb.closed).toEqual({ code: WS_REVOKED, reason: 'acceso revocado' });
    expect(ca.closed).toBeNull();
    expect(await authorizeConnection({ store: t.store, hash: makeHasher(null) }, b.token, id)).toMatchObject({ close: 4401 });
    await t.close();
  });

  it('borrar el espacio cierra todas sus conexiones con 4410', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const link = (await a.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const cl = await connect(t, id, { userId: null, linkToken: link }, 'viewer');
    const ca = await connect(t, id, { userId: a.user.id, linkToken: null }, 'owner');
    expect((await a.api.del(`/api/workspaces/${id}`)).status).toBe(204);
    expect(cl.closed?.code).toBe(WS_DELETED);
    expect(ca.closed?.code).toBe(WS_DELETED);
    await t.close();
  });

  it('borrar la cuenta: sus conexiones a espacios ajenos (4401) y a los que hereda otro (4401; el heredero 4205)', async () => {
    const t = makeApi();
    await t.register('admin@x.io'); // primer usuario = admin; así la cuenta que se borra no es la única
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io');
    const ownA = (await a.api.post('/api/workspaces', { name: 'De Ana' })).body.id as string;
    const ownB = (await b.api.post('/api/workspaces', { name: 'De Bea' })).body.id as string;
    await a.api.put(`/api/workspaces/${ownA}/members/${b.user.id}`, { role: 'editor' });
    await b.api.put(`/api/workspaces/${ownB}/members/${a.user.id}`, { role: 'viewer' });
    const aInA = await connect(t, ownA, { userId: a.user.id, linkToken: null }, 'owner');
    const bInA = await connect(t, ownA, { userId: b.user.id, linkToken: null });
    const aInB = await connect(t, ownB, { userId: a.user.id, linkToken: null }, 'viewer');
    const bInB = await connect(t, ownB, { userId: b.user.id, linkToken: null }, 'owner');
    const res = await t.app.request('/api/auth/account', { method: 'DELETE', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: PW }) });
    expect(res.status).toBe(200);
    expect((await res.json() as { transferred: unknown[] }).transferred).toEqual([{ id: ownA, to: b.user.id }]);
    expect(aInA.closed?.code).toBe(WS_REVOKED);
    expect(bInA.closed?.code).toBe(WS_ROLE_CHANGED);
    expect(aInB.closed?.code).toBe(WS_REVOKED);
    expect(bInB.closed).toBeNull();
    await t.close();
  });

  it('cambiar el dueño cierra con 4205 al anterior y al nuevo (reconectan con su rol actual)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    await a.api.put(`/api/workspaces/${id}/members/${b.user.id}`, { role: 'editor' });
    const ca = await connect(t, id, { userId: a.user.id, linkToken: null }, 'owner');
    const cb = await connect(t, id, { userId: b.user.id, linkToken: null });
    expect((await a.api.patch(`/api/workspaces/${id}`, { ownerId: b.user.id })).status).toBe(200);
    expect(ca.closed?.code).toBe(WS_ROLE_CHANGED);
    expect(cb.closed?.code).toBe(WS_ROLE_CHANGED);
    await t.close();
  });

  it('revokeConnections sin coincidencias no cierra nada; un doc no cargado no se abre para revocar', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'S' })).body.id as string;
    const c = await connect(t, id, { userId: a.user.id, linkToken: null }, 'owner');
    expect(revokeConnections(c.live, { userId: 'usr_otro' }, WS_REVOKED, 'x')).toBe(0);
    expect(revokeConnections(c.live, {}, WS_REVOKED, 'x')).toBe(0);
    expect(c.closed).toBeNull();
    c.handlers.onClose();
    await t.docs.unload(id);
    expect(t.docs.has(id)).toBe(false);
    const { LocalDocHost } = await import('../src/host');
    expect(await new LocalDocHost(t.docs).revoke(id, { userId: a.user.id }, WS_REVOKED, 'x')).toBe(0);
    expect(t.docs.has(id)).toBe(false);
    await t.close();
  });
});
