/** Compartir en línea: una sala en el servidor de sincronización; el id de sala va en la URL (#/w/<id>?room=<sala>). */
import { connectRemote, type RemoteConnection } from '@all-draw/sync';
import type * as Y from 'yjs';

export function syncUrl(): string {
  const env = import.meta.env.VITE_SYNC_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function roomFromHash(): string | null {
  const q = location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get('room') : null;
}

export function connectRoom(doc: Y.Doc, room: string): RemoteConnection {
  return connectRemote(doc, { url: syncUrl(), room });
}

export function readOnlyFromHash(): boolean {
  const q = location.hash.split('?')[1];
  return !!q && new URLSearchParams(q).get('ro') === '1';
}
