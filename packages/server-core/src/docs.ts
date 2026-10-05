/**
 * Documentos Yjs vivos: uno por espacio abierto, compartido entre las conexiones WebSocket y la API
 * REST (`commands`, `snapshot`). Persistencia con `DocPersistence.saveDoc` (debounce 500 ms) y
 * descarga del doc cuando no quedan conexiones ni actividad reciente.
 *
 * No depende de Node: en el servidor Node el `DocManager` vive en el proceso; en Cloudflare cada
 * Durable Object tiene un único `LiveDoc` cuya persistencia es su propio storage.
 */
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import type { Workspace } from '@all-draw/core';
import { RECORD_FORMAT, SYNC_PROTOCOL, WS_UPGRADE_REQUIRED, YjsStore, migrateRecords, recordValue, replaceInto } from '@all-draw/sync';
import type { SnapshotMeta, SnapshotStore, WorkspaceStore } from './store/types';
import { docTooLarge } from './ops';

export const SAVE_DEBOUNCE_MS = 500;
const IDLE_UNLOAD_MS = 60_000;
/** Instantáneas por espacio; al pasarse se podan las automáticas (sin etiqueta) más antiguas. */
export const MAX_SNAPSHOTS = 100;
/**
 * Instantánea automática cuando llega un cambio y han pasado ≥ 30 min desde la última **guardada** (se lee del
 * historial al cargar el doc, así que cuenta aunque el doc se descargue entre medias). Un espacio con contenido y sin
 * ninguna instantánea guarda la primera con el primer cambio; uno recién creado espera los 30 min.
 */
export const AUTO_SNAPSHOT_MS = 30 * 60_000;

/** Lo único que un doc vivo necesita de la persistencia: el estado del doc y sus instantáneas. */
export type DocPersistence = Pick<WorkspaceStore, 'loadDoc' | 'saveDoc'> & SnapshotStore;

/** Reconstruye el Workspace JSON a partir de un update Yjs completo (lo que guarda una instantánea). */
export function workspaceFromUpdate(update: Uint8Array): Workspace {
  const d = new Y.Doc();
  Y.applyUpdate(d, update);
  const ws = new YjsStore(d).snapshot();
  d.destroy();
  return ws;
}

/**
 * Quién abrió una conexión: el usuario (sesión o API key) o el enlace compartido con el que entró. Se guarda al
 * aceptar el WebSocket para poder cerrarla cuando ese acceso se revoca (`revokeConnections`).
 *
 * `sessionId` (prefijo del hash de la sesión, `sessionIdOf`) y `keyId` (id de la API key) dicen con qué credencial
 * entró el usuario: así «Cerrar sesión» cierra sólo los WebSockets de ese navegador y revocar una clave, los suyos.
 * Ausentes (conexiones aceptadas antes de existir estos campos) = credencial desconocida, se trata como sesión.
 */
export interface ConnIdentity { userId: string | null; linkToken: string | null; sessionId?: string | null; keyId?: string | null }
/**
 * Qué conexiones cerrar: las de un usuario, un enlace, una sesión o una API key (basta con que coincida uno).
 * `sessionsOnly` deja fuera las abiertas con API key; `exceptSessionId` respeta la sesión desde la que se pide
 * (cambiar la contraseña no desconecta el navegador que la cambia).
 */
export interface ConnMatch { userId?: string; linkToken?: string; sessionId?: string; keyId?: string; sessionsOnly?: boolean; exceptSessionId?: string }
export function matchesIdentity(id: ConnIdentity | undefined, m: ConnMatch): boolean {
  if (!id) return false;
  const hit = (!!m.userId && id.userId === m.userId) || (!!m.linkToken && id.linkToken === m.linkToken)
    || (!!m.sessionId && id.sessionId === m.sessionId) || (!!m.keyId && id.keyId === m.keyId);
  if (!hit) return false;
  if (m.sessionsOnly && id.keyId) return false;
  if (m.exceptSessionId && id.sessionId === m.exceptSessionId) return false;
  return true;
}
/** Identificador de una sesión en las conexiones (prefijo del hash del token: nunca el token). */
export const sessionIdOf = (sessionHash: string): string => sessionHash.slice(0, 32);

/** Conexión registrada en un doc: lo que `ysync` y la API necesitan poder hacer con ella. */
export interface DocConnection {
  close(code?: number, reason?: string): void;
  identity?: ConnIdentity;
  /**
   * Versión del protocolo que habla el cliente (`SYNC_PROTOCOL` de `@all-draw/sync`), una vez admitida en la puerta de
   * versión (ver `LiveDoc`); `0` = cliente sin versión (no es la app: tests, scripts). Si ya viene puesta al registrarla
   * (p. ej. un socket del Durable Object que despierta de la hibernación), no se vuelve a pasar por la puerta.
   */
  protocol?: number;
  /** Se llama al admitirla (para recordarlo, p. ej. en el adjunto del socket del DO). */
  onAdmit?(protocol: number): void;
}

// ---------------------------------------------------------------- Puerta de versión del protocolo
/**
 * Los registros del documento cambiaron de formato (JSON plano → `Y.Map` por registro, ver `@all-draw/sync/ydoc`). Un
 * cliente de la app anterior no sabe leer el formato nuevo y, al escribir, estropearía los registros: no puede
 * sincronizar. Los clientes nuevos publican `proto` en su awareness antes de abrir el socket (`connectRemote`).
 *
 * Al registrar una conexión, lo que el servidor le manda se retiene hasta saber quién es:
 * - awareness con `proto ≥ SYNC_PROTOCOL` → se admite y se le manda lo retenido (en la práctica, al momento: el
 *   awareness llega justo detrás del primer mensaje de sync);
 * - awareness con presencia de la app (`name`) y sin `proto`, o con un `proto` antiguo → se cierra con
 *   `WS_UPGRADE_REQUIRED` (4426, «hay una versión nueva: recarga»), sin haberle mandado nada del documento;
 * - sin awareness (o vacío) en `PROTOCOL_GATE_MS` → se admite igual: no es la app (tests, scripts, otros clientes
 *   y-websocket), que no estropean nada mientras no escriban registros con la forma antigua.
 *
 * Lo que mande un cliente viejo antes de cerrarlo sí se aplica: son registros JSON enteros, que el formato nuevo lee
 * (y migra al siguiente cambio).
 */
export const PROTOCOL_GATE_MS = 1500;
export { WS_UPGRADE_REQUIRED };
export const UPGRADE_REASON = 'Hay una versión nueva de all-draw: recarga la página';

interface Gate { send: (buf: Uint8Array) => void; queue: Uint8Array[]; timer: ReturnType<typeof setTimeout> }

/** `Map` de conexiones que avisa al registrar y al quitar una (para la puerta de versión). */
class ConnRegistry extends Map<DocConnection, Set<number>> {
  onAdd: ((c: DocConnection) => void) | null = null;
  onRemove: ((c: DocConnection) => void) | null = null;
  override set(c: DocConnection, ids: Set<number>): this {
    const fresh = !this.has(c);
    super.set(c, ids);
    if (fresh) this.onAdd?.(c);
    return this;
  }
  override delete(c: DocConnection): boolean {
    const had = super.delete(c);
    if (had) this.onRemove?.(c);
    return had;
  }
  override clear(): void {
    const all = [...this.keys()];
    super.clear();
    for (const c of all) this.onRemove?.(c);
  }
}

export class LiveDoc {
  readonly doc: Y.Doc;
  readonly store: YjsStore;
  readonly awareness: awarenessProtocol.Awareness;
  /** Conexiones y los clientIds de awareness que controla cada una. */
  readonly conns: Map<DocConnection, Set<number>> = new ConnRegistry();
  /** Conexiones aún sin versión conocida (ver «Puerta de versión»). */
  private gates = new Map<DocConnection, Gate>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();
  private lastSnapshotAt = Date.now();
  private snapshotting: Promise<unknown> = Promise.resolve();
  /** Tamaño máximo del doc (update Yjs completo) en bytes; 0 = sin límite (`MAX_DOC_BYTES`). */
  maxBytes = 0;
  /** Bytes del último estado completo leído o guardado. */
  private savedBytes = 0;
  /** Bytes de los updates llegados desde entonces (cota superior del crecimiento). */
  private pendingBytes = 0;
  /**
   * Comentarios recién **añadidos** al doc (clave nueva en `comments`), venga el cambio de un WebSocket o de la API. No
   * cuentan los que entran al cargar, restaurar, reemplazar o importar (origen `load`). Lo usa el centro de
   * notificaciones para las menciones (`Notifier.mentions`).
   */
  onNewComments: ((comments: Record<string, unknown>[]) => void) | null = null;

  constructor(readonly id: string, private persist: DocPersistence, private onIdle: () => void = () => {}, private debounceMs = SAVE_DEBOUNCE_MS, private autoSnapshotMs = AUTO_SNAPSHOT_MS) {
    this.doc = new Y.Doc({ gc: true });
    this.store = new YjsStore(this.doc);
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    const reg = this.conns as ConnRegistry;
    reg.onAdd = c => this.gate(c);
    reg.onRemove = c => this.ungate(c);
    // Antes que el difusor de `ysync` (se instala al conectar el primero): clasifica según el awareness que llega.
    this.awareness.on('update', ({ added, updated }: { added: number[]; updated: number[] }, origin: unknown) => {
      if (!origin || typeof origin !== 'object' || !this.gates.has(origin as DocConnection)) return;
      const conn = origin as DocConnection;
      const ids = [...added, ...updated];
      for (const id of ids) {
        const st = this.awareness.getStates().get(id) as { proto?: unknown; name?: unknown } | undefined;
        if (!st) continue;
        if (typeof st.proto === 'number') { if (st.proto >= SYNC_PROTOCOL) this.admit(conn, st.proto); else this.reject(conn, ids); return; }
        if (typeof st.name === 'string') { this.reject(conn, ids); return; }
      }
    });
    this.doc.on('update', (u: Uint8Array, origin: unknown) => {
      this.dirty = true;
      this.pendingBytes += u.byteLength;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { void this.flush(); }, this.debounceMs);
      if (origin !== 'load' && Date.now() - this.lastSnapshotAt >= this.autoSnapshotMs) void this.createSnapshot(null, null).catch(e => console.error('instantánea automática', this.id, e));
    });
    const comments = this.doc.getMap('comments');
    comments.observe((ev, txn) => {
      if (!this.onNewComments || txn.origin === 'load') return;
      const added: Record<string, unknown>[] = [];
      for (const [k, ch] of ev.changes.keys) {
        // Registro en formato 2 (`Y.Map`) o 1 (JSON): siempre plano para quien lo reciba.
        const v = ch.action === 'add' ? recordValue('comments', k, comments.get(k)) : undefined;
        if (v) added.push(v);
      }
      if (added.length) { try { this.onNewComments(added); } catch (e) { console.error('onNewComments', this.id, e); } }
    });
  }

  // ---------------------------------------------------------------- Puerta de versión
  /** Retiene lo que se le manda a una conexión nueva hasta saber si habla el protocolo actual. */
  private gate(c: DocConnection) {
    if (c.protocol !== undefined) return;
    const sock = c as DocConnection & { send?: (buf: Uint8Array) => void };
    if (typeof sock.send !== 'function') return;
    const send = sock.send;
    const g: Gate = { send, queue: [], timer: setTimeout(() => this.admit(c, 0), PROTOCOL_GATE_MS) };
    (g.timer as { unref?: () => void }).unref?.();
    sock.send = buf => { g.queue.push(buf); };
    this.gates.set(c, g);
  }

  private ungate(c: DocConnection): Gate | undefined {
    const g = this.gates.get(c);
    if (!g) return undefined;
    this.gates.delete(c);
    clearTimeout(g.timer);
    (c as DocConnection & { send: (buf: Uint8Array) => void }).send = g.send;
    return g;
  }

  /** Deja pasar la conexión: le manda lo retenido, en orden. */
  private admit(c: DocConnection, protocol: number) {
    const g = this.ungate(c);
    if (!g) return;
    c.protocol = protocol;
    try { c.onAdmit?.(protocol); } catch { /* sólo es para recordarlo */ }
    for (const buf of g.queue) { try { g.send.call(c, buf); } catch { break; } }
  }

  /** Cliente de una versión anterior de la app: fuera, sin mandarle nada del documento. */
  private reject(c: DocConnection, clientIds: number[] = []) {
    if (!this.ungate(c)) return;
    const ids = new Set([...(this.conns.get(c) ?? []), ...clientIds]);
    this.conns.delete(c);
    if (ids.size) awarenessProtocol.removeAwarenessStates(this.awareness, [...ids], null);
    try { c.close(WS_UPGRADE_REQUIRED, UPGRADE_REASON); } catch { /* ya cerrada */ }
    this.touch();
  }

  async load(): Promise<void> {
    const update = await this.persist.loadDoc(this.id);
    if (update) Y.applyUpdate(this.doc, update, 'load');
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    this.dirty = false;
    this.savedBytes = update?.byteLength ?? 0;
    this.pendingBytes = 0;
    this.lastSnapshotAt = update ? await this.lastSavedSnapshotAt() : Date.now();
    if (update) await this.migrateFormat();
  }

  /**
   * Migración del formato de registros (1 → 2) al cargar, de una vez y antes de que se conecte nadie: así los clientes
   * reciben los registros ya migrados y no los migran cada uno por su lado al editarlos a la vez (la primera edición
   * simultánea de un registro antiguo la ganaría uno). Antes guarda una instantánea automática del estado anterior.
   * Deja la marca `recordFormat` en `meta` (el esquema del espacio la ignora).
   */
  private async migrateFormat(): Promise<void> {
    if (this.store.legacyCount() === 0) return;
    try { await this.createSnapshot(null, null); } catch (e) { console.error('instantánea antes de migrar', this.id, e); }
    const n = migrateRecords(this.store, 'load');
    this.doc.transact(() => this.store.metaMap.set('recordFormat', RECORD_FORMAT), 'load');
    this.dirty = true;
    this.savedBytes = Y.encodeStateAsUpdate(this.doc).byteLength;
    this.pendingBytes = 0;
    console.info?.(`espacio ${this.id}: ${n} registros migrados al formato ${RECORD_FORMAT}`);
  }

  /** Fecha (ms) de la instantánea más reciente del historial; 0 si no hay ninguna. Si no se puede leer, ahora (no se fuerza una). */
  private async lastSavedSnapshotAt(): Promise<number> {
    try {
      const [last] = await this.persist.listSnapshots(this.id);
      const at = last ? Date.parse(last.createdAt) : 0;
      return Number.isFinite(at) ? at : 0;
    } catch { return Date.now(); }
  }

  // ---------------------------------------------------------------- Historial de versiones
  listSnapshots(): Promise<SnapshotMeta[]> { return this.persist.listSnapshots(this.id); }

  /** Guarda el estado actual como instantánea (update Yjs completo) y poda las automáticas sobrantes. Serializadas. */
  createSnapshot(authorId: string | null, label: string | null): Promise<SnapshotMeta> {
    this.lastSnapshotAt = Date.now();
    const data = Y.encodeStateAsUpdate(this.doc);
    const p = this.snapshotting.then(async () => {
      const meta = await this.persist.createSnapshot({ workspaceId: this.id, authorId, label, data });
      await this.persist.pruneSnapshots(this.id, MAX_SNAPSHOTS);
      return meta;
    });
    this.snapshotting = p.catch(() => { /* ya se informa al llamador */ });
    return p;
  }

  async snapshotWorkspace(sid: string): Promise<Workspace | null> {
    const s = await this.persist.getSnapshot(this.id, sid);
    return s ? workspaceFromUpdate(s.data) : null;
  }

  /**
   * Restaura una instantánea sobre el doc vivo con `replaceInto` (diff: solo cambia lo que difiere; los clientes
   * conectados lo ven como un cambio más y el historial Yjs se conserva). Antes guarda una instantánea automática.
   */
  async restoreSnapshot(sid: string, authorId: string | null): Promise<Workspace | null> {
    const ws = await this.snapshotWorkspace(sid);
    if (!ws) return null;
    await this.createSnapshot(authorId, null);
    replaceInto(this.store, ws, 'load');
    return ws;
  }

  deleteSnapshot(sid: string): Promise<boolean> { return this.persist.deleteSnapshot(this.id, sid); }

  get isDirty() { return this.dirty; }

  // ---------------------------------------------------------------- Cuota de tamaño
  /** Tamaño estimado del doc (estado guardado + updates desde entonces; nunca lo subestima). */
  get bytes(): number { return this.savedBytes + this.pendingBytes; }

  /** Lanza `CommandError` 413 si el doc ya está en el límite (escrituras por la API). */
  assertWritable(extraBytes = 0): void {
    if (this.maxBytes > 0 && this.bytes + extraBytes > this.maxBytes) throw docTooLarge(this.maxBytes);
  }

  /**
   * ¿Se acepta este update (WebSocket) sin pasarse de `maxBytes`? Se mide sólo lo que el doc aún no tiene
   * (`Y.diffUpdate` contra su vector de estado: al reconectar, el cliente reenvía todo lo que ya existe), y un
   * update que sólo borra se acepta siempre, para que se pueda volver por debajo del límite.
   */
  accepts(update: Uint8Array): boolean {
    if (this.maxBytes <= 0 || this.bytes + update.byteLength <= this.maxBytes) return true;
    try {
      const novel = Y.diffUpdate(update, Y.encodeStateVector(this.doc));
      if (Y.decodeUpdate(novel).structs.length === 0) return true;
      return this.bytes + novel.byteLength <= this.maxBytes;
    } catch { return false; }
  }

  /** Guarda ahora (si hay cambios). Serializa las escrituras. */
  flush(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.dirty) return this.saving;
    this.dirty = false;
    const snapshot = Y.encodeStateAsUpdate(this.doc);
    this.savedBytes = snapshot.byteLength;
    this.pendingBytes = 0;
    this.saving = this.saving.then(() => this.persist.saveDoc(this.id, snapshot)).catch(e => console.error('no se pudo guardar', this.id, e));
    return this.saving;
  }

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  touch() { if (this.idleTimer) clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (this.conns.size === 0) this.onIdle(); }, IDLE_UNLOAD_MS); }

  /** Cierra todas las conexiones con un código (p. ej. 4410 al borrar el espacio). */
  closeConnections(code?: number, reason?: string) {
    for (const c of [...this.conns.keys()]) { try { c.close(code, reason); } catch { /* ya cerrada */ } }
  }

  async destroy(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    for (const c of [...this.gates.keys()]) this.ungate(c);
    await this.flush();
    this.awareness.destroy();
    this.doc.destroy();
  }
}

export interface DocManagerOptions {
  /** Tamaño máximo de cada doc en bytes (`MAX_DOC_BYTES`); 0 o ausente = sin límite. */
  maxDocBytes?: number;
  /** Comentarios nuevos de un espacio (ver `LiveDoc.onNewComments`): el servidor Node notifica las menciones. */
  onNewComments?: (workspaceId: string, comments: Record<string, unknown>[], live: LiveDoc) => void;
}

export class DocManager {
  private docs = new Map<string, Promise<LiveDoc>>();
  constructor(private persist: DocPersistence, private opts: DocManagerOptions = {}) {}

  /** Docs abiertos ahora mismo (métrica). */
  get size(): number { return this.docs.size; }
  /** Conexiones WebSocket registradas en los docs ya cargados (métrica). */
  async connections(): Promise<number> {
    let n = 0;
    for (const p of this.docs.values()) { try { n += (await p).conns.size; } catch { /* doc que no cargó */ } }
    return n;
  }

  /** Doc cargado (lo abre si hace falta). El llamador debe saber que el espacio existe. */
  get(id: string): Promise<LiveDoc> {
    let p = this.docs.get(id);
    if (!p) {
      p = (async () => {
        const d = new LiveDoc(id, this.persist, () => { void this.unload(id); });
        d.maxBytes = this.opts.maxDocBytes ?? 0;
        const hook = this.opts.onNewComments;
        if (hook) d.onNewComments = cs => hook(id, cs, d);
        await d.load();
        d.touch();
        return d;
      })();
      this.docs.set(id, p);
      p.catch(() => this.docs.delete(id));
    }
    return p;
  }

  has(id: string) { return this.docs.has(id); }

  async unload(id: string): Promise<void> {
    const p = this.docs.get(id); if (!p) return;
    const d = await p;
    if (d.conns.size > 0) return;
    this.docs.delete(id);
    await d.destroy();
  }

  /** Guarda ya todos los docs con cambios (sin cerrarlos). */
  async flushAll(): Promise<void> {
    for (const p of [...this.docs.values()]) { try { await (await p).flush(); } catch { /* doc que no cargó */ } }
  }

  /**
   * Cierra todo guardando (apagado ordenado). Las conexiones se cierran con `code` (1012 «reiniciando»
   * al apagar: el cliente y-websocket reconecta solo).
   */
  async closeAll(code?: number, reason?: string): Promise<void> {
    const all = [...this.docs.values()]; this.docs.clear();
    for (const p of all) {
      let d: LiveDoc;
      try { d = await p; } catch { continue; }
      d.closeConnections(code, reason);
      await d.destroy();
    }
  }

  /** Ejecuta `fn` con el store del doc y persiste sin esperar al debounce. */
  async withStore<T>(id: string, fn: (store: YjsStore, live: LiveDoc) => T): Promise<T> {
    const d = await this.get(id);
    const out = fn(d.store, d);
    d.touch();
    void d.flush();
    return out;
  }
}
