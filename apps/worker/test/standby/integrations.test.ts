/**
 * Integraciones en la copia de respaldo (`STANDBY="true"`): los webhooks no se crean (503) ni se envían (el DO no manda
 * nada aunque le llegue un evento); los enlaces de inserción sincronizados (`view_id`) siguen funcionando (son de lectura).
 */
import { SELF, env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { exampleWorkspace } from '@all-draw/core';
import { WebhookDispatcher, hashPassword, jsonLogger, type WebhookRequest } from '@all-draw/server-core';
import { registryFromEnv } from '../../src/mail-env';

const BASE = 'https://alldraw.test';
const T = '2025-01-01T00:00:00.000Z';
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
const call = (method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
  SELF.fetch(BASE + p, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }).then(j);

describe('integraciones en la copia de respaldo', () => {
  it('webhooks: 503 al crear, `enabled: false` y el DO no envía; inserción: funciona', async () => {
    const ws = exampleWorkspace();
    const viewId = Object.keys(ws.views)[0]!;
    const pw = await hashPassword('contraseña-larga');
    const sync = await call('POST', '/api/admin/import', {
      replace: true,
      users: [{ id: 'usr_o', email: 'o@example.com', name: 'O', password_hash: pw, is_admin: 1, created_at: T }],
      workspaces: [{ id: 'ws_i', owner_id: 'usr_o', name: 'I', created_at: T, updated_at: T }],
      members: [], apiKeys: [],
      links: [{ token: 'emb_sincronizado', workspace_id: 'ws_i', role: 'viewer', created_by: 'usr_o', created_at: T, expires_at: null, view_id: viewId }],
      docs: [{ id: 'ws_i', workspace: ws }],
    }, { 'x-import-secret': 'secreto-de-prueba' });
    expect(sync.status).toBe(200);
    const login = await call('POST', '/api/auth/login', { email: 'o@example.com', password: 'contraseña-larga' });
    const auth = { authorization: `Bearer ${login.body.token}` };
    const w = await call('POST', '/api/workspaces/ws_i/webhooks', { url: 'https://93.184.216.34/h', events: ['member.added'] }, auth);
    expect(w.status).toBe(503);
    expect(w.body.code).toBe('standby');
    expect((await call('GET', '/api/workspaces/ws_i/webhooks', undefined, auth)).body).toMatchObject({ webhooks: [], enabled: false });

    // Aunque al DO le llegue un evento, no envía nada
    const sent: WebhookRequest[] = [];
    const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName('ws_i'));
    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { webhooks: WebhookDispatcher }).webhooks = new WebhookDispatcher({ store: registryFromEnv(env), logger: jsonLogger({ level: 'silent' }), transport: async r => { sent.push(r); return { status: 200, body: '' }; } });
    });
    const r = await stub.fetch(new Request('https://do/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'x-alldraw-workspace': 'ws_i' }, body: JSON.stringify({ event: 'member.added', data: {} }) }));
    expect(r.status).toBe(200);
    await new Promise(res => setTimeout(res, 50));
    expect(sent).toEqual([]);

    // El enlace de inserción sincronizado (con su vista) se ve
    const page = await SELF.fetch(`${BASE}/embed/ws_i/${viewId}?token=emb_sincronizado`);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<svg');
    expect(html).toContain('Copia de respaldo de solo lectura');
  });
});
