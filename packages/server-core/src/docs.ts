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
import { loadInto, type Workspace } from '@all-draw/core';
import { YjsStore } from '@all-draw/sync';
import type { SnapshotMeta, SnapshotStore, WorkspaceStore } from './store/types';
import { docTooLarge } from './ops';

export const SAVE_DEBOUNCE_MS = 500;
const IDLE_UNLOAD_MS = 60_000;
/** Instantáneas por espacio; al pasarse se podan las automáticas (sin etiqueta) más antiguas. */
export const MAX_SNAPSHOTS = 100;
/** Instantánea automática cuando llega un cambio y han pasado ≥ 30 min desde la última. */
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

/** Conexión registrada en un doc: lo que `ysync` y la API necesitan poder hacer con ella. */
export interface DocConnection { close(code?: number, reason?: string): void }

export class LiveDoc {
  readonly doc: Y.Doc;
  readonly store: YjsStore;
  readonly awareness: awarenessProtocol.Awareness;
  /** Conexiones y los clientIds de awareness que controla cada una. */
  readonly conns = new Map<DocConnection, Set<number>>();
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

  constructor(readonly id: string, private persist: DocPersistence, private onIdle: () => void = () => {}, private debounceMs = SAVE_DEBOUNCE_MS, private autoSnapshotMs = AUTO_SNAPSHOT_MS) {
    this.doc = new Y.Doc({ gc: true });
    this.store = new YjsStore(this.doc);
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    this.doc.on('update', (u: Uint8Array, origin: unknown) => {
      this.dirty = true;
      this.pendingBytes += u.byteLength;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { void this.flush(); }, this.debounceMs);
      if (origin !== 'load' && Date.now() - this.lastSnapshotAt >= this.autoSnapshotMs) void this.createSnapshot(null, null).catch(e => console.error('instantánea automática', this.id, e));
    });
  }

  async load(): Promise<void> {
    const update = await this.persist.loadDoc(this.id);
    if (update) Y.applyUpdate(this.doc, update, 'load');
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    this.dirty = false;
    this.savedBytes = update?.byteLength ?? 0;
    this.pendingBytes = 0;
    this.lastSnapshotAt = Date.now();
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
   * Restaura una instantánea sobre el doc vivo con `loadInto` (los clientes conectados lo ven como un
   * cambio más y el historial Yjs se conserva). Antes guarda una instantánea automática del estado actual.
   */
  async restoreSnapshot(sid: string, authorId: string | null): Promise<Workspace | null> {
    const ws = await this.snapshotWorkspace(sid);
    if (!ws) return null;
    await this.createSnapshot(authorId, null);
    loadInto(this.store, ws);
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
    await this.flush();
    this.awareness.destroy();
    this.doc.destroy();
  }
}

export interface DocManagerOptions {
  /** Tamaño máximo de cada doc en bytes (`MAX_DOC_BYTES`); 0 o ausente = sin límite. */
  maxDocBytes?: number;
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
