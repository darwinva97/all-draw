/**
 * Un `Store` es la única puerta de entrada para mutar un workspace: registros planos por colección.
 * `MemoryStore` sirve para tests, agentes y el servidor; `@all-draw/sync` implementa el mismo
 * contrato sobre un `Y.Doc` (colaboración y offline).
 */
import { COLLECTIONS, emptyWorkspace, type Collection, type Workspace, type WorkspaceMeta, type RecordOf } from './model';

export type Listener = (change: StoreChange) => void;
export interface StoreChange {
  collection: Collection | 'meta';
  ids: string[];
  /** Origen: 'local' (comandos), 'remote' (sync), 'undo' */
  origin: string;
}

export interface Store {
  get<C extends Collection>(c: C, id: string): RecordOf<C> | undefined;
  set<C extends Collection>(c: C, id: string, value: RecordOf<C>): void;
  delete(c: Collection, id: string): void;
  list<C extends Collection>(c: C): RecordOf<C>[];
  ids(c: Collection): string[];
  meta(): WorkspaceMeta;
  setMeta(patch: Partial<WorkspaceMeta>): void;
  /** Agrupa cambios en una unidad (undo y notificación). */
  transact<T>(fn: () => T, origin?: string): T;
  subscribe(l: Listener): () => void;
  snapshot(): Workspace;
}

export class MemoryStore implements Store {
  private ws: Workspace;
  private listeners = new Set<Listener>();
  private pending: Map<string, Set<string>> | null = null;
  private origin = 'local';
  /** `list()` devuelve la misma matriz hasta que la colección cambia (no la mutes). */
  private listCache = new Map<Collection, unknown[]>();

  constructor(ws: Workspace = emptyWorkspace()) { this.ws = ws; }

  get<C extends Collection>(c: C, id: string): RecordOf<C> | undefined {
    return this.ws[c][id] as RecordOf<C> | undefined;
  }
  set<C extends Collection>(c: C, id: string, value: RecordOf<C>): void {
    (this.ws[c] as Record<string, RecordOf<C>>)[id] = value;
    this.listCache.delete(c);
    this.touch(c, id);
  }
  delete(c: Collection, id: string): void {
    if (!(id in this.ws[c])) return;
    delete (this.ws[c] as Record<string, unknown>)[id];
    this.listCache.delete(c);
    this.touch(c, id);
  }
  list<C extends Collection>(c: C): RecordOf<C>[] {
    let cached = this.listCache.get(c);
    if (!cached) { cached = Object.values(this.ws[c]); this.listCache.set(c, cached); }
    return cached as RecordOf<C>[];
  }
  ids(c: Collection): string[] { return Object.keys(this.ws[c]); }
  meta(): WorkspaceMeta { return this.ws.meta; }
  setMeta(patch: Partial<WorkspaceMeta>): void { this.ws.meta = { ...this.ws.meta, ...patch }; this.touch('meta', '*'); }

  transact<T>(fn: () => T, origin = 'local'): T {
    if (this.pending) return fn();
    this.pending = new Map();
    this.origin = origin;
    try { return fn(); } finally {
      const p = this.pending; this.pending = null;
      for (const [c, ids] of p) this.emit({ collection: c as Collection | 'meta', ids: [...ids], origin });
    }
  }
  subscribe(l: Listener): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  snapshot(): Workspace { return structuredClone(this.ws); }

  private touch(c: Collection | 'meta', id: string) {
    if (this.pending) { let s = this.pending.get(c); if (!s) this.pending.set(c, (s = new Set())); s.add(id); }
    else this.emit({ collection: c, ids: [id], origin: this.origin });
  }
  private emit(ch: StoreChange) { for (const l of this.listeners) l(ch); }
}

export function loadInto(store: Store, ws: Workspace): void {
  store.transact(() => {
    for (const c of COLLECTIONS) {
      for (const id of store.ids(c)) store.delete(c, id);
      for (const [id, v] of Object.entries(ws[c])) store.set(c, id, v as never);
    }
    store.setMeta(ws.meta);
  }, 'load');
}
