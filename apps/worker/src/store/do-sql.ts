/**
 * `WorkspaceStore` sobre el SQLite propio de un Durable Object (`RegistryDO`, ver `../registry.ts`), para
 * no depender de D1. Dos piezas:
 *
 *   - `sqlStorageDriver(storage)`: el `SqlDriver` de `sql.ts` sobre `ctx.storage.sql` (síncrono). Lo usa el
 *     DO por dentro, así que **todo el SQL es el mismo que con D1** (`SqlWorkspaceStore`).
 *   - `RegistryWorkspaceStore`: lo que usa el worker. Cada método del store es **una** llamada RPC
 *     `invoke(método, args)` al DO, que la ejecuta en su `SqlWorkspaceStore`. Como el SQL del DO es
 *     síncrono, cada operación (p. ej. leer y borrar una sesión caducada) es atómica.
 *
 * Los argumentos y resultados viajan por RPC con structured clone (`Uint8Array`, `null`, objetos planos);
 * los errores vuelven como valor `{ error }` y aquí se relanzan con su mensaje (p. ej. `email ya registrado`).
 */
import type { WorkspaceStore } from '@all-draw/server-core';
import type { ImportResult, ImportRows } from './import';
import type { SqlDriver, SqlStatement } from './sql';

export function sqlStorageDriver(storage: DurableObjectStorage): SqlDriver {
  const sql = storage.sql;
  const exec = (query: string, params: unknown[]) => sql.exec(query, ...(params as SqlStorageValue[]));
  // `cursor.rowsWritten` incluye las escrituras de índices: `changes()` da las filas afectadas, como D1.
  const run = (query: string, params: unknown[]) => { exec(query, params).toArray(); return Number(sql.exec<{ n: number }>('SELECT changes() AS n').one().n); };
  return {
    async one<T>(query: string, params: unknown[]) { return (exec(query, params).toArray()[0] as T | undefined) ?? null; },
    async all<T>(query: string, params: unknown[]) { return exec(query, params).toArray() as T[]; },
    async run(query, params) { return run(query, params); },
    async batch(statements: SqlStatement[]) { return storage.transactionSync(() => statements.map(s => run(s.sql, s.params))); },
  };
}

/** Métodos que el `RegistryDO` acepta por `invoke` (todo `WorkspaceStore` salvo `close`, más la importación). */
export const REGISTRY_METHODS = [
  'createUser', 'getUser', 'getUserByEmail', 'countUsers', 'listUsers', 'setPasswordHash',
  'createSession', 'getSession', 'touchSession', 'deleteSession', 'deleteUserSessions', 'purgeExpiredSessions',
  'createApiKey', 'listApiKeys', 'resolveApiKey', 'deleteApiKey', 'touchApiKey',
  'listWorkspaces', 'listAllWorkspaces', 'getWorkspace', 'createWorkspace', 'updateMeta', 'deleteWorkspace',
  'loadDoc', 'saveDoc', 'appendUpdate',
  'getRole', 'setRole', 'listMembers',
  'createShareLink', 'listShareLinks', 'resolveShareLink', 'deleteShareLink',
  'createSnapshot', 'listSnapshots', 'getSnapshot', 'deleteSnapshot', 'pruneSnapshots',
  'importRows',
] as const;
export type RegistryMethod = (typeof REGISTRY_METHODS)[number];
// Falla al compilar si `WorkspaceStore` gana un método que no está en la lista.
type Missing = Exclude<keyof WorkspaceStore, RegistryMethod | 'close'>;
const _allMethods: [Missing] extends [never] ? true : Missing = true;
void _allMethods;

/** Respuesta de `RegistryDO.invoke`: el valor o el mensaje del error (que el cliente relanza). */
export type RegistryReply = { value: unknown } | { error: string };
/** Lo que el cliente necesita del stub (el tipo RPC completo de `DurableObjectStub<RegistryDO>` no aporta nada aquí). */
export interface RegistryStub { invoke(method: RegistryMethod, args: unknown[]): Promise<RegistryReply> }

export type RegistryWorkspaceStore = WorkspaceStore & { importRows(rows: ImportRows): Promise<ImportResult> };

/** Nombre de la única instancia del registro (`idFromName`). */
export const REGISTRY_NAME = 'registry';

/**
 * Store que delega en el `RegistryDO`. `stub` se pide en cada llamada (los stubs son baratos y así no se
 * comparten entre peticiones). Por defecto, la instancia `idFromName('registry')`.
 */
export function registryStore(ns: DurableObjectNamespace, stub: () => RegistryStub = () => ns.get(ns.idFromName(REGISTRY_NAME)) as unknown as RegistryStub): RegistryWorkspaceStore {
  const store: Record<string, unknown> = { close: async () => { /* nada que cerrar */ } };
  for (const m of REGISTRY_METHODS) {
    store[m] = async (...args: unknown[]) => {
      const r = await stub().invoke(m, args);
      if ('error' in r) throw new Error(r.error);
      return r.value;
    };
  }
  return store as unknown as RegistryWorkspaceStore;
}
