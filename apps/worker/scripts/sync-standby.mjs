#!/usr/bin/env node
/**
 * Sincronización nocturna VPS → worker de Cloudflare (copia de respaldo de solo lectura, `STANDBY="true"`).
 *
 * Usa la misma ruta que la migración `--target do` (`migrate-sql.mjs` para las filas, `doc-json.mjs` del servidor Node
 * para los documentos y `POST /api/admin/import` del worker) pero con `replace: true`: el registro del worker queda
 * **idéntico** al de la SQLite (borra cuentas, espacios, miembros, enlaces y API keys que ya no existan y sobrescribe
 * el resto) y los documentos que cambiaron se sobrescriben (los idénticos no se tocan). Las sesiones del worker de
 * cuentas que siguen existiendo se conservan.
 *
 * Autorización: `X-Import-Secret` = `IMPORT_SECRET` del worker, leído de `~/.config/alldraw/cf-import-secret`
 * (`--secret-file`, o la variable `ALLDRAW_IMPORT_SECRET`); nunca por argumentos (se verían en `ps`). Antes de escribir
 * comprueba que el worker publica `standby: true` en `/api/status`: contra un worker que no es copia de respaldo no hace nada.
 *
 *   node scripts/sync-standby.mjs [--url https://alldraw.darwin-sva-97.workers.dev] [--db ~/.alldraw-data/alldraw.sqlite]
 *                                 [--secret-file <fichero>] [--dry-run] [--no-notify]
 *
 * Si algo falla avisa por ntfy (`apps/server/scripts/lib/ntfy.mjs`) y sale con 1. Escribe el resumen en
 * `~/.alldraw-backups/sync-standby.last.json` (`BACKUP_DIR`). Cron (03:47, después de la copia de las 03:17):
 *   47 3 * * * cd /home/maka/projects/all-draw/apps/worker && /usr/bin/node scripts/sync-standby.mjs >> /home/maka/.alldraw-backups/sync-standby.log 2>&1
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectMigrationRows } from './migrate-sql.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const env = process.env;
const url = opt('--url', env.STANDBY_URL ?? 'https://alldraw.darwin-sva-97.workers.dev').replace(/\/$/, '');
const dbPath = opt('--db', env.DB_PATH ?? path.join(env.DATA_DIR ?? path.join(os.homedir(), '.alldraw-data'), 'alldraw.sqlite'));
const secretFile = opt('--secret-file', env.ALLDRAW_IMPORT_SECRET_FILE ?? path.join(os.homedir(), '.config', 'alldraw', 'cf-import-secret'));
const dryRun = args.includes('--dry-run');
const shouldNotify = !args.includes('--no-notify');
const stateFile = path.join(env.BACKUP_DIR ?? path.join(os.homedir(), '.alldraw-backups'), 'sync-standby.last.json');
/** Tamaño máximo de cada petición de documentos (el worker acepta 64 MiB; se deja margen). */
const BATCH_BYTES = Number(env.SYNC_BATCH_BYTES ?? 16 * 1024 * 1024);
const log = (...a) => console.log(`[sync-standby ${new Date().toISOString()}]`, ...a);

const here = path.dirname(fileURLToPath(import.meta.url));
const serverLib = path.join(here, '../../server/scripts/lib');
const { notify } = await import(path.join(serverLib, 'ntfy.mjs'));

async function fail(msg) {
  log(`ERROR: ${msg}`);
  try { fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), ok: false, url, error: msg }, null, 2)); } catch { /* sin carpeta de copias */ }
  if (shouldNotify && !dryRun) await notify({ title: 'all-draw: falló la sincronización con Cloudflare', message: `${msg}\nLa copia de respaldo (${url}) se queda con los datos de la noche anterior.` });
  process.exit(1);
}

const secret = env.ALLDRAW_IMPORT_SECRET?.trim() || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8').trim() : '');
if (!secret && !dryRun) await fail(`no hay secreto de importación (${secretFile} o ALLDRAW_IMPORT_SECRET)`);
if (!fs.existsSync(dbPath)) await fail(`no existe la BD ${dbPath}`);

// 1. El destino tiene que ser una copia de respaldo.
try {
  const res = await fetch(`${url}/api/status`, { signal: AbortSignal.timeout(20_000) });
  const st = await res.json().catch(() => ({}));
  if (st.standby !== true) await fail(`${url} no es una copia de respaldo (GET /api/status sin standby: true, HTTP ${res.status}); no se sincroniza`);
} catch (e) { await fail(`${url}/api/status: ${e?.cause?.code ?? e?.message ?? e}`); }

// 2. Filas y documentos de la SQLite (solo lectura; el servidor sigue en marcha).
const { listWorkspaces, loadDocUpdate, openReadOnly, updateToWorkspace } = await import(path.join(serverLib, 'doc-json.mjs'));
const db = openReadOnly(dbPath);
const { rows, stats } = collectMigrationRows(db);
const docs = [], invalid = [];
let empty = 0;
for (const w of listWorkspaces(db)) {
  const update = loadDocUpdate(db, w.id);
  if (!update) { empty++; continue; }
  try { docs.push({ id: w.id, workspace: updateToWorkspace(update) }); }
  catch (e) { invalid.push(`${w.id}: ${e?.message ?? e}`); }
}
db.close();
log(`origen ${dbPath}: ${stats.users} usuarios, ${stats.workspaces} espacios, ${stats.members} miembros, ${stats.links} enlaces, ${stats.apiKeys} API keys; ${docs.length} documentos (${empty} vacíos, ${invalid.length} no validan)`);

// 3. Lotes: el primero lleva las filas con replace; los demás, sólo documentos.
const batches = [];
let cur = [], size = 0;
for (const d of docs) {
  const n = JSON.stringify(d).length;
  if (cur.length && size + n > BATCH_BYTES) { batches.push(cur); cur = []; size = 0; }
  cur.push(d); size += n;
}
if (cur.length || batches.length === 0) batches.push(cur);
if (dryRun) {
  log(`[dry-run] POST ${url}/api/admin/import en ${batches.length} petición(es): ${batches.map(b => b.length).join(' + ')} documentos; replace: true en la primera`);
  process.exit(0);
}

async function post(body) {
  const res = await fetch(`${url}/api/admin/import`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-import-secret': secret }, body: JSON.stringify(body), signal: AbortSignal.timeout(300_000) });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 300) }; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${data.error ?? ''}`);
  return data;
}

const summary = { imported: 0, unchanged: 0, failed: [], deleted: null, inserted: null };
try {
  for (let i = 0; i < batches.length; i++) {
    const r = await post(i === 0 ? { ...rows, replace: true, docs: batches[i] } : { docs: batches[i] });
    if (i === 0) { summary.deleted = r.deleted; summary.inserted = r.inserted; }
    summary.imported += r.docs.imported.length;
    summary.unchanged += r.docs.unchanged?.length ?? 0;
    summary.failed.push(...r.docs.failed.map(f => `${f.id}: ${f.error}`));
  }
} catch (e) { await fail(`importación: ${e?.message ?? e}`); }

const fmt = (o) => (o ? Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ') || 'nada' : '?');
log(`ok ${url}: filas escritas {${fmt(summary.inserted)}}, borradas {${fmt(summary.deleted)}}; documentos ${summary.imported} actualizados, ${summary.unchanged} sin cambios, ${summary.failed.length} con error`);
const problems = [...invalid.map(s => `no valida en el VPS: ${s}`), ...summary.failed];
try { fs.writeFileSync(stateFile, JSON.stringify({ at: new Date().toISOString(), ok: problems.length === 0, url, stats, ...summary, problems }, null, 2)); } catch { /* sin carpeta de copias */ }
if (problems.length) await fail(`${problems.length} documento(s) sin sincronizar: ${problems.slice(0, 3).join('; ')}`);
