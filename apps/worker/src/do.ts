/**
 * `WorkspaceDO`: un Durable Object por espacio. Mantiene el `Y.Doc` vivo (`LiveDoc` de server-core),
 * habla el protocolo y-websocket con la Hibernation API (`ctx.acceptWebSocket`) y persiste el estado
 * completo del doc en su storage (troceado: el límite por valor es 128 KiB en KV / 2 MiB en SQLite).
 *
 * El worker le reenvía por `stub.fetch` tanto el upgrade del WebSocket (`GET /ws`, con el rol y la identidad ya
 * resueltos en las cabeceras `x-alldraw-role` y `x-alldraw-user` o `x-alldraw-link`) como las operaciones de la API
 * (`RemoteDocHost`):
 *
 *   POST /init {name, initial}       PUT /snapshot (Workspace)    POST /meta {patch}
 *   GET  /snapshot                   POST /commands {commands, label}   GET /validate
 *   GET  /svg?viewId&theme&padding   POST /drop    POST /revoke {userId?, linkToken?, code, reason}
 *
 * Cada WebSocket se acepta con etiquetas de hibernación `[rol, "u:<userId>" | "l:<token de enlace>", "s:<sesión>" | "k:<API key>"]`:
 * sobreviven a la hibernación y `/revoke` las usa (`ctx.getWebSockets(tag)`) para cerrar las conexiones de un acceso revocado
 * (un enlace, un usuario, una sesión cerrada o una clave revocada).
 *   GET  /snapshots                  POST /snapshots {authorId, label}
 *   GET  /snapshots/:sid             POST /snapshots/:sid/restore {authorId}   DELETE /snapshots/:sid
 *
 * Las instantáneas (historial de versiones) también viven en el storage del DO: `snap:<id>` (meta) +
 * `snapd:<id>:<n>` (trozos del update Yjs).
 *
 * Webhooks (`webhooks-env.ts`): `POST /webhook {event, data, baseUrl}` (eventos de la API) y, desde el doc vivo,
 * `comment.created` y `workspace.changed`. Este último se agrega en el storage (`wh:changes`: resumen, primer cambio y
 * hora de envío, 30 s tras el último cambio y como mucho 5 min tras el primero) y lo envía `alarm()` (la misma alarma que
 * corta los enlaces caducados): sobrevive a la hibernación. Las entregas van con `ctx.waitUntil`.
 *
 * Los sockets nuevos pasan por la puerta de versión de `LiveDoc` (los clientes de la app anterior al formato de
 * registros 2 se cierran con 4426 «recarga»); la versión admitida se guarda en el adjunto del socket.
 */
import { DurableObject } from 'cloudflare:workers';
import type { Command, Workspace, WorkspaceMeta } from '@all-draw/core';
import {
  CommandError, DEFAULT_MAX_DOC_BYTES, LiveDoc, WEBHOOK_DEBOUNCE_MS, WEBHOOK_MAX_WAIT_MS, changeEventData, commentEventData, isWebhookEvent, mergeChanges, WS_DELETED, WS_EXPIRED_REASON, WS_REVOKED, attachConnection, closeConn, matchesIdentity, mentionContextOf, opCommands, opInit, opRenderSvg, opReplace, opSetMeta, opSnapshot, opValidate, parseCommands, parseWorkspaceJson,
  type ChangeSummary, type ConnIdentity, type ConnMatch, type DocChange, type DocPersistence, type Notifier, type Role, type Snapshot, type SnapshotMeta, type SyncHandlers, type SyncSocket,
  type WebhookDispatcher,
} from '@all-draw/server-core';
import { newId } from '@all-draw/core';
import { envInt, type Env } from './env';
import { registryFromEnv, workerNotifier } from './mail-env';
import { workerDispatcher } from './webhooks-env';

export const ROLE_HEADER = 'x-alldraw-role';
/** Identidad de la conexión (sólo una de las dos): la pone el worker tras autorizar; nunca se fía de la del cliente. */
export const USER_HEADER = 'x-alldraw-user';
export const LINK_HEADER = 'x-alldraw-link';
/** Con qué credencial entró el usuario: la sesión (`sessionIdOf`) o la API key (id). */
export const SESSION_HEADER = 'x-alldraw-session';
export const KEY_HEADER = 'x-alldraw-key';
/** Id del espacio (el DO no conoce el nombre con que se creó su id): lo ponen el worker y `RemoteDocHost`; se guarda en `ws:id`. */
export const WORKSPACE_HEADER = 'x-alldraw-workspace';
/** Caducidad del enlace con el que se abre el socket (ISO): etiqueta `e:<ms>` y `alarm()` para cerrarlo a su hora. */
export const EXPIRES_HEADER = 'x-alldraw-expires';
const WORKSPACE_KEY = 'ws:id';
/** Cambios pendientes de `workspace.changed` (ver arriba). */
const CHANGES_KEY = 'wh:changes';
interface PendingChanges { summary: ChangeSummary; first: number; due: number }
/** Cada cuánto se vuelve a preguntar al registro si hay webhooks de `workspace.changed` (cada cambio no hace una consulta). */
const HOOKS_TTL_MS = 60_000;
const expiryTag = (ms: number) => `e:${ms}`;
/** Milisegundos de caducidad de un socket (etiqueta `e:`), o `null`. */
export const expiryOfTags = (tags: string[]): number | null => { const v = tags.find(t => t.startsWith('e:'))?.slice(2); const n = v ? Number(v) : NaN; return Number.isFinite(n) ? n : null; };
const userTag = (id: string) => `u:${id}`;
const linkTag = (token: string) => `l:${token}`;
const sessionTag = (id: string) => `s:${id}`;
const keyTag = (id: string) => `k:${id}`;
/** Etiquetas de hibernación de un socket: el rol primero (compatibles con los aceptados antes) y la identidad. */
export function socketTags(role: Role, identity: ConnIdentity | null, expiresAtMs?: number | null): string[] {
  const tags: string[] = [role];
  if (identity?.userId) {
    tags.push(userTag(identity.userId));
    if (identity.sessionId) tags.push(sessionTag(identity.sessionId));
    else if (identity.keyId) tags.push(keyTag(identity.keyId));
  } else if (identity?.linkToken) tags.push(linkTag(identity.linkToken));
  if (expiresAtMs != null && Number.isFinite(expiresAtMs)) tags.push(expiryTag(expiresAtMs));
  return tags;
}
export function identityFromTags(tags: string[]): ConnIdentity | undefined {
  const get = (p: string) => tags.find(t => t.startsWith(p))?.slice(2);
  const u = get('u:'), l = get('l:'), sid = get('s:'), kid = get('k:');
  if (!u && !l) return undefined;
  // Sockets aceptados antes de existir `s:`/`k:`: credencial desconocida (se tratan como sesión al revocar).
  return { userId: u ?? null, linkToken: l ?? null, ...(sid ? { sessionId: sid } : {}), ...(kid ? { keyId: kid } : {}) };
}
/** WebSockets por espacio por defecto (`MAX_WS_PER_WORKSPACE`) y código de cierre al pasarse (igual que Node). */
export const DEFAULT_MAX_WS_PER_WORKSPACE = 100;
export const WS_TOO_MANY = 4429;
const CHUNK = 96 * 1024; // < 128 KiB por valor, vale para KV y SQLite
const META_KEY = 'doc:meta';
const SNAP_PREFIX = 'snap:';
const snapDataKey = (id: string, n: number) => `snapd:${id}:${n}`;
type StoredSnapshot = SnapshotMeta & { chunks: number };

/** Trocea un update en valores < 128 KiB. */
function chunk(update: Uint8Array, key: (n: number) => string): { entries: Record<string, ArrayBuffer>; n: number } {
  const entries: Record<string, ArrayBuffer> = {};
  let n = 0;
  for (let off = 0; off < update.length; off += CHUNK, n++) entries[key(n)] = update.slice(off, off + CHUNK).buffer as ArrayBuffer;
  return { entries, n };
}
async function readChunks(storage: DurableObjectStorage, keys: string[], size: number): Promise<Uint8Array | null> {
  const got = await storage.get<ArrayBuffer>(keys);
  const out = new Uint8Array(size);
  let off = 0;
  for (const k of keys) { const part = got.get(k); if (!part) return null; out.set(new Uint8Array(part), off); off += part.byteLength; }
  return out;
}

/** Persistencia del doc en el storage del DO, troceada. */
function storagePersistence(storage: DurableObjectStorage): DocPersistence {
  return {
    async loadDoc() {
      const meta = await storage.get<{ chunks: number; size: number }>(META_KEY);
      if (!meta || meta.chunks === 0) return null;
      return readChunks(storage, Array.from({ length: meta.chunks }, (_, i) => `doc:${i}`), meta.size);
    },
    async saveDoc(_id, update) {
      const prev = await storage.get<{ chunks: number }>(META_KEY);
      const { entries, n } = chunk(update, i => `doc:${i}`);
      await storage.put({ ...entries, [META_KEY]: { chunks: n, size: update.length } });
      if (prev && prev.chunks > n) await storage.delete(Array.from({ length: prev.chunks - n }, (_, i) => `doc:${n + i}`));
    },

    // ---- instantáneas
    async createSnapshot(s) {
      const id = s.id ?? newId('snp');
      const { entries, n } = chunk(s.data, i => snapDataKey(id, i));
      const stored: StoredSnapshot = { id, workspaceId: s.workspaceId, createdAt: new Date().toISOString(), authorId: s.authorId, label: s.label, size: s.data.byteLength, chunks: n };
      await storage.put({ ...entries, [SNAP_PREFIX + id]: stored });
      const { chunks: _c, ...meta } = stored;
      return meta;
    },
    async listSnapshots() {
      const all = await storage.list<StoredSnapshot>({ prefix: SNAP_PREFIX });
      return [...all.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).map(({ chunks: _c, ...m }) => m);
    },
    async getSnapshot(_ws, id): Promise<Snapshot | null> {
      const stored = await storage.get<StoredSnapshot>(SNAP_PREFIX + id);
      if (!stored) return null;
      const data = await readChunks(storage, Array.from({ length: stored.chunks }, (_, i) => snapDataKey(id, i)), stored.size);
      if (!data) return null;
      const { chunks: _c, ...meta } = stored;
      return { ...meta, data };
    },
    async deleteSnapshot(_ws, id) {
      const stored = await storage.get<StoredSnapshot>(SNAP_PREFIX + id);
      if (!stored) return false;
      await storage.delete([SNAP_PREFIX + id, ...Array.from({ length: stored.chunks }, (_, i) => snapDataKey(id, i))]);
      return true;
    },
    async pruneSnapshots(ws, keep) {
      const all = await this.listSnapshots(ws);
      let excess = all.length - keep, n = 0;
      for (const s of [...all].reverse()) { if (excess <= 0) break; if (s.label === null && (await this.deleteSnapshot(ws, s.id))) { excess--; n++; } }
      return n;
    },
  };
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

export class WorkspaceDO extends DurableObject<Env> {
  private live: Promise<LiveDoc> | null = null;
  private sockets = new Map<WebSocket, { conn: SyncSocket; handlers: SyncHandlers }>();
  /** Id del espacio (cabecera `WORKSPACE_HEADER`, guardado en `ws:id`): hace falta para notificar menciones. */
  private workspaceId: string | null = null;
  private notifier: Notifier | null = null;
  /** Notificaciones de menciones en curso: se esperan antes de terminar cada mensaje (el DO puede hibernar después). */
  private notifying = new Set<Promise<unknown>>();
  private webhooks: WebhookDispatcher | null = null;
  /** Cola de cambios (`workspace.changed`): en orden, uno tras otro. */
  private changeChain: Promise<unknown> = Promise.resolve();
  private pendingChanges: PendingChanges | null | undefined = undefined;
  private changeHooks: { at: number; value: boolean } | null = null;

  private dispatcher(): WebhookDispatcher {
    this.webhooks ??= workerDispatcher(this.env, registryFromEnv(this.env), p => this.ctx.waitUntil(p));
    return this.webhooks;
  }
  private get standby() { return this.env.STANDBY === 'true'; }
  /** Algo que hay que esperar antes de terminar el mensaje o la petición (el DO puede hibernar después). */
  private keep(p: Promise<unknown>) {
    const q = p.catch(e => console.error('DO tarea', e)).finally(() => this.notifying.delete(q));
    this.notifying.add(q);
  }

  private doc(): Promise<LiveDoc> {
    this.live ??= (async () => {
      const d = new LiveDoc(this.ctx.id.toString(), storagePersistence(this.ctx.storage));
      d.maxBytes = envInt(this.env.MAX_DOC_BYTES) ?? DEFAULT_MAX_DOC_BYTES;
      // Comentarios nuevos con menciones → notificaciones (y correo) en el registro (`notifications.ts`).
      d.onNewComments = cs => {
        const p = (async () => {
          const wid = await this.knownWorkspace();
          if (!wid) return;
          this.notifier ??= workerNotifier(this.env);
          await this.notifier.mentions(wid, cs, mentionContextOf(d.doc));
        })().catch(e => console.error('menciones', e)).finally(() => this.notifying.delete(p));
        this.notifying.add(p);
        // Webhooks `comment.created`.
        if (!this.standby) this.keep((async () => {
          const wid = await this.knownWorkspace();
          if (!wid) return;
          for (const c of cs) { const data = commentEventData(c); if (data) await this.dispatcher().emit(wid, 'comment.created', data); }
        })());
      };
      // Webhooks `workspace.changed`: se agregan en el storage y los envía `alarm()`.
      d.onChanges = cs => { if (!this.standby) this.keep(this.changeChain = this.changeChain.then(() => this.queueChanges(cs)).catch(e => console.error('cambios', e))); };
      await d.load();
      return d;
    })();
    return this.live;
  }

  private async knownWorkspace(): Promise<string | null> {
    this.workspaceId ??= (await this.ctx.storage.get<string>(WORKSPACE_KEY)) ?? null;
    return this.workspaceId;
  }
  /** Apunta el id del espacio que trae la petición (la primera vez lo guarda). */
  private async rememberWorkspace(request: Request) {
    const id = request.headers.get(WORKSPACE_HEADER);
    if (!id || id === this.workspaceId) return;
    if ((await this.knownWorkspace()) !== id) await this.ctx.storage.put(WORKSPACE_KEY, id);
    this.workspaceId = id;
  }
  private drainNotifications() { return Promise.allSettled([...this.notifying]); }

  /** Programa la alarma para lo primero que toque: el socket que caduca antes (enlaces con `expiresAt`) o el envío de `workspace.changed`. */
  private async scheduleExpiry() {
    let next: number | null = null;
    for (const ws of this.ctx.getWebSockets()) { const e = expiryOfTags(this.ctx.getTags(ws)); if (e !== null && (next === null || e < next)) next = e; }
    const due = (await this.loadPendingChanges())?.due ?? null;
    if (due !== null && (next === null || due < next)) next = due;
    if (next === null) return;
    const cur = await this.ctx.storage.getAlarm();
    if (cur === null || next < cur) await this.ctx.storage.setAlarm(next);
  }

  // ---------------------------------------------------------------- Webhooks: `workspace.changed`
  private async loadPendingChanges(): Promise<PendingChanges | null> {
    if (this.pendingChanges === undefined) this.pendingChanges = (await this.ctx.storage.get<PendingChanges>(CHANGES_KEY)) ?? null;
    return this.pendingChanges;
  }
  private async hasChangeHooks(workspaceId: string): Promise<boolean> {
    if (this.changeHooks && Date.now() - this.changeHooks.at < HOOKS_TTL_MS) return this.changeHooks.value;
    let value = false;
    try { value = (await registryFromEnv(this.env).listWebhooks(workspaceId)).some(h => h.events.includes('workspace.changed')); } catch (e) { console.error('webhooks', e); }
    this.changeHooks = { at: Date.now(), value };
    return value;
  }
  private async queueChanges(cs: DocChange[]) {
    const wid = await this.knownWorkspace();
    if (!wid || !(await this.hasChangeHooks(wid))) return;
    const cur = await this.loadPendingChanges();
    const now = Date.now();
    const debounce = envInt(this.env.WEBHOOKS_DEBOUNCE_MS) ?? WEBHOOK_DEBOUNCE_MS;
    const first = cur?.first ?? now;
    const next: PendingChanges = { summary: mergeChanges(cur?.summary ?? null, cs), first, due: Math.min(now + debounce, first + WEBHOOK_MAX_WAIT_MS) };
    this.pendingChanges = next;
    await this.ctx.storage.put(CHANGES_KEY, next);
    // Si la alarma ya estaba antes (el envío anterior), salta, ve que aún no toca y se reprograma a `due`.
    await this.scheduleExpiry();
  }
  /** Envía `workspace.changed` si ya toca. */
  private async flushChanges(now: number) {
    const cur = await this.loadPendingChanges();
    if (!cur || cur.due > now) return;
    this.pendingChanges = null;
    await this.ctx.storage.delete(CHANGES_KEY);
    const wid = await this.knownWorkspace();
    const data = changeEventData(cur.summary);
    if (wid && data && !this.standby) await this.dispatcher().emit(wid, 'workspace.changed', data);
  }

  /** Alarma: cierra (4401 `expired`) los sockets abiertos con un enlace ya caducado, envía `workspace.changed` si toca y programa la siguiente. */
  override async alarm() {
    const now = Date.now();
    await this.flushChanges(now).catch(e => console.error('workspace.changed', e));
    const live = this.live ? await this.live : null;
    for (const ws of this.ctx.getWebSockets()) {
      const e = expiryOfTags(this.ctx.getTags(ws));
      if (e === null || e > now) continue;
      try { ws.close(WS_REVOKED, WS_EXPIRED_REASON); } catch { /* ya cerrada */ }
      const s = this.sockets.get(ws);
      this.sockets.delete(ws);
      if (s && live) closeConn(live, s.conn);
    }
    await this.scheduleExpiry();
  }

  /**
   * Registra (o re-registra tras hibernar) un WebSocket aceptado en el doc. La versión del protocolo con la que se
   * admitió (puerta de versión de `LiveDoc`) se guarda en el adjunto del socket: al despertar no se vuelve a retener.
   */
  private attach(ws: WebSocket, live: LiveDoc, role: Role, identity?: ConnIdentity) {
    let protocol: number | undefined;
    try { const a = ws.deserializeAttachment() as { proto?: unknown } | null; if (typeof a?.proto === 'number') protocol = a.proto; } catch { /* sin adjunto */ }
    const conn: SyncSocket = {
      ...(identity ? { identity } : {}),
      ...(protocol !== undefined ? { protocol } : {}),
      onAdmit: proto => { try { ws.serializeAttachment({ proto }); } catch { /* socket ya cerrado */ } },
      isOpen: () => ws.readyState === 1 /* OPEN */,
      send: buf => ws.send(buf),
      close: (code, reason) => { try { ws.close(code ?? 1000, reason); } catch { /* ya cerrada */ } },
    };
    const handlers = attachConnection(conn, live, role);
    this.sockets.set(ws, { conn, handlers });
    return this.sockets.get(ws)!;
  }

  private async socketFor(ws: WebSocket) {
    const known = this.sockets.get(ws);
    if (known) return known;
    // Despertar de hibernación: el rol y la identidad viajan en las etiquetas del socket
    const tags = this.ctx.getTags(ws);
    const role = (tags[0] ?? 'viewer') as Role;
    return this.attach(ws, await this.doc(), role, identityFromTags(tags));
  }

  /** Cierra con `code` los sockets abiertos con ese usuario, enlace, sesión o clave (por etiqueta: vale también tras hibernar). */
  private async revoke(match: ConnMatch, code: number, reason: string): Promise<number> {
    const targets = new Set<WebSocket>();
    const add = (tag: string) => { for (const ws of this.ctx.getWebSockets(tag)) if (matchesIdentity(identityFromTags(this.ctx.getTags(ws)), match)) targets.add(ws); };
    if (match.userId) add(userTag(match.userId));
    if (match.linkToken) add(linkTag(match.linkToken));
    if (match.sessionId) add(sessionTag(match.sessionId));
    if (match.keyId) add(keyTag(match.keyId));
    const live = targets.size && this.live ? await this.live : null;
    for (const ws of targets) {
      try { ws.close(code, reason); } catch { /* ya cerrada */ }
      const s = this.sockets.get(ws);
      this.sockets.delete(ws);
      if (s && live) closeConn(live, s.conn); // lo saca del doc y de la presencia (el cierre de arriba manda el código)
    }
    return targets.size;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    await this.rememberWorkspace(request);
    // Alta o baja de un webhook: se vuelve a mirar si hay suscritos a `workspace.changed`.
    if (url.pathname === '/webhook/refresh' && request.method === 'POST') { this.changeHooks = null; return json({ ok: true }); }
    // Eventos de webhook de la API: se envían desde aquí (`ctx.waitUntil`), sin cargar el doc.
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const b = await request.json() as { event?: string; data?: Record<string, unknown>; baseUrl?: string | null };
      const wid = await this.knownWorkspace();
      if (!wid || !b.event || !isWebhookEvent(b.event)) return json({ error: 'evento desconocido' }, 400);
      if (!this.standby) await this.dispatcher().emit(wid, b.event, b.data && typeof b.data === 'object' ? b.data : {}, b.baseUrl ?? undefined);
      return json({ ok: true });
    }
    // Antes de cargar el doc: sin sockets abiertos no hay nada que cerrar ni motivo para leer el storage.
    if (url.pathname === '/revoke' && request.method === 'POST') {
      const b = await request.json() as ConnMatch & { code?: number; reason?: string };
      const str = (k: 'userId' | 'linkToken' | 'sessionId' | 'keyId' | 'exceptSessionId') => (typeof b[k] === 'string' && b[k] ? { [k]: b[k] } : {});
      const match: ConnMatch = { ...str('userId'), ...str('linkToken'), ...str('sessionId'), ...str('keyId'), ...str('exceptSessionId'), ...(b.sessionsOnly === true ? { sessionsOnly: true } : {}) };
      return json({ closed: await this.revoke(match, Number(b.code) || 4401, String(b.reason ?? 'acceso revocado')) });
    }
    const live = await this.doc();

    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('se esperaba un WebSocket', { status: 426 });
      const role = (request.headers.get(ROLE_HEADER) ?? 'viewer') as Role;
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      const max = envInt(this.env.MAX_WS_PER_WORKSPACE) ?? DEFAULT_MAX_WS_PER_WORKSPACE;
      if (max > 0 && this.ctx.getWebSockets().length >= max) {
        server.accept();
        server.close(WS_TOO_MANY, 'demasiadas conexiones a este espacio');
        return new Response(null, { status: 101, webSocket: client });
      }
      const userId = request.headers.get(USER_HEADER), linkToken = request.headers.get(LINK_HEADER);
      const sessionId = request.headers.get(SESSION_HEADER), keyId = request.headers.get(KEY_HEADER);
      const identity: ConnIdentity | null = userId
        ? { userId, linkToken: null, sessionId: sessionId || null, keyId: sessionId ? null : keyId || null }
        : linkToken ? { userId: null, linkToken } : null;
      const expires = Date.parse(request.headers.get(EXPIRES_HEADER) ?? '');
      this.ctx.acceptWebSocket(server, socketTags(role, identity, Number.isFinite(expires) ? expires : null));
      this.attach(server, live, role, identity ?? undefined);
      if (Number.isFinite(expires)) await this.scheduleExpiry();
      return new Response(null, { status: 101, webSocket: client });
    }

    try {
      // Historial de versiones
      const snap = /^\/snapshots(?:\/([^/]+)(\/restore)?)?$/.exec(url.pathname);
      if (snap) {
        const sid = snap[1] ? decodeURIComponent(snap[1]) : null;
        if (!sid && request.method === 'GET') return json({ snapshots: await live.listSnapshots() });
        if (!sid && request.method === 'POST') { const b = await request.json() as { authorId: string | null; label: string | null }; return json(await live.createSnapshot(b.authorId ?? null, b.label ?? null)); }
        if (sid && !snap[2] && request.method === 'GET') { const ws = await live.snapshotWorkspace(sid); return ws ? json(ws) : json({ error: 'No existe esa instantánea' }, 404); }
        if (sid && snap[2] && request.method === 'POST') {
          live.assertWritable();
          const b = await request.json() as { authorId: string | null };
          const ws = await live.restoreSnapshot(sid, b.authorId ?? null);
          if (!ws) return json({ error: 'No existe esa instantánea' }, 404);
          await live.flush();
          return json(ws);
        }
        if (sid && !snap[2] && request.method === 'DELETE') return (await live.deleteSnapshot(sid)) ? json({ ok: true }) : json({ error: 'No existe esa instantánea' }, 404);
        return json({ error: 'ruta desconocida en el DO' }, 404);
      }
      switch (`${request.method} ${url.pathname}`) {
        case 'POST /init': {
          const body = await request.json() as { name: string; initial: unknown };
          let initial: Workspace | null = null;
          if (body.initial != null) { const r = parseWorkspaceJson(body.initial); if ('issues' in r) return json({ error: 'initial inválido', issues: r.issues }, 400); initial = r; }
          opInit(live.store, body.name, initial);
          break;
        }
        case 'GET /snapshot': return json(opSnapshot(live.store));
        case 'PUT /snapshot': {
          live.assertWritable();
          const r = parseWorkspaceJson(await request.json());
          if ('issues' in r) return json({ error: 'Workspace inválido', issues: r.issues }, 400);
          opReplace(live.store, r);
          break;
        }
        case 'POST /meta': opSetMeta(live.store, (await request.json() as { patch: Partial<WorkspaceMeta> }).patch); break;
        case 'POST /commands': {
          const body = await request.json() as { commands: unknown; label?: string };
          const commands = parseCommands(body.commands);
          live.assertWritable();
          const inverse: Command = opCommands(live.store, commands, body.label);
          await live.flush();
          await this.drainNotifications();
          return json({ inverse });
        }
        case 'GET /validate': return json({ diagnostics: opValidate(live.store) });
        case 'GET /svg': {
          const theme = url.searchParams.get('theme') as 'light' | 'dark' | 'dual' | null;
          const padding = url.searchParams.get('padding');
          const svg = opRenderSvg(live.store, url.searchParams.get('viewId') ?? '', { ...(theme ? { theme } : {}), ...(padding ? { padding: Number(padding) } : {}) });
          return svg === null ? json({ error: 'La vista no existe' }, 404) : new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
        }
        case 'POST /drop': {
          live.closeConnections(WS_DELETED, 'espacio borrado');
          for (const ws of this.ctx.getWebSockets()) { try { ws.close(WS_DELETED, 'espacio borrado'); } catch { /* nada */ } }
          this.sockets.clear();
          live.conns.clear();
          this.live = null;
          this.pendingChanges = null;
          await this.ctx.storage.deleteAll();
          return json({ ok: true });
        }
        default: return json({ error: 'ruta desconocida en el DO' }, 404);
      }
      await live.flush();
      await this.drainNotifications();
      return json({ ok: true });
    } catch (e) {
      if (e instanceof CommandError) return json({ error: e.message, ...(e.issues ? { issues: e.issues } : {}), ...e.extra }, e.status);
      console.error('DO', e);
      return json({ error: 'error interno' }, 500);
    }
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string') return;
    // Un socket que ya cerramos (revocado) no se vuelve a registrar aunque llegue algo rezagado.
    if (ws.readyState !== 1 /* OPEN */) return;
    const { handlers } = await this.socketFor(ws);
    handlers.onMessage(new Uint8Array(message));
    const live = await this.doc();
    if (live.isDirty) await live.flush(); // no confiamos en que el DO siga vivo para el debounce
    if (this.notifying.size) await this.drainNotifications();
  }

  override async webSocketClose(ws: WebSocket) {
    const s = this.sockets.get(ws);
    if (s) { this.sockets.delete(ws); s.handlers.onClose(); }
    else if (this.live) closeConn(await this.live, { isOpen: () => false, send() {}, close() {} });
  }

  override async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
}
