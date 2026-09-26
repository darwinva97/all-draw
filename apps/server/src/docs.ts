/**
 * Documentos Yjs vivos: uno por espacio abierto, compartido entre las conexiones WebSocket y la API
 * REST (`commands`, `snapshot`). Persistencia con `WorkspaceStore.saveDoc` (debounce 500 ms) y
 * descarga del doc cuando no quedan conexiones ni actividad reciente.
 */
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { YjsStore } from '@all-draw/sync';
import type { WorkspaceStore } from './store/types';

export const SAVE_DEBOUNCE_MS = 500;
const IDLE_UNLOAD_MS = 60_000;

export class LiveDoc {
  readonly doc: Y.Doc;
  readonly store: YjsStore;
  readonly awareness: awarenessProtocol.Awareness;
  /** Conexiones y los clientIds de awareness que controla cada una. */
  readonly conns = new Map<object, Set<number>>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();

  constructor(readonly id: string, private persist: WorkspaceStore, private onIdle: () => void) {
    this.doc = new Y.Doc({ gc: true });
    this.store = new YjsStore(this.doc);
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);
    this.doc.on('update', () => {
      this.dirty = true;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { void this.flush(); }, SAVE_DEBOUNCE_MS);
    });
  }

  async load(): Promise<void> {
    const update = await this.persist.loadDoc(this.id);
    if (update) Y.applyUpdate(this.doc, update, 'load');
    this.dirty = false;
  }

  /** Guarda ahora (si hay cambios). Serializa las escrituras. */
  flush(): Promise<void> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    if (!this.dirty) return this.saving;
    this.dirty = false;
    const snapshot = Y.encodeStateAsUpdate(this.doc);
    this.saving = this.saving.then(() => this.persist.saveDoc(this.id, snapshot)).catch(e => console.error('no se pudo guardar', this.id, e));
    return this.saving;
  }

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  touch() { if (this.idleTimer) clearTimeout(this.idleTimer); this.idleTimer = setTimeout(() => { if (this.conns.size === 0) this.onIdle(); }, IDLE_UNLOAD_MS); }

  async destroy(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    await this.flush();
    this.awareness.destroy();
    this.doc.destroy();
  }
}

export class DocManager {
  private docs = new Map<string, Promise<LiveDoc>>();
  constructor(private persist: WorkspaceStore) {}

  /** Doc cargado (lo abre si hace falta). El llamador debe saber que el espacio existe. */
  get(id: string): Promise<LiveDoc> {
    let p = this.docs.get(id);
    if (!p) {
      p = (async () => {
        const d = new LiveDoc(id, this.persist, () => { void this.unload(id); });
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

  /** Cierra todo guardando (apagado ordenado). */
  async closeAll(): Promise<void> {
    const all = [...this.docs.values()]; this.docs.clear();
    for (const p of all) { const d = await p; for (const c of d.conns.keys()) (c as { close?: () => void }).close?.(); await d.destroy(); }
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
