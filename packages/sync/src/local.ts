/**
 * Workspaces locales: `Y.Doc` persistido en IndexedDB (`y-indexeddb`) y un índice ligero en
 * `localStorage` (`alldraw:index`) para listar sin abrir cada base.
 */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { YjsStore } from './ydoc';
import { YjsHistory } from './undo';

export const DB_PREFIX = 'alldraw:';
export const INDEX_KEY = 'alldraw:index';
const INDEX_DEBOUNCE_MS = 300;

export interface LocalWorkspaceEntry { id: string; name: string; updatedAt: string }

export interface LocalWorkspace {
  store: YjsStore;
  doc: Y.Doc;
  history: YjsHistory;
  /** Se resuelve cuando IndexedDB ha volcado lo que tenía en el doc. */
  whenSynced: Promise<void>;
  destroy(): void;
}

// localStorage no existe en node: caemos a un mapa en memoria para no romper.
const memoryStorage = new Map<string, string>();
function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  if (typeof localStorage !== 'undefined') return localStorage;
  return { getItem: k => memoryStorage.get(k) ?? null, setItem: (k, v) => { memoryStorage.set(k, v); } };
}
function readIndex(): Record<string, Omit<LocalWorkspaceEntry, 'id'>> {
  try { return JSON.parse(storage().getItem(INDEX_KEY) ?? '{}') ?? {}; } catch { return {}; }
}
function writeIndex(idx: Record<string, Omit<LocalWorkspaceEntry, 'id'>>) { storage().setItem(INDEX_KEY, JSON.stringify(idx)); }
function upsertIndex(id: string, store: YjsStore) {
  const idx = readIndex();
  const m = store.meta();
  idx[id] = { name: m.name, updatedAt: m.updatedAt ?? idx[id]?.updatedAt ?? new Date().toISOString() };
  writeIndex(idx);
}

export async function openLocalWorkspace(id: string): Promise<LocalWorkspace> {
  const doc = new Y.Doc();
  const store = new YjsStore(doc);
  const history = new YjsHistory(store);
  const persistence = new IndexeddbPersistence(DB_PREFIX + id, doc);

  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => { if (timer) { clearTimeout(timer); timer = null; } upsertIndex(id, store); };
  const unsubscribe = store.subscribe(ch => {
    if (ch.collection !== 'meta') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, INDEX_DEBOUNCE_MS);
  });

  const whenSynced = persistence.whenSynced.then(() => { upsertIndex(id, store); });

  return {
    store, doc, history, whenSynced,
    destroy() {
      flush();
      unsubscribe();
      history.destroy();
      void persistence.destroy();
      doc.destroy();
    },
  };
}

export async function listLocalWorkspaces(): Promise<LocalWorkspaceEntry[]> {
  return Object.entries(readIndex())
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteLocalWorkspace(id: string): Promise<void> {
  const idx = readIndex();
  delete idx[id];
  writeIndex(idx);
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_PREFIX + id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // se borrará al cerrar la última conexión
  });
}
