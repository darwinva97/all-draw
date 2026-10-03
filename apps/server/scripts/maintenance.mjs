#!/usr/bin/env node
/**
 * Mantenimiento semanal de la SQLite de producción (con el servidor en marcha): `quick_check`, compactación
 * de `doc_updates`, purga de sesiones caducadas, `ANALYZE`, `PRAGMA optimize`, `VACUUM` y checkpoint del WAL.
 * La lógica está en `src/maintenance.ts` (probada en `test/maintenance.test.ts`).
 *
 *   node scripts/maintenance.mjs [--no-vacuum]        (DB_PATH / DATA_DIR como el servidor)
 *
 * Cron (domingos 03:37, tras la copia diaria de las 03:17): ver README, sección Operaciones.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { register } from 'tsx/esm/api';

register();
const { runMaintenance } = await import('../src/maintenance.ts');

const env = process.env;
const dataDir = env.DATA_DIR ?? path.join(os.homedir(), '.alldraw-data');
const dbPath = env.DB_PATH ?? path.join(dataDir, 'alldraw.sqlite');
const log = (...a) => console.log(`[maintenance ${new Date().toISOString()}]`, ...a);

if (!fs.existsSync(dbPath)) { console.error(`no existe la BD ${dbPath}`); process.exit(2); }
const db = new DatabaseSync(dbPath);
try {
  const r = runMaintenance(db, dbPath, { vacuum: !process.argv.includes('--no-vacuum') });
  log(`ok ${dbPath}: check ${r.check}; doc_updates compactados ${r.compacted.updates} en ${r.compacted.workspaces} espacios; sesiones caducadas ${r.expiredSessions}; ${r.vacuum ? 'VACUUM' : 'sin VACUUM'}; ${(r.bytesBefore / 1024).toFixed(1)} → ${(r.bytesAfter / 1024).toFixed(1)} KiB en ${r.ms} ms`);
} catch (e) {
  log(`ERROR ${e?.message ?? e}`);
  process.exitCode = 1;
} finally { db.close(); }
