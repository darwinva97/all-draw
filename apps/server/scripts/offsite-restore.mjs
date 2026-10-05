#!/usr/bin/env node
/**
 * Recupera una copia externa de Backblaze B2 (ver `offsite.mjs`).
 *
 *   node scripts/offsite-restore.mjs --list                              copias diarias y semanales del bucket
 *   node scripts/offsite-restore.mjs --date <fecha|latest> --into <dir> [--weekly]
 *
 * `--date` es el nombre de la carpeta (`2026-10-05T01-17-06Z`) o `latest`. Descarga `daily/<fecha>/` (o `weekly/` con
 * `--weekly`) en `<dir>`, verifica cada fichero contra `offsite.json` (sha256, tamaño) y el ETag (MD5) y, si está
 * `alldraw.sqlite.gz`, la descomprime en un temporal y pasa `PRAGMA integrity_check`. La carpeta queda con el mismo
 * formato que `~/.alldraw-backups/<fecha>/`: sirve para `restore.mjs`, `restore-drill.mjs --from <dir>` o para
 * restaurar la instalación entera (ver README, *Operaciones*). Sale con 1 si la verificación falla.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { downloadSet, listSets } from './lib/offsite.mjs';
import { loadB2Config } from './lib/s3.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const kind = args.includes('--weekly') ? 'weekly' : 'daily';
const usage = () => { console.error('uso: offsite-restore.mjs --list | --date <fecha|latest> --into <dir> [--weekly]'); process.exit(2); };

const cfg = loadB2Config();
const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;

if (args.includes('--list')) {
  for (const k of ['daily', 'weekly']) {
    const sets = await listSets(cfg, k);
    console.log(`${k}/ (${sets.length})`);
    for (const s of sets) console.log(`  ${s.stamp}  ${String(s.files).padStart(3)} ficheros  ${kib(s.bytes).padStart(10)}${s.complete ? '' : '  INCOMPLETA (sin offsite.json)'}`);
  }
  process.exit(0);
}

let stamp = opt('--date');
const into = opt('--into');
if (!stamp || !into) usage();
if (stamp === 'latest') {
  stamp = (await listSets(cfg, kind)).filter(s => s.complete).at(-1)?.stamp;
  if (!stamp) { console.error(`no hay copias completas en ${kind}/`); process.exit(2); }
}

try {
  const dest = path.resolve(into);
  const r = await downloadSet(cfg, kind, stamp, dest, { log: m => console.log(m) });
  const gz = path.join(dest, 'alldraw.sqlite.gz');
  if (fs.existsSync(gz)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-offsite-'));
    try {
      const file = path.join(tmp, 'alldraw.sqlite');
      fs.writeFileSync(file, gunzipSync(fs.readFileSync(gz)));
      const db = new DatabaseSync(file, { readOnly: true });
      const check = db.prepare('PRAGMA integrity_check').get();
      const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n, workspaces = db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n;
      db.close();
      if (check?.integrity_check !== 'ok') throw new Error(`integrity_check: ${JSON.stringify(check)}`);
      console.log(`alldraw.sqlite: integrity_check ok, ${users} usuarios, ${workspaces} espacios`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  console.log(`ok ${kind}/${stamp}: ${r.files} ficheros en ${dest}`);
} catch (e) {
  console.error(`ERROR: ${e?.message ?? e}`);
  process.exit(1);
}
