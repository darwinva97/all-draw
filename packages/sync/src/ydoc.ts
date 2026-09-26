/**
 * `YjsStore`: el contrato `Store` del núcleo sobre un `Y.Doc`.
 *
 * Estructura del documento: un `Y.Map` por colección (`doc.getMap('elements')`, …) cuyos valores
 * son **objetos JSON planos** (un registro entero por clave), y `doc.getMap('meta')` con claves
 * sueltas. La granularidad de conflicto es el registro: dos usuarios que editan el mismo registro a
 * la vez se resuelven por último-escritor-gana (deliberadamente simple).
 */
import * as Y from 'yjs';
import {
  COLLECTIONS,
  WorkspaceMeta as WorkspaceMetaSchema,
  parseWorkspace,
  type Collection,
  type Listener,
  type RecordOf,
  type Store,
  type StoreChange,
  type Workspace,
  type WorkspaceMeta,
} from '@all-draw/core';

/** Traduce el origen de una transacción Yjs al `origin` del `StoreChange`. */
export function resolveOrigin(origin: unknown): string {
  if (typeof origin === 'string') return origin;
  if (origin instanceof Y.UndoManager) return origin.undoing ? 'undo' : origin.redoing ? 'redo' : 'local';
  // Cualquier otro objeto es un proveedor (IndexedDB, WebSocket, …) o una aplicación de update directa.
  return 'remote';
}

export class YjsStore implements Store {
  readonly doc: Y.Doc;
  readonly maps: Record<Collection, Y.Map<unknown>>;
  readonly metaMap: Y.Map<unknown>;
  private listeners = new Set<Listener>();
  private listCache = new Map<Collection, unknown[]>();
  private metaCache: WorkspaceMeta | null = null;

  constructor(doc: Y.Doc = new Y.Doc()) {
    this.doc = doc;
    this.maps = Object.fromEntries(COLLECTIONS.map(c => [c, doc.getMap(c)])) as Record<Collection, Y.Map<unknown>>;
    this.metaMap = doc.getMap('meta');
    for (const c of COLLECTIONS) {
      this.maps[c].observe((ev, txn) => {
        this.listCache.delete(c);
        this.emit({ collection: c, ids: [...ev.keysChanged], origin: resolveOrigin(txn.origin) });
      });
    }
    this.metaMap.observe((ev, txn) => {
      this.metaCache = null;
      this.emit({ collection: 'meta', ids: [...ev.keysChanged], origin: resolveOrigin(txn.origin) });
    });
  }

  get<C extends Collection>(c: C, id: string): RecordOf<C> | undefined {
    return this.maps[c].get(id) as RecordOf<C> | undefined;
  }
  set<C extends Collection>(c: C, id: string, value: RecordOf<C>): void {
    this.listCache.delete(c);
    this.doc.transact(() => this.maps[c].set(id, value), 'local');
  }
  delete(c: Collection, id: string): void {
    if (!this.maps[c].has(id)) return;
    this.listCache.delete(c);
    this.doc.transact(() => this.maps[c].delete(id), 'local');
  }
  list<C extends Collection>(c: C): RecordOf<C>[] {
    let cached = this.listCache.get(c);
    if (!cached) { cached = [...this.maps[c].values()]; this.listCache.set(c, cached); }
    return cached as RecordOf<C>[];
  }
  ids(c: Collection): string[] { return [...this.maps[c].keys()]; }

  meta(): WorkspaceMeta {
    if (!this.metaCache) this.metaCache = WorkspaceMetaSchema.parse(Object.fromEntries(this.metaMap.entries()));
    return this.metaCache;
  }
  setMeta(patch: Partial<WorkspaceMeta>): void {
    this.metaCache = null;
    this.doc.transact(() => {
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) this.metaMap.delete(k); else this.metaMap.set(k, v);
      }
    }, 'local');
  }

  /** Una transacción Yjs: un solo `StoreChange` por colección tocada. Anidar reutiliza la externa. */
  transact<T>(fn: () => T, origin = 'local'): T {
    return this.doc.transact(() => fn(), origin);
  }
  subscribe(l: Listener): () => void { this.listeners.add(l); return () => { this.listeners.delete(l); }; }

  /** Copia validada (`parseWorkspace`), desligada del documento. */
  snapshot(): Workspace {
    const raw: Record<string, unknown> = { meta: Object.fromEntries(this.metaMap.entries()) };
    for (const c of COLLECTIONS) raw[c] = Object.fromEntries(this.maps[c].entries());
    return parseWorkspace(structuredClone(raw));
  }

  private emit(ch: StoreChange) { for (const l of this.listeners) l(ch); }
}
