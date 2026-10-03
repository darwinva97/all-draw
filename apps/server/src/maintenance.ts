/**
 * Mantenimiento semanal de la SQLite (lo ejecuta `scripts/maintenance.mjs` desde cron, con el servidor en
 * marcha): comprobación rápida, compactación de `doc_updates`, purga de sesiones caducadas, `ANALYZE`,
 * `PRAGMA optimize`, `VACUUM` y checkpoint del WAL.
 *
 * Compactar `doc_updates`: `loadDoc` funde `docs.state` con la cola de updates incrementales; aquí se hace
 * lo mismo por adelantado y se guarda el resultado como estado, borrando la cola. Cada espacio va en su
 * propia transacción `IMMEDIATE` (el servidor espera con `busy_timeout` si quiere escribir a la vez) y sólo se
 * borran los updates leídos (`id <= max`), así que un update que llegue durante la compactación no se pierde.
 */
import fs from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import * as Y from 'yjs';

export interface CompactResult { workspaces: number; updates: number }

export function compactDocUpdates(db: DatabaseSync): CompactResult {
  const ids = (db.prepare('SELECT DISTINCT workspace_id AS id FROM doc_updates').all() as { id: string }[]).map(r => r.id);
  let updates = 0;
  for (const id of ids) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const base = db.prepare('SELECT state FROM docs WHERE workspace_id = ?').get(id) as { state: Uint8Array } | undefined;
      const rows = db.prepare('SELECT id, data FROM doc_updates WHERE workspace_id = ? ORDER BY id').all(id) as { id: number; data: Uint8Array }[];
      if (rows.length > 0) {
        const merged = Y.mergeUpdates([...(base ? [new Uint8Array(base.state)] : []), ...rows.map(r => new Uint8Array(r.data))]);
        const t = new Date().toISOString();
        db.prepare('INSERT INTO docs (workspace_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at').run(id, merged, t);
        updates += Number(db.prepare('DELETE FROM doc_updates WHERE workspace_id = ? AND id <= ?').run(id, rows[rows.length - 1]!.id).changes);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  return { workspaces: ids.length, updates };
}

export interface MaintenanceResult {
  check: string;
  compacted: CompactResult;
  expiredSessions: number;
  vacuum: boolean;
  bytesBefore: number;
  bytesAfter: number;
  ms: number;
}

const fileBytes = (p: string) => [p, `${p}-wal`].reduce((n, f) => { try { return n + fs.statSync(f).size; } catch { return n; } }, 0);

/** Ejecuta todo el mantenimiento sobre una BD abierta en lectura/escritura (`path` sólo para medir el tamaño). */
export function runMaintenance(db: DatabaseSync, path: string, opts: { vacuum?: boolean } = {}): MaintenanceResult {
  const t0 = Date.now();
  const bytesBefore = fileBytes(path);
  db.exec('PRAGMA busy_timeout = 10000');
  const check = String((db.prepare('PRAGMA quick_check').get() as { quick_check: string }).quick_check);
  if (check !== 'ok') throw new Error(`quick_check: ${check}`);
  const compacted = compactDocUpdates(db);
  const expiredSessions = Number(db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString()).changes);
  db.exec('ANALYZE');
  db.exec('PRAGMA optimize');
  const vacuum = opts.vacuum ?? true;
  if (vacuum) db.exec('VACUUM');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  return { check, compacted, expiredSessions, vacuum, bytesBefore, bytesAfter: fileBytes(path), ms: Date.now() - t0 };
}
