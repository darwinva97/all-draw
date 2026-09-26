-- Migración v2: índice para purgar sesiones caducadas (mismo SQL que MIGRATIONS[1] de apps/server/src/store/sqlite.ts).
CREATE INDEX sessions_expires ON sessions(expires_at);
