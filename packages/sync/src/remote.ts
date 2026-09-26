/**
 * Colaboración en tiempo real: `WebsocketProvider` de y-websocket (reconexión con backoff incluida)
 * y presencia (cursores, selección) vía awareness.
 */
import type * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import type { Awareness } from 'y-protocols/awareness';

export type RemoteStatus = 'connecting' | 'connected' | 'disconnected';

export interface RemoteOptions {
  /** p. ej. `wss://sync.bezenti.com` */
  url: string;
  room: string;
  /** Se envía como parámetro `token` de la URL del WebSocket. */
  token?: string;
  /** Polyfill de WebSocket (node). */
  WebSocketPolyfill?: typeof WebSocket;
}

export interface RemoteConnection {
  provider: WebsocketProvider;
  awareness: Awareness;
  status(): RemoteStatus;
  disconnect(): void;
}

export function connectRemote(doc: Y.Doc, { url, room, token, WebSocketPolyfill }: RemoteOptions): RemoteConnection {
  const provider = new WebsocketProvider(url, room, doc, {
    params: token ? { token } : {},
    ...(WebSocketPolyfill ? { WebSocketPolyfill } : {}),
  });
  let status: RemoteStatus = 'connecting';
  provider.on('status', (ev: { status: RemoteStatus }) => { status = ev.status; });
  return {
    provider,
    awareness: provider.awareness,
    status: () => status,
    disconnect() { provider.destroy(); status = 'disconnected'; },
  };
}

// ---------------------------------------------------------------- Presencia
export interface Presence {
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
