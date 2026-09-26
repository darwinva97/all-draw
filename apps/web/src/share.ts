/** Conexión a la sala del servidor. La sala es el id del espacio; el token es opcional (sesión por cookie) o un enlace `lnk_…`. */
import { connectRemote, type RemoteConnection } from '@all-draw/sync';
import type * as Y from 'yjs';

export function syncUrl(): string {
  const env = import.meta.env.VITE_SYNC_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function tokenFromHash(): string | null {
  const q = location.hash.split('?')[1];
  return q ? new URLSearchParams(q).get('token') : null;
}

export function connectRoom(doc: Y.Doc, room: string, token?: string): RemoteConnection {
  return connectRemote(doc, { url: syncUrl(), room, token });
}
