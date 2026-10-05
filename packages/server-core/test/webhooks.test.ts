/** Webhooks sin red: SSRF, formatos, firma, resumen de cambios, agregador y repartidor con reintentos. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonLogger } from '../src/log';
import { MemoryWorkspaceStore } from '../src/store/memory';
import {
  ChangeAggregator, WebhookDispatcher, WebhookUrlError, changeEventData, checkWebhookUrl, commentEventData, detectWebhookFormat, fetchTransport, isPublicAddress,
  mergeChanges, mergeKind, parseWebhookUrl, readLimited, signWebhook, verifyWebhookSignature, webhookBody, type WebhookEnvelope, type WebhookRequest,
} from '../src/webhooks';

const quiet = jsonLogger({ level: 'silent' });
const code = (fn: () => unknown) => { try { fn(); return 'ok'; } catch (e) { return e instanceof WebhookUrlError ? e.code : String(e); } };

describe('SSRF', () => {
  it('sólo https a nombres y IPs públicas', () => {
    expect(code(() => parseWebhookUrl('https://example.com/hook'))).toBe('ok');
    expect(code(() => parseWebhookUrl('https://8.8.8.8/x'))).toBe('ok');
    expect(code(() => parseWebhookUrl('https://[2606:4700::1111]/x'))).toBe('ok');
    expect(code(() => parseWebhookUrl('http://example.com/hook'))).toBe('webhook_url_scheme');
    expect(code(() => parseWebhookUrl('ftp://example.com/'))).toBe('webhook_url_scheme');
    expect(code(() => parseWebhookUrl('no es una url'))).toBe('webhook_url_invalid');
    expect(code(() => parseWebhookUrl('https://user:pass@example.com/'))).toBe('webhook_url_invalid');
    for (const bad of ['https://localhost/', 'https://api.localhost/', 'https://printer.local/', 'https://db.internal/', 'https://intranet/', 'https://127.0.0.1/', 'https://127.1/',
      'https://2130706433/', 'https://0x7f000001/', 'https://10.0.0.5/', 'https://172.16.3.4/', 'https://192.168.1.1/', 'https://169.254.169.254/latest/meta-data/', 'https://100.64.0.1/',
      'https://0.0.0.0/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[fd00::1]/', 'https://[fe80::1]/', 'https://[64:ff9b::a00:1]/', 'https://224.0.0.1/']) {
      expect(code(() => parseWebhookUrl(bad)), bad).toBe('webhook_url_private');
    }
  });

  it('WEBHOOKS_ALLOW_PRIVATE (pruebas): http y localhost', () => {
    expect(code(() => parseWebhookUrl('http://localhost:4567/x', { allowPrivate: true }))).toBe('ok');
    expect(code(() => parseWebhookUrl('http://127.0.0.1:4567/x', { allowPrivate: true }))).toBe('ok');
    expect(code(() => parseWebhookUrl('ftp://localhost/', { allowPrivate: true }))).toBe('webhook_url_scheme');
  });

  it('IPs públicas y privadas', () => {
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true);
    for (const ip of ['127.0.0.1', '10.1.2.3', '::1', 'fe80::1', '::ffff:10.0.0.1', '198.18.0.1', 'no-ip']) expect(isPublicAddress(ip), ip).toBe(false);
  });

  it('el DNS tiene que resolver sólo a IPs públicas', async () => {
    const dns: Record<string, string[]> = { 'ok.example': ['93.184.216.34'], 'rebind.example': ['93.184.216.34', '127.0.0.1'], 'privada.example': ['10.0.0.2'], 'vacia.example': [] };
    const resolve = async (h: string) => { if (!(h in dns)) throw new Error('NXDOMAIN'); return dns[h]!; };
    await expect(checkWebhookUrl('https://ok.example/h', { resolve })).resolves.toBeInstanceOf(URL);
    for (const [h, c] of [['rebind.example', 'webhook_url_private'], ['privada.example', 'webhook_url_private'], ['vacia.example', 'webhook_url_dns'], ['nx.example', 'webhook_url_dns']] as const) {
      await expect(checkWebhookUrl(`https://${h}/`, { resolve }), h).rejects.toMatchObject({ code: c });
    }
  });
});

describe('transporte fetch', () => {
  const req = (url: string, extra: Partial<WebhookRequest> = {}): WebhookRequest => ({ url, body: '{}', headers: { 'content-type': 'application/json' }, timeoutMs: 1000, maxResponseBytes: 16, ...extra });
  it('no sigue redirecciones, corta la respuesta y comprueba el destino antes de enviar', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('x'.repeat(100), { status: 200 }); }) as unknown as typeof fetch;
    const t = fetchTransport({ fetch: f, resolve: async () => ['93.184.216.34'] });
    const r = await t(req('https://ok.example/h'));
    expect(r).toEqual({ status: 200, body: 'x'.repeat(16) });
    expect(calls[0]!.init.redirect).toBe('manual');
    await expect(t(req('https://127.0.0.1/h'))).rejects.toBeInstanceOf(WebhookUrlError);
    await expect(fetchTransport({ fetch: f, resolve: async () => ['10.0.0.1'] })(req('https://x.example/'))).rejects.toMatchObject({ code: 'webhook_url_private' });
    expect(calls).toHaveLength(1);
  });
  it('tiempo máximo', async () => {
    const f = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch;
    await expect(fetchTransport({ fetch: f, allowPrivate: true })(req('http://localhost/', { timeoutMs: 30 }))).rejects.toThrow(/sin respuesta/);
  });
  it('readLimited', async () => {
    expect(await readLimited(new Response('hola mundo'), 4)).toBe('hola');
    expect(await readLimited(new Response(null, { status: 204 }), 4)).toBe('');
  });
});

describe('formatos y firma', () => {
  const env = (event: WebhookEnvelope['event'], data: Record<string, unknown>): WebhookEnvelope => ({ id: 'dlv_1', event, sentAt: '2026-10-05T10:00:00.000Z', workspace: { id: 'ws_1', name: 'Pagos', url: 'https://a.test/#/s/ws_1' }, data });
  it('detecta el formato por la URL', () => {
    expect(detectWebhookFormat('https://hooks.slack.com/services/T/B/X')).toBe('slack');
    expect(detectWebhookFormat('https://acme.webhook.office.com/webhookb2/x')).toBe('teams');
    expect(detectWebhookFormat('https://prod-12.westeurope.logic.azure.com/workflows/x')).toBe('teams');
    expect(detectWebhookFormat('https://discord.com/api/webhooks/1/abc')).toBe('discord');
    expect(detectWebhookFormat('https://example.com/hook')).toBe('json');
  });
  it('Slack: texto, bloques y enlace; escapa lo que Slack interpretaría', () => {
    const b = webhookBody('slack', env('comment.created', { comment: { text: '<!channel> mira <https://mal|esto>', author: { name: 'Ana' } } }), 'es') as { text: string; blocks: { type: string; text?: { text: string }; elements?: { url?: string }[] }[] };
    expect(b.text).toContain('Ana ha comentado en «Pagos»');
    const section = b.blocks.find(x => x.type === 'section')!.text!.text;
    expect(section).toContain('&lt;!channel&gt;');
    expect(section).not.toContain('<!channel>');
    expect(b.blocks.find(x => x.type === 'actions')!.elements![0]!.url).toBe('https://a.test/#/s/ws_1');
  });
  it('Teams (Adaptive Card), Discord (embed sin menciones) y JSON', () => {
    const data = { counts: { elements: { added: 2, changed: 0, deleted: 1 }, relations: { added: 0, changed: 0, deleted: 0 }, views: { added: 0, changed: 1, deleted: 0 } }, elements: { added: [{ id: 'e1', name: 'Cobro' }, { id: 'e2', name: null }], changed: [], deleted: [{ id: 'e3', name: 'Viejo' }] }, relations: { added: [], changed: [], deleted: [] }, views: { added: [], changed: [{ id: 'v1', name: 'Proceso' }], deleted: [] } };
    const teams = webhookBody('teams', env('workspace.changed', data), 'en') as { attachments: { contentType: string; content: { type: string; body: { text: string }[]; actions: { url: string }[] } }[] };
    expect(teams.attachments[0]!.contentType).toBe('application/vnd.microsoft.card.adaptive');
    expect(teams.attachments[0]!.content.type).toBe('AdaptiveCard');
    const texts = teams.attachments[0]!.content.body.map(x => x.text).join('\n');
    expect(texts).toContain('Changes in “Pagos”');
    expect(texts).toContain('Elements: 2 added (Cobro, …); 1 deleted (Viejo)');
    expect(texts).toContain('Views: 1 changed (Proceso)');
    const discord = webhookBody('discord', env('member.added', { member: { name: 'Bea', role: 'editor' }, by: 'Ana' }), 'es') as { allowed_mentions: { parse: string[] }; embeds: { title: string; description: string; url: string }[] };
    expect(discord.allowed_mentions.parse).toEqual([]);
    expect(discord.embeds[0]!.title).toBe('Bea tiene acceso a «Pagos»');
    expect(discord.embeds[0]!.description).toContain('Añadido por Ana');
    const json = webhookBody('json', env('snapshot.created', { snapshot: { id: 's1', label: 'v1.0' }, by: 'Ana' }), 'es') as Record<string, unknown>;
    expect(json).toMatchObject({ id: 'dlv_1', event: 'snapshot.created', workspace: { id: 'ws_1', name: 'Pagos' }, data: { snapshot: { label: 'v1.0' } } });
    expect(json.text).toContain('Ana ha guardado una versión de «Pagos»');
  });
  it('HMAC-SHA256 del cuerpo exacto', async () => {
    const sig = await signWebhook('whsec_x', '{"a":1}');
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(await verifyWebhookSignature('whsec_x', '{"a":1}', sig)).toBe(true);
    expect(await verifyWebhookSignature('whsec_x', '{"a":2}', sig)).toBe(false);
    expect(await verifyWebhookSignature('otro', '{"a":1}', sig)).toBe(false);
    expect(await verifyWebhookSignature('whsec_x', '{"a":1}', null)).toBe(false);
  });
});

describe('resumen de cambios', () => {
  it('añadido + cambiado = añadido; añadido + borrado = nada; borrado + añadido = cambiado', () => {
    expect(mergeKind(undefined, 'changed')).toBe('changed');
    expect(mergeKind('added', 'changed')).toBe('added');
    expect(mergeKind('added', 'deleted')).toBeNull();
    expect(mergeKind('deleted', 'added')).toBe('changed');
    expect(mergeKind('changed', 'deleted')).toBe('deleted');
    expect(mergeKind('deleted', 'changed')).toBe('deleted');
    let s = mergeChanges(null, [{ collection: 'elements', id: 'a', kind: 'added', name: 'A' }, { collection: 'elements', id: 'b', kind: 'added', name: 'B' }]);
    s = mergeChanges(s, [{ collection: 'elements', id: 'a', kind: 'changed', name: 'A2' }, { collection: 'elements', id: 'b', kind: 'deleted', name: null }, { collection: 'relations', id: 'r', kind: 'deleted', name: null }]);
    const data = changeEventData(s)!;
    expect(data.counts).toEqual({ elements: { added: 1, changed: 0, deleted: 0 }, relations: { added: 0, changed: 0, deleted: 1 }, views: { added: 0, changed: 0, deleted: 0 } });
    expect((data.elements as { added: unknown[] }).added).toEqual([{ id: 'a', name: 'A2' }]);
    expect(changeEventData(mergeChanges(null, [{ collection: 'views', id: 'v', kind: 'added', name: 'V' }, { collection: 'views', id: 'v', kind: 'deleted', name: null }]))).toBeNull();
  });

  describe('agregador', () => {
    afterEach(() => { vi.useRealTimers(); });
    it('espera 30 s desde el último cambio y como mucho 5 min desde el primero', () => {
      vi.useFakeTimers();
      const out: string[] = [];
      const agg = new ChangeAggregator((id, s) => out.push(`${id}:${Object.keys(s.items.elements).join(',')}`));
      agg.add('w', [{ collection: 'elements', id: 'a', kind: 'added', name: null }]);
      vi.advanceTimersByTime(29_000);
      agg.add('w', [{ collection: 'elements', id: 'b', kind: 'added', name: null }]);
      vi.advanceTimersByTime(29_000);
      expect(out).toEqual([]);
      vi.advanceTimersByTime(1_000);
      expect(out).toEqual(['w:a,b']);
      // Cambios sin parar: sale a los 5 min igualmente
      for (let i = 0; i < 20; i++) { agg.add('x', [{ collection: 'elements', id: `e${i}`, kind: 'changed', name: null }]); vi.advanceTimersByTime(20_000); }
      expect(out.filter(o => o.startsWith('x:'))).toHaveLength(1);
      agg.add('y', [{ collection: 'views', id: 'v', kind: 'changed', name: null }]);
      agg.flushAll();
      expect(agg.size).toBe(0);
    });
  });

  it('comment.created: sólo comentarios nuevos', () => {
    const now = new Date().toISOString();
    expect(commentEventData({ id: 'c1', text: 'hola', author: { name: 'Ana', userId: 'usr_1' }, anchor: { kind: 'view', id: 'v1' }, createdAt: now })).toEqual({ comment: { id: 'c1', threadId: 'c1', text: 'hola', author: { name: 'Ana' }, viewId: 'v1', createdAt: now } });
    expect(commentEventData({ id: 'c2', text: 'viejo', createdAt: '2020-01-01T00:00:00Z' })).toBeNull();
  });
});

describe('repartidor', () => {
  async function setup(responses: (number | Error)[], opts: { enabled?: boolean } = {}) {
    const store = new MemoryWorkspaceStore();
    const u = await store.createUser({ email: 'a@x.io', name: 'Ana', passwordHash: '' });
    const w = await store.createWorkspace({ ownerId: u.id, name: 'Pagos' });
    const sent: WebhookRequest[] = [];
    let i = 0;
    const transport = async (r: WebhookRequest) => { sent.push(r); const x = responses[Math.min(i++, responses.length - 1)]!; if (x instanceof Error) throw x; return { status: x, body: x >= 400 ? 'fallo' : 'ok' }; };
    const sleeps: number[] = [];
    const d = new WebhookDispatcher({ store, transport, logger: quiet, publicUrl: 'https://a.test', retryBaseMs: 100, sleep: async ms => { sleeps.push(ms); }, ...(opts.enabled === false ? { enabled: false } : {}) });
    const hook = await store.createWebhook({ workspaceId: w.id, url: 'https://example.com/h', events: ['snapshot.created'], format: 'json', lang: 'es', secret: 'whsec_s', createdBy: u.id });
    await store.createWebhook({ workspaceId: w.id, url: 'https://example.com/otro', events: ['member.added'], format: 'json', lang: 'es', secret: 'whsec_t', createdBy: u.id });
    return { store, w, hook, sent, sleeps, d };
  }

  it('sólo a los suscritos, firmado y con cabeceras', async () => {
    const { d, w, sent, store, hook } = await setup([200]);
    await d.emit(w.id, 'snapshot.created', { snapshot: { id: 's1', label: 'v1' }, by: 'Ana' });
    await d.idle();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe('https://example.com/h');
    expect(sent[0]!.headers['x-alldraw-event']).toBe('snapshot.created');
    expect(await verifyWebhookSignature('whsec_s', sent[0]!.body, sent[0]!.headers['x-alldraw-signature'])).toBe(true);
    const body = JSON.parse(sent[0]!.body);
    expect(body).toMatchObject({ event: 'snapshot.created', workspace: { id: w.id, name: 'Pagos', url: `https://a.test/#/s/${w.id}` }, data: { snapshot: { id: 's1' } } });
    expect(sent[0]!.headers['x-alldraw-delivery']).toBe(body.id);
    const log = (await store.getWebhook(w.id, hook.id))!.deliveries;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ event: 'snapshot.created', status: 200, ok: true, attempts: 1, pending: false, error: null });
  });

  it('reintenta con espera exponencial ante 5xx y red; no ante 4xx', async () => {
    const a = await setup([500, new Error('ECONNRESET'), 503, 200]);
    await a.d.emit(a.w.id, 'snapshot.created', {});
    await a.d.idle();
    expect(a.sent).toHaveLength(4);
    expect(a.sleeps).toEqual([100, 200, 400]);
    const log = (await a.store.getWebhook(a.w.id, a.hook.id))!.deliveries;
    expect(log).toHaveLength(1); // la misma entrega, actualizada
    expect(log[0]).toMatchObject({ ok: true, status: 200, attempts: 4, pending: false });
    // El cuerpo y la firma son los mismos en todos los intentos
    expect(new Set(a.sent.map(s => s.body)).size).toBe(1);

    const b = await setup([500]);
    await b.d.emit(b.w.id, 'snapshot.created', {});
    await b.d.idle();
    expect(b.sent).toHaveLength(5);
    expect((await b.store.getWebhook(b.w.id, b.hook.id))!.deliveries[0]).toMatchObject({ ok: false, status: 500, attempts: 5, pending: false, error: 'HTTP 500: fallo' });

    const c = await setup([404]);
    await c.d.emit(c.w.id, 'snapshot.created', {});
    await c.d.idle();
    expect(c.sent).toHaveLength(1);

    const blocked = await setup([new WebhookUrlError('webhook_url_private', 'privada')]);
    await blocked.d.emit(blocked.w.id, 'snapshot.created', {});
    await blocked.d.idle();
    expect(blocked.sent).toHaveLength(1);
    expect((await blocked.store.getWebhook(blocked.w.id, blocked.hook.id))!.deliveries[0]).toMatchObject({ ok: false, status: 0, attempts: 1, error: 'privada' });
  });

  it('«Probar»: un solo intento y queda en el registro; desactivado (copia de respaldo) no envía', async () => {
    const a = await setup([500]);
    const r = await a.d.test(a.hook);
    expect(r).toMatchObject({ event: 'ping', ok: false, status: 500, attempts: 1, pending: false });
    expect(a.sent).toHaveLength(1);
    expect(JSON.parse(a.sent[0]!.body).text).toContain('Prueba del webhook de «Pagos»');
    const off = await setup([200], { enabled: false });
    await off.d.emit(off.w.id, 'snapshot.created', {});
    await off.d.idle();
    expect(off.sent).toHaveLength(0);
  });
});
