/** `POST /api/admin/import` (lo usa `scripts/migrate-from-sqlite.mjs --target do`): secreto con registro vacío, admin después. */
import { SELF, env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { exampleWorkspace } from '@all-draw/core';
import { hashPassword } from '@all-draw/server-core';

const BASE = 'https://alldraw.test';
const SECRET = 'secreto-de-prueba'; // IMPORT_SECRET en vitest.config.ts
const post = (body: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(`${BASE}/api/admin/import`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const T = '2025-01-01T00:00:00.000Z';

describe(`importación de cuentas (${env.DB ? 'D1' : 'RegistryDO'})`, () => {
  it('secreto sólo con el registro vacío; luego admin; INSERT OR IGNORE; scrypt → reset; docs al WorkspaceDO', async () => {
    const pbkdf2 = await hashPassword('contraseña-larga');
    const rows = {
      users: [
        { id: 'usr_admin', email: 'Admin@Example.com', name: 'Admin', password_hash: pbkdf2, is_admin: 1, created_at: T },
        { id: 'usr_viejo', email: 'viejo@example.com', name: 'Viejo', password_hash: 'scrypt$00$11', is_admin: 0, created_at: T },
      ],
      workspaces: [{ id: 'ws_mig', owner_id: 'usr_admin', name: 'Migrado', created_at: T, updated_at: T }],
      members: [{ workspace_id: 'ws_mig', user_id: 'usr_viejo', role: 'viewer', created_at: T }],
      links: [{ token: 'lnk_mig', workspace_id: 'ws_mig', role: 'viewer', created_by: 'usr_admin', created_at: T, expires_at: null }],
      apiKeys: [{ id: 'key_mig', user_id: 'usr_admin', name: 'vieja', prefix: 'adk_12', key_hash: 'abc', created_at: T, last_used_at: null }],
    };
    const ws = exampleWorkspace();

    expect((await post(rows)).status).toBe(401);
    expect((await post(rows, { 'x-import-secret': 'otro' })).status).toBe(403);
    expect((await post({ users: [{ id: 'x' }] }, { 'x-import-secret': SECRET })).status).toBe(400);
    // Clave foránea rota: todo o nada
    const bad = await post({ users: rows.users, members: [{ workspace_id: 'ws_nope', user_id: 'usr_admin', role: 'editor', created_at: T }] }, { 'x-import-secret': SECRET });
    expect(bad.status).toBe(400);

    const first = await post({ ...rows, docs: [{ id: 'ws_mig', workspace: ws }, { id: 'ws_nope', workspace: ws }] }, { 'x-import-secret': SECRET });
    expect(first.status).toBe(200);
    const r = await first.json() as any;
    expect(r.inserted).toEqual({ users: 2, workspaces: 1, members: 1, links: 1, apiKeys: 1 });
    expect(r.needsReset).toEqual([{ id: 'usr_viejo', email: 'viejo@example.com' }]);
    expect(r.docs.imported).toEqual(['ws_mig']);
    expect(r.docs.failed).toEqual([{ id: 'ws_nope', error: expect.stringContaining('no existe') }]);

    // Ya hay usuarios: el secreto deja de valer
    expect((await post(rows, { 'x-import-secret': SECRET })).status).toBe(403);

    const login = await SELF.fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@example.com', password: 'contraseña-larga' }) });
    expect(login.status).toBe(200);
    const token = ((await login.json()) as { token: string }).token;
    const auth = { authorization: `Bearer ${token}` };
    const again = await (await post(rows, auth)).json() as any;
    expect(again.inserted).toEqual({ users: 0, workspaces: 0, members: 0, links: 0, apiKeys: 0 });
    expect(again.skipped).toEqual({ users: 2, workspaces: 1, members: 1, links: 1, apiKeys: 1 });

    const snap = await (await SELF.fetch(`${BASE}/api/workspaces/ws_mig/snapshot`, { headers: auth })).json() as any;
    expect(Object.keys(snap.elements)).toEqual(Object.keys(ws.elements));
    expect((await SELF.fetch(`${BASE}/api/workspaces/ws_mig/snapshot?token=lnk_mig`)).status).toBe(200);
    // El de scrypt no puede entrar (reset$) y no es admin
    const viejo = await SELF.fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'viejo@example.com', password: 'lo-que-sea-123' }) });
    expect(viejo.status).toBe(401);

    // Un usuario normal no puede importar
    const reg = await SELF.fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'normal@example.com', name: 'N', password: 'contraseña-larga' }) });
    const normal = ((await reg.json()) as { token: string }).token;
    expect((await post(rows, { authorization: `Bearer ${normal}` })).status).toBe(403);
    expect((await SELF.fetch(`${BASE}/api/admin/import`, { headers: auth })).status).toBe(405);
  });
});
