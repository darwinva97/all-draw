/**
 * Colaboración en tiempo real: `WebsocketProvider` de y-websocket (reconexión con backoff incluida)
 * y presencia (cursores, selección) vía awareness.
 */
import type * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';

/**
 * Versión del protocolo de sincronización que habla este cliente, publicada en su awareness (`proto`). El servidor
 * no deja sincronizar a los clientes de la app que no la publican (los anteriores al formato de registros 2, que no
 * sabrían leer el documento y lo estropearían al escribir): los cierra con `WS_UPGRADE_REQUIRED` («recarga»).
 */
export const SYNC_PROTOCOL = 2;
/** Cierre del WebSocket «hay una versión nueva: recarga» (rango 44xx: y-websocket no reintenta). */
export const WS_UPGRADE_REQUIRED = 4426;

export type RemoteStatus = 'connecting' | 'connected' | 'disconnected';

export interface RemoteOptions {
  /** p. ej. `wss://sync.bezenti.com` */
  url: string;
  room: string;
  /** Se envía como parámetro `token` de la URL del WebSocket. */
  token?: string;
  /** Polyfill de WebSocket (node). */
  WebSocketPolyfill?: typeof WebSocket;
  /** `false` crea el proveedor (y su awareness) sin conectar; se conecta luego con `connect()` (p. ej. al volver la red). */
  connect?: boolean;
}

export interface RemoteConnection {
  provider: WebsocketProvider;
  awareness: Awareness;
  status(): RemoteStatus;
  /** Conecta (o reanuda tras un cierre definitivo del servidor). */
  connect(): void;
  disconnect(): void;
}

export function connectRemote(doc: Y.Doc, { url, room, token, WebSocketPolyfill, connect = true }: RemoteOptions): RemoteConnection {
  const provider = new WebsocketProvider(url, room, doc, {
    params: token ? { token } : {},
    connect,
    ...(WebSocketPolyfill ? { WebSocketPolyfill } : {}),
  });
  // Antes de que se abra el socket: el primer mensaje de awareness ya lleva la versión del protocolo.
  provider.awareness.setLocalStateField('proto', SYNC_PROTOCOL);
  let status: RemoteStatus = connect ? 'connecting' : 'disconnected';
  provider.on('status', (ev: { status: RemoteStatus }) => { status = ev.status; });
  return {
    provider,
    awareness: provider.awareness,
    status: () => status,
    connect() { if (!provider.wsconnected && !provider.wsconnecting) provider.connect(); },
    disconnect() { provider.destroy(); status = 'disconnected'; },
  };
}

// ---------------------------------------------------------------- Presencia
export interface Presence {
  /** Versión del protocolo (`SYNC_PROTOCOL`); la pone `connectRemote`. */
  proto?: number;
  /** Último aviso para los demás (p. ej. «X ha restaurado una versión»); ver `publishNotice`. */
  notice?: Notice;
  name: string;
  color: string;
  viewId?: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

export function setPresence(awareness: Awareness, p: Partial<Presence>): void {
  awareness.setLocalState({ ...(awareness.getLocalState() ?? {}), ...p });
}

/** Llama a `cb` con la presencia de todos los clientes (incluido el propio) en cada cambio. */
export function onPresence(awareness: Awareness, cb: (states: Map<number, Presence>) => void): () => void {
  const handler = () => cb(awareness.getStates() as Map<number, Presence>);
  awareness.on('change', handler);
  handler();
  return () => { awareness.off('change', handler); };
}

// ---------------------------------------------------------------- Avisos a los demás conectados
/** Aviso efímero que un cliente publica para los demás (no se guarda en el documento). */
export interface Notice {
  /** Único por aviso (los demás lo muestran una vez). */
  id: string;
  kind: 'restore';
  /** Fecha (ISO) de la versión restaurada. */
  at: string;
  /** Quién (nombre visible), por si su presencia aún no tiene nombre. */
  by?: string;
}

/** Publica un aviso para los demás conectados (por awareness: lo ven los que estén conectados ahora). */
export function publishNotice(awareness: Pick<Awareness, 'clientID' | 'setLocalStateField'>, notice: Omit<Notice, 'id'> & { id?: string }): Notice {
  const n: Notice = { ...notice, id: notice.id ?? `${awareness.clientID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` };
  awareness.setLocalStateField('notice', n);
  return n;
}

/**
 * Llama a `cb` con cada aviso nuevo de **otro** cliente. Los avisos que ya estaban publicados al suscribirse o al
 * aparecer un cliente (alguien que entra después) no se repiten: solo los que cambian estando conectados.
 */
export function onNotices(awareness: Awareness, cb: (notice: Notice, from: Presence, clientId: number) => void): () => void {
  const seen = new Map<number, string | undefined>();
  const noticeOf = (id: number) => (awareness.getStates().get(id) as Presence | undefined)?.notice;
  for (const id of awareness.getStates().keys()) seen.set(id, noticeOf(id)?.id);
  const handler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    for (const id of removed) seen.delete(id);
    for (const id of added) seen.set(id, noticeOf(id)?.id);
    for (const id of updated) {
      const n = noticeOf(id);
      const before = seen.get(id);
      seen.set(id, n?.id);
      if (!n || n.id === before || id === awareness.clientID) continue;
      cb(n, awareness.getStates().get(id) as Presence, id);
    }
  };
  awareness.on('change', handler);
  return () => { awareness.off('change', handler); };
}
