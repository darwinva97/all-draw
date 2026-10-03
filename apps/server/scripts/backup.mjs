#!/usr/bin/env node
/**
 * Copia de seguridad del servidor Node:
 *   - `alldraw.sqlite.gz`: copia consistente de la BD con la API de backup de `node:sqlite`
 *     (`sqlite.backup()`, no bloquea al servidor en marcha; si no existe, `VACUUM INTO`).
 *   - `<workspaceId>.json.gz` por espacio: meta (dueño, miembros, enlaces) + `snapshot` (Workspace JSON
 *     sacado del doc Yjs). Lo lee `restore.mjs`.
 *   - `manifest.json` con el resumen.
 * Todo en `$BACKUP_DIR/<fecha>/` (por defecto `~/.alldraw-backups`); borra las carpetas de más de
 * `KEEP_DAYS` días (30), y también las copias finales de `deleted/` (espacios borrados con su cuenta). La BD se abre en solo lectura: no hace falta parar el servicio.
 *
 *   node scripts/backup.mjs            (DB_PATH / DATA_DIR como el servidor; BACKUP_DIR, KEEP_DAYS)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import { gzipSync } from 'node:zlib';
import { listWorkspaces, loadDocUpdate, openReadOnly, updateToWorkspace } from './lib/doc-json.mjs';

const env = process.env;
const dataDir = env.DATA_DIR ?? path.join(os.homedir(), '.alldraw-data');
const dbPath = env.DB_PATH ?? path.join(dataDir, 'alldraw.sqlite');
const backupRoot = env.BACKUP_DIR ?? path.join(os.homedir(), '.alldraw-backups');
const keepDays = Number(env.KEEP_DAYS ?? 30);
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-'); // 2026-09-26T03-17-00Z
const dir = path.join(backupRoot, stamp);
const log = (...a) => console.log(`[backup ${new Date().toISOString()}]`, ...a);

if (!fs.existsSync(dbPath)) { console.error(`no existe la BD ${dbPath}`); process.exit(2); }
fs.mkdirSync(dir, { recursive: true });

// 1. Copia consistente de la BD (fichero plano, sin WAL) y gzip.
const rawCopy = path.join(dir, 'alldraw.sqlite');
const src = openReadOnly(dbPath);
if (typeof sqliteBackup === 'function') await sqliteBackup(src, rawCopy);
else src.exec(`VACUUM INTO '${rawCopy.replace(/'/g, "''")}'`);
src.close();

// 2. Un JSON por espacio, leído de la copia (así el snapshot y la BD son del mismo instante).
// La copia hereda la cabecera WAL del original: se pasa a journal DELETE para que sea un único fichero.
const copy = new DatabaseSync(rawCopy);
copy.exec('PRAGMA journal_mode = DELETE');
const check = copy.prepare('PRAGMA integrity_check').get();
if (check?.integrity_check !== 'ok') { console.error('integrity_check falló:', check); process.exit(1); }
const workspaces = listWorkspaces(copy);
const manifest = { createdAt: new Date().toISOString(), dbPath, sqlite: 'alldraw.sqlite.gz', workspaces: [], errors: [] };
for (const w of workspaces) {
  const entry = { id: w.id, name: w.name, ownerEmail: w.ownerEmail, file: `${w.id}.json.gz` };
  try {
    const update = loadDocUpdate(copy, w.id);
    const snapshot = update ? updateToWorkspace(update) : null;
    const json = { format: 'all-draw-backup/1', exportedAt: manifest.createdAt, workspace: w, snapshot };
    fs.writeFileSync(path.join(dir, entry.file), gzipSync(JSON.stringify(json)));
    entry.elements = snapshot ? Object.keys(snapshot.elements).length : 0;
    entry.views = snapshot ? Object.keys(snapshot.views).length : 0;
  } catch (e) {
    // Si el doc no valida, guarda el update crudo para no perder nada.
    entry.error = String(e?.message ?? e);
    manifest.errors.push({ id: w.id, error: entry.error });
    const update = loadDocUpdate(copy, w.id);
    if (update) { entry.file = `${w.id}.yupdate.gz`; fs.writeFileSync(path.join(dir, entry.file), gzipSync(update)); }
    log(`aviso: ${w.id} (${w.name}) no se pudo convertir a JSON: ${entry.error}`);
  }
  manifest.workspaces.push(entry);
}
manifest.users = copy.prepare('SELECT COUNT(*) AS n FROM users').get().n;
copy.close();

fs.writeFileSync(`${rawCopy}.gz`, gzipSync(fs.readFileSync(rawCopy)));
for (const f of [rawCopy, `${rawCopy}-wal`, `${rawCopy}-shm`]) fs.rmSync(f, { force: true });
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 3. Retención.
let removed = 0;
if (keepDays > 0) {
  const limit = Date.now() - keepDays * 86_400_000;
  for (const name of fs.readdirSync(backupRoot)) {
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/.exec(name);
    if (!m) continue;
    const when = Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`);
    if (when < limit) { fs.rmSync(path.join(backupRoot, name), { recursive: true, force: true }); removed++; }
  }
  // Copias finales de espacios borrados con su cuenta (`deleted/<fecha>-<id>.json.gz`, ver src/archive.ts).
  const deletedDir = path.join(backupRoot, 'deleted');
  if (fs.existsSync(deletedDir)) {
    for (const name of fs.readdirSync(deletedDir)) {
      const file = path.join(deletedDir, name);
      if (fs.statSync(file).mtimeMs < limit) { fs.rmSync(file, { force: true }); removed++; }
    }
  }
}

const size = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
log(`ok ${dir}: ${manifest.users} usuarios, ${workspaces.length} espacios (${manifest.errors.length} con error), ${(size / 1024).toFixed(1)} KiB; borradas ${removed} copias de más de ${keepDays} días`);
process.exit(manifest.errors.length ? 1 : 0);
