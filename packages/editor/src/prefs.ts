/**
 * Preferencias de este navegador (no del espacio): tipos usados hace poco, favoritos de la paleta, categorías plegadas
 * por notación y elecciones recientes de la paleta de comandos. Viven en `localStorage` y avisan a quien escucha
 * (`useSyncExternalStore`), también cuando cambian en otra pestaña (`storage`).
 */
import { useSyncExternalStore } from 'react';

export const RECENT_TYPES_KEY = 'alldraw:palette:recent';
export const FAVORITE_TYPES_KEY = 'alldraw:palette:favorites';
export const COLLAPSED_KEY = 'alldraw:palette:collapsed';
export const CMDK_RECENT_KEY = 'alldraw:cmdk:recent';
/** Tipos que recuerda la sección «Recientes» de la paleta. */
export const RECENT_TYPES_MAX = 8;
/** Elecciones que recuerda la paleta de comandos. */
export const CMDK_RECENT_MAX = 6;

const listeners = new Map<string, Set<() => void>>();
/** Último valor leído por clave (misma identidad mientras no cambie: lo exige `useSyncExternalStore`). */
const cache = new Map<string, { raw: string | null; value: unknown }>();

function readRaw(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function read<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value as T;
  let value: T = fallback;
  if (raw) { try { const v: unknown = JSON.parse(raw); if (valid(v)) value = v; } catch { /* JSON inválido: valor por defecto */ } }
  cache.set(key, { raw, value });
  return value;
}

function write(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try { globalThis.localStorage?.setItem(key, raw); } catch { /* sin almacenamiento: solo en memoria */ }
  cache.set(key, { raw: readRaw(key) ?? raw, value });
  for (const l of listeners.get(key) ?? []) l();
}

function subscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === key) cb(); };
  globalThis.addEventListener?.('storage', onStorage);
  return () => { set!.delete(cb); globalThis.removeEventListener?.('storage', onStorage); };
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const isOpenMap = (v: unknown): v is Record<string, Record<string, boolean>> => !!v && typeof v === 'object' && !Array.isArray(v);
const EMPTY: string[] = [];
const EMPTY_MAP: Record<string, Record<string, boolean>> = {};

/** Pone `id` el primero de la lista (sin duplicados) y la corta a `max`. */
export function pushRecent(list: readonly string[], id: string, max: number): string[] {
  return [id, ...list.filter(x => x !== id)].slice(0, max);
}

// ---------------------------------------------------------------- tipos recientes y favoritos
export const recentTypes = (): string[] => read(RECENT_TYPES_KEY, EMPTY, isStrings);
/** Anota que se acaba de crear un elemento de `typeId` (paleta, Ctrl+K, «Crear y conectar»). */
export function noteTypeUsed(typeId: string): void {
  if (!typeId) return;
  const cur = recentTypes();
  if (cur[0] === typeId) return;
  write(RECENT_TYPES_KEY, pushRecent(cur, typeId, RECENT_TYPES_MAX));
}
export function useRecentTypes(): string[] {
  return useSyncExternalStore(cb => subscribe(RECENT_TYPES_KEY, cb), recentTypes, recentTypes);
}

export const favoriteTypes = (): string[] => read(FAVORITE_TYPES_KEY, EMPTY, isStrings);
export function toggleFavoriteType(typeId: string): void {
  const cur = favoriteTypes();
  write(FAVORITE_TYPES_KEY, cur.includes(typeId) ? cur.filter(x => x !== typeId) : [...cur, typeId]);
}
export function useFavoriteTypes(): string[] {
  return useSyncExternalStore(cb => subscribe(FAVORITE_TYPES_KEY, cb), favoriteTypes, favoriteTypes);
}

// ---------------------------------------------------------------- categorías plegadas (por notación)
/** `{ [notationId]: { [categoryKey]: abierta } }`: solo lo que el usuario cambió; el resto, por defecto. */
export const categoryState = (): Record<string, Record<string, boolean>> => read(COLLAPSED_KEY, EMPTY_MAP, isOpenMap);
export function setCategoryOpen(notationId: string, key: string, open: boolean): void {
  const all = categoryState();
  write(COLLAPSED_KEY, { ...all, [notationId]: { ...all[notationId], [key]: open } });
}
/** ¿Está abierta la categoría `key` de la paleta de `notationId`? `fallback` si nunca se tocó. */
export function isCategoryOpen(state: Record<string, Record<string, boolean>>, notationId: string, key: string, fallback: boolean): boolean {
  const v = state[notationId]?.[key];
  return typeof v === 'boolean' ? v : fallback;
}
export function useCategoryState(): Record<string, Record<string, boolean>> {
  return useSyncExternalStore(cb => subscribe(COLLAPSED_KEY, cb), categoryState, categoryState);
}

// ---------------------------------------------------------------- paleta de comandos
/** Claves `kind:id` de lo último elegido en Ctrl+K (acciones, vistas, elementos). */
export const cmdkRecent = (): string[] => read(CMDK_RECENT_KEY, EMPTY, isStrings);
export function noteCmdkChoice(key: string): void { write(CMDK_RECENT_KEY, pushRecent(cmdkRecent(), key, CMDK_RECENT_MAX)); }

// ---------------------------------------------------------------- lienzo: rueda del ratón
export const WHEEL_KEY = 'alldraw:canvas:wheel';
/** `pan`: la rueda desplaza y Ctrl/⌘+rueda hace zoom (como Figma, draw.io o Archi). `zoom`: la rueda hace zoom. */
export type WheelMode = 'pan' | 'zoom';
const isWheelMode = (v: unknown): v is WheelMode => v === 'pan' || v === 'zoom';
export const wheelMode = (): WheelMode => read(WHEEL_KEY, 'pan', isWheelMode);
export function setWheelMode(mode: WheelMode): void { write(WHEEL_KEY, mode); }
export function useWheelMode(): WheelMode {
  return useSyncExternalStore(cb => subscribe(WHEEL_KEY, cb), wheelMode, wheelMode);
}
