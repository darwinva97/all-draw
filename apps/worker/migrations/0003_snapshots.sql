-- Migración v3: historial de versiones (mismo SQL que MIGRATIONS[2] de apps/server/src/store/sqlite.ts).
-- En el worker las instantáneas viven en el storage del Durable Object de cada espacio; esta tabla
-- mantiene el esquema alineado con SQLite/Postgres (copias de respaldo y migraciones).
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
