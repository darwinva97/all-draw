/**
 * `WorkspaceDO`: un Durable Object por espacio. Mantiene el `Y.Doc` vivo (`LiveDoc` de server-core),
 * habla el protocolo y-websocket con la Hibernation API (`ctx.acceptWebSocket`) y persiste el estado
 * completo del doc en su storage (troceado: el límite por valor es 128 KiB en KV / 2 MiB en SQLite).
 *
 * El worker le reenvía por `stub.fetch` tanto el upgrade del WebSocket (`GET /ws`, con el rol ya
 * resuelto en la cabecera `x-alldraw-role`) como las operaciones de la API (`RemoteDocHost`):
 *
 *   POST /init {name, initial}       PUT /snapshot (Workspace)    POST /meta {patch}
 *   GET  /snapshot                   POST /commands {commands, label}   GET /validate
 *   GET  /svg?viewId&theme&padding   POST /drop
 */
import { DurableObject } from 'cloudflare:workers';
import type { Command, Workspace, WorkspaceMeta } from '@all-draw/core';
import {
  CommandError, LiveDoc, attachConnection, closeConn, opCommands, opInit, opRenderSvg, opReplace, opSetMeta, opSnapshot, opValidate, parseCommands, parseWorkspaceJson,
  type DocPersistence, type Role, type SyncHandlers, type SyncSocket,
} from '@all-draw/server-core';
import type { Env } from './env';

export const ROLE_HEADER = 'x-alldraw-role';
const CHUNK = 96 * 1024; // < 128 KiB por valor, vale para KV y SQLite
const META_KEY = 'doc:meta';

/** Persistencia del doc en el storage del DO, troceada. */
function storagePersistence(storage: DurableObjectStorage): DocPersistence {
  return {
    async loadDoc() {
      const meta = await storage.get<{ chunks: number; size: number }>(META_KEY);
      if (!meta || meta.chunks === 0) return null;
      const keys = Array.from({ length: meta.chunks }, (_, i) => `doc:${i}`);
      const got = await storage.get<ArrayBuffer>(keys);
      const out = new Uint8Array(meta.size);
      let off = 0;
      for (const k of keys) { const part = got.get(k); if (!part) return null; out.set(new Uint8Array(part), off); off += part.byteLength; }
      return out;
    },
    async saveDoc(_id, update) {
      const prev = await storage.get<{ chunks: number }>(META_KEY);
      const entries: Record<string, ArrayBuffer | { chunks: number; size: number }> = {};
      let n = 0;
      for (let off = 0; off < update.length; off += CHUNK, n++) entries[`doc:${n}`] = update.slice(off, off + CHUNK).buffer as ArrayBuffer;
      entries[META_KEY] = { chunks: n, size: update.length };
      await storage.put(entries);
      if (prev && prev.chunks > n) await storage.delete(Array.from({ length: prev.chunks - n }, (_, i) => `doc:${n + i}`));
    },
  };
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

export class WorkspaceDO extends DurableObject<Env> {
  private live: Promise<LiveDoc> | null = null;
  private sockets = new Map<WebSocket, { conn: SyncSocket; handlers: SyncHandlers }>();

  private doc(): Promise<LiveDoc> {
    this.live ??= (async () => {
      const d = new LiveDoc(this.ctx.id.toString(), storagePersistence(this.ctx.storage));
      await d.load();
      return d;
    })();
    return this.live;
  }

  /** Registra (o re-registra tras hibernar) un WebSocket aceptado en el doc. */
  private attach(ws: WebSocket, live: LiveDoc, role: Role) {
    const conn: SyncSocket = {
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
    // Despertar de hibernación: el rol viaja en las etiquetas del socket
    const role = (this.ctx.getTags(ws)[0] ?? 'viewer') as Role;
    return this.attach(ws, await this.doc(), role);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const live = await this.doc();

    if (url.pathname === '/ws') {
      if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('se esperaba un WebSocket', { status: 426 });
      const role = (request.headers.get(ROLE_HEADER) ?? 'viewer') as Role;
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      this.ctx.acceptWebSocket(server, [role]);
      this.attach(server, live, role);
      return new Response(null, { status: 101, webSocket: client });
    }

    try {
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
          const r = parseWorkspaceJson(await request.json());
          if ('issues' in r) return json({ error: 'Workspace inválido', issues: r.issues }, 400);
          opReplace(live.store, r);
          break;
        }
        case 'POST /meta': opSetMeta(live.store, (await request.json() as { patch: Partial<WorkspaceMeta> }).patch); break;
        case 'POST /commands': {
          const body = await request.json() as { commands: unknown; label?: string };
          const commands = parseCommands(body.commands);
          const inverse: Command = opCommands(live.store, commands, body.label);
          await live.flush();
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
          live.closeConnections(4410, 'espacio borrado');
          for (const ws of this.ctx.getWebSockets()) { try { ws.close(4410, 'espacio borrado'); } catch { /* nada */ } }
          this.sockets.clear();
          live.conns.clear();
          this.live = null;
          await this.ctx.storage.deleteAll();
          return json({ ok: true });
        }
        default: return json({ error: 'ruta desconocida en el DO' }, 404);
      }
      await live.flush();
      return json({ ok: true });
    } catch (e) {
      if (e instanceof CommandError) return json({ error: e.message, ...(e.issues ? { issues: e.issues } : {}) }, e.status);
      console.error('DO', e);
      return json({ error: 'error interno' }, 500);
    }
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message === 'string') return;
    const { handlers } = await this.socketFor(ws);
    handlers.onMessage(new Uint8Array(message));
    const live = await this.doc();
    if (live.isDirty) await live.flush(); // no confiamos en que el DO siga vivo para el debounce
  }

  override async webSocketClose(ws: WebSocket) {
    const s = this.sockets.get(ws);
    if (s) { this.sockets.delete(ws); s.handlers.onClose(); }
    else if (this.live) closeConn(await this.live, { isOpen: () => false, send() {}, close() {} });
  }

  override async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
}
