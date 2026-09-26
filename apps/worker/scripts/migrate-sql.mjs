/**
 * Generador puro del SQL de migración SQLite → D1 (mismo esquema, ver `migrations/0001_init.sql`).
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

/**
 * @param db objeto con `prepare(sql).all()` (node:sqlite `DatabaseSync`)
 * @returns {{ sql: string, stats: Record<string, number>, needsReset: {id:string,email:string}[], workspaces: {id:string,name:string,ownerId:string}[] }}
 */
export function generateMigrationSql(db) {
  const all = (sql) => db.prepare(sql).all();
  const users = all('SELECT * FROM users ORDER BY created_at, id');
  const workspaces = all('SELECT * FROM workspaces ORDER BY created_at, id');
  const members = all('SELECT * FROM workspace_members ORDER BY workspace_id, user_id');
  const links = all('SELECT * FROM share_links ORDER BY created_at, token');
  const keys = all('SELECT * FROM api_keys ORDER BY created_at, id');

  const needsReset = [];
  const lines = [
    `-- all-draw: migración SQLite → D1 generada el ${new Date().toISOString()}`,
    `-- ${users.length} usuarios, ${workspaces.length} espacios, ${members.length} miembros, ${links.length} enlaces, ${keys.length} API keys.`,
    '-- INSERT OR IGNORE: se puede aplicar más de una vez sin duplicar. Los docs Yjs no van aquí (ver migrate-from-sqlite.mjs --url).',
    '',
  ];
  for (const u of users) {
    const row = { ...u };
    if (isScrypt(u.password_hash)) { row.password_hash = RESET_PREFIX + u.password_hash; needsReset.push({ id: u.id, email: u.email }); }
    lines.push(insert('users', ['id', 'email', 'name', 'password_hash', 'is_admin', 'created_at'], row));
  }
  for (const w of workspaces) lines.push(insert('workspaces', ['id', 'owner_id', 'name', 'created_at', 'updated_at'], w));
  for (const m of members) lines.push(insert('workspace_members', ['workspace_id', 'user_id', 'role', 'created_at'], m));
  for (const l of links) lines.push(insert('share_links', ['token', 'workspace_id', 'role', 'created_by', 'created_at', 'expires_at'], l));
  for (const k of keys) lines.push(insert('api_keys', ['id', 'user_id', 'name', 'prefix', 'key_hash', 'created_at', 'last_used_at'], k));

  return {
    sql: lines.join('\n') + '\n',
    stats: { users: users.length, workspaces: workspaces.length, members: members.length, links: links.length, apiKeys: keys.length, needsReset: needsReset.length },
    needsReset,
    workspaces: workspaces.map(w => ({ id: w.id, name: w.name, ownerId: w.owner_id })),
  };
}
