/** Producción (server-core, memoria): RGPD (exportar, borrar cuenta, perfil), cuotas, anti-abuso del registro, estado, errores del cliente, log y cuota de tamaño de los docs. */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { exampleWorkspace, makeElement } from '@all-draw/core';
import { makeApi } from './helpers';
import { DocManager, LiveDoc } from '../src/docs';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { MSG_AUTH, attachConnection, type SyncSocket } from '../src/ysync';
import { jsonLogger, redactPath, redactTokens, truncateIp } from '../src/log';
import { SECURITY_CONTACT, securityHeaders, securityTxt } from '../src/headers';
import type { WorkspaceArchive } from '../src/api';

const PW = 'contraseña-larga';

describe('GET /api/status', () => {
  it('versión, commit, uptime y BD; 503 si la BD falla', async () => {
    const t = makeApi({ build: { version: '1.2.3', commit: 'abc1234', runtime: 'test', db: 'memory', startedAt: new Date(Date.now() - 5000).toISOString() } });
    const r = await t.client().get('/api/status');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', version: '1.2.3', commit: 'abc1234', runtime: 'test', db: { kind: 'memory', ok: true } });
    expect(r.body.uptimeS).toBeGreaterThanOrEqual(4);
    expect(r.headers.get('cache-control')).toBe('no-store');
    t.store.countUsers = async () => { throw new Error('disco lleno'); };
    const bad = await t.client().get('/api/status');
    expect(bad.status).toBe(503);
    expect(bad.body).toMatchObject({ status: 'degraded', db: { ok: false, error: 'error' } });
    expect(JSON.stringify(bad.body)).not.toContain('disco lleno');
  });
});

describe('perfil y cuotas', () => {
  it('GET /me trae cuotas; PATCH /me cambia nombre y, con contraseña, el email', async () => {
    const t = makeApi({ maxWorkspacesPerUser: 5 });
    await t.register('admin@x.io');
    const a = await t.register('ana@x.io');
    await a.api.post('/api/workspaces', { name: 'uno' });
    const me = await a.api.get('/api/auth/me');
    expect(me.body.quotas).toEqual({ workspaces: { used: 1, limit: 5 }, docBytes: { limit: 20 * 1024 * 1024 } });
    // el admin no tiene límite de espacios
    const adminToken = (await t.client().post('/api/auth/login', { email: 'admin@x.io', password: PW })).body.token;
    expect((await t.client(adminToken).get('/api/auth/me')).body.quotas.workspaces.limit).toBeNull();

    expect((await a.api.patch('/api/auth/me', { name: 'Ana López' })).body.user.name).toBe('Ana López');
    expect((await a.api.patch('/api/auth/me', { email: 'nueva@x.io' })).status).toBe(403);
    expect((await a.api.patch('/api/auth/me', { email: 'nueva@x.io', password: 'mala-contraseña' })).status).toBe(403);
    expect((await a.api.patch('/api/auth/me', { email: 'admin@x.io', password: PW })).status).toBe(409);
    expect((await a.api.patch('/api/auth/me', { email: 'Nueva@X.io', password: PW })).body.user.email).toBe('nueva@x.io');
    expect((await t.client().post('/api/auth/login', { email: 'nueva@x.io', password: PW })).status).toBe(200);
    // con API key se cambia el nombre, no el email
    const key = (await a.api.post('/api/keys', { name: 'k' })).body.key;
    expect((await t.client(key).patch('/api/auth/me', { name: 'Por clave' })).status).toBe(200);
    expect((await t.client(key).patch('/api/auth/me', { email: 'otra@x.io', password: PW })).status).toBe(403);
    await t.close();
  });

  it('MAX_WORKSPACES_PER_USER: error claro al pasarse; los admins no tienen límite', async () => {
    const t = makeApi({ maxWorkspacesPerUser: 2 });
    const admin = await t.register('admin@x.io');
    const a = await t.register('ana@x.io');
    for (const n of ['1', '2']) expect((await a.api.post('/api/workspaces', { name: n })).status).toBe(201);
    const r = await a.api.post('/api/workspaces', { name: '3' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ code: 'quota_workspaces', limit: 2 });
    expect(r.body.error).toMatch(/máximo de 2 espacios/);
    for (const n of ['1', '2', '3']) expect((await admin.api.post('/api/workspaces', { name: n })).status).toBe(201);
    await t.close();
  });

  it('MAX_DOC_BYTES: Workspace JSON demasiado grande → 413; doc en el límite → comandos 413', async () => {
    const t = makeApi({ maxDocBytes: 1000 });
    const a = await t.register('ana@x.io');
    const big = exampleWorkspace();
    expect(JSON.stringify(big).length).toBeGreaterThan(1000);
    const r = await a.api.post('/api/workspaces', { initial: big });
    expect(r.status).toBe(413);
    expect(r.body).toMatchObject({ code: 'doc_too_large', limit: 1000 });
    const id = (await a.api.post('/api/workspaces', { name: 'pequeño' })).body.id;
    expect((await a.api.put(`/api/workspaces/${id}/snapshot`, big)).status).toBe(413);
    const el = (_i: number) => { const e = makeElement('freeform:box', 'x'.repeat(400)); return { type: 'set', collection: 'elements', id: e.id, value: e }; };
    let last = 200;
    for (let i = 0; i < 10 && last === 200; i++) last = (await a.api.post(`/api/workspaces/${id}/commands`, { commands: [el(i)] })).status;
    expect(last).toBe(413);
    const again = await a.api.post(`/api/workspaces/${id}/commands`, { commands: [el(99)] });
    expect(again.status).toBe(413);
    expect(again.body.code).toBe('doc_too_large');
    expect(again.body.error).toMatch(/tamaño máximo/);
    await t.close();
  });
});

describe('exportar y borrar la cuenta (RGPD)', () => {
  it('GET /api/auth/export: cuenta, claves sin secreto, espacios propios con contenido, miembros y enlaces; compartidos sin contenido', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io');
    const own = (await a.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;
    await a.api.put(`/api/workspaces/${own}/members/${b.user.id}`, { role: 'viewer' });
    const link = (await a.api.post(`/api/workspaces/${own}/links`, { role: 'viewer' })).body.token as string;
    await a.api.post('/api/keys', { name: 'mi clave' });
    const shared = (await b.api.post('/api/workspaces', { name: 'de Bea' })).body.id;
    await b.api.put(`/api/workspaces/${shared}/members/${a.user.id}`, { role: 'editor' });

    const r = await a.api.get('/api/auth/export');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toMatch(/^attachment; filename="alldraw-usr_.*\.json"$/);
    expect(r.body).toMatchObject({ format: 'all-draw-account/1', user: { email: 'ana@x.io' } });
    expect(r.body.apiKeys).toHaveLength(1);
    expect(JSON.stringify(r.body)).not.toMatch(/keyHash|passwordHash|password_hash/);
    const o = r.body.workspaces.find((w: { id: string }) => w.id === own);
    expect(o.role).toBe('owner');
    expect(Object.keys(o.snapshot.elements).length).toBeGreaterThan(0);
    expect(o.members).toEqual([expect.objectContaining({ email: 'bea@x.io', role: 'viewer' })]);
    expect(o.links[0].tokenPrefix).toBe(`${link.slice(0, 8)}…`);
    expect(JSON.stringify(r.body)).not.toContain(link);
    const s = r.body.workspaces.find((w: { id: string }) => w.id === shared);
    expect(s).toMatchObject({ role: 'editor', name: 'de Bea' });
    expect(s.snapshot).toBeUndefined();
    await t.close();
  });

  it('DELETE /api/auth/account: contraseña, transferencia al editor más antiguo, borrado con copia final, sesiones fuera', async () => {
    const archived: WorkspaceArchive[] = [];
    const t = makeApi({ archiveWorkspace: async a => { archived.push(a); } });
    const admin = await t.register('admin@x.io');
    const a = await t.register('ana@x.io');
    const b = await t.register('bea@x.io');
    const c = await t.register('carlos@x.io');
    const withEditors = (await a.api.post('/api/workspaces', { name: 'con editores' })).body.id;
    await a.api.put(`/api/workspaces/${withEditors}/members/${c.user.id}`, { role: 'viewer' });
    await new Promise(r => setTimeout(r, 5));
    await a.api.put(`/api/workspaces/${withEditors}/members/${b.user.id}`, { role: 'editor' });
    await new Promise(r => setTimeout(r, 5));
    await a.api.put(`/api/workspaces/${withEditors}/members/${admin.user.id}`, { role: 'editor' });
    const alone = (await a.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;
    await a.api.put(`/api/workspaces/${alone}/members/${c.user.id}`, { role: 'viewer' });
    const others = (await b.api.post('/api/workspaces', { name: 'de Bea' })).body.id;
    await b.api.put(`/api/workspaces/${others}/members/${a.user.id}`, { role: 'editor' });
    const key = (await a.api.post('/api/keys', { name: 'k' })).body.key;

    const del = (tok: string, password: string) => t.app.request('/api/auth/account', { method: 'DELETE', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    expect((await del(key, PW)).status).toBe(403); // API key no
    expect((await del(a.token, 'otra-contraseña')).status).toBe(403);
    const res = await del(a.token, PW);
    expect(res.status).toBe(200);
    const out = await res.json() as { deleted: string[]; transferred: { id: string; to: string }[] };
    expect(out.transferred).toEqual([{ id: withEditors, to: b.user.id }]);
    expect(out.deleted).toEqual([alone]);

    // transferido: Bea es dueña y deja de ser miembro; el resto de miembros sigue
    expect((await b.api.get(`/api/workspaces/${withEditors}`)).body.role).toBe('owner');
    const members = (await b.api.get(`/api/workspaces/${withEditors}/members`)).body.members.map((m: { userId: string; role: string }) => `${m.userId}:${m.role}`);
    expect(members.sort()).toEqual([`${admin.user.id}:editor`, `${c.user.id}:viewer`].sort());
    // borrado con copia final (contenido + miembros + enlaces)
    expect((await c.api.get(`/api/workspaces/${alone}`)).status).toBe(404);
    expect(archived).toHaveLength(1);
    expect(archived[0]).toMatchObject({ format: 'all-draw-backup/1', reason: 'account-deleted', deletedBy: { email: 'ana@x.io' }, workspace: { id: alone, ownerEmail: 'ana@x.io', members: [expect.objectContaining({ email: 'carlos@x.io', role: 'viewer' })] } });
    expect(Object.keys(archived[0]!.snapshot!.elements).length).toBeGreaterThan(0);
    // membresía en espacios ajenos, sesión, clave y cuenta: fuera
    expect((await b.api.get(`/api/workspaces/${others}/members`)).body.members).toEqual([]);
    expect((await a.api.get('/api/auth/me')).status).toBe(401);
    expect((await t.client(key).get('/api/auth/me')).status).toBe(401);
    expect((await t.client().post('/api/auth/login', { email: 'ana@x.io', password: PW })).status).toBe(401);
    expect(await t.store.getUserByEmail('ana@x.io')).toBeNull();
    await t.close();
  });

  it('si la copia final falla no se borra nada; el único admin debe nombrar otro antes', async () => {
    const t = makeApi({ archiveWorkspace: async () => { throw new Error('disco lleno'); } });
    const admin = await t.register('admin@x.io');
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { name: 'solo' })).body.id;
    const del = (tok: string) => t.app.request('/api/auth/account', { method: 'DELETE', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: PW }) });
    const r = await del(a.token);
    expect(r.status).toBe(500);
    expect((await a.api.get(`/api/workspaces/${id}`)).status).toBe(200);
    expect((await a.api.get('/api/auth/me')).status).toBe(200);

    const last = await del(admin.token);
    expect(last.status).toBe(409);
    expect(((await last.json()) as { code: string }).code).toBe('last_admin');
    // nombrar a Ana administradora (sólo admin y desde sesión); no se puede dejar el servidor sin admins
    expect((await a.api.patch(`/api/admin/users/${admin.user.id}`, { isAdmin: false })).status).toBe(403);
    expect((await admin.api.patch(`/api/admin/users/${admin.user.id}`, { isAdmin: false })).status).toBe(409);
    expect((await admin.api.patch(`/api/admin/users/${a.user.id}`, { isAdmin: true })).body.user.isAdmin).toBe(true);
    await t.close();
  });

  it('el único usuario (admin) puede borrar su cuenta', async () => {
    const t = makeApi();
    const admin = await t.register('admin@x.io');
    const r = await t.app.request('/api/auth/account', { method: 'DELETE', headers: { authorization: `Bearer ${admin.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: PW }) });
    expect(r.status).toBe(200);
    expect(await t.store.countUsers()).toBe(0);
    await t.close();
  });
});

describe('registro anti-abuso', () => {
  it('trampa (website) rellena → 400', async () => {
    const t = makeApi();
    const r = await t.client().post('/api/auth/register', { email: 'bot@x.io', name: 'Bot', password: PW, website: 'http://spam' });
    expect(r.status).toBe(400);
    expect(await t.store.getUserByEmail('bot@x.io')).toBeNull();
    await t.close();
  });

  it('formToken: obligatorio, firmado y con tiempo mínimo', async () => {
    const t = makeApi({ registerMinMs: 150, secret: 'secreto' });
    const reg = (extra: Record<string, unknown>) => t.client().post('/api/auth/register', { email: `u${Math.random()}@x.io`, name: 'U', password: PW, ...extra });
    const cfg = (await t.client().get('/api/auth/config')).body;
    expect(cfg).toMatchObject({ registration: 'open', formMinMs: 150 });
    expect(cfg.formToken).toMatch(/^\d+\.[0-9a-f]{32}$/);
    const missing = await reg({});
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('form_token');
    expect((await reg({ formToken: cfg.formToken })).body.error).toMatch(/Demasiado rápido/);
    const [ts, sig] = cfg.formToken.split('.');
    expect((await reg({ formToken: `${Number(ts) - 10_000}.${sig}` })).status).toBe(400); // firma de otro instante
    expect((await reg({ formToken: `${ts}.${'0'.repeat(32)}` })).status).toBe(400);
    await new Promise(r => setTimeout(r, 200));
    expect((await reg({ formToken: cfg.formToken })).status).toBe(201);
    await t.close();
  });
});

describe('POST /api/client-errors', () => {
  it('registra en el log (sin tokens ni campos desconocidos), máx. 8 KB y con límite por IP', async () => {
    const logs: Record<string, unknown>[] = [];
    const t = makeApi({ logs });
    const r = await t.client().post('/api/client-errors', {
      message: 'TypeError: x is undefined', stack: 'at f (app.js:1:2)', source: 'onerror', url: '/#/s/ws_1?token=lnk_secretoSecreto123',
      workspace: { elements: { secreto: 1 } }, // no está en el esquema: se descarta
    });
    expect(r.status).toBe(204);
    const line = logs.find(l => l.msg === 'client-error')!;
    expect(line).toMatchObject({ level: 'warn', source: 'onerror', message: 'TypeError: x is undefined', user: 'anon', ip: 'unknown' });
    expect(JSON.stringify(line)).not.toContain('secretoSecreto');
    expect(JSON.stringify(line)).not.toContain('elements');
    const big = await t.app.request('/api/client-errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'x', stack: 'y'.repeat(9000) }) });
    expect(big.status).toBe(413);
    let last = 204;
    for (let i = 0; i < 40 && last !== 429; i++) last = (await t.client().post('/api/client-errors', { message: `e${i}` })).status;
    expect(last).toBe(429);
    await t.close();
  });
});

describe('log y cabeceras', () => {
  it('truncateIp, redactPath, redactTokens', () => {
    expect(truncateIp('203.0.113.77')).toBe('203.0.113.0');
    expect(truncateIp('::ffff:10.1.2.3')).toBe('10.1.2.0');
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
    expect(truncateIp('::1')).toBe('::');
    expect(truncateIp(undefined)).toBe('unknown');
    expect(redactPath('/api/workspaces/ws_1/links/lnk_abcDEF123?token=lnk_x')).toBe('/api/workspaces/ws_1/links/:token');
    expect(redactPath('/ws/ws_1?token=lnk_secret')).toBe('/ws/ws_1');
    expect(redactTokens('fallo en https://x/#/s/ws?token=lnk_abcdefghij&y=1 con adk_ABCDEFGHIJKL')).toBe('fallo en https://x/#/s/ws?token=…&y=1 con adk_…');
  });

  it('jsonLogger: niveles y una línea JSON por evento', () => {
    const lines: string[] = [];
    const log = jsonLogger({ level: 'warn', write: l => lines.push(l) });
    log.info('no sale'); log.warn('sale', { a: 1, err: new Error('boom') }); log.error('también');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!);
    expect(first).toMatchObject({ level: 'warn', msg: 'sale', a: 1, err: { message: 'boom' } });
    expect(Date.parse(first.t)).toBeGreaterThan(0);
    const silent: string[] = [];
    jsonLogger({ level: 'silent', write: l => silent.push(l) }).error('nada');
    expect(silent).toEqual([]);
  });

  it('COOP y CORP same-origin; security.txt con contacto y caducidad futura', () => {
    const h = securityHeaders({ https: true, host: 'x.io' });
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    expect(h['cross-origin-resource-policy']).toBe('same-origin');
    const txt = securityTxt('https://alldraw.example/');
    expect(txt).toContain(`Contact: ${SECURITY_CONTACT}`);
    expect(txt).toContain('Canonical: https://alldraw.example/.well-known/security.txt');
    const exp = /Expires: (\S+)/.exec(txt)![1]!;
    expect(Date.parse(exp)).toBeGreaterThan(Date.now() + 300 * 86_400_000);
  });

  it('el SVG de una vista se puede incrustar desde otro origen (CORP cross-origin)', async () => {
    const t = makeApi();
    const a = await t.register('ana@x.io');
    const id = (await a.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;
    const view = Object.keys((await a.api.get(`/api/workspaces/${id}/snapshot`)).body.views)[0];
    const r = await t.app.request(`/api/workspaces/${id}/views/${view}/svg`, { headers: { authorization: `Bearer ${a.token}` } });
    expect(r.status).toBe(200);
    expect(r.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    await t.close();
  });
});

describe('cuota de tamaño en el doc vivo (WebSocket)', () => {
  const step = (type: 'update' | 'step2', u: Uint8Array) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, 0);
    if (type === 'update') syncProtocol.writeUpdate(enc, u); else syncProtocol.writeSyncStep2(enc, (() => { const d = new Y.Doc(); Y.applyUpdate(d, u); return d; })());
    return encoding.toUint8Array(enc);
  };

  it('accepts: crecimiento por encima del límite no; reenvíos de lo que ya hay y borrados sí', async () => {
    const store = new MemoryWorkspaceStore();
    const live = new LiveDoc('w', store);
    await live.load();
    live.maxBytes = 600;
    const client = new Y.Doc();
    const texts = client.getMap('elements');
    texts.set('a', 'x'.repeat(300));
    const first = Y.encodeStateAsUpdate(client);
    expect(live.accepts(first)).toBe(true);
    Y.applyUpdate(live.doc, first);
    texts.set('b', 'y'.repeat(400));
    const growth = Y.encodeStateAsUpdate(client, Y.encodeStateVector(live.doc));
    expect(live.accepts(growth)).toBe(false);
    // al reconectar el cliente manda todo su estado: lo que el doc ya tiene no cuenta
    client.getMap('elements').delete('b');
    const whole = Y.encodeStateAsUpdate(client);
    expect(live.accepts(whole)).toBe(true);
    // un update que sólo borra se acepta aunque el doc esté en el límite
    live.maxBytes = 1;
    const before = Y.encodeStateVector(client);
    client.getMap('elements').delete('a');
    expect(live.accepts(Y.encodeStateAsUpdate(client, before))).toBe(true);
    expect(() => live.assertWritable()).toThrow(/tamaño máximo/);
    await live.destroy();
  });

  it('un update que se pasa se descarta y el cliente recibe permissionDenied doc_too_large', async () => {
    const store = new MemoryWorkspaceStore();
    const docs = new DocManager(store, { maxDocBytes: 500 });
    const live = await docs.get('w');
    const sent: Uint8Array[] = [];
    const conn: SyncSocket = { send: b => { sent.push(b); }, isOpen: () => true, close() {} };
    const h = attachConnection(conn, live, 'editor');
    const client = new Y.Doc();
    client.getMap('elements').set('big', 'z'.repeat(2000));
    h.onMessage(step('update', Y.encodeStateAsUpdate(client)));
    expect(live.doc.getMap('elements').get('big')).toBeUndefined();
    const denied = sent.map(b => decoding.createDecoder(b)).find(d => decoding.readVarUint(d) === MSG_AUTH)!;
    expect(decoding.readVarUint(denied)).toBe(0);
    expect(JSON.parse(decoding.readVarString(denied))).toEqual({ error: 'doc_too_large', limit: 500 });
    // uno pequeño sí entra (también como step2)
    const small = new Y.Doc(); small.getMap('meta').set('name', 'ok');
    h.onMessage(step('step2', Y.encodeStateAsUpdate(small)));
    expect(live.doc.getMap('meta').get('name')).toBe('ok');
    h.onClose();
    await docs.closeAll();
  });
});
