/**
 * `WorkspaceStore` sobre Cloudflare D1 (opcional: sólo si el worker tiene el binding `DB`). El SQL está en
 * `sql.ts`; aquí sólo el `SqlDriver` de D1. Las migraciones las aplica `wrangler d1 migrations apply`
 * (`migrations/*.sql`), no el código.
 */
import { SqlWorkspaceStore, type SqlDriver } from './sql';

export function d1Driver(db: D1Database): SqlDriver {
  const q = (sql: string, params: unknown[]) => db.prepare(sql).bind(...params);
  return {
    async one<T>(sql: string, params: unknown[]) { return (await q(sql, params).first<T>()) ?? null; },
    async all<T>(sql: string, params: unknown[]) { return (await q(sql, params).all<T>()).results; },
    async run(sql, params) { return (await q(sql, params).run()).meta.changes ?? 0; },
    async batch(statements) {
      if (statements.length === 0) return [];
      return (await db.batch(statements.map(s => q(s.sql, s.params)))).map(r => r.meta.changes ?? 0);
    },
  };
}

export class D1WorkspaceStore extends SqlWorkspaceStore {
  constructor(readonly db: D1Database) { super(d1Driver(db)); }
}
