/**
 * Utilidades comunes de los scripts de operaciones: abrir la SQLite en solo lectura, fundir el doc Yjs
 * de un espacio (`docs.state` + `doc_updates`) y convertirlo al Workspace JSON validado.
 *
 * Los paquetes del monorepo se importan desde sus fuentes `.ts`, así que se registra el loader de
 * `tsx` (igual que `src/server.mjs`). Lo usan `backup.mjs` y `apps/worker/scripts/migrate-from-sqlite.mjs`.
 */
import { DatabaseSync } from 'node:sqlite';
import { register } from 'tsx/esm/api';

register();
const Y = await import('yjs');
const { YjsStore } = await import('@all-draw/sync');

/** Abre la BD en solo lectura (la de producción puede estar en uso: WAL lo permite). */
export function openReadOnly(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

/** Update Yjs completo del espacio (o `null` si no tiene documento). */
export function loadDocUpdate(db, workspaceId) {
  const base = db.prepare('SELECT state FROM docs WHERE workspace_id = ?').get(workspaceId);
  const extra = db.prepare('SELECT data FROM doc_updates WHERE workspace_id = ? ORDER BY id').all(workspaceId);
  const parts = [...(base ? [new Uint8Array(base.state)] : []), ...extra.map(e => new Uint8Array(e.data))];
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : Y.mergeUpdates(parts);
}

/** Workspace JSON (validado con el esquema de `@all-draw/core`) a partir de un update Yjs. */
export function updateToWorkspace(update) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, update, 'load');
  const store = new YjsStore(doc);
  try { return store.snapshot(); } finally { doc.destroy(); }
}

/** Filas de `workspaces` con dueño, miembros y enlaces (para el JSON de cada espacio). */
export function listWorkspaces(db) {
  const rows = db.prepare('SELECT w.*, u.email AS owner_email FROM workspaces w LEFT JOIN users u ON u.id = w.owner_id ORDER BY w.created_at').all();
  return rows.map(w => ({
    id: w.id, name: w.name, ownerId: w.owner_id, ownerEmail: w.owner_email ?? null, createdAt: w.created_at, updatedAt: w.updated_at,
    members: db.prepare('SELECT m.user_id, m.role, m.created_at, u.email FROM workspace_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at').all(w.id)
      .map(m => ({ userId: m.user_id, email: m.email ?? null, role: m.role, createdAt: m.created_at })),
    links: db.prepare('SELECT * FROM share_links WHERE workspace_id = ? ORDER BY created_at').all(w.id)
      .map(l => ({ token: l.token, role: l.role, createdBy: l.created_by, createdAt: l.created_at, expiresAt: l.expires_at ?? null })),
  }));
}
