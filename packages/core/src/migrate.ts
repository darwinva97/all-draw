import { SCHEMA_VERSION, parseWorkspace, type Workspace } from './model';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Migraciones por versión de esquema: `migrations[n]` lleva de n a n+1. */
const migrations: Record<number, Migration> = {
  // 0 → 1: primer esquema; nada que hacer salvo asegurar meta.
  0: raw => ({ ...raw, meta: { ...(raw.meta as object ?? {}), schemaVersion: 1 } }),
  // 1 → 2: colección `comments` (hilos de comentarios anclados a elementos, nodos, vistas o puntos).
  1: raw => ({ ...raw, comments: raw.comments && typeof raw.comments === 'object' ? raw.comments : {}, meta: { ...(raw.meta as object ?? {}), schemaVersion: 2 } }),
};

export function migrate(input: unknown): Workspace {
  let raw = (input && typeof input === 'object' ? { ...(input as Record<string, unknown>) } : {}) as Record<string, unknown>;
  let v = Number((raw.meta as { schemaVersion?: number } | undefined)?.schemaVersion ?? 0);
  while (v < SCHEMA_VERSION) {
    const m = migrations[v];
    if (!m) throw new Error(`No hay migración desde la versión ${v}`);
    raw = m(raw); v++;
  }
  if (v > SCHEMA_VERSION) throw new Error(`El fichero es de una versión más nueva (${v}) que la aplicación (${SCHEMA_VERSION})`);
  return parseWorkspace(raw);
}
