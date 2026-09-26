#!/usr/bin/env node
/**
 * Migra una instalación Node (SQLite) a Cloudflare (D1 + Durable Objects) en dos pasos:
 *
 *   1. Cuentas y permisos → fichero SQL para D1:
 *        node scripts/migrate-from-sqlite.mjs --db ~/.alldraw-data/alldraw.sqlite --out migrate.sql
 *        npx wrangler d1 execute alldraw --remote --file migrate.sql
 *   2. Documentos Yjs → Durable Object de cada espacio, por la API del worker ya desplegado, con una
 *      API key del dueño (o de un admin, que puede escribir en todos):
 *        node scripts/migrate-from-sqlite.mjs --db … --url https://alldraw.example.com --key adk_…
 *
 * `--dry-run` cuenta y lista sin escribir el SQL ni llamar a la API. `--only <id,id>` limita los espacios
 * del paso 2. La SQLite se abre en solo lectura (el servidor Node puede seguir en marcha).
 * Las API keys migradas sólo funcionan si el worker tiene el mismo `SESSION_SECRET` que el servidor Node
 * (los hashes son HMAC con él); si no, créalas de nuevo. Los usuarios con hash `scrypt$` no podrán
 * iniciar sesión en el worker: se listan al final (haz login una vez en Node antes, que re-hashea a PBKDF2).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMigrationSql } from './migrate-sql.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const dbPath = opt('--db', process.env.DB_PATH ?? path.join(process.env.DATA_DIR ?? path.join(os.homedir(), '.alldraw-data'), 'alldraw.sqlite'));
const out = opt('--out');
const url = opt('--url', process.env.ALLDRAW_URL)?.replace(/\/$/, '');
const key = opt('--key', process.env.ALLDRAW_API_KEY);
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const dryRun = flag('--dry-run');
if (flag('--help') || (!out && !url && !dryRun)) {
  console.error('uso: node scripts/migrate-from-sqlite.mjs --db <alldraw.sqlite> [--out migrate.sql] [--url <worker> --key adk_…] [--only id,id] [--dry-run]');
  process.exit(2);
}
if (!fs.existsSync(dbPath)) { console.error(`no existe ${dbPath}`); process.exit(2); }

// La conversión Yjs → Workspace JSON vive en los scripts del servidor Node (usa tsx y @all-draw/sync).
const here = path.dirname(fileURLToPath(import.meta.url));
const { listWorkspaces, loadDocUpdate, openReadOnly, updateToWorkspace } = await import(path.join(here, '../../server/scripts/lib/doc-json.mjs'));

const db = openReadOnly(dbPath);
const gen = generateMigrationSql(db);
console.log(`SQLite ${dbPath}: ${gen.stats.users} usuarios, ${gen.stats.workspaces} espacios, ${gen.stats.members} miembros, ${gen.stats.links} enlaces, ${gen.stats.apiKeys} API keys`);
if (gen.needsReset.length) {
  console.warn(`AVISO: ${gen.needsReset.length} usuario(s) con hash scrypt$ (no verificable en Workers); se marcan como reset$ y deberán restablecer la contraseña:`);
  for (const u of gen.needsReset) console.warn(`  - ${u.email} (${u.id})`);
}

if (out) {
  if (dryRun) console.log(`[dry-run] escribiría ${out} (${gen.sql.length} bytes, ${gen.sql.split('\n').filter(l => l.startsWith('INSERT')).length} INSERT)`);
  else { fs.writeFileSync(out, gen.sql); console.log(`SQL escrito en ${out} → npx wrangler d1 execute <db> --remote --file ${out}`); }
}

if (url || dryRun) {
  const workspaces = listWorkspaces(db).filter(w => !only || only.includes(w.id));
  let done = 0, failed = 0, empty = 0;
  for (const w of workspaces) {
    const update = loadDocUpdate(db, w.id);
    if (!update) { empty++; console.log(`  ${w.id} (${w.name}): sin documento, nada que subir`); continue; }
    let snapshot;
    try { snapshot = updateToWorkspace(update); } catch (e) { failed++; console.error(`  ${w.id} (${w.name}): el doc no valida: ${e?.message ?? e}`); continue; }
    const n = `${Object.keys(snapshot.elements).length} elementos, ${Object.keys(snapshot.views).length} vistas`;
    if (dryRun || !url) { console.log(`  [dry-run] PUT /api/workspaces/${w.id}/snapshot (${w.name}: ${n})`); done++; continue; }
    if (!key) { console.error('falta --key (API key del dueño o de un admin en el worker)'); process.exit(2); }
    try {
      const res = await fetch(`${url}/api/workspaces/${encodeURIComponent(w.id)}/snapshot`, { method: 'PUT', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(snapshot) });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      done++; console.log(`  ${w.id} (${w.name}): subido (${n})`);
    } catch (e) { failed++; console.error(`  ${w.id} (${w.name}): fallo ${e?.message ?? e}`); }
  }
  console.log(`documentos: ${done} ${dryRun ? 'listos' : 'subidos'}, ${empty} vacíos, ${failed} con error`);
  if (failed) process.exitCode = 1;
}
db.close();
