/**
 * Integraciones en workerd: webhooks (API en el worker, envío desde el `WorkspaceDO` con `ctx.waitUntil`, `workspace.changed`
 * agregado en el storage del DO y enviado por `alarm()`) e inserción (`/embed`, oEmbed). El transporte de los webhooks del
 * DO se sustituye por uno falso (`runInDurableObject`): los tests no salen a la red.
 */
import { SELF, env, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { exampleWorkspace, makeElement } from '@all-draw/core';
import { WebhookDispatcher, jsonLogger, verifyWebhookSignature, type WebhookRequest } from '@all-draw/server-core';
import { registryFromEnv } from '../src/mail-env';

const BASE = 'https://alldraw.test';
const j = async (res: Response) => ({ status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) as any, headers: res.headers });
const client = (token?: string) => {
  const headers = (extra: Record<string, string> = {}) => ({ ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra });
  return {
    get: (p: string) => SELF.fetch(BASE + p, { headers: headers() }).then(j),
    del: (p: string) => SELF.fetch(BASE + p, { method: 'DELETE', headers: headers() }).then(j),
    post: (p: string, body?: unknown) => SELF.fetch(BASE + p, { method: 'POST', headers: headers({ 'content-type': 'application/json' }), body: JSON.stringify(body ?? {}) }).then(j),
  };
};
async function owner(email: string) {
  const r = await client().post('/api/auth/register', { email, name: email.split('@')[0], password: 'contraseña-larga' });
  if (r.status !== 201) throw new Error(`registro falló: ${r.status} ${JSON.stringify(r.body)}`);
  const api = client(r.body.token);
  const w = await api.post('/api/workspaces', { initial: exampleWorkspace() });
  const views = Object.keys((await api.get(`/api/workspaces/${w.body.id}/snapshot`)).body.views);
  return { api, id: w.body.id as string, viewId: views[0]! };
}
const until = async (cond: () => boolean, ms = 5000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado'); await new Promise(r => setTimeout(r, 20)); } };

/** Sustituye el repartidor del DO del espacio por uno con transporte falso; devuelve lo que «envía». */
async function fakeDoTransport(workspaceId: string) {
  const sent: WebhookRequest[] = [];
  const stub = env.WORKSPACES.get(env.WORKSPACES.idFromName(workspaceId));
  await runInDurableObject(stub, async (instance: unknown, state) => {
    (instance as { webhooks: WebhookDispatcher }).webhooks = new WebhookDispatcher({
      store: registryFromEnv(env), logger: jsonLogger({ level: 'silent' }), publicUrl: 'https://alldraw.test',
      transport: async r => { sent.push(r); return { status: 200, body: 'ok' }; }, schedule: p => state.waitUntil(p),
    });
  });
  return { sent, stub };
}

describe(`worker: integraciones (${env.DB ? 'D1' : 'RegistryDO'})`, () => {
  it('webhooks: alta (sólo https públicas), lista sin secreto, límite y baja', async () => {
    const o = await owner(`wk-wh-${env.DB ? 'd1' : 'do'}@example.com`);
    const r = await o.api.post(`/api/workspaces/${o.id}/webhooks`, { url: 'https://93.184.216.34/hook', events: ['snapshot.created'] });
    expect(r.status).toBe(201);
    expect(r.body.secret).toMatch(/^whsec_/);
    expect(r.body.webhook.format).toBe('json');
    for (const [url, c] of [['http://93.184.216.34/h', 'webhook_url_scheme'], ['https://10.0.0.1/h', 'webhook_url_private'], ['https://localhost/h', 'webhook_url_private']]) {
      expect((await o.api.post(`/api/workspaces/${o.id}/webhooks`, { url, events: ['member.added'] })).body.code, url).toBe(c);
    }
    const list = await o.api.get(`/api/workspaces/${o.id}/webhooks`);
    expect(list.body.enabled).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain(r.body.secret);
    expect((await o.api.del(`/api/workspaces/${o.id}/webhooks/${r.body.webhook.id}`)).status).toBe(204);
    expect((await o.api.get(`/api/workspaces/${o.id}/webhooks`)).body.webhooks).toEqual([]);
  });

  it('el DO envía los eventos de la API (snapshot.created) y workspace.changed por alarm()', async () => {
    const o = await owner(`wk-ev-${env.DB ? 'd1' : 'do'}@example.com`);
    const { sent, stub } = await fakeDoTransport(o.id);
    const r = await o.api.post(`/api/workspaces/${o.id}/webhooks`, { url: 'https://93.184.216.34/hook', events: ['snapshot.created', 'workspace.changed', 'comment.created'], format: 'slack' });
    expect(r.status).toBe(201);
    await o.api.post(`/api/workspaces/${o.id}/snapshots`, { label: 'Hito' });
    await until(() => sent.some(s => s.headers['x-alldraw-event'] === 'snapshot.created'));
    const snap = sent.find(s => s.headers['x-alldraw-event'] === 'snapshot.created')!;
    expect(await verifyWebhookSignature(r.body.secret, snap.body, snap.headers['x-alldraw-signature'])).toBe(true);
    expect(JSON.parse(snap.body).text).toContain('Hito');

    const el = makeElement('freeform:box', 'Desde el worker');
    await o.api.post(`/api/workspaces/${o.id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el.id, value: el }] });
    // Pendiente en el storage del DO hasta que salta la alarma (WEBHOOKS_DEBOUNCE_MS = 100 en los tests)
    const pending = await runInDurableObject(stub, async (_i, state) => state.storage.get<{ due: number }>('wh:changes'));
    expect(pending?.due).toBeGreaterThan(0);
    await new Promise(res => setTimeout(res, 150));
    await runDurableObjectAlarm(stub);
    await until(() => sent.some(s => s.headers['x-alldraw-event'] === 'workspace.changed'));
    const changed = JSON.parse(sent.find(s => s.headers['x-alldraw-event'] === 'workspace.changed')!.body);
    expect(changed.text).toContain('Desde el worker');
    expect(await runInDurableObject(stub, async (_i, state) => state.storage.get('wh:changes'))).toBeUndefined();
    const log = (await o.api.get(`/api/workspaces/${o.id}/webhooks`)).body.webhooks[0].deliveries;
    expect(log.map((d: { event: string }) => d.event)).toEqual(expect.arrayContaining(['snapshot.created', 'workspace.changed']));
  });

  it('/embed: página incrustable, SVG, oEmbed y revocar', async () => {
    const o = await owner(`wk-emb-${env.DB ? 'd1' : 'do'}@example.com`);
    const e = await o.api.post(`/api/workspaces/${o.id}/embeds`, { viewId: o.viewId });
    expect(e.status).toBe(201);
    const page = await SELF.fetch(e.body.url);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain('frame-ancestors *');
    expect(page.headers.get('x-frame-options')).toBeNull();
    expect(await page.text()).toContain('<svg');
    const svg = await SELF.fetch(e.body.svgUrl);
    expect(svg.headers.get('content-type')).toContain('image/svg+xml');
    expect((await SELF.fetch(e.body.svgUrl, { headers: { 'if-none-match': svg.headers.get('etag')! } })).status).toBe(304);
    const o2 = await client().get(`/api/oembed?url=${encodeURIComponent(e.body.url)}&format=json`);
    expect(o2.body).toMatchObject({ type: 'rich', provider_name: 'all-draw' });
    // El token de inserción no vale para la API
    expect((await client(e.body.token).get(`/api/workspaces/${o.id}/snapshot`)).status).toBe(401);
    expect((await (await SELF.fetch(`${BASE}/api/status`)).headers.get('x-frame-options'))).toBe('SAMEORIGIN');
    expect((await o.api.del(`/api/workspaces/${o.id}/embeds/${e.body.token}`)).status).toBe(204);
    expect((await SELF.fetch(e.body.svgUrl)).status).toBe(401);
  });
});
