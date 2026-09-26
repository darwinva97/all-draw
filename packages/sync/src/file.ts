/**
 * Importación y exportación: binario Yjs (update completo con historial CRDT) o `.alldraw` (JSON del
 * `Workspace`, legible y portable, sin historial).
 */
import * as Y from 'yjs';
import { loadInto, parseWorkspace, type Store } from '@all-draw/core';

export function serializeDoc(doc: Y.Doc): Uint8Array { return Y.encodeStateAsUpdate(doc); }
export function loadUpdate(doc: Y.Doc, bytes: Uint8Array, origin: unknown = 'load'): void { Y.applyUpdate(doc, bytes, origin); }

export function toJsonFile(store: Store): string { return JSON.stringify(store.snapshot(), null, 2); }
export function fromJsonFile(store: Store, text: string): void { loadInto(store, parseWorkspace(JSON.parse(text))); }
