/**
 * Webhooks por espacio, sin nada de Node: qué se envía, cómo se firma, a qué direcciones **no** se envía (SSRF) y el
 * repartidor con reintentos. El transporte (la petición HTTP de verdad) lo aporta cada runtime: `fetchTransport` (Workers,
 * con DNS por DoH) o el de Node (`apps/server/src/webhook-transport.ts`, que comprueba la IP en el propio `lookup` del
 * socket: sin ventana entre comprobar y conectar).
 *
 * Eventos (`WEBHOOK_EVENTS`):
 *   - `workspace.changed`: resumen agregado de elementos, relaciones y vistas añadidos, cambiados y borrados. Se envía
 *     30 s después del último cambio (como mucho 5 min después del primero), venga del editor o de la API.
 *   - `comment.created`: comentario nuevo (no los que llegan al restaurar o importar).
 *   - `snapshot.created`: instantánea guardada a mano (`POST /api/workspaces/:id/snapshots`; las automáticas no).
 *   - `snapshot.restored`: instantánea restaurada.
 *   - `member.added`: alguien recibe acceso como miembro (no los cambios de rol).
 *   - `ping`: el botón «Probar».
 *
 * Formatos (`WEBHOOK_FORMATS`): `json` (sobre propio: `{ id, event, sentAt, workspace, data, text }`), `slack` (`text` +
 * `blocks`), `teams` (Adaptive Card) y `discord` (embed). Con `auto` se elige por la URL (`hooks.slack.com`, …).
 *
 * Cada petición lleva `X-AllDraw-Event`, `X-AllDraw-Delivery` (id único: sirve para descartar repetidas) y
 * `X-AllDraw-Signature: sha256=<hex>` = HMAC-SHA256 del cuerpo exacto con el secreto del webhook.
 */
import type { Logger } from './log';
import { ipInCidrs, parseIp } from './net';
import { isFreshComment, type CommentLike } from './notifications';
import { randomToken, toHex } from './auth';
import {
  WEBHOOK_EVENTS, WEBHOOK_FORMATS, type Webhook, type WebhookDelivery, type WebhookEvent, type WebhookFormat, type WorkspaceStore,
} from './store/types';

export { WEBHOOK_EVENTS, WEBHOOK_FORMATS, MAX_WEBHOOKS_PER_WORKSPACE, MAX_WEBHOOK_DELIVERIES } from './store/types';

/** Prefijo del secreto de firma (se muestra una vez al crear el webhook). */
export const WEBHOOK_SECRET_PREFIX = 'whsec_';
export const WEBHOOK_TIMEOUT_MS = 10_000;
/** Bytes de la respuesta que se leen como mucho (el resto se descarta y se corta la conexión). */
export const WEBHOOK_MAX_RESPONSE_BYTES = 64 * 1024;
/** Intentos por entrega (el primero más 4 reintentos), con espera exponencial: 2, 4, 8 y 16 s. */
export const WEBHOOK_MAX_ATTEMPTS = 5;
export const WEBHOOK_RETRY_BASE_MS = 2000;
/** `workspace.changed`: espera desde el último cambio y espera máxima desde el primero. */
export const WEBHOOK_DEBOUNCE_MS = 30_000;
export const WEBHOOK_MAX_WAIT_MS = 5 * 60_000;
export const WEBHOOK_USER_AGENT = 'all-draw-webhooks/1 (+https://github.com/darwinva97/all-draw)';

// ---------------------------------------------------------------- SSRF
/**
 * Redes a las que nunca se envía: «esta red», privadas, CGNAT, loopback, enlace local (incluida la IP de metadatos de las
 * nubes, 169.254.169.254), redes de documentación y de pruebas, multicast y reservadas; en IPv6, loopback, ULA, enlace
 * local, multicast, documentación, NAT64 y 6to4 (llevan una IPv4 dentro). Las IPv4 mapeadas (`::ffff:a.b.c.d`) cuentan como IPv4.
 */
export const BLOCKED_CIDRS = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
  '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4',
  '::/128', '::1/128', '::/96', '64:ff9b::/96', '64:ff9b:1::/48', '100::/64', '2001::/32', '2001:db8::/32', '2002::/16', 'fc00::/7', 'fe80::/10', 'fec0::/10', 'ff00::/8',
];
/** Nombres que nunca son públicos. */
const BLOCKED_HOST = /(^|\.)(localhost|local|internal|intranet|lan|home\.arpa|localdomain)$/i;

export type WebhookUrlErrorCode = 'webhook_url_invalid' | 'webhook_url_scheme' | 'webhook_url_private' | 'webhook_url_dns';
export class WebhookUrlError extends Error {
  constructor(readonly code: WebhookUrlErrorCode, message: string) { super(message); }
}

/** ¿Es una IP pública (a la que se puede enviar)? `false` también si no es una IP. */
export function isPublicAddress(ip: string): boolean {
  return !!parseIp(ip) && !ipInCidrs(ip, BLOCKED_CIDRS);
}

export interface UrlPolicy {
  /**
   * `WEBHOOKS_ALLOW_PRIVATE=1` (**sólo pruebas**, inseguro): permite `http:`, `localhost` e IPs privadas. Con él, cualquiera
   * que pueda crear un webhook puede hacer que el servidor llame a servicios internos.
   */
  allowPrivate?: boolean;
}

/** Comprobación sin red: forma, esquema (`https:`), sin credenciales en la URL y sin nombres ni IPs locales. Devuelve la URL normalizada. */
export function parseWebhookUrl(raw: string, policy: UrlPolicy = {}): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new WebhookUrlError('webhook_url_invalid', 'La URL del webhook no es válida'); }
  const schemes = policy.allowPrivate ? ['https:', 'http:'] : ['https:'];
  if (!schemes.includes(u.protocol)) throw new WebhookUrlError('webhook_url_scheme', 'La URL del webhook tiene que empezar por https://');
  if (u.username || u.password) throw new WebhookUrlError('webhook_url_invalid', 'La URL del webhook no puede llevar usuario ni contraseña');
  if (raw.length > 2000) throw new WebhookUrlError('webhook_url_invalid', 'La URL del webhook es demasiado larga');
  u.hash = '';
  if (policy.allowPrivate) return u;
  const host = hostOf(u);
  if (!host || BLOCKED_HOST.test(host) || !host.includes('.') && !parseIp(host)) throw new WebhookUrlError('webhook_url_private', 'La URL del webhook apunta a una dirección local o privada');
  if (parseIp(host) && !isPublicAddress(host)) throw new WebhookUrlError('webhook_url_private', 'La URL del webhook apunta a una dirección local o privada');
  return u;
}

/** Nombre o IP del host sin corchetes ni punto final. */
export const hostOf = (u: URL): string => u.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

/** Resuelve un nombre a sus IPs (A y AAAA). */
export type Resolver = (host: string) => Promise<string[]>;

/** Comprueba que **todas** las IPs de una lista son públicas; lanza `WebhookUrlError` si no. */
export function assertPublicAddresses(host: string, addrs: string[]): void {
  if (addrs.length === 0) throw new WebhookUrlError('webhook_url_dns', `No se pudo resolver ${host}`);
  if (addrs.some(a => !isPublicAddress(a))) throw new WebhookUrlError('webhook_url_private', 'La URL del webhook apunta a una dirección local o privada');
}

/** Comprobación completa al registrar: `parseWebhookUrl` y, con `resolve`, que el nombre sólo resuelve a IPs públicas. */
export async function checkWebhookUrl(raw: string, policy: UrlPolicy & { resolve?: Resolver } = {}): Promise<URL> {
  const u = parseWebhookUrl(raw, policy);
  if (policy.allowPrivate || !policy.resolve) return u;
  const host = hostOf(u);
  if (parseIp(host)) return u;
  let addrs: string[];
  try { addrs = await policy.resolve(host); } catch { throw new WebhookUrlError('webhook_url_dns', `No se pudo resolver ${host}`); }
  assertPublicAddresses(host, addrs);
  return u;
}

/** Resolución por DNS sobre HTTPS (Cloudflare 1.1.1.1), para Workers, que no tienen DNS propio. */
export function dohResolver(fetchFn: typeof fetch = (...a) => fetch(...a), endpoint = 'https://cloudflare-dns.com/dns-query'): Resolver {
  return async host => {
    const ask = async (type: 'A' | 'AAAA') => {
      const r = await fetchFn(`${endpoint}?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
      if (!r.ok) throw new Error(`DoH ${r.status}`);
      const j = await r.json() as { Answer?: { type: number; data: string }[] };
      return (j.Answer ?? []).filter(a => a.type === (type === 'A' ? 1 : 28)).map(a => a.data);
    };
    const [a, aaaa] = await Promise.all([ask('A'), ask('AAAA').catch(() => [] as string[])]);
    return [...a, ...aaaa];
  };
}

// ---------------------------------------------------------------- Transporte
export interface WebhookRequest { url: string; body: string; headers: Record<string, string>; timeoutMs: number; maxResponseBytes: number }
export interface WebhookResponse { status: number; body: string }
/** Envía la petición. Lanza `WebhookUrlError` si el destino resulta ser privado al conectar, `Error` si falla la red o el tiempo. */
export type WebhookTransport = (req: WebhookRequest) => Promise<WebhookResponse>;

/** Lee como mucho `max` bytes del cuerpo y corta el resto. */
export async function readLimited(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value.subarray(0, Math.max(0, max - n)));
      n += value.byteLength;
      if (n >= max) { await reader.cancel().catch(() => {}); break; }
    }
  } catch { /* cuerpo cortado: nos quedamos con lo leído */ }
  const all = new Uint8Array(chunks.reduce((s, c) => s + c.byteLength, 0));
  let off = 0; for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(all);
}

/**
 * Transporte con `fetch` (Workers y pruebas): comprueba la URL y su DNS (`resolve`) antes de cada envío, no sigue
 * redirecciones (una redirección a una IP interna se saltaría la comprobación), corta a los `timeoutMs` y lee como mucho
 * `maxResponseBytes`. En Workers, además, Cloudflare no deja conectar con redes privadas.
 */
export function fetchTransport(opts: UrlPolicy & { resolve?: Resolver; fetch?: typeof fetch } = {}): WebhookTransport {
  const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return async req => {
    await checkWebhookUrl(req.url, opts);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), req.timeoutMs);
    try {
      const res = await f(req.url, { method: 'POST', headers: req.headers, body: req.body, redirect: 'manual', signal: ctl.signal });
      return { status: res.status, body: await readLimited(res, req.maxResponseBytes) };
    } catch (e) {
      if (ctl.signal.aborted) throw new Error(`sin respuesta en ${Math.round(req.timeoutMs / 1000)} s`);
      throw e;
    } finally { clearTimeout(timer); }
  };
}

// ---------------------------------------------------------------- Firma
const te = new TextEncoder();
/** `sha256=<hex>`: HMAC-SHA256 del cuerpo exacto con el secreto del webhook. */
export async function signWebhook(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `sha256=${toHex(await crypto.subtle.sign('HMAC', key, te.encode(body)))}`;
}
/** Comprueba una firma (para quien recibe; también lo usan los tests). */
export async function verifyWebhookSignature(secret: string, body: string, header: string | null | undefined): Promise<boolean> {
  if (!header) return false;
  const want = await signWebhook(secret, body);
  if (want.length !== header.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ header.charCodeAt(i);
  return d === 0;
}
export const newWebhookSecret = (): string => randomToken(WEBHOOK_SECRET_PREFIX, 32);

// ---------------------------------------------------------------- Formatos
/** Formato según la URL: Slack (`hooks.slack.com`), Teams (`*.webhook.office.com`, `*.logic.azure.com`), Discord (`/api/webhooks/`); si no, `json`. */
export function detectWebhookFormat(url: string): WebhookFormat {
  let u: URL; try { u = new URL(url); } catch { return 'json'; }
  const h = hostOf(u);
  const is = (d: string) => h === d || h.endsWith(`.${d}`);
  if (is('hooks.slack.com')) return 'slack';
  if (is('webhook.office.com') || is('logic.azure.com') || is('office.com') && u.pathname.includes('webhook')) return 'teams';
  if ((is('discord.com') || is('discordapp.com')) && u.pathname.startsWith('/api/webhooks/')) return 'discord';
  return 'json';
}

type Lang = 'es' | 'en';
const L = {
  es: {
    open: 'Abrir en all-draw', untitled: 'Sin nombre', someone: 'Alguien',
    elements: 'Elementos', relations: 'Relaciones', views: 'Vistas',
    added: (n: number) => `${n} ${n === 1 ? 'añadido' : 'añadidos'}`, changed: (n: number) => `${n} ${n === 1 ? 'cambiado' : 'cambiados'}`, deleted: (n: number) => `${n} ${n === 1 ? 'borrado' : 'borrados'}`,
    changedTitle: (ws: string) => `Cambios en «${ws}»`,
    comment: (who: string, ws: string) => `${who} ha comentado en «${ws}»`,
    snapshot: (who: string, ws: string) => `${who} ha guardado una versión de «${ws}»`,
    restored: (who: string, ws: string) => `${who} ha restaurado una versión de «${ws}»`,
    member: (who: string, ws: string) => `${who} tiene acceso a «${ws}»`,
    memberBy: (by: string) => `Añadido por ${by}`,
    role: (r: string) => (r === 'editor' ? 'Puede editar' : 'Solo lectura'),
    versionOf: (d: string) => `Versión del ${d}`,
    ping: (ws: string) => `Prueba del webhook de «${ws}»`,
    pingLine: 'Si ves este mensaje, el webhook funciona.',
  },
  en: {
    open: 'Open in all-draw', untitled: 'Untitled', someone: 'Someone',
    elements: 'Elements', relations: 'Relations', views: 'Views',
    added: (n: number) => `${n} added`, changed: (n: number) => `${n} changed`, deleted: (n: number) => `${n} deleted`,
    changedTitle: (ws: string) => `Changes in “${ws}”`,
    comment: (who: string, ws: string) => `${who} commented in “${ws}”`,
    snapshot: (who: string, ws: string) => `${who} saved a version of “${ws}”`,
    restored: (who: string, ws: string) => `${who} restored a version of “${ws}”`,
    member: (who: string, ws: string) => `${who} now has access to “${ws}”`,
    memberBy: (by: string) => `Added by ${by}`,
    role: (r: string) => (r === 'editor' ? 'Can edit' : 'Read only'),
    versionOf: (d: string) => `Version from ${d}`,
    ping: (ws: string) => `Test of the webhook for “${ws}”`,
    pingLine: 'If you can read this, the webhook works.',
  },
} as const;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Título y líneas legibles de un evento (para Slack, Teams, Discord y el campo `text` del JSON). */
export function describeWebhookEvent(event: WebhookEvent | 'ping', data: Record<string, unknown>, workspaceName: string, lang: Lang = 'es'): { title: string; lines: string[] } {
  const t = L[lang];
  const ws = workspaceName || t.untitled;
  const by = str(data.by) || t.someone;
  switch (event) {
    case 'workspace.changed': {
      const lines: string[] = [];
      for (const c of TRACKED) {
        const counts = obj(obj(data.counts)[c]) as Record<ChangeKind, number>;
        const names = obj(data[c]) as Record<ChangeKind, { name: string | null }[] | undefined>;
        const parts = (['added', 'changed', 'deleted'] as const).filter(k => counts[k] > 0).map(k => {
          const sample = (names[k] ?? []).map(x => x.name).filter((x): x is string => !!x).slice(0, 5);
          return `${t[k](counts[k])}${sample.length ? ` (${sample.map(s => clip(s, 60)).join(', ')}${counts[k] > sample.length ? ', …' : ''})` : ''}`;
        });
        if (parts.length) lines.push(`${t[c]}: ${parts.join('; ')}`);
      }
      return { title: t.changedTitle(ws), lines };
    }
    case 'comment.created': {
      const c = obj(data.comment);
      return { title: t.comment(str(obj(c.author).name) || t.someone, ws), lines: [`“${clip(str(c.text).replace(/\s+/g, ' ').trim(), 500)}”`] };
    }
    case 'snapshot.created': {
      const s = obj(data.snapshot);
      return { title: t.snapshot(by, ws), lines: [str(s.label) || t.versionOf(str(s.createdAt).slice(0, 16).replace('T', ' '))] };
    }
    case 'snapshot.restored': {
      const s = obj(data.snapshot);
      return { title: t.restored(by, ws), lines: [str(s.label) || t.versionOf(str(s.createdAt).slice(0, 16).replace('T', ' '))] };
    }
    case 'member.added': {
      const m = obj(data.member);
      return { title: t.member(str(m.name) || t.someone, ws), lines: [t.role(str(m.role)), ...(str(data.by) ? [t.memberBy(str(data.by))] : [])] };
    }
    case 'ping': return { title: t.ping(ws), lines: [t.pingLine] };
  }
}

export interface WebhookEnvelope { id: string; event: WebhookEvent | 'ping'; sentAt: string; workspace: { id: string; name: string; url: string }; data: Record<string, unknown> }

const slackEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Cuerpo de la petición en el formato del webhook. */
export function webhookBody(format: WebhookFormat, env: WebhookEnvelope, lang: Lang = 'es'): unknown {
  const { title, lines } = describeWebhookEvent(env.event, env.data, env.workspace.name, lang);
  const url = typeof env.data.url === 'string' && env.data.url ? env.data.url : env.workspace.url;
  const open = L[lang].open;
  const footer = `all-draw · ${env.event}`;
  switch (format) {
    case 'slack': return {
      text: clip(`${title}${lines.length ? ` — ${lines[0]}` : ''}`, 300),
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: clip(`*${slackEsc(title)}*${lines.length ? `\n${lines.map(slackEsc).join('\n')}` : ''}`, 2900) } },
        ...(url ? [{ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: open }, url }] }] : []),
        { type: 'context', elements: [{ type: 'mrkdwn', text: slackEsc(footer) }] },
      ],
      unfurl_links: false,
    };
    case 'teams': return {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
          body: [
            { type: 'TextBlock', text: clip(title, 300), weight: 'Bolder', size: 'Medium', wrap: true },
            ...lines.map(l => ({ type: 'TextBlock', text: clip(l, 1000), wrap: true, spacing: 'Small' })),
            { type: 'TextBlock', text: footer, isSubtle: true, size: 'Small', wrap: true },
          ],
          ...(url ? { actions: [{ type: 'Action.OpenUrl', title: open, url }] } : {}),
        },
      }],
    };
    case 'discord': return {
      username: 'all-draw',
      allowed_mentions: { parse: [] },
      embeds: [{ title: clip(title, 250), description: clip(lines.join('\n'), 4000), ...(url ? { url } : {}), color: 0x2563eb, timestamp: env.sentAt, footer: { text: footer } }],
    };
    default: return { ...env, text: [title, ...lines].join('\n') };
  }
}

// ---------------------------------------------------------------- Resumen de cambios (`workspace.changed`)
export const TRACKED = ['elements', 'relations', 'views'] as const;
export type TrackedCollection = (typeof TRACKED)[number];
export type ChangeKind = 'added' | 'changed' | 'deleted';
/** Un cambio de un registro (lo emite `LiveDoc.onChanges`). */
export interface DocChange { collection: TrackedCollection; id: string; kind: ChangeKind; name: string | null }
/** Cambios acumulados de un espacio desde `since` (serializable: el Durable Object lo guarda en su storage). */
export interface ChangeSummary { since: string; items: Record<TrackedCollection, Record<string, { kind: ChangeKind; name: string | null }>>; truncated?: boolean }
/** Registros que se recuerdan por colección (un espacio enorme reemplazado entero no llena la memoria). */
const MAX_TRACKED = 2000;
/** Nombres por lista en el cuerpo del evento. */
const MAX_LISTED = 25;

/** Lo que queda de dos cambios seguidos del mismo registro (`null` = nada: se añadió y se borró). */
export function mergeKind(prev: ChangeKind | undefined, next: ChangeKind): ChangeKind | null {
  if (!prev) return next;
  if (prev === 'added') return next === 'deleted' ? null : 'added';
  if (prev === 'deleted') return next === 'added' ? 'changed' : 'deleted';
  return next === 'deleted' ? 'deleted' : 'changed';
}

export function mergeChanges(summary: ChangeSummary | null, changes: DocChange[], now = new Date()): ChangeSummary {
  const s: ChangeSummary = summary ?? { since: now.toISOString(), items: { elements: {}, relations: {}, views: {} } };
  for (const ch of changes) {
    const bucket = s.items[ch.collection];
    const prev = bucket[ch.id];
    if (!prev && Object.keys(bucket).length >= MAX_TRACKED) { s.truncated = true; continue; }
    const kind = mergeKind(prev?.kind, ch.kind);
    if (kind === null) delete bucket[ch.id];
    else bucket[ch.id] = { kind, name: ch.name ?? prev?.name ?? null };
  }
  return s;
}

/** Datos del evento `workspace.changed`; `null` si al final no cambió nada (p. ej. se añadió y se borró lo mismo). */
export function changeEventData(s: ChangeSummary, until = new Date()): Record<string, unknown> | null {
  const data: Record<string, unknown> = { since: s.since, until: until.toISOString() };
  const counts: Record<string, Record<ChangeKind, number>> = {};
  let total = 0;
  for (const c of TRACKED) {
    const lists: Record<ChangeKind, { id: string; name: string | null }[]> = { added: [], changed: [], deleted: [] };
    for (const [id, v] of Object.entries(s.items[c])) lists[v.kind].push({ id, name: v.name });
    counts[c] = { added: lists.added.length, changed: lists.changed.length, deleted: lists.deleted.length };
    total += lists.added.length + lists.changed.length + lists.deleted.length;
    data[c] = { added: lists.added.slice(0, MAX_LISTED), changed: lists.changed.slice(0, MAX_LISTED), deleted: lists.deleted.slice(0, MAX_LISTED) };
  }
  if (total === 0) return null;
  data.counts = counts;
  if (s.truncated) data.truncated = true;
  return data;
}

/**
 * Agrega cambios por espacio y llama a `flush` 30 s después del último (como mucho 5 min después del primero). Para Node;
 * el Durable Object guarda el resumen en su storage y usa `alarm()` (ver `apps/worker/src/do.ts`).
 */
export class ChangeAggregator {
  private pending = new Map<string, { summary: ChangeSummary; first: number; timer: ReturnType<typeof setTimeout> }>();
  constructor(private flush: (workspaceId: string, summary: ChangeSummary) => void, private opts: { debounceMs?: number; maxWaitMs?: number } = {}) {}

  add(workspaceId: string, changes: DocChange[]): void {
    if (!changes.length) return;
    const debounce = this.opts.debounceMs ?? WEBHOOK_DEBOUNCE_MS, maxWait = this.opts.maxWaitMs ?? WEBHOOK_MAX_WAIT_MS;
    const cur = this.pending.get(workspaceId);
    if (cur) clearTimeout(cur.timer);
    const first = cur?.first ?? Date.now();
    const summary = mergeChanges(cur?.summary ?? null, changes);
    const wait = Math.max(0, Math.min(debounce, first + maxWait - Date.now()));
    const timer = setTimeout(() => this.fire(workspaceId), wait);
    (timer as { unref?: () => void }).unref?.();
    this.pending.set(workspaceId, { summary, first, timer });
  }

  private fire(workspaceId: string) {
    const cur = this.pending.get(workspaceId);
    if (!cur) return;
    this.pending.delete(workspaceId);
    try { this.flush(workspaceId, cur.summary); } catch { /* el que recibe registra sus errores */ }
  }

  /** Envía ya todo lo pendiente (apagado ordenado). */
  flushAll(): void { for (const id of [...this.pending.keys()]) { clearTimeout(this.pending.get(id)!.timer); this.fire(id); } }
  get size(): number { return this.pending.size; }
}

/** Datos del evento `comment.created` de un comentario recién añadido; `null` si no es nuevo (más de 24 h). */
export function commentEventData(c: CommentLike): Record<string, unknown> | null {
  const id = str(c.id);
  if (!id || !isFreshComment(c)) return null;
  const a = obj(c.author), anchor = obj(c.anchor);
  const viewId = str(anchor.viewId) || (anchor.kind === 'view' ? str(anchor.id) : '');
  const text = str(c.text);
  return { comment: { id, threadId: str(c.threadId) || id, text: clip(text, 2000), author: { name: str(a.name) || null }, viewId: viewId || null, createdAt: str(c.createdAt) || null } };
}

// ---------------------------------------------------------------- Repartidor
/** Lo que la API y los docs necesitan de los webhooks: emitir un evento, la prueba y la validación de la URL al registrarla. */
export interface WebhookService {
  /** Envía (en segundo plano) el evento a los webhooks del espacio suscritos a él. Nunca lanza. */
  emit(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>, baseUrl?: string): Promise<void>;
  /** Envía un `ping` ahora (un intento) y devuelve cómo fue. */
  test(hook: Webhook, baseUrl?: string): Promise<WebhookDelivery>;
  /** Comprueba la URL al registrarla (forma, esquema, red y DNS). Lanza `WebhookUrlError`. */
  checkUrl(url: string): Promise<URL>;
  /** Los webhooks de un espacio han cambiado (alta o baja): el worker se lo dice al DO, que guarda en caché si hay suscritos. */
  invalidate?(workspaceId: string): Promise<void>;
}

export interface WebhookDispatcherOptions extends UrlPolicy {
  store: Pick<WorkspaceStore, 'listWebhooks' | 'getWorkspace' | 'recordWebhookDelivery'>;
  transport: WebhookTransport;
  logger: Logger;
  /** Base de los enlaces «Abrir en all-draw» (`PUBLIC_URL`); si falta, la de la petición que originó el evento. */
  publicUrl?: string | null;
  /** `false` en la copia de respaldo (`STANDBY`): no se envía nada. */
  enabled?: boolean;
  /** Para comprobar el DNS al registrar la URL (Node: `dns.lookup`; Workers: DoH). */
  resolve?: Resolver;
  /** Ejecuta una entrega en segundo plano (Workers: `ctx.waitUntil`). */
  schedule?: (p: Promise<unknown>) => void;
  retryBaseMs?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class WebhookDispatcher implements WebhookService {
  private inflight = new Set<Promise<unknown>>();
  constructor(readonly opts: WebhookDispatcherOptions) {}
  get enabled() { return this.opts.enabled !== false; }

  checkUrl(url: string) { return checkWebhookUrl(url, { ...(this.opts.allowPrivate ? { allowPrivate: true } : {}), ...(this.opts.resolve ? { resolve: this.opts.resolve } : {}) }); }

  private track<T>(p: Promise<T>): Promise<T> {
    const q = p.finally(() => this.inflight.delete(q));
    this.inflight.add(q);
    return q;
  }
  /** Espera a que terminen las entregas en curso (tests y apagado). */
  async idle(): Promise<void> { while (this.inflight.size) await Promise.allSettled([...this.inflight]); }

  private workspaceUrl(workspaceId: string, baseUrl?: string, viewId?: string | null) {
    const base = (this.opts.publicUrl ?? baseUrl ?? '').replace(/\/+$/, '');
    return base ? `${base}/#/s/${encodeURIComponent(workspaceId)}${viewId ? `/v/${encodeURIComponent(viewId)}` : ''}` : '';
  }

  async emit(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>, baseUrl?: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const hooks = (await this.opts.store.listWebhooks(workspaceId)).filter(h => h.events.includes(event));
      if (!hooks.length) return;
      const ws = await this.opts.store.getWorkspace(workspaceId);
      if (!ws) return;
      const viewId = event === 'comment.created' ? str(obj(data.comment).viewId) : '';
      const full = { ...data, url: this.workspaceUrl(workspaceId, baseUrl, viewId || null) };
      for (const h of hooks) {
        const p = this.track(this.deliver(h, event, full, ws.name, baseUrl).catch(e => { this.opts.logger.error('webhook: error inesperado', { workspace: workspaceId, webhook: h.id, err: e }); }));
        this.opts.schedule?.(p);
      }
    } catch (e) { this.opts.logger.error('webhook: no se pudieron leer los webhooks', { workspace: workspaceId, event, err: e }); }
  }

  async test(hook: Webhook, baseUrl?: string): Promise<WebhookDelivery> {
    const ws = await this.opts.store.getWorkspace(hook.workspaceId);
    return this.track(this.deliver(hook, 'ping', { url: this.workspaceUrl(hook.workspaceId, baseUrl) }, ws?.name ?? '', baseUrl, 1));
  }

  /** Una entrega con sus reintentos (espera exponencial ante red caída, 5xx, 408 y 429). Apunta cada intento en el registro. */
  async deliver(hook: Webhook, event: WebhookEvent | 'ping', data: Record<string, unknown>, workspaceName: string, baseUrl?: string, maxAttempts = this.opts.maxAttempts ?? WEBHOOK_MAX_ATTEMPTS): Promise<WebhookDelivery> {
    const { logger, store, transport } = this.opts;
    const at = new Date();
    const id = randomToken('dlv_', 20);
    const env: WebhookEnvelope = { id, event, sentAt: at.toISOString(), workspace: { id: hook.workspaceId, name: workspaceName, url: this.workspaceUrl(hook.workspaceId, baseUrl) }, data };
    const body = JSON.stringify(webhookBody(hook.format, env, hook.lang));
    const headers: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8', 'user-agent': WEBHOOK_USER_AGENT,
      'x-alldraw-event': event, 'x-alldraw-delivery': id, 'x-alldraw-signature': await signWebhook(hook.secret, body),
    };
    const host = (() => { try { return new URL(hook.url).host; } catch { return '?'; } })();
    let delivery: WebhookDelivery = { id, event, at: env.sentAt, status: 0, ok: false, ms: 0, attempts: 0, pending: false, error: null };
    for (let attempt = 1; ; attempt++) {
      if (!this.enabled) { delivery = { ...delivery, pending: false, error: delivery.error ?? 'webhooks desactivados' }; break; }
      const t0 = Date.now();
      let status = 0, error: string | null = null, blocked = false;
      try {
        const res = await transport({ url: hook.url, body, headers, timeoutMs: this.opts.timeoutMs ?? WEBHOOK_TIMEOUT_MS, maxResponseBytes: this.opts.maxResponseBytes ?? WEBHOOK_MAX_RESPONSE_BYTES });
        status = res.status;
        if (status < 200 || status >= 300) error = `HTTP ${status}${res.body.trim() ? `: ${clip(res.body.replace(/[\u0000-\u001f]+/g, ' ').trim(), 200)}` : ''}`;
      } catch (e) {
        blocked = e instanceof WebhookUrlError;
        error = clip(e instanceof Error ? e.message : String(e), 200);
      }
      const ok = status >= 200 && status < 300;
      const retry = !ok && !blocked && (status === 0 || status >= 500 || status === 408 || status === 429) && attempt < maxAttempts;
      delivery = { id, event, at: env.sentAt, status, ok, ms: Date.now() - t0, attempts: attempt, pending: retry, error };
      await store.recordWebhookDelivery(hook.workspaceId, hook.id, delivery).catch(e => logger.error('webhook: no se pudo apuntar la entrega', { webhook: hook.id, err: e }));
      if (!retry) break;
      await (this.opts.sleep ?? (ms => new Promise(r => setTimeout(r, ms))))((this.opts.retryBaseMs ?? WEBHOOK_RETRY_BASE_MS) * 2 ** (attempt - 1));
    }
    logger.log(delivery.ok ? 'info' : 'warn', delivery.ok ? 'webhook entregado' : 'webhook fallido', { workspace: hook.workspaceId, webhook: hook.id, event, host, status: delivery.status, ms: delivery.ms, attempts: delivery.attempts, ...(delivery.error ? { error: delivery.error } : {}) });
    return delivery;
  }
}

/** Webhook tal y como lo ve su dueño por la API: sin el secreto (sólo su principio). */
export function publicWebhook(h: Webhook) {
  const { secret, ...rest } = h;
  return { ...rest, secretPrefix: `${secret.slice(0, WEBHOOK_SECRET_PREFIX.length + 4)}…` };
}

/** `auto` → el formato que toca por la URL. */
export function resolveWebhookFormat(format: WebhookFormat | 'auto' | undefined, url: string): WebhookFormat {
  return !format || format === 'auto' ? detectWebhookFormat(url) : format;
}
export const isWebhookEvent = (e: string): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e);
export const isWebhookFormat = (f: string): f is WebhookFormat => (WEBHOOK_FORMATS as readonly string[]).includes(f);
