/**
 * Cliente S3 mínimo (firma AWS SigV4 hecha con `node:crypto`, sin dependencias) para la API S3 compatible de
 * Backblaze B2. Solo lo que necesitan las copias externas: PUT, HEAD, GET y ListObjectsV2, con URLs de estilo ruta
 * (`https://s3.<región>.backblazeb2.com/<bucket>/<clave>`).
 *
 * Configuración (`loadB2Config`): variables `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`, `B2_S3_ENDPOINT`, `B2_REGION`; las que
 * falten se leen de `B2_ENV_FILE` (por defecto `~/.config/alldraw/b2.env`, formato `CLAVE=valor`). Nunca se imprimen.
 */
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_B2_ENV_FILE = path.join(os.homedir(), '.config', 'alldraw', 'b2.env');

/** Lee un fichero `CLAVE=valor` (admite comillas y `export`; ignora comentarios). */
export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function loadB2Config(env = process.env) {
  const file = env.B2_ENV_FILE ?? DEFAULT_B2_ENV_FILE;
  const fromFile = fs.existsSync(file) ? parseEnvFile(fs.readFileSync(file, 'utf8')) : {};
  const get = (k) => env[k] || fromFile[k] || '';
  const cfg = { keyId: get('B2_KEY_ID'), appKey: get('B2_APP_KEY'), bucket: get('B2_BUCKET'), endpoint: get('B2_S3_ENDPOINT').replace(/\/$/, ''), region: get('B2_REGION') };
  const missing = Object.entries({ B2_KEY_ID: cfg.keyId, B2_APP_KEY: cfg.appKey, B2_BUCKET: cfg.bucket, B2_S3_ENDPOINT: cfg.endpoint }).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`faltan ${missing.join(', ')} (entorno o ${file})`);
  if (!/^https?:\/\//.test(cfg.endpoint)) cfg.endpoint = `https://${cfg.endpoint}`;
  // s3.us-east-005.backblazeb2.com → us-east-005
  cfg.region ||= /^https:\/\/s3\.([^.]+)\./.exec(cfg.endpoint)?.[1] ?? 'us-east-1';
  return cfg;
}

export const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex');
export const sha1Hex = (buf) => createHash('sha1').update(buf).digest('hex');
export const md5Hex = (buf) => createHash('md5').update(buf).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** RFC 3986 como pide SigV4: todo salvo `A-Za-z0-9-_.~` (y `/` en la ruta). */
const encode = (s, keepSlash = false) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).replace(keepSlash ? /%2F/g : /$^/, '/');

/**
 * Firma SigV4 (`AWS4-HMAC-SHA256`) de una petición: devuelve las cabeceras a enviar (con `authorization`,
 * `x-amz-date` y `x-amz-content-sha256`, sin `host`). `path` ya codificado. Probada con el ejemplo de la
 * documentación de AWS (`test/offsite.test.ts`).
 */
export function signV4({ method, host, path: canonicalUri, query = {}, headers = {}, payloadHash, accessKey, secretKey, region, service = 's3', now = new Date() }) {
  const canonicalQuery = Object.keys(query).sort().map(k => `${encode(k)}=${encode(String(query[k]))}`).join('&');
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); // 20261005T031700Z
  const day = amzDate.slice(0, 8);
  const h = { ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim()])), host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash };
  const names = Object.keys(h).sort();
  const canonicalRequest = [method, canonicalUri, canonicalQuery, names.map(n => `${n}:${h[n]}\n`).join(''), names.join(';'), payloadHash].join('\n');
  const scope = `${day}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  const { host: _host, ...out } = h;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return { headers: out, canonicalQuery };
}

/**
 * Firma y envía una petición. `key` es la clave del objeto (sin el bucket); `query` un objeto; `body` un Buffer.
 * Devuelve la `Response` de `fetch` (no lanza por estado HTTP).
 */
export async function s3Request(cfg, { method = 'GET', key = '', query = {}, headers = {}, body, timeoutMs = 120_000 }) {
  const url = new URL(cfg.endpoint);
  const canonicalUri = `/${encode(cfg.bucket)}${key ? `/${encode(key, true)}` : ''}`;
  const signed = signV4({ method, host: url.host, path: canonicalUri, query, headers, payloadHash: sha256Hex(body ?? Buffer.alloc(0)), accessKey: cfg.keyId, secretKey: cfg.appKey, region: cfg.region });
  return fetch(`${cfg.endpoint}${canonicalUri}${signed.canonicalQuery ? `?${signed.canonicalQuery}` : ''}`, { method, headers: signed.headers, body, signal: AbortSignal.timeout(timeoutMs) });
}

/** Error de S3 con el `Code` del XML (sin firmas ni credenciales). */
async function s3Error(res, what) {
  const text = await res.text().catch(() => '');
  const code = /<Code>([^<]*)<\/Code>/.exec(text)?.[1] ?? '';
  const msg = /<Message>([^<]*)<\/Message>/.exec(text)?.[1] ?? '';
  return new Error(`${what}: HTTP ${res.status}${code ? ` ${code}` : ''}${msg ? ` (${msg})` : ''}`);
}

const xmlDecode = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Sube un objeto con `Content-MD5` (el servidor rechaza si no coincide) y metadatos `x-amz-meta-*`. */
export async function putObject(cfg, key, body, { contentType = 'application/octet-stream', meta = {} } = {}) {
  const headers = { 'content-type': contentType, 'content-md5': Buffer.from(md5Hex(body), 'hex').toString('base64') };
  for (const [k, v] of Object.entries(meta)) headers[`x-amz-meta-${k}`] = v;
  const res = await s3Request(cfg, { method: 'PUT', key, headers, body });
  if (!res.ok) throw await s3Error(res, `PUT ${key}`);
  await res.arrayBuffer();
  return { etag: (res.headers.get('etag') ?? '').replace(/"/g, '') };
}

/** `HEAD`: `null` si no existe; si existe, tamaño, ETag y metadatos `x-amz-meta-*`. */
export async function headObject(cfg, key) {
  const res = await s3Request(cfg, { method: 'HEAD', key });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${key}: HTTP ${res.status}`);
  const meta = {};
  for (const [k, v] of res.headers) if (k.startsWith('x-amz-meta-')) meta[k.slice(11)] = v;
  return { size: Number(res.headers.get('content-length')), etag: (res.headers.get('etag') ?? '').replace(/"/g, ''), meta };
}

export async function getObject(cfg, key) {
  const res = await s3Request(cfg, { method: 'GET', key, timeoutMs: 600_000 });
  if (!res.ok) throw await s3Error(res, `GET ${key}`);
  return { body: Buffer.from(await res.arrayBuffer()), etag: (res.headers.get('etag') ?? '').replace(/"/g, '') };
}

/** ListObjectsV2 completo (sigue `NextContinuationToken`): `[{ key, size, etag, lastModified }]`. */
export async function listObjects(cfg, prefix) {
  const out = [];
  let token;
  do {
    const query = { 'list-type': '2', prefix, 'max-keys': '1000', ...(token ? { 'continuation-token': token } : {}) };
    const res = await s3Request(cfg, { method: 'GET', query });
    if (!res.ok) throw await s3Error(res, `LIST ${prefix}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const tag = (t) => xmlDecode(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(m[1])?.[1] ?? '');
      out.push({ key: tag('Key'), size: Number(tag('Size')), etag: tag('ETag').replace(/"/g, ''), lastModified: tag('LastModified') });
    }
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xmlDecode(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '') : undefined;
  } while (token);
  return out;
}
