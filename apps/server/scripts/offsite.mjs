#!/usr/bin/env node
/**
 * Copia fuera del servidor: sube la copia diaria más reciente de `BACKUP_DIR` (`~/.alldraw-backups/<fecha>/`) a
 * Backblaze B2 (API S3, firma SigV4 propia, sin dependencias) con prefijo `daily/<fecha>/`, verificando MD5, sha256 y
 * tamaño, y una vez por semana también a `weekly/<fecha>/`. Lógica en `lib/offsite.mjs`; credenciales en
 * `~/.config/alldraw/b2.env` (`B2_ENV_FILE`). `backup.mjs` lo llama al terminar.
 *
 *   node scripts/offsite.mjs                       la última copia (weekly automático)
 *   node scripts/offsite.mjs --dir <carpeta>       una carpeta concreta
 *   node scripts/offsite.mjs --weekly always|never|auto
 *   node scripts/offsite.mjs --notify              si falla, avisa por ntfy (`lib/ntfy.mjs`)
 *
 * Sale con 0 si todo quedó subido y verificado, 1 si algo falló y 2 si no hay copia que subir.
 */
import os from 'node:os';
import path from 'node:path';
import { notify } from './lib/ntfy.mjs';
import { latestBackupDir, uploadBackup } from './lib/offsite.mjs';
import { loadB2Config } from './lib/s3.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const backupRoot = process.env.BACKUP_DIR ?? path.join(os.homedir(), '.alldraw-backups');
const dir = opt('--dir') ? path.resolve(opt('--dir')) : latestBackupDir(backupRoot);
const weekly = opt('--weekly', 'auto');
const log = (...a) => console.log(`[offsite ${new Date().toISOString()}]`, ...a);

if (!['auto', 'always', 'never'].includes(weekly)) { console.error('--weekly auto|always|never'); process.exit(2); }
if (!dir) { console.error(`no hay copias en ${backupRoot}`); process.exit(2); }

try {
  const cfg = loadB2Config();
  const r = await uploadBackup(cfg, dir, { weekly, log });
  log(`ok ${r.stamp} → b2://${cfg.bucket}/daily/${r.stamp}/${r.weekly ? ` y weekly/${r.stamp}/` : ''}`);
} catch (e) {
  const msg = String(e?.message ?? e);
  log(`ERROR: ${msg}`);
  if (args.includes('--notify')) await notify({ title: 'all-draw: falló la copia externa (B2)', message: `${path.basename(dir)}: ${msg}\nLa copia local sigue en el VPS.` });
  process.exit(1);
}
