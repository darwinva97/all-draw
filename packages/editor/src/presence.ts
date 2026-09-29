/**
 * Presencia colaborativa sin depender de `@all-draw/sync`: el editor solo necesita algo con la
 * forma de un `Awareness` de Yjs. La app le pasa el real; los tests pueden pasar uno en memoria.
 */
import { useSyncExternalStore, useCallback, useRef } from 'react';
import { t } from '@all-draw/i18n';

export interface AwarenessLike {
  getStates(): Map<number, unknown>;
  setLocalStateField(key: string, value: unknown): void;
  on(ev: 'change', cb: () => void): void;
  off(ev: 'change', cb: () => void): void;
  clientID: number;
}

/** Quién soy. `userId` (opcional) identifica al autor de comentarios aunque cambie de nombre. */
export interface PresenceMe { name: string; color: string; userId?: string }

/** Estado que publica cada cliente (mismo contrato que `Presence` de `@all-draw/sync`). */
export interface PresenceState {
  name?: string;
  color?: string;
  viewId?: string | null;
  cursor?: { x: number; y: number } | null;
  selection?: string[];
}

export interface Peer extends PresenceState { clientId: number; name: string; color: string }

/** Lee los estados de los demás (sin el propio), ya normalizados. */
export function peersOf(aw: AwarenessLike): Peer[] {
  const out: Peer[] = [];
  for (const [clientId, raw] of aw.getStates()) {
    if (clientId === aw.clientID || !raw || typeof raw !== 'object') continue;
    const s = raw as PresenceState;
    out.push({ clientId, ...s, name: s.name || t('Invitado {n}', { n: clientId % 1000 }), color: s.color || colorFor(clientId) });
  }
  return out.sort((a, b) => a.clientId - b.clientId);
}

const PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
export function colorFor(n: number): string { return PALETTE[Math.abs(n) % PALETTE.length]!; }

/** Iniciales para un avatar: "Ana López" → "AL". */
export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Nodos seleccionados por otros en una vista: nodo → color del primero que lo tiene. */
export function remoteSelection(peers: Peer[], viewId: string | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of peers) if (p.viewId === viewId) for (const id of p.selection ?? []) if (!m.has(id)) m.set(id, p.color);
  return m;
}

/** Firma estable de lo que afecta al lienzo sin contar cursores (para no rehacer nodos a cada movimiento). */
export function selectionSignature(peers: Peer[]): string {
  return peers.map(p => `${p.clientId}:${p.viewId ?? ''}:${p.color}:${(p.selection ?? []).join(',')}`).join('|');
}

/** Llama a `fn` como mucho una vez cada `ms`; la última llamada pendiente se emite al final. */
export function throttle<A extends unknown[]>(fn: (...a: A) => void, ms: number): ((...a: A) => void) & { cancel(): void } {
  let last = 0; let timer: ReturnType<typeof setTimeout> | null = null; let pending: A | null = null;
  const flush = () => { timer = null; if (pending) { last = Date.now(); const a = pending; pending = null; fn(...a); } };
  const out = ((...a: A) => {
    const now = Date.now();
    if (now - last >= ms && !timer) { last = now; fn(...a); return; }
    pending = a;
    if (!timer) timer = setTimeout(flush, ms - (now - last));
  }) as ((...a: A) => void) & { cancel(): void };
  out.cancel = () => { if (timer) clearTimeout(timer); timer = null; pending = null; };
  return out;
}

const NO_PEERS: Peer[] = [];

/** Los demás participantes; se re-renderiza con cada cambio de awareness. Devuelve [] (estable) sin presencia. */
export function usePeers(aw: AwarenessLike | null | undefined): Peer[] {
  const cache = useRef<{ v: number; peers: Peer[] }>({ v: -1, peers: NO_PEERS });
  const version = useRef(0);
  const subscribe = useCallback((cb: () => void) => {
    if (!aw) return () => {};
    const h = () => { version.current++; cb(); };
    aw.on('change', h);
    return () => aw.off('change', h);
  }, [aw]);
  const v = useSyncExternalStore(subscribe, () => version.current, () => 0);
  if (!aw) return NO_PEERS;
  if (cache.current.v !== v) cache.current = { v, peers: peersOf(aw) };
  return cache.current.peers;
}
