/** Integraciones en el servidor Node real: webhooks con el transporte de Node, `/embed` y el MCP remoto `POST /mcp`. */
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { exampleWorkspace } from '@all-draw/core';
import { WebhookUrlError, redactPath, redactTokens, verifyWebhookSignature } from '@all-draw/server-core';
import { routeOf } from '../src/metrics';
import { nodeTransport, safeLookup } from '../src/webhook-transport';
import { viewsOf } from '../src/mcp-tools';
import { client, startServer, type TestServer } from './helpers';

interface Hit { headers: http.IncomingHttpHeaders; body: string; path: string }
let receiver: http.Server; let hits: Hit[] = []; let rport = 0; let replyStatus = 200;
let srv: TestServer;

beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      hits.push({ headers: req.headers, body, path: req.url ?? '' });
      if (req.url === '/lento') { setTimeout(() => { res.writeHead(200); res.end(); }, 3000); return; }
      if (req.url === '/grande') { res.writeHead(200); res.end('x'.repeat(200_000)); return; }
      res.writeHead(replyStatus, { 'content-type': 'text/plain' }); res.end('vale');
    });
  });
  await new Promise<void>(r => receiver.listen(0, '127.0.0.1', () => r()));
  rport = (receiver.address() as { port: number }).port;
  srv = await startServer({ config: { webhooksAllowPrivate: true, webhooksRetryBaseMs: 10, webhooksDebounceMs: 200, publicUrl: 'https://alldraw.test' } });
});
afterAll(async () => { await srv.close(); await new Promise(r => receiver.close(r)); });

const until = async (cond: () => boolean, ms = 4000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error('tiempo agotado'); await new Promise(r => setTimeout(r, 20)); } };
async function owner(email: string) {
  const r = await client(srv.url).post('/api/auth/register', { email, name: email.split('@')[0], password: 'contraseña-larga' });
  const api = client(srv.url, r.body.token);
  const w = await api.post('/api/workspaces', { initial: exampleWorkspace() });
  const views = Object.keys((await api.get(`/api/workspaces/${w.body.id}/snapshot`)).body.views);
  return { token: r.body.token as string, api, id: w.body.id as string, viewId: views[0]! };
}

describe('webhooks en Node', () => {
  it('entrega firmada al receptor local (WEBHOOKS_ALLOW_PRIVATE), reintentos y workspace.changed', async () => {
    const o = await owner('node-wh@example.com');
    const r = await o.api.post(`/api/workspaces/${o.id}/webhooks`, { url: `http://127.0.0.1:${rport}/hook`, events: ['workspace.changed', 'snapshot.created'], format: 'json' });
    expect(r.status).toBe(201);
    // Lo de crear el espacio (agregado 200 ms) sale antes de empezar a mirar.
    await new Promise(res => setTimeout(res, 300));
    await srv.app.webhooks.idle();
    hits = [];
    const t = await o.api.post(`/api/workspaces/${o.id}/webhooks/${r.body.webhook.id}/test`);
    expect(t.body.delivery).toMatchObject({ ok: true, status: 200, event: 'ping' });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.headers['x-alldraw-event']).toBe('ping');
    expect(hits[0]!.headers['user-agent']).toContain('all-draw-webhooks');
    expect(await verifyWebhookSignature(r.body.secret, hits[0]!.body, String(hits[0]!.headers['x-alldraw-signature']))).toBe(true);

    // 503 → reintenta hasta que responde 200
    hits = []; replyStatus = 503;
    await o.api.post(`/api/workspaces/${o.id}/snapshots`, { label: 'uno' });
    await until(() => hits.length >= 2);
    replyStatus = 200;
    await until(() => hits.some(h => h.headers['x-alldraw-event'] === 'snapshot.created') && hits.length >= 3);
    await srv.app.webhooks.idle();
    const d = (await o.api.get(`/api/workspaces/${o.id}/webhooks`)).body.webhooks[0].deliveries.find((x: { event: string }) => x.event === 'snapshot.created');
    expect(d).toMatchObject({ ok: true, status: 200, pending: false });
    expect(d.attempts).toBeGreaterThanOrEqual(3);

    hits = [];
    await o.api.patch(`/api/workspaces/${o.id}`, { name: 'Renombrado' });
    await o.api.post(`/api/workspaces/${o.id}/commands`, { commands: [{ type: 'set', collection: 'elements', id: 'el_node_wh', value: { id: 'el_node_wh', typeId: 'freeform:box', name: 'Nodo' } }] });
    const mine = () => hits.find(h => h.headers['x-alldraw-event'] === 'workspace.changed' && h.body.includes('el_node_wh'));
    await until(() => !!mine());
    const body = JSON.parse(mine()!.body);
    expect(body.data.elements.added).toEqual([{ id: 'el_node_wh', name: 'Nodo' }]);
    expect(body.workspace).toMatchObject({ id: o.id, name: 'Renombrado', url: `https://alldraw.test/#/s/${o.id}` });
  });

  it('sin WEBHOOKS_ALLOW_PRIVATE: ni http ni localhost; el lookup del socket rechaza IPs privadas', async () => {
    const strict = await startServer({ config: { webhooksAllowPrivate: false } });
    try {
      const r = await client(strict.url).post('/api/auth/register', { email: 'strict@example.com', name: 'S', password: 'contraseña-larga' });
      const api = client(strict.url, r.body.token);
      const w = await api.post('/api/workspaces', { name: 'S' });
      expect((await api.post(`/api/workspaces/${w.body.id}/webhooks`, { url: `http://127.0.0.1:${rport}/hook`, events: ['member.added'] })).body.code).toBe('webhook_url_scheme');
      expect((await api.post(`/api/workspaces/${w.body.id}/webhooks`, { url: `https://127.0.0.1:${rport}/hook`, events: ['member.added'] })).body.code).toBe('webhook_url_private');
      expect((await api.post(`/api/workspaces/${w.body.id}/webhooks`, { url: 'https://localhost/hook', events: ['member.added'] })).body.code).toBe('webhook_url_private');
    } finally { await strict.close(); }
    // El `lookup` del socket: `localhost` resuelve a 127.0.0.1 → rechazado (protege del DNS rebinding)
    const err = await new Promise<Error | null>(res => safeLookup({})('localhost', {}, e => res(e)));
    expect(err).toBeInstanceOf(WebhookUrlError);
    const ok = await new Promise<string | null>(res => safeLookup({ allowPrivate: true })('localhost', {}, (e, a) => res(e ? null : String(a))));
    expect(ok).toMatch(/127\.0\.0\.1|::1/);
    // El transporte: IP privada en la URL, rechazada antes de conectar; respuesta grande, cortada; tiempo máximo
    await expect(nodeTransport({})({ url: `https://127.0.0.1:${rport}/x`, body: '{}', headers: {}, timeoutMs: 1000, maxResponseBytes: 100 })).rejects.toBeInstanceOf(WebhookUrlError);
    const big = await nodeTransport({ allowPrivate: true })({ url: `http://127.0.0.1:${rport}/grande`, body: '{}', headers: {}, timeoutMs: 2000, maxResponseBytes: 1000 });
    expect(big.body).toHaveLength(1000);
    await expect(nodeTransport({ allowPrivate: true })({ url: `http://127.0.0.1:${rport}/lento`, body: '{}', headers: {}, timeoutMs: 200, maxResponseBytes: 100 })).rejects.toThrow(/sin respuesta/);
  });
});

describe('inserción en Node', () => {
  it('/embed se deja incrustar; el resto no', async () => {
    const o = await owner('node-emb@example.com');
    const e = await o.api.post(`/api/workspaces/${o.id}/embeds`, { viewId: o.viewId });
    expect(e.body.url).toBe(`https://alldraw.test/embed/${o.id}/${o.viewId}?token=${e.body.token}`);
    const page = await fetch(`${srv.url}/embed/${o.id}/${o.viewId}?token=${e.body.token}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain('frame-ancestors *');
    expect(page.headers.get('content-security-policy')).toMatch(/script-src 'nonce-/);
    expect(page.headers.get('x-frame-options')).toBeNull();
    expect(page.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(await page.text()).toContain('<svg');
    const img = await fetch(`${srv.url}/embed/${o.id}/${o.viewId}.svg?token=${e.body.token}&theme=light`);
    expect(img.headers.get('content-type')).toContain('image/svg+xml');
    const api = await fetch(`${srv.url}/api/status`);
    expect(api.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(api.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    expect((await fetch(`${srv.url}/embed/${o.id}/${o.viewId}?token=nada`)).status).toBe(401);
  });
});

describe('MCP remoto (POST /mcp)', () => {
  it('con API key: herramientas (incluida list_views), recursos y lectura del snapshot', async () => {
    const o = await owner('node-mcp@example.com');
    const key = (await o.api.post('/api/keys', { name: 'mcp' })).body.key as string;
    const c = new Client({ name: 'test', version: '1.0.0' });
    await c.connect(new StreamableHTTPClientTransport(new URL(`${srv.url}/mcp`), { requestInit: { headers: { authorization: `Bearer ${key}` } } }));
    const tools = (await c.listTools()).tools.map(t => t.name).sort();
    expect(tools).toEqual(['get_snapshot', 'list_notations', 'list_views', 'list_workspaces', 'render_svg', 'run_commands', 'validate']);
    const ws = await c.callTool({ name: 'list_workspaces', arguments: {} });
    expect(JSON.stringify(ws.content)).toContain(o.id);
    const views = await c.callTool({ name: 'list_views', arguments: { workspaceId: o.id } });
    const parsed = JSON.parse((views.content as { text: string }[])[0]!.text) as { views: { id: string }[] };
    expect(parsed.views.map(v => v.id)).toContain(o.viewId);
    const svg = await c.callTool({ name: 'render_svg', arguments: { workspaceId: o.id, viewId: o.viewId } });
    expect((svg.content as { text: string }[])[0]!.text).toContain('<svg');
    const bad = await c.callTool({ name: 'get_snapshot', arguments: { workspaceId: 'ws_nope' } });
    expect(bad.isError).toBe(true);
    const res = await c.listResources();
    expect(res.resources.map(r => r.uri)).toEqual(expect.arrayContaining(['alldraw://workspaces', `alldraw://workspaces/${o.id}/snapshot`]));
    const read = await c.readResource({ uri: `alldraw://workspaces/${o.id}/snapshot` });
    expect(JSON.parse((read.contents[0] as { text: string }).text).views[o.viewId]).toBeTruthy();
    const svgRes = await c.readResource({ uri: `alldraw://workspaces/${o.id}/views/${o.viewId}.svg` });
    expect((svgRes.contents[0] as { text: string }).text).toContain('<svg');
    await c.close();
  });

  it('sin clave, con sesión o con clave revocada: 401; GET: 405', async () => {
    const o = await owner('node-mcp2@example.com');
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } };
    const post = (auth?: string) => fetch(`${srv.url}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(init) });
    const none = await post();
    expect(none.status).toBe(401);
    expect(none.headers.get('www-authenticate')).toContain('Bearer');
    expect((await post(`Bearer ${o.token}`)).status).toBe(401);
    const k = (await o.api.post('/api/keys', { name: 'x' })).body;
    expect((await post(`Bearer ${k.key}`)).status).toBe(200);
    await o.api.del(`/api/keys/${k.id}`);
    expect((await post(`Bearer ${k.key}`)).status).toBe(401);
    expect((await fetch(`${srv.url}/mcp`)).status).toBe(405);
  });

  it('log y métricas: sin tokens de inserción ni secretos, rutas agrupadas', () => {
    expect(redactPath('/api/workspaces/ws_1/embeds/emb_abcdefghijkl')).toBe('/api/workspaces/ws_1/embeds/:token');
    expect(redactPath('/embed/ws_1/v_1?token=emb_abcdefghijkl')).toBe('/embed/ws_1/v_1');
    expect(redactTokens('secreto whsec_abcdefghijkl y emb_abcdefghijkl')).toBe('secreto whse… y emb_…');
    expect(routeOf('/embed/ws_1/v_1?token=x')).toBe('/embed/:id/:id');
    expect(routeOf('/embed/ws_1/v_1.svg?token=x')).toBe('/embed/:id/:id.svg');
    expect(routeOf('/mcp')).toBe('/mcp');
    expect(routeOf('/api/workspaces/ws_1/webhooks/whk_1/test')).toBe('/api/workspaces/:id/webhooks/:id/test');
    expect(routeOf('/api/workspaces/ws_1/embeds/emb_1')).toBe('/api/workspaces/:id/embeds/:id');
  });

  it('viewsOf', () => {
    expect(viewsOf({ views: { v1: { id: 'v1', name: 'A', notationId: 'bpmn', kind: 'diagram' } }, nodes: { n1: { viewId: 'v1' }, n2: { viewId: 'v2' } } })).toEqual([{ id: 'v1', name: 'A', notationId: 'bpmn', kind: 'diagram', nodes: 1 }]);
    expect(viewsOf(null)).toEqual([]);
  });
});
