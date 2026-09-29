/**
 * Generador puro del SQL de migración SQLite → D1 (mismo esquema, ver `migrations/0001_init.sql`) y de las
 * filas para `POST /api/admin/import` del worker (`collectMigrationRows`, registro en el `RegistryDO`).
 * Sin dependencias: recibe una `DatabaseSync` (o cualquier objeto con `prepare(sql).all()`) y devuelve
 * el texto SQL más estadísticas. Lo usa `migrate-from-sqlite.mjs` y lo prueba `apps/server/test/migrate-sql.test.ts`.
 *
 * Qué migra: `users`, `workspaces`, `workspace_members`, `share_links`, `api_keys`. No migra `sessions`
 * (caducan, y el worker tendrá otro `SESSION_SECRET`) ni `docs`/`doc_updates` (el doc va al Durable Object
 * por `PUT /api/workspaces/:id/snapshot`).
 *
 * Contraseñas: los hashes `pbkdf2$…` valen tal cual (WebCrypto en el worker). Los `scrypt$…` no se pueden
 * verificar en Workers: se guardan como `reset$scrypt$…` (el login falla siempre, el hash original queda
 * detrás del prefijo por si se vuelve a Node) y se devuelven en `needsReset`. Los usuarios sin hash
 * (`legacy@alldraw.local`) se conservan igual: nunca han podido iniciar sesión.
 */

/** Literal SQL para D1/SQLite. */
export function sqlLiteral(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (v instanceof Uint8Array) return `X'${Buffer.from(v).toString('hex')}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

export const RESET_PREFIX = 'reset$';
export const isScrypt = (hash) => typeof hash === 'string' && hash.startsWith('scrypt$');

const insert = (table, cols, row) => `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => sqlLiteral(row[c])).join(', ')});`;

/** Columnas que se migran de cada tabla (mismas que `src/store/import.ts` del worker). */
export const MIGRATION_COLUMNS = {
  users: ['id', 'email', 'name', 'password_hash', 'is_admin', 'created_at'],
  workspaces: ['id', 'owner_id', 'name', 'created_at', 'updated_at'],
  members: ['workspace_id', 'user_id', 'role', 'created_at'],
  links: ['token', 'workspace_id', 'role', 'created_by', 'created_at', 'expires_at'],
  apiKeys: ['id', 'user_id', 'name', 'prefix', 'key_hash', 'created_at', 'last_used_at'],
};
const TABLE = { users: 'users', workspaces: 'workspaces', members: 'workspace_members', links: 'share_links', apiKeys: 'api_keys' };
const pick = (row, cols) => Object.fromEntries(cols.map(c => [c, typeof row[c] === 'bigint' ? Number(row[c]) : row[c] ?? null]));

/**
 * Filas a migrar, ya transformadas (`scrypt$` → `reset$scrypt$`), con los nombres de columna de SQLite.
 * Es el cuerpo de `POST /api/admin/import` del worker (`--target do`) y la base del SQL de `generateMigrationSql`.
 * @param db objeto con `prepare(sql).all()` (node:sqlite `DatabaseSync`)
 */
export function collectMigrationRows(db) {
  const all = (sql) => db.prepare(sql).all();
  const src = {
    users: all('SELECT * FROM users ORDER BY created_at, id'),
    workspaces: all('SELECT * FROM workspaces ORDER BY created_at, id'),
    members: all('SELECT * FROM workspace_members ORDER BY workspace_id, user_id'),
    links: all('SELECT * FROM share_links ORDER BY created_at, token'),
    apiKeys: all('SELECT * FROM api_keys ORDER BY created_at, id'),
  };
  const needsReset = [];
  const rows = {};
  for (const [group, cols] of Object.entries(MIGRATION_COLUMNS)) {
    rows[group] = src[group].map(r => {
      const row = pick(r, cols);
      if (group === 'users' && isScrypt(row.password_hash)) { row.password_hash = RESET_PREFIX + row.password_hash; needsReset.push({ id: row.id, email: row.email }); }
      return row;
    });
  }
  return {
    rows,
    stats: { users: src.users.length, workspaces: src.workspaces.length, members: src.members.length, links: src.links.length, apiKeys: src.apiKeys.length, needsReset: needsReset.length },
    needsReset,
    workspaces: src.workspaces.map(w => ({ id: w.id, name: w.name, ownerId: w.owner_id })),
  };
}

/**
 * @param db objeto con `prepare(sql).all()` (node:sqlite `DatabaseSync`)
 * @returns {{ sql: string, stats: Record<string, number>, needsReset: {id:string,email:string}[], workspaces: {id:string,name:string,ownerId:string}[] }}
 */
export function generateMigrationSql(db) {
  const { rows, stats, needsReset, workspaces } = collectMigrationRows(db);
  const lines = [
    `-- all-draw: migración SQLite → D1 generada el ${new Date().toISOString()}`,
    `-- ${stats.users} usuarios, ${stats.workspaces} espacios, ${stats.members} miembros, ${stats.links} enlaces, ${stats.apiKeys} API keys.`,
    '-- INSERT OR IGNORE: se puede aplicar más de una vez sin duplicar. Los docs Yjs no van aquí (ver migrate-from-sqlite.mjs --url).',
    '',
  ];
  for (const [group, cols] of Object.entries(MIGRATION_COLUMNS)) for (const row of rows[group]) lines.push(insert(TABLE[group], cols, row));
  return { sql: lines.join('\n') + '\n', stats, needsReset, workspaces };
}
