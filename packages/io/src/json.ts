/**
 * Formato nativo: el `Workspace` tal cual, en JSON **estable** (claves ordenadas, 2 espacios) para
 * que los diffs en git sean legibles y dos exportaciones del mismo estado sean byte a byte iguales.
 */
import { migrate, type Workspace } from '@all-draw/core';

/** Copia con las claves de todos los objetos ordenadas (los arrays conservan su orden). */
export function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) if (src[k] !== undefined) out[k] = stableSort(src[k]);
    return out;
  }
  return value;
}

export function exportWorkspace(ws: Workspace): string {
  return JSON.stringify(stableSort(ws), null, 2) + '\n';
}

/** Lee un JSON de workspace de cualquier versión anterior y lo migra al esquema actual. */
export function importWorkspace(text: string | unknown): Workspace {
  const raw = typeof text === 'string' ? JSON.parse(text) : text;
  return migrate(raw);
}
