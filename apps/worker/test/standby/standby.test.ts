/**
 * Proyecto `standby` (`STANDBY="true"`): el worker como copia de respaldo de solo lectura del VPS.
 *   - `GET /api/status` → `standby: true` y `primaryUrl`;
 *   - escrituras → 503 `code: 'standby'`, salvo entrar/salir; el WebSocket entra como viewer aunque seas el dueño;
 *   - `POST /api/admin/import` con `X-Import-Secret` aunque haya usuarios y `replace: true` (sincronización nocturna):
 *     borra lo que no está en el origen (y vacía el DO de los espacios borrados), sobrescribe el resto, no toca los docs
 *     idénticos y conserva las sesiones de quien sigue;
 *   - rate limit con el binding de Workers (`RL_LOGIN`) cuando hay `CF-Connecting-IP`.
 */
import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { exampleWorkspace, makeElement, type Workspace } from '@all-draw/core';
import { hashPassword } from '@all-draw/server-core';

const BASE = 'https://alldraw.test';
const SECRET = 'secreto-de-prueba'; // IMPORT_SECRET en vitest.config.ts
const T = '2025-01-01T00:00:00.000Z';
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
const call = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(BASE + p, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }).then(j);
const sync = (body: unknown) => call('POST', '/api/admin/import', body, { 'x-import-secret': SECRET });
const login = (email: string, password = 'contraseña-larga', headers: Record<string, string> = {}) => call('POST', '/api/auth/login', { email, password }, headers);

function wsWith(name: string, extra?: string): Workspace {
  const ws = exampleWorkspace();
  ws.meta = { ...ws.meta, name };
  if (extra) { const el = makeElement('freeform:box', extra); ws.elements[el.id] = el; }
  return ws;
}

describe('copia de respaldo de solo lectura (STANDBY)', () => {
  it('status, sincronización con replace, escrituras 503, sesión permitida, WebSocket viewer', async () => {
    const st = await call('GET', '/api/status');
    expect(st.status).toBe(200);
    expect(st.body).toMatchObject({ standby: true, primaryUrl: 'https://alldraw.bezenti.com' });

    const pw = await hashPassword('contraseña-larga');
    const base = {
      users: [
        { id: 'usr_admin', email: 'admin@example.com', name: 'Admin', password_hash: pw, is_admin: 1, created_at: T },
        { id: 'usr_bob', email: 'bob@example.com', name: 'Bob', password_hash: pw, is_admin: 0, created_at: T },
      ],
      workspaces: [
        { id: 'ws_a', owner_id: 'usr_admin', name: 'A', created_at: T, updated_at: T },
        { id: 'ws_b', owner_id: 'usr_bob', name: 'B', created_at: T, updated_at: T },
      ],
      members: [{ workspace_id: 'ws_a', user_id: 'usr_bob', role: 'editor', created_at: T }],
      links: [{ token: 'lnk_a', workspace_id: 'ws_a', role: 'viewer', created_by: 'usr_admin', created_at: T, expires_at: null }],
      apiKeys: [{ id: 'key_bob', user_id: 'usr_bob', name: 'k', prefix: 'adk_1', key_hash: 'h1', created_at: T, last_used_at: null }],
    };
    // replace exige los cinco grupos
    expect((await sync({ users: base.users, replace: true })).status).toBe(400);
    const first = await sync({ ...base, replace: true, docs: [{ id: 'ws_a', workspace: wsWith('A') }, { id: 'ws_b', workspace: wsWith('B') }] });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ replaced: true, inserted: { users: 2, workspaces: 2, members: 1, links: 1, apiKeys: 1 }, docs: { imported: ['ws_a', 'ws_b'], failed: [] } });

    // Sesión: entrar sí; escribir no (503 standby con la URL principal)
    const admin = await login('admin@example.com');
    expect(admin.status).toBe(200);
    const auth = { authorization: `Bearer ${admin.body.token}` };
    expect((await call('GET', '/api/workspaces', undefined, auth)).body.workspaces).toHaveLength(2);
    for (const [m, p, b] of [
      ['POST', '/api/workspaces', { name: 'nuevo' }], ['PUT', '/api/workspaces/ws_a/snapshot', wsWith('A')],
      ['POST', '/api/workspaces/ws_a/commands', { commands: [{ type: 'meta', patch: { description: 'x' } }] }],
      ['PATCH', '/api/workspaces/ws_a', { name: 'otro' }], ['DELETE', '/api/workspaces/ws_a', undefined], ['POST', '/api/keys', { name: 'k' }],
      ['POST', '/api/workspaces/ws_a/links', { role: 'viewer' }], ['PATCH', '/api/auth/me', { name: 'Yo' }],
    ] as const) {
      const r = await call(m, p, b, auth);
      expect(r.status, `${m} ${p}`).toBe(503);
      expect(r.body).toMatchObject({ code: 'standby', primaryUrl: 'https://alldraw.bezenti.com' });
    }
    expect((await call('POST', '/api/auth/register', { email: 'x@example.com', name: 'X', password: 'contraseña-larga' })).body.code).toBe('standby');
    expect((await call('GET', '/api/workspaces/ws_a/snapshot', undefined, auth)).status).toBe(200);
    expect((await call('POST', '/api/client-errors', { message: 'boom' })).status).toBe(204);

    // WebSocket: el dueño entra como viewer y sus cambios se rechazan con read-only
    const res = await SELF.fetch(`${BASE}/ws/ws_a?token=${admin.body.token}`, { headers: { upgrade: 'websocket' } });
    expect(res.status).toBe(101);
    const ws = res.webSocket!;
    const messages: Uint8Array[] = [];
    ws.addEventListener('message', (e: { data: unknown }) => { void (async () => { const d = e.data; if (d instanceof ArrayBuffer) messages.push(new Uint8Array(d)); else if (d instanceof Blob) messages.push(new Uint8Array(await d.arrayBuffer())); })(); });
    ws.accept();
    const intruso = new Y.Doc(); intruso.getMap('elements').set('el_hack', { id: 'el_hack' });
    const enc = encoding.createEncoder(); encoding.writeVarUint(enc, 0); syncProtocol.writeUpdate(enc, Y.encodeStateAsUpdate(intruso));
    ws.send(encoding.toUint8Array(enc));
    const t0 = Date.now();
    while (!messages.some(m => m[0] === 2) && Date.now() - t0 < 5000) await new Promise(r => setTimeout(r, 10));
    const denied = messages.find(m => m[0] === 2)!;
    const d = decoding.createDecoder(denied); decoding.readVarUint(d); decoding.readVarUint(d);
    expect(JSON.parse(decoding.readVarString(d))).toEqual({ error: 'read-only' });
    ws.close(1000, 'fin');
    expect((await call('GET', '/api/workspaces/ws_a/snapshot', undefined, auth)).body.elements.el_hack).toBeUndefined();

    // Segunda noche: Bob ya no existe (Carol hereda su correo), ws_b se borró, cambia el miembro y el enlace, y A cambia
    const second = {
      users: [
        { id: 'usr_admin', email: 'admin@example.com', name: 'Admin Renombrado', password_hash: pw, is_admin: 1, created_at: T },
        { id: 'usr_carol', email: 'bob@example.com', name: 'Carol', password_hash: pw, is_admin: 0, created_at: T },
      ],
      workspaces: [{ id: 'ws_a', owner_id: 'usr_admin', name: 'A2', created_at: T, updated_at: '2025-02-01T00:00:00.000Z' }],
      members: [{ workspace_id: 'ws_a', user_id: 'usr_carol', role: 'viewer', created_at: T }],
      links: [{ token: 'lnk_a2', workspace_id: 'ws_a', role: 'editor', created_by: 'usr_admin', created_at: T, expires_at: null }],
      apiKeys: [],
    };
    const a2 = wsWith('A2', 'Nuevo en el VPS');
    const r2 = await sync({ ...second, replace: true, docs: [{ id: 'ws_a', workspace: a2 }] });
    expect(r2.status).toBe(200);
    expect(r2.body).toMatchObject({ deleted: { users: 1, workspaces: 1, links: 1, members: 1 }, removedWorkspaces: ['ws_b'], docs: { imported: ['ws_a'], unchanged: [] } });

    // La sesión del admin sigue; ve sólo ws_a con el nombre nuevo y el contenido nuevo
    const me = await call('GET', '/api/auth/me', undefined, auth);
    expect(me.body.user.name).toBe('Admin Renombrado');
    const list = await call('GET', '/api/workspaces', undefined, auth);
    expect(list.body.workspaces.map((w: { id: string; name: string }) => [w.id, w.name])).toEqual([['ws_a', 'A2']]);
    expect(Object.keys((await call('GET', '/api/workspaces/ws_a/snapshot', undefined, auth)).body.elements)).toEqual(Object.keys(a2.elements));
    expect((await call('GET', '/api/workspaces/ws_b', undefined, auth)).status).toBe(404);
    // El DO del espacio borrado quedó vacío
    const doB = env.WORKSPACES.get(env.WORKSPACES.idFromName('ws_b'));
    expect(Object.keys((await (await doB.fetch('https://do/snapshot')).json() as Workspace).elements ?? {})).toHaveLength(0);
    // Enlaces y miembros como en el origen; Carol entra con el correo que era de Bob
    expect((await call('GET', '/api/workspaces/ws_a?token=lnk_a')).status).toBe(401);
    expect((await call('GET', '/api/workspaces/ws_a?token=lnk_a2')).body.role).toBe('editor');
    const carol = await login('bob@example.com');
    expect(carol.body.user.id).toBe('usr_carol');
    expect((await call('GET', '/api/workspaces/ws_a', undefined, { authorization: `Bearer ${carol.body.token}` })).body.role).toBe('viewer');

    // Tercera noche sin cambios: el doc no se toca
    const r3 = await sync({ ...second, replace: true, docs: [{ id: 'ws_a', workspace: a2 }] });
    expect(r3.body.docs).toMatchObject({ imported: [], unchanged: ['ws_a'] });

    expect((await call('POST', '/api/auth/logout', undefined, auth)).status).toBe(204);
    expect((await call('GET', '/api/auth/me', undefined, auth)).status).toBe(401);
  });

  it('rate limit del binding RL_LOGIN por IP (CF-Connecting-IP); sin IP del borde no se limita aquí', async () => {
    const ip = { 'cf-connecting-ip': '203.0.113.9' };
    const statuses: number[] = [];
    // Correos distintos: el limitador en memoria (10 por IP+correo, 30 por IP) no salta; el del binding (10/min) sí.
    for (let i = 0; i < 11; i++) statuses.push((await login(`nadie${i}@example.com`, 'mala-contraseña', ip)).status);
    expect(statuses.slice(0, 10).every(s => s === 401)).toBe(true);
    const last = await SELF.fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...ip }, body: JSON.stringify({ email: 'otro@example.com', password: 'x' }) });
    expect(statuses[10]).toBe(429);
    expect(last.status).toBe(429);
    expect(last.headers.get('retry-after')).toBe('60');
    expect(await last.json()).toMatchObject({ code: 'too_many_attempts' });
    // Otra IP sigue pudiendo
    expect((await login('nadie@example.com', 'mala-contraseña', { 'cf-connecting-ip': '203.0.113.10' })).status).toBe(401);
  });
});
