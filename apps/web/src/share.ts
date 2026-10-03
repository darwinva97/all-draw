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

const tokenKey = (room: string) => `alldraw:token:${room}`;

/**
 * Token del enlace compartido para una sala: si viene en la URL (`#/s/<id>?token=lnk_…`) se guarda en
 * `sessionStorage` y se **borra de la URL** (así no queda en el historial, en marcadores ni en capturas);
 * si no, se usa el guardado en esta pestaña.
 */
export function takeShareToken(room: string): string | null {
  const fromUrl = tokenFromHash();
  if (fromUrl) {
    try { sessionStorage.setItem(tokenKey(room), fromUrl); } catch { /* sin almacenamiento: se usa sólo en memoria */ }
    const [path] = location.hash.split('?');
    history.replaceState(history.state, '', `${location.pathname}${location.search}${path}`);
    return fromUrl;
  }
  try { return sessionStorage.getItem(tokenKey(room)); } catch { return null; }
}

/** `connect: false` crea el proveedor sin conectar (espacio abierto sin red): se conecta con `conn.connect()` al volver. */
export function connectRoom(doc: Y.Doc, room: string, token?: string, opts: { connect?: boolean } = {}): RemoteConnection {
  return connectRemote(doc, { url: syncUrl(), room, token, ...(opts.connect === false ? { connect: false } : {}) });
}
