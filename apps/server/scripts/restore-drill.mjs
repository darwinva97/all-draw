#!/usr/bin/env node
/**
 * Simulacro de restauración (semanal, desde cron): demuestra que la última copia de `backup.mjs` sirve.
 *
 *   1. Toma la copia más reciente de `$BACKUP_DIR` (o `--from <carpeta>`) y descomprime `alldraw.sqlite.gz`
 *      en un `DATA_DIR` temporal.
 *   2. En esa copia (nunca en la BD de producción) crea un admin técnico `drill-…@alldraw.local` sin
 *      contraseña y una API key para él.
 *   3. Arranca `src/server.mjs` en un puerto alto libre de 127.0.0.1 con ese `DATA_DIR` (sin estáticos, sin
 *      `SESSION_SECRET`, registro cerrado) y espera a `/healthz`.
 *   4. Comprueba `GET /api/status` (BD ok), que `GET /api/workspaces` devuelve los mismos espacios que el
 *      `manifest.json` de la copia y, para cada uno, `GET /api/workspaces/:id/validate` (200) y
 *      `GET …/snapshot` (mismo número de elementos y vistas que el manifiesto).
 *   5. Para el servidor con SIGTERM (debe salir con 0: prueba también el apagado ordenado), borra el temporal
 *      y escribe el resultado en `$BACKUP_DIR/restore-drill.last.json`. Sale con 1 si algo falla.
 *
 *   node scripts/restore-drill.mjs [--from <carpeta-de-copia>] [--keep]
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const backupRoot = process.env.BACKUP_DIR ?? path.join(os.homedir(), '.alldraw-backups');
const keep = args.includes('--keep');
const t0 = Date.now();
const log = (...a) => console.log(`[restore-drill ${new Date().toISOString()}]`, ...a);

function latestBackup() {
  const from = opt('--from');
  if (from) return path.resolve(from);
  if (!fs.existsSync(backupRoot)) return null;
  const dirs = fs.readdirSync(backupRoot).filter(n => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/.test(n) && fs.existsSync(path.join(backupRoot, n, 'alldraw.sqlite.gz'))).sort();
  return dirs.length ? path.join(backupRoot, dirs[dirs.length - 1]) : null;
}

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

const result = { ok: false, startedAt: new Date(t0).toISOString(), backup: null, workspaces: 0, expected: 0, checked: 0, failures: [], exitCode: null, ms: 0 };
const fail = (what) => { result.failures.push(what); log(`FALLO ${what}`); };

const backup = latestBackup();
if (!backup || !fs.existsSync(path.join(backup, 'alldraw.sqlite.gz'))) {
  log(`no hay copias en ${backupRoot}`);
  process.exit(2);
}
result.backup = backup;
const manifest = fs.existsSync(path.join(backup, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8')) : { workspaces: [] };
result.expected = manifest.workspaces.length;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-drill-'));
const dbPath = path.join(tmp, 'alldraw.sqlite');
fs.writeFileSync(dbPath, gunzipSync(fs.readFileSync(path.join(backup, 'alldraw.sqlite.gz'))));

// Admin técnico + API key en la copia (el servidor del simulacro arranca sin SESSION_SECRET: hash = SHA-256).
const rand = crypto.randomBytes(6).toString('hex');
const key = `adk_${crypto.randomBytes(24).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x')}`;
{
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  const uid = `usr_drill_${rand}`;
  db.prepare('INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, 1, ?)').run(uid, `drill-${rand}@alldraw.local`, 'Simulacro de restauración', '', now);
  db.prepare('INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(`key_drill_${rand}`, uid, 'restore-drill', key.slice(0, 10), crypto.createHash('sha256').update(key).digest('hex'), now);
  db.close();
}

const port = Number(process.env.DRILL_PORT) || await freePort();
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['src/server.mjs'], {
  cwd: serverDir,
  env: {
    PATH: process.env.PATH, HOME: tmp, DATA_DIR: tmp, DB_PATH: dbPath, PORT: String(port), HOST: '127.0.0.1',
    STATIC_DIR: path.join(tmp, 'sin-estaticos'), BACKUP_DIR: path.join(tmp, 'backups'), SESSION_SECRET: '', ALLOW_REGISTRATION: 'false',
    LOG_LEVEL: process.env.DRILL_LOG_LEVEL ?? 'warn', ALLDRAW_COMMIT: 'drill',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', d => { output += d; });
child.stderr.on('data', d => { output += d; });
const exited = new Promise(r => child.on('exit', code => r(code)));

const call = async (p) => {
  const res = await fetch(base + p, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

try {
  // Arranque (migraciones incluidas)
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`el servidor salió con ${child.exitCode}:\n${output.slice(-2000)}`);
    try { if ((await fetch(`${base}/healthz`)).ok) break; } catch { /* aún no escucha */ }
    if (Date.now() > deadline) throw new Error('el servidor no respondió a /healthz en 60 s');
    await new Promise(r => setTimeout(r, 200));
  }
  const status = await call('/api/status');
  if (status.status !== 200 || !status.body?.db?.ok) fail(`/api/status → ${status.status} ${JSON.stringify(status.body)}`);

  const list = await call('/api/workspaces');
  if (list.status !== 200) throw new Error(`/api/workspaces → ${list.status} ${JSON.stringify(list.body)}`);
  const workspaces = list.body.workspaces;
  result.workspaces = workspaces.length;
  if (workspaces.length !== manifest.workspaces.length) fail(`espacios: ${workspaces.length} en la BD restaurada, ${manifest.workspaces.length} en el manifiesto`);
  const expected = new Map(manifest.workspaces.map(w => [w.id, w]));
  for (const w of workspaces) {
    const id = encodeURIComponent(w.id);
    const v = await call(`/api/workspaces/${id}/validate`);
    if (v.status !== 200) { fail(`${w.id} validate → ${v.status} ${JSON.stringify(v.body).slice(0, 300)}`); continue; }
    const snap = await call(`/api/workspaces/${id}/snapshot`);
    if (snap.status !== 200) { fail(`${w.id} snapshot → ${snap.status}`); continue; }
    const m = expected.get(w.id);
    if (!m) fail(`${w.id} no está en el manifiesto`);
    else if (!m.error && m.elements !== undefined) {
      const elements = Object.keys(snap.body.elements ?? {}).length, views = Object.keys(snap.body.views ?? {}).length;
      if (elements !== m.elements || views !== m.views) fail(`${w.id}: ${elements} elementos / ${views} vistas, el manifiesto dice ${m.elements} / ${m.views}`);
    }
    result.checked++;
  }
} catch (e) {
  fail(String(e?.message ?? e));
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
  result.exitCode = await exited;
  clearTimeout(timer);
  if (result.exitCode !== 0) fail(`el servidor no salió limpio con SIGTERM (código ${result.exitCode})`);
  if (!keep) fs.rmSync(tmp, { recursive: true, force: true });
}

result.ok = result.failures.length === 0;
result.ms = Date.now() - t0;
try { fs.writeFileSync(path.join(backupRoot, 'restore-drill.last.json'), JSON.stringify(result, null, 2)); } catch { /* sin permisos: sólo log */ }
log(`${result.ok ? 'ok' : 'FALLÓ'} ${path.basename(backup)}: ${result.checked}/${result.workspaces} espacios validados (manifiesto: ${result.expected}), ${result.failures.length} fallos, ${result.ms} ms${keep ? `; copia en ${tmp}` : ''}`);
process.exit(result.ok ? 0 : 1);
