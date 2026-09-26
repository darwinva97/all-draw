#!/usr/bin/env node
/**
 * Restaura un espacio desde un JSON de `backup.mjs` en un servidor en marcha (Node o worker) por la API:
 *
 *   ALLDRAW_URL=https://alldraw.bezenti.com ALLDRAW_API_KEY=adk_… \
 *   node scripts/restore.mjs ~/.alldraw-backups/<fecha>/<id>.json.gz [--into <id>] [--name <nombre>]
 *
 * Sin `--into` crea un espacio nuevo (POST /api/workspaces {name, initial}) del que es dueño el usuario
 * de la API key. Con `--into <id>` reemplaza el contenido de ese espacio (PUT /api/workspaces/:id/snapshot;
 * requiere ser editor o dueño). Miembros y enlaces no se restauran (los tokens de enlace de la copia se listan).
 * Acepta también un Workspace JSON a secas (exportación de la app).
 */
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--into' && args[i - 1] !== '--name');
const into = opt('--into');
const nameOverride = opt('--name');
const base = (process.env.ALLDRAW_URL ?? '').replace(/\/$/, '');
const key = process.env.ALLDRAW_API_KEY;
if (!file || !base || !key) {
  console.error('uso: ALLDRAW_URL=… ALLDRAW_API_KEY=… node scripts/restore.mjs <fichero.json[.gz]> [--into <id>] [--name <nombre>]');
  process.exit(2);
}

let raw = fs.readFileSync(file);
if (file.endsWith('.gz')) raw = gunzipSync(raw);
const parsed = JSON.parse(raw.toString('utf8'));
const isBackup = parsed && parsed.format === 'all-draw-backup/1';
const snapshot = isBackup ? parsed.snapshot : parsed;
if (!snapshot || typeof snapshot !== 'object' || !('meta' in snapshot)) {
  console.error(isBackup ? 'la copia no tiene documento (el espacio estaba vacío)' : 'el fichero no es un Workspace JSON ni una copia de backup.mjs');
  process.exit(2);
}
const name = nameOverride ?? (isBackup ? parsed.workspace.name : undefined) ?? snapshot.meta.name ?? 'Restaurado';
snapshot.meta = { ...snapshot.meta, name };

const call = async (method, path, body) => {
  const res = await fetch(base + path, { method, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { error: text }; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.error ?? text}${json.issues ? '\n' + JSON.stringify(json.issues, null, 1) : ''}`);
  return json;
};

try {
if (into) {
  await call('PUT', `/api/workspaces/${encodeURIComponent(into)}/snapshot`, snapshot);
  console.log(`restaurado en ${into} (${name}): ${Object.keys(snapshot.elements ?? {}).length} elementos, ${Object.keys(snapshot.views ?? {}).length} vistas`);
} else {
  const ws = await call('POST', '/api/workspaces', { name, initial: snapshot });
  console.log(`creado ${ws.id} (${ws.name}) desde ${isBackup ? parsed.workspace.id : file}: ${Object.keys(snapshot.elements ?? {}).length} elementos, ${Object.keys(snapshot.views ?? {}).length} vistas`);
}
if (isBackup && parsed.workspace.members?.length) console.log(`miembros de la copia (no restaurados): ${parsed.workspace.members.map(m => `${m.email ?? m.userId}:${m.role}`).join(', ')}`);
if (isBackup && parsed.workspace.links?.length) console.log(`enlaces de la copia (no restaurados): ${parsed.workspace.links.length}`);
} catch (e) { console.error(e?.message ?? e); process.exit(1); }
