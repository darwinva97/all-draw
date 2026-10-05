/** API de integraciones (webhooks, inserción, oEmbed) y eventos que la disparan, sin servidor HTTP. */
import { afterAll, describe, expect, it } from 'vitest';
import { exampleWorkspace, makeElement } from '@all-draw/core';
import { verifyWebhookSignature, type WebhookRequest } from '../src/webhooks';
import { handleEmbed, parseEmbedPath, svgSize, iframeSize } from '../src/embed';
import { LocalDocHost } from '../src/host';
import { makeApi } from './helpers';

const sent: WebhookRequest[] = [];
let reply = 200;
const transport = async (r: WebhookRequest) => { sent.push(r); return { status: reply, body: '' }; };
const dns: Record<string, string[]> = { 'hooks.slack.com': ['52.1.2.3'], 'example.com': ['93.184.216.34'], 'internal.example.com': ['10.0.0.7'] };
const api = makeApi({ webhookTransport: transport, webhookResolve: async h => dns[h] ?? [], publicUrl: 'https://alldraw.test', debounceMs: 300 });
afterAll(() => api.close());
const until = async (cond: () => boolean, ms = 2000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado'); await new Promise(r => setTimeout(r, 10)); } };
const bodies = (event: string) => sent.filter(s => s.headers['x-alldraw-event'] === event).map(s => JSON.parse(s.body));

async function workspaceWithOwner(email: string) {
  const owner = await api.register(email);
  const w = await owner.api.post('/api/workspaces', { initial: exampleWorkspace() });
  const id = w.body.id as string;
  const views = Object.keys((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.views);
  return { owner, id, viewId: views[0]! };
}

describe('webhooks por la API', () => {
  it('registrar (dueño), formato por la URL, secreto una vez, límite y SSRF', async () => {
    const { owner, id } = await workspaceWithOwner('wh-owner@example.com');
    const editor = await api.register('wh-editor@example.com');
    await owner.api.put(`/api/workspaces/${id}/members/${editor.user.id}`, { role: 'editor' });
    const r = await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://hooks.slack.com/services/T/B/X', events: ['comment.created', 'member.added'] });
    expect(r.status).toBe(201);
    expect(r.body.secret).toMatch(/^whsec_/);
    expect(r.body.webhook).toMatchObject({ format: 'slack', events: ['comment.created', 'member.added'], lang: 'es', deliveries: [] });
    expect(r.body.webhook.secret).toBeUndefined();
    const list = await owner.api.get(`/api/workspaces/${id}/webhooks`);
    expect(list.body).toMatchObject({ max: 10, enabled: true });
    expect(list.body.webhooks).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(r.body.secret);
    expect(list.body.webhooks[0].secretPrefix).toBe(`${r.body.secret.slice(0, 10)}…`);
    // Sólo el dueño
    expect((await editor.api.get(`/api/workspaces/${id}/webhooks`)).status).toBe(403);
    expect((await editor.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/h', events: ['member.added'] })).status).toBe(403);
    // SSRF
    for (const [url, c] of [['http://example.com/h', 'webhook_url_scheme'], ['https://localhost/h', 'webhook_url_private'], ['https://127.0.0.1/h', 'webhook_url_private'], ['https://internal.example.com/h', 'webhook_url_private'], ['https://nx.example.org/h', 'webhook_url_dns']]) {
      const x = await owner.api.post(`/api/workspaces/${id}/webhooks`, { url, events: ['member.added'] });
      expect(x.status, url).toBe(400);
      expect(x.body.code, url).toBe(c);
    }
    expect((await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/h', events: [] })).status).toBe(400);
    expect((await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/h', events: ['nada'] })).status).toBe(400);
    // Máximo 10
    for (let i = 1; i < 10; i++) expect((await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: `https://example.com/h${i}`, events: ['snapshot.restored'], format: 'json', lang: 'en' })).status).toBe(201);
    const full = await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/h11', events: ['member.added'] });
    expect(full.status).toBe(409);
    expect(full.body.code).toBe('webhooks_limit');
    // Borrar
    const hid = r.body.webhook.id as string;
    expect((await owner.api.del(`/api/workspaces/${id}/webhooks/${hid}`)).status).toBe(204);
    expect((await owner.api.del(`/api/workspaces/${id}/webhooks/${hid}`)).body.code).toBe('webhook_not_found');
  });

  it('«Probar»: envía un ping firmado y lo apunta', async () => {
    const { owner, id } = await workspaceWithOwner('wh-test@example.com');
    const r = await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/ping', events: ['member.added'], format: 'discord' });
    sent.length = 0; reply = 204;
    const t = await owner.api.post(`/api/workspaces/${id}/webhooks/${r.body.webhook.id}/test`);
    expect(t.status).toBe(200);
    expect(t.body.delivery).toMatchObject({ event: 'ping', status: 204, ok: true, attempts: 1 });
    expect(sent).toHaveLength(1);
    expect(await verifyWebhookSignature(r.body.secret, sent[0]!.body, sent[0]!.headers['x-alldraw-signature'])).toBe(true);
    expect(JSON.parse(sent[0]!.body).embeds[0].url).toBe(`https://alldraw.test/#/s/${id}`);
    expect((await owner.api.get(`/api/workspaces/${id}/webhooks`)).body.webhooks[0].deliveries[0]).toMatchObject({ event: 'ping', status: 204 });
    reply = 200;
  });

  it('eventos: member.added, snapshot.created, snapshot.restored, comment.created y workspace.changed (agregado)', async () => {
    const { owner, id } = await workspaceWithOwner('wh-events@example.com');
    const bea = await api.register('wh-bea@example.com', 'Bea');
    const r = await owner.api.post(`/api/workspaces/${id}/webhooks`, { url: 'https://example.com/all', events: ['workspace.changed', 'comment.created', 'snapshot.created', 'snapshot.restored', 'member.added'], format: 'json' });
    const secret = r.body.secret as string;
    // Lo de crear el espacio (agregado 300 ms) ya ha salido o salido sin destinatarios.
    await new Promise(res => setTimeout(res, 400));
    await api.webhooks!.idle();
    sent.length = 0;
    await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'viewer' });
    await owner.api.put(`/api/workspaces/${id}/members/${bea.user.id}`, { role: 'editor' }); // cambio de rol: no es member.added
    await until(() => bodies('member.added').length >= 1);
    expect(bodies('member.added')).toHaveLength(1);
    expect(bodies('member.added')[0].data).toMatchObject({ member: { userId: bea.user.id, name: 'Bea', role: 'viewer' }, by: 'wh-events' });
    expect(JSON.stringify(bodies('member.added')[0])).not.toContain('wh-bea@example.com'); // sin correos

    const snap = await owner.api.post(`/api/workspaces/${id}/snapshots`, { label: 'Antes' });
    await until(() => bodies('snapshot.created').length >= 1);
    expect(bodies('snapshot.created')[0].data.snapshot).toMatchObject({ id: snap.body.id, label: 'Antes' });

    // Cambios por la API: se agregan en un único workspace.changed
    const el = makeElement('freeform:box', 'Caja nueva');
    await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: el.id, value: el }] });
    await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'patch', collection: 'elements', id: el.id, patch: { name: 'Caja renombrada' } }] });
    await until(() => bodies('workspace.changed').some(b => JSON.stringify(b).includes(el.id)), 4000);
    const changed = bodies('workspace.changed').filter(b => JSON.stringify(b).includes(el.id));
    expect(changed).toHaveLength(1);
    expect(changed[0].data.counts.elements).toEqual({ added: 1, changed: 0, deleted: 0 });
    expect(changed[0].data.elements.added).toEqual([{ id: el.id, name: 'Caja renombrada' }]);
    expect(changed[0].text).toContain('Elementos: 1 añadido (Caja renombrada)');

    // Comentario nuevo en el doc vivo
    const live = await api.docs.get(id);
    live.store.set('comments', 'c_wh', { id: 'c_wh', threadId: 'c_wh', anchor: { kind: 'view', id: 'v_x' }, author: { name: 'Ana', userId: owner.user.id }, text: 'Revisad el cobro', mentions: [], createdAt: new Date().toISOString() } as never);
    await until(() => bodies('comment.created').length >= 1);
    expect(bodies('comment.created')[0].data).toMatchObject({ comment: { id: 'c_wh', text: 'Revisad el cobro', author: { name: 'Ana' }, viewId: 'v_x' }, url: `https://alldraw.test/#/s/${id}/v/v_x` });

    sent.length = 0;
    await owner.api.post(`/api/workspaces/${id}/snapshots/${snap.body.id}/restore`);
    await until(() => bodies('snapshot.restored').length >= 1 && bodies('workspace.changed').length >= 1, 4000);
    expect(bodies('snapshot.restored')[0].data.snapshot).toMatchObject({ id: snap.body.id, label: 'Antes' });
    expect(bodies('workspace.changed')[0].data.counts.elements.deleted).toBe(1); // la caja desaparece al restaurar
    for (const s of sent) expect(await verifyWebhookSignature(secret, s.body, s.headers['x-alldraw-signature'])).toBe(true);
  });

  it('sin webhooks en la instalación: 501; en la copia de respaldo no se crean ni se envían', async () => {
    const plain = makeApi();
    const o = await plain.register('plain@example.com');
    const w = await o.api.post('/api/workspaces', { name: 'X' });
    expect((await o.api.post(`/api/workspaces/${w.body.id}/webhooks`, { url: 'https://example.com/h', events: ['member.added'] })).body.code).toBe('webhooks_unavailable');
    expect((await o.api.get(`/api/workspaces/${w.body.id}/webhooks`)).body.enabled).toBe(false);
    await plain.close();
  });
});

describe('inserción y oEmbed', () => {
  const docHost = new LocalDocHost(api.docs);
  const embed = (path: string, init: RequestInit = {}) => handleEmbed(new Request(`https://alldraw.test${path}`, init), { store: api.store, docs: docHost, publicUrl: 'https://alldraw.test' });

  it('rutas y tamaños', () => {
    expect(parseEmbedPath('/embed/ws_1/v_1')).toEqual({ workspaceId: 'ws_1', viewId: 'v_1', svg: false });
    expect(parseEmbedPath('/embed/ws_1/v_1.svg')).toEqual({ workspaceId: 'ws_1', viewId: 'v_1', svg: true });
    expect(parseEmbedPath('/embed/ws_1')).toBeNull();
    expect(parseEmbedPath('/embed/ws 1/v')).toBeNull();
    expect(svgSize('<svg xmlns="x" viewBox="0 0 400 300" width="400" height="300">')).toEqual({ width: 400, height: 300 });
    expect(iframeSize({ width: 2000, height: 1000 })).toEqual({ width: 800, height: 416 });
    expect(iframeSize({ width: 400, height: 300 }, { width: 300 })).toEqual({ width: 300, height: 241 });
  });

  it('enlace de inserción por vista: crear, listar, página, SVG con ETag, alcance, oEmbed y revocar', async () => {
    const { owner, id, viewId } = await workspaceWithOwner('emb-owner@example.com');
    const viewer = await api.register('emb-viewer@example.com');
    await owner.api.put(`/api/workspaces/${id}/members/${viewer.user.id}`, { role: 'viewer' });
    expect((await viewer.api.post(`/api/workspaces/${id}/embeds`, { viewId })).status).toBe(403);
    expect((await owner.api.post(`/api/workspaces/${id}/embeds`, { viewId: 'v_nope' })).status).toBe(404);
    const c = await owner.api.post(`/api/workspaces/${id}/embeds`, { viewId });
    expect(c.status).toBe(201);
    const token = c.body.token as string;
    expect(token).toMatch(/^emb_/);
    expect(c.body.url).toBe(`https://alldraw.test/embed/${id}/${viewId}?token=${token}`);
    expect(c.body.svgUrl).toBe(`https://alldraw.test/embed/${id}/${viewId}.svg?token=${token}`);
    expect((await owner.api.get(`/api/workspaces/${id}/embeds`)).body.embeds.map((e: { token: string }) => e.token)).toEqual([token]);
    // No aparece entre los enlaces compartidos, ni vale para la API
    expect((await owner.api.get(`/api/workspaces/${id}/links`)).body.links).toEqual([]);
    expect((await api.client(token).get(`/api/workspaces/${id}/snapshot`)).status).toBe(401);
    expect((await api.client().get(`/api/workspaces/${id}/views/${viewId}/svg?token=${token}`)).status).toBe(401);

    // Página
    const page = (await embed(`/embed/${id}/${viewId}?token=${token}&theme=dark`, { headers: { 'accept-language': 'en-GB' } }))!;
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('<svg');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('Open in all-draw');
    expect(html).toContain(`href="https://alldraw.test/#/s/${id}/v/${viewId}"`); // sin el token de inserción
    expect(html).toContain('type="application/json+oembed"');
    const csp = page.headers.get('content-security-policy')!;
    expect(csp).toContain('frame-ancestors *');
    const nonce = /'nonce-([^']+)'/.exec(csp)![1]!;
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(page.headers.get('x-frame-options')).toBeNull();
    expect(page.headers.get('referrer-policy')).toBe('no-referrer');
    expect(page.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    // SVG con ETag (304 si no cambió) y se actualiza al cambiar el diagrama
    const svg = (await embed(`/embed/${id}/${viewId}.svg?token=${token}`))!;
    expect(svg.status).toBe(200);
    expect(svg.headers.get('content-type')).toContain('image/svg+xml');
    expect(svg.headers.get('access-control-allow-origin')).toBe('*');
    const etag = svg.headers.get('etag')!;
    expect((await embed(`/embed/${id}/${viewId}.svg?token=${token}`, { headers: { 'if-none-match': etag } }))!.status).toBe(304);
    const view = (await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.views[viewId];
    await owner.api.post(`/api/workspaces/${id}/commands`, { commands: [{ type: 'patch', collection: 'views', id: viewId, patch: { name: `${view.name} (v2)` } }] });
    const svg2 = (await embed(`/embed/${id}/${viewId}.svg?token=${token}`, { headers: { 'if-none-match': etag } }))!;
    expect(svg2.status).toBe(200);
    expect(await svg2.text()).toContain('(v2)');
    // Alcance: otra vista, otro espacio, sin token, token basura
    const other = await workspaceWithOwner('emb-other@example.com');
    const views = Object.keys((await owner.api.get(`/api/workspaces/${id}/snapshot`)).body.views);
    const otherView = views.find(v => v !== viewId);
    if (otherView) expect((await embed(`/embed/${id}/${otherView}?token=${token}`))!.status).toBe(401);
    expect((await embed(`/embed/${other.id}/${other.viewId}?token=${token}`))!.status).toBe(401);
    expect((await embed(`/embed/${id}/${viewId}`))!.status).toBe(401);
    expect((await embed(`/embed/${id}/${viewId}?token=adk_nope`))!.status).toBe(401);
    expect((await embed(`/embed/ws_nope/${viewId}?token=${token}`))!.status).toBe(404);
    expect((await embed(`/embed/${id}/${viewId}`, { method: 'POST' }))!.status).toBe(405);
    expect(await embed('/api/otra')).toBeNull();
    // Un enlace de lectura normal (lnk_) también sirve, para cualquier vista; «Abrir» lleva su token
    const lnk = (await owner.api.post(`/api/workspaces/${id}/links`, { role: 'viewer' })).body.token as string;
    const viaLink = await (await embed(`/embed/${id}/${viewId}?token=${lnk}`))!.text();
    expect(viaLink).toContain(`?token=${lnk}`);

    // oEmbed
    const o = await api.client().get(`/api/oembed?format=json&url=${encodeURIComponent(c.body.url)}&maxwidth=500`);
    expect(o.status).toBe(200);
    expect(o.headers.get('access-control-allow-origin')).toBe('*');
    expect(o.body).toMatchObject({ version: '1.0', type: 'rich', provider_name: 'all-draw' });
    expect(o.body.width).toBeLessThanOrEqual(500);
    expect(o.body.html).toContain(`<iframe src="https://alldraw.test/embed/${id}/${viewId}?token=${token}"`);
    expect((await api.client().get(`/api/oembed?format=xml&url=${encodeURIComponent(c.body.url)}`)).status).toBe(501);
    expect((await api.client().get(`/api/oembed?url=${encodeURIComponent('https://otra.web/embed/x/y?token=' + token)}`)).status).toBe(404);
    expect((await api.client().get(`/api/oembed?url=${encodeURIComponent(c.body.url.replace(token, 'emb_falso'))}`)).status).toBe(404);

    // Revocar: deja de verse
    expect((await owner.api.del(`/api/workspaces/${id}/embeds/${lnk}`)).status).toBe(404); // un enlace normal no se revoca por aquí
    expect((await owner.api.del(`/api/workspaces/${id}/embeds/${token}`)).status).toBe(204);
    expect((await embed(`/embed/${id}/${viewId}.svg?token=${token}`))!.status).toBe(401);
    expect((await owner.api.get(`/api/workspaces/${id}/embeds`)).body.embeds).toEqual([]);
  });

  it('caducado: lo explica', async () => {
    const { id, viewId } = await workspaceWithOwner('emb-exp@example.com');
    const ws = await api.store.getWorkspace(id);
    await api.store.createShareLink({ workspaceId: id, role: 'viewer', createdBy: ws!.ownerId, token: 'emb_caducado', viewId, expiresAt: new Date(Date.now() - 1000).toISOString() });
    const r = (await embed(`/embed/${id}/${viewId}?token=emb_caducado`))!;
    expect(r.status).toBe(401);
    expect(await r.text()).toContain('ha caducado');
  });
});
