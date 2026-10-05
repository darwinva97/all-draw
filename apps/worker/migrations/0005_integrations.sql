-- Migración v5: integraciones. Enlaces de inserción con alcance a una vista (`share_links.view_id`, tokens `emb_…`) y
-- webhooks por espacio (eventos, formato, secreto de la firma y últimas entregas en JSON). Igual que la v5 de
-- apps/server/src/store/sqlite.ts.
ALTER TABLE share_links ADD COLUMN view_id TEXT;
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  format TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'es',
  secret TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deliveries TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX webhooks_ws ON webhooks(workspace_id, created_at);
