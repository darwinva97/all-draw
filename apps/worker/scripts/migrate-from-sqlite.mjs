#!/usr/bin/env node
/**
 * Migra una instalación Node (SQLite) a Cloudflare.
 *
 * `--target do` (registro en el Durable Object `RegistryDO`, sin D1): sube cuentas, permisos y documentos al
 * worker desplegado por `POST /api/admin/import`, con el secreto `IMPORT_SECRET` del worker (sólo mientras
 * no tenga usuarios) o con un token de admin:
 *        npx wrangler secret put IMPORT_SECRET
 *        node scripts/migrate-from-sqlite.mjs --db … --target do --url https://alldraw.example.com --secret <IMPORT_SECRET>
 *   Con `--secret` va todo en una petición (cuentas + docs). Con `--key <token de admin>` (sesión o API key del
 *   worker), primero las cuentas y luego un doc por petición. `--no-docs` sólo sube las cuentas.
 *
 * `--target d1` (por defecto, registro en D1) en dos pasos:
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
import { collectMigrationRows, generateMigrationSql } from './migrate-sql.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const dbPath = opt('--db', process.env.DB_PATH ?? path.join(process.env.DATA_DIR ?? path.join(os.homedir(), '.alldraw-data'), 'alldraw.sqlite'));
const out = opt('--out');
const url = opt('--url', process.env.ALLDRAW_URL)?.replace(/\/$/, '');
const key = opt('--key', process.env.ALLDRAW_API_KEY);
const only = opt('--only')?.split(',').map(s => s.trim()).filter(Boolean);
const dryRun = flag('--dry-run');
const target = opt('--target', 'd1');
const secret = opt('--secret', process.env.ALLDRAW_IMPORT_SECRET);
const noDocs = flag('--no-docs');
const usage = () => {
  console.error([
    'uso: node scripts/migrate-from-sqlite.mjs --db <alldraw.sqlite> [--target d1|do] [--dry-run] [--only id,id]',
    '  --target d1 (defecto): [--out migrate.sql] [--url <worker> --key adk_…]',
    '  --target do:           --url <worker> (--secret <IMPORT_SECRET> | --key <token de admin>) [--no-docs]',
  ].join('\n'));
  process.exit(2);
};
if (flag('--help') || !['d1', 'do'].includes(target)) usage();
if (target === 'd1' && !out && !url && !dryRun) usage();
if (target === 'do' && !dryRun && (!url || (!secret && !key))) usage();
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

if (target === 'd1' && out) {
  if (dryRun) console.log(`[dry-run] escribiría ${out} (${gen.sql.length} bytes, ${gen.sql.split('\n').filter(l => l.startsWith('INSERT')).length} INSERT)`);
  else { fs.writeFileSync(out, gen.sql); console.log(`SQL escrito en ${out} → npx wrangler d1 execute <db> --remote --file ${out}`); }
}

/** Workspace JSON de cada espacio con documento (los vacíos y los que no validan se cuentan aparte). */
function collectDocs() {
  const docs = [], stats = { empty: 0, invalid: 0 };
  for (const w of listWorkspaces(db).filter(w => !only || only.includes(w.id))) {
    const update = loadDocUpdate(db, w.id);
    if (!update) { stats.empty++; console.log(`  ${w.id} (${w.name}): sin documento, nada que subir`); continue; }
    try { docs.push({ id: w.id, name: w.name, workspace: updateToWorkspace(update) }); }
    catch (e) { stats.invalid++; console.error(`  ${w.id} (${w.name}): el doc no valida: ${e?.message ?? e}`); }
  }
  return { docs, stats };
}

async function importRequest(body) {
  const headers = { 'content-type': 'application/json', ...(secret && !key ? { 'x-import-secret': secret } : { authorization: `Bearer ${key}` }) };
  const res = await fetch(`${url}/api/admin/import`, { method: 'POST', headers, body });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!res.ok) throw new Error(`${res.status} ${data.error ?? text}`);
  return data;
}

if (target === 'do') {
  const MAX = 60 * 1024 * 1024; // el worker acepta hasta 64 MiB por petición
  const { rows } = collectMigrationRows(db);
  const { docs, stats } = noDocs ? { docs: [], stats: { empty: 0, invalid: 0 } } : collectDocs();
  const describe = (d) => `${d.id} (${d.name}: ${Object.keys(d.workspace.elements).length} elementos, ${Object.keys(d.workspace.views).length} vistas)`;
  const payloadDocs = (list) => list.map(d => ({ id: d.id, workspace: d.workspace }));
  const oneShot = !key; // con el secreto sólo hay una oportunidad: después ya hay usuarios
  const accountsBody = JSON.stringify(oneShot ? { ...rows, docs: payloadDocs(docs) } : rows);
  if (dryRun) {
    console.log(`[dry-run] POST ${url ?? '<url>'}/api/admin/import (${oneShot ? 'X-Import-Secret, cuentas + docs' : 'token de admin, cuentas'}): ${(accountsBody.length / 1024).toFixed(1)} KiB`);
    for (const d of docs) console.log(`  [dry-run] doc ${describe(d)}${oneShot ? '' : ' → una petición'}`);
  } else {
    if (accountsBody.length > MAX) {
      console.error(`la petición ocupa ${(accountsBody.length / 1048576).toFixed(1)} MiB (> 60): sube primero las cuentas con --no-docs y luego los docs con --key <token de admin>`);
      process.exit(1);
    }
    let failed = stats.invalid;
    try {
      const r = await importRequest(accountsBody);
      const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ');
      console.log(`cuentas: insertadas {${fmt(r.inserted)}}; ya existían {${fmt(r.skipped)}}`);
      if (r.needsReset?.length) console.warn(`restablecer contraseña: ${r.needsReset.map(u => u.email).join(', ')}`);
      if (oneShot) {
        for (const id of r.docs.imported) console.log(`  ${id}: subido`);
        for (const f of r.docs.failed) { failed++; console.error(`  ${f.id}: fallo ${f.error}`); }
      }
    } catch (e) { console.error(`importación de cuentas: ${e?.message ?? e}`); process.exit(1); }
    if (!oneShot) {
      for (const d of docs) {
        try {
          const r = await importRequest(JSON.stringify({ docs: payloadDocs([d]) }));
          if (r.docs.failed.length) throw new Error(r.docs.failed[0].error);
          console.log(`  ${describe(d)}: subido`);
        } catch (e) { failed++; console.error(`  ${d.id} (${d.name}): fallo ${e?.message ?? e}`); }
      }
    }
    console.log(`documentos: ${docs.length - (failed - stats.invalid)} de ${docs.length} subidos, ${stats.empty} vacíos, ${failed} con error`);
    if (failed) process.exitCode = 1;
  }
}

if (target === 'd1' && (url || dryRun)) {
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
