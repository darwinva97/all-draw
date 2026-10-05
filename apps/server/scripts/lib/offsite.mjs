/**
 * Copias fuera del servidor (Backblaze B2, API S3): sube una carpeta de `backup.mjs` (`<BACKUP_DIR>/<fecha>/`) a
 * `daily/<fecha>/` y, si la última semanal tiene 6 días o más, también a `weekly/<fecha>/`. Lo usan `offsite.mjs`,
 * `offsite-restore.mjs` y el final de `backup.mjs`.
 *
 * Integridad: cada fichero se sube con `Content-MD5` (B2 rechaza la subida si no coincide) y metadatos `sha256`/`sha1`;
 * después un `HEAD` comprueba tamaño, ETag (= MD5) y `sha256`. Al final se sube `offsite.json` con la lista de ficheros
 * y sus sumas: su presencia marca la copia como completa y es lo que verifica la descarga.
 * El bucket es privado, cifrado en reposo (SSE-B2) y borra todo a los 90 días (regla de ciclo de vida del bucket).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getObject, headObject, listObjects, md5Hex, putObject, sha1Hex, sha256Hex } from './s3.mjs';

export const OFFSITE_MANIFEST = 'offsite.json';
export const STAMP_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;
/** Días mínimos entre dos copias semanales (6, no 7: el cron no cae siempre a la misma hora). */
export const WEEKLY_MIN_DAYS = 6;

export const stampTime = (stamp) => { const m = STAMP_RE.exec(stamp); return m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : NaN; };

/** La carpeta `<fecha>` más reciente de `root` (o `null`). */
export function latestBackupDir(root) {
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root).filter(n => STAMP_RE.test(n) && fs.statSync(path.join(root, n)).isDirectory()).sort();
  return dirs.length ? path.join(root, dirs.at(-1)) : null;
}

/** Ficheros de la carpeta (sin subcarpetas) con tamaño y sumas. */
export function describeDir(dir) {
  return fs.readdirSync(dir).filter(n => n !== OFFSITE_MANIFEST && fs.statSync(path.join(dir, n)).isFile()).sort().map(name => {
    const body = fs.readFileSync(path.join(dir, name));
    return { name, size: body.length, sha256: sha256Hex(body), sha1: sha1Hex(body), md5: md5Hex(body), body };
  });
}

const contentType = (name) => name.endsWith('.json') ? 'application/json' : name.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream';
const isMd5 = (etag) => /^[0-9a-f]{32}$/.test(etag);

/** Comprueba en el bucket tamaño, ETag (si es un MD5) y el `sha256` guardado en los metadatos. */
export async function verifyRemote(cfg, key, f) {
  const h = await headObject(cfg, key);
  if (!h) throw new Error(`${key}: no aparece tras subirlo`);
  if (h.size !== f.size) throw new Error(`${key}: tamaño ${h.size} ≠ ${f.size}`);
  if (isMd5(h.etag) && h.etag !== f.md5) throw new Error(`${key}: MD5 ${h.etag} ≠ ${f.md5}`);
  if (h.meta.sha256 !== f.sha256) throw new Error(`${key}: sha256 de los metadatos no coincide`);
  return h;
}

/** Sube los ficheros bajo `prefix` (salta los que ya están idénticos) y, al final, `offsite.json`. */
export async function uploadSet(cfg, prefix, files, { stamp, log = () => {} }) {
  let uploaded = 0, skipped = 0, bytes = 0;
  for (const f of files) {
    const key = `${prefix}${f.name}`;
    const prev = await headObject(cfg, key);
    if (prev && prev.size === f.size && prev.meta.sha256 === f.sha256) { skipped++; continue; }
    await putObject(cfg, key, f.body, { contentType: contentType(f.name), meta: { sha256: f.sha256, sha1: f.sha1 } });
    await verifyRemote(cfg, key, f);
    uploaded++; bytes += f.size;
  }
  const manifest = { format: 'all-draw-offsite/1', stamp, uploadedAt: new Date().toISOString(), files: files.map(({ body: _b, ...f }) => f) };
  const mbody = Buffer.from(JSON.stringify(manifest, null, 2));
  const m = { name: OFFSITE_MANIFEST, size: mbody.length, sha256: sha256Hex(mbody), sha1: sha1Hex(mbody), md5: md5Hex(mbody) };
  await putObject(cfg, `${prefix}${OFFSITE_MANIFEST}`, mbody, { contentType: 'application/json', meta: { sha256: m.sha256, sha1: m.sha1 } });
  await verifyRemote(cfg, `${prefix}${OFFSITE_MANIFEST}`, m);
  log(`${prefix}: ${uploaded} subidos (${(bytes / 1024).toFixed(1)} KiB), ${skipped} ya estaban, ${files.length} verificados`);
  return { prefix, uploaded, skipped, bytes, files: files.length };
}

/** Copias completas (con `offsite.json`) de `daily/` o `weekly/`: `[{ stamp, files, bytes }]`, de la más antigua a la más nueva. */
export async function listSets(cfg, kind) {
  const objs = await listObjects(cfg, `${kind}/`);
  const sets = new Map();
  for (const o of objs) {
    const [, stamp, name] = o.key.split('/');
    if (!stamp || !name) continue;
    const s = sets.get(stamp) ?? { stamp, files: 0, bytes: 0, complete: false };
    if (name === OFFSITE_MANIFEST) s.complete = true; else { s.files++; s.bytes += o.size; }
    sets.set(stamp, s);
  }
  return [...sets.values()].sort((a, b) => a.stamp.localeCompare(b.stamp));
}

/**
 * Sube una carpeta de copia: `daily/<fecha>/` siempre; `weekly/<fecha>/` según `weekly` (`auto`: si la última semanal
 * completa tiene `WEEKLY_MIN_DAYS` días o más; `always`; `never`).
 */
export async function uploadBackup(cfg, dir, { weekly = 'auto', log = () => {}, now = Date.now() } = {}) {
  const stamp = path.basename(dir);
  if (!STAMP_RE.test(stamp)) throw new Error(`${dir} no es una carpeta de copia (<fecha> como 2026-10-05T01-17-06Z)`);
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error(`${dir} no tiene manifest.json (¿copia a medias?)`);
  const files = describeDir(dir);
  const daily = await uploadSet(cfg, `daily/${stamp}/`, files, { stamp, log });
  let weeklyResult = null;
  if (weekly !== 'never') {
    const last = (await listSets(cfg, 'weekly')).filter(s => s.complete).at(-1);
    const age = last ? (now - stampTime(last.stamp)) / 86_400_000 : Infinity;
    if (weekly === 'always' || age >= WEEKLY_MIN_DAYS) weeklyResult = await uploadSet(cfg, `weekly/${stamp}/`, files, { stamp, log });
    else log(`semanal: la última es ${last.stamp} (hace ${age.toFixed(1)} días), toca dentro de ${(WEEKLY_MIN_DAYS - age).toFixed(1)}`);
  }
  return { stamp, daily, weekly: weeklyResult };
}

/**
 * Descarga `<kind>/<fecha>/` en `into` y verifica cada fichero contra `offsite.json` (tamaño, sha256) y el ETag (MD5).
 * Lanza si falta algo o no coincide; los ficheros sólo se escriben si están bien.
 */
export async function downloadSet(cfg, kind, stamp, into, { log = () => {} } = {}) {
  const prefix = `${kind}/${stamp}/`;
  let manifest;
  try { manifest = JSON.parse((await getObject(cfg, `${prefix}${OFFSITE_MANIFEST}`)).body.toString('utf8')); }
  catch (e) { throw new Error(`${prefix}: sin ${OFFSITE_MANIFEST} (copia incompleta o inexistente): ${e.message}`); }
  if (manifest.format !== 'all-draw-offsite/1' || !Array.isArray(manifest.files)) throw new Error(`${prefix}${OFFSITE_MANIFEST}: formato desconocido`);
  fs.mkdirSync(into, { recursive: true });
  let bytes = 0;
  for (const f of manifest.files) {
    if (path.basename(f.name) !== f.name) throw new Error(`nombre de fichero no válido: ${f.name}`);
    const { body, etag } = await getObject(cfg, `${prefix}${f.name}`);
    if (body.length !== f.size) throw new Error(`${f.name}: tamaño ${body.length} ≠ ${f.size}`);
    if (sha256Hex(body) !== f.sha256) throw new Error(`${f.name}: sha256 no coincide`);
    if (isMd5(etag) && etag !== md5Hex(body)) throw new Error(`${f.name}: el ETag no coincide con el MD5 descargado`);
    fs.writeFileSync(path.join(into, f.name), body);
    bytes += body.length;
  }
  fs.writeFileSync(path.join(into, OFFSITE_MANIFEST), JSON.stringify(manifest, null, 2));
  log(`${prefix} → ${into}: ${manifest.files.length} ficheros verificados (sha256 y tamaño), ${(bytes / 1024).toFixed(1)} KiB`);
  return { files: manifest.files.length, bytes, manifest };
}
