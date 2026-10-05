-- Migración v4: cuentas (correo verificado, idioma de los correos, preferencia «recibir por correo»), sesiones activas
-- (dispositivo resumido, IP truncada, último uso), tokens de un solo uso por correo (restablecer contraseña, verificar
-- correo; sólo el hash) y centro de notificaciones. Igual que la v4 de apps/server/src/store/sqlite.ts.
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN locale TEXT;
ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN device TEXT;
ALTER TABLE sessions ADD COLUMN ip TEXT;
ALTER TABLE sessions ADD COLUMN last_used_at TEXT;
CREATE TABLE account_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('reset','verify')),
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX account_tokens_user ON account_tokens(user_id, kind);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);
