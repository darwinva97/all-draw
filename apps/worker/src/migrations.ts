/**
 * Migraciones del esquema del registro, las mismas que `migrations/*.sql` (D1) y `MIGRATIONS` de
 * `apps/server/src/store/sqlite.ts`. Las aplica `RegistryDO` al arrancar (tabla `schema_migrations`).
 * Duplicadas aquí porque ni wrangler ni vite importan `.sql` como texto de la misma forma; el test
 * `test/registry.test.ts` comprueba que coinciden con los ficheros `.sql`. Sólo se añaden al final.
 */
export const MIGRATIONS: string[] = [
  // migrations/0001_init.sql
  `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX workspaces_owner ON workspaces(owner_id);
CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX members_user ON workspace_members(user_id);
CREATE TABLE share_links (
  token TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE INDEX share_links_ws ON share_links(workspace_id);
CREATE TABLE docs (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  state BLOB NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE doc_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX doc_updates_ws ON doc_updates(workspace_id);
`,
  // migrations/0002_sessions_expiry.sql
  `
CREATE INDEX sessions_expires ON sessions(expires_at);
`,
  // migrations/0003_snapshots.sql
  `
CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  author_id TEXT,
  label TEXT,
  data BLOB NOT NULL,
  size INTEGER NOT NULL
);
CREATE INDEX snapshots_ws ON snapshots(workspace_id, created_at);
`,
];
