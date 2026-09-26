#!/usr/bin/env node
/**
 * Vigilante para cron: pide `GET /healthz`; si falla `HEALTH_FAILS` veces seguidas (3) reinicia la unidad
 * de usuario `ALLDRAW_UNIT` (alldraw) con `systemctl --user restart`. Sólo escribe en el log cuando algo
 * falla, se reinicia o se recupera; el contador de fallos vive en `HEALTH_STATE`.
 *
 * Línea de cron (cada 5 minutos; el `*` con barra no cabe en este comentario, ver README):
 *   <cada-5-min> cd /home/maka/projects/all-draw/apps/server && node scripts/healthcheck.mjs >> ~/.alldraw-backups/health.log 2>&1
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const env = process.env;
const url = (env.ALLDRAW_URL ?? `http://127.0.0.1:${env.PORT ?? 4002}`).replace(/\/$/, '') + '/healthz';
const unit = env.ALLDRAW_UNIT ?? 'alldraw';
const maxFails = Number(env.HEALTH_FAILS ?? 3);
const stateFile = env.HEALTH_STATE ?? path.join(os.homedir(), '.alldraw-backups', 'health.state');
const log = (msg) => console.log(`[health ${new Date().toISOString()}] ${msg}`);

let fails = 0;
try { fails = Number(fs.readFileSync(stateFile, 'utf8')) || 0; } catch { /* primera vez */ }
const save = (n) => { fs.mkdirSync(path.dirname(stateFile), { recursive: true }); fs.writeFileSync(stateFile, String(n)); };

let ok = false, detail = '';
try {
  const res = await fetch(url, { signal: AbortSignal.timeout(Number(env.HEALTH_TIMEOUT_MS ?? 8000)) });
  ok = res.ok && (await res.text()).trim() === 'ok';
  if (!ok) detail = `HTTP ${res.status}`;
} catch (e) { detail = e?.cause?.code ?? e?.name ?? String(e); }

if (ok) {
  if (fails > 0) log(`recuperado (${url}) tras ${fails} fallo(s)`);
  save(0);
  process.exit(0);
}

fails++;
log(`fallo ${fails}/${maxFails}: ${url} ${detail}`);
if (fails < maxFails) { save(fails); process.exit(1); }

// systemctl --user necesita el bus de sesión aunque cron no lo tenga en el entorno.
const uid = os.userInfo().uid;
const sysEnv = { ...env, XDG_RUNTIME_DIR: env.XDG_RUNTIME_DIR ?? `/run/user/${uid}`, DBUS_SESSION_BUS_ADDRESS: env.DBUS_SESSION_BUS_ADDRESS ?? `unix:path=/run/user/${uid}/bus` };
try {
  execFileSync('systemctl', ['--user', 'restart', unit], { env: sysEnv, stdio: 'pipe', timeout: 60_000 });
  log(`reiniciada la unidad ${unit}`);
  save(0);
} catch (e) {
  log(`no se pudo reiniciar ${unit}: ${e?.stderr?.toString().trim() || e?.message}`);
  save(fails);
  process.exit(1);
}
