/**
 * `RegistryDO`: registro de cuentas, sesiones, API keys, espacios, permisos y enlaces en el SQLite propio
 * de un Durable Object (`new_sqlite_classes`, disponible en el plan gratuito). Sustituye a D1 cuando el
 * worker no tiene el binding `DB`. Hay **una sola instancia** (`idFromName('registry')`).
 *
 * Diseño: el DO contiene un `SqlWorkspaceStore` (el mismo SQL que con D1, vía `sqlStorageDriver`) y expone
 * un único método RPC genérico, `invoke(método, args)` → `{ value } | { error }`, restringido a los métodos de `WorkspaceStore`
 * (`REGISTRY_METHODS`) más `importRows`. Frente a un RPC de SQL crudo (`query`/`run`/`batch`):
 *   - una operación del store = un viaje de ida y vuelta (no 2-3), y es atómica (SQL síncrono en el DO);
 *   - el DO no ejecuta SQL arbitrario que le llegue;
 *   - no hay que añadir un método RPC por cada método del store.
 *
 * Migraciones: `src/migrations.ts` (= `migrations/*.sql`) se aplican en el constructor, cada una en su
 * transacción, con la versión en `schema_migrations` (igual que `apps/server/src/store/sqlite.ts`).
 */
import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';
import { MIGRATIONS } from './migrations';
import { REGISTRY_METHODS, sqlStorageDriver, type RegistryMethod, type RegistryReply } from './store/do-sql';
import { SqlWorkspaceStore } from './store/sql';

/** Aplica las migraciones pendientes; devuelve la versión final. */
export function migrateRegistry(storage: DurableObjectStorage): number {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const cur = Number(sql.exec<{ v: number }>('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').one().v);
  for (let v = cur; v < MIGRATIONS.length; v++) {
    storage.transactionSync(() => {
      sql.exec(MIGRATIONS[v]!);
      sql.exec('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', v + 1, new Date().toISOString());
    });
  }
  return MIGRATIONS.length;
}

const ALLOWED = new Set<string>(REGISTRY_METHODS);

export class RegistryDO extends DurableObject<Env> {
  private readonly store: SqlWorkspaceStore;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    migrateRegistry(ctx.storage);
    this.store = new SqlWorkspaceStore(sqlStorageDriver(ctx.storage));
  }

  /**
   * RPC: ejecuta un método del `WorkspaceStore` (o `importRows`) con sus argumentos. Los errores vuelven
   * como valor (`{ error }`) y el cliente los relanza: así sólo viaja el mensaje, sin pila remota.
   */
  async invoke(method: RegistryMethod, args: unknown[]): Promise<RegistryReply> {
    try {
      if (!ALLOWED.has(method)) throw new Error(`método de registro desconocido: ${String(method)}`);
      const fn = this.store[method] as (...a: unknown[]) => Promise<unknown>;
      return { value: await fn.apply(this.store, Array.isArray(args) ? args : []) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }
}
