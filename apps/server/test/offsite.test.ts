/**
 * Copias externas (`scripts/lib/offsite.mjs`, `s3.mjs`): firma SigV4 con el ejemplo de la documentación de AWS, y subida,
 * semanal automática, verificación y descarga contra un S3 falso en memoria (comprueba `Content-MD5` como B2). Por último,
 * `backup.mjs` con un S3 que falla: la copia local vale, sale con 0 y avisa por ntfy (servidor falso).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error módulo .mjs sin tipos
import { signV4 } from '../scripts/lib/s3.mjs';
// @ts-expect-error módulo .mjs sin tipos
import { downloadSet, listSets, uploadBackup } from '../scripts/lib/offsite.mjs';
import { SqliteWorkspaceStore } from '../src/store/sqlite';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-offsite-'));

type Obj = { body: Buffer; meta: Record<string, string>; md5: string };
const objects = new Map<string, Obj>();
let failPuts = false;
const ntfy: { topic: string; title: string; message: string }[] = [];
let server: http.Server;
let endpoint = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const url = new URL(req.url!, 'http://x');
      if (url.pathname === '/ntfy') { ntfy.push(JSON.parse(Buffer.concat(chunks).toString())); res.end('{}'); return; }
      if (!String(req.headers.authorization ?? '').startsWith('AWS4-HMAC-SHA256 Credential=kid/')) { res.statusCode = 403; res.end(); return; }
      const [, bucket, ...rest] = url.pathname.split('/');
      const key = decodeURIComponent(rest.join('/'));
      if (bucket !== 'cubo') { res.statusCode = 404; res.end(); return; }
      if (req.method === 'PUT') {
        const body = Buffer.concat(chunks), md5 = createHash('md5').update(body).digest();
        if (failPuts || req.headers['content-md5'] !== md5.toString('base64')) { res.statusCode = failPuts ? 503 : 400; res.end('<Error><Code>BadDigest</Code></Error>'); return; }
        const meta = Object.fromEntries(Object.entries(req.headers).filter(([k]) => k.startsWith('x-amz-meta-')).map(([k, v]) => [k.slice(11), String(v)]));
        objects.set(key, { body, meta, md5: md5.toString('hex') });
        res.setHeader('etag', `"${md5.toString('hex')}"`); res.end(); return;
      }
      if (!key && url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? '';
        const items = [...objects].filter(([k]) => k.startsWith(prefix)).map(([k, o]) => `<Contents><Key>${k}</Key><Size>${o.body.length}</Size><ETag>"${o.md5}"</ETag></Contents>`);
        res.end(`<ListBucketResult>${items.join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`); return;
      }
      const o = objects.get(key);
      if (!o) { res.statusCode = 404; res.end(); return; }
      res.setHeader('etag', `"${o.md5}"`);
      for (const [k, v] of Object.entries(o.meta)) res.setHeader(`x-amz-meta-${k}`, v);
      res.setHeader('content-length', o.body.length);
      res.end(req.method === 'HEAD' ? undefined : o.body);
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

const cfg = () => ({ keyId: 'kid', appKey: 'secreto', bucket: 'cubo', endpoint, region: 'us-east-005' });

function fakeBackup(stamp: string) {
  const dir = path.join(tmp, 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ stamp }));
  fs.writeFileSync(path.join(dir, 'ws_a.json.gz'), Buffer.from(`datos ${stamp}`));
  return dir;
}

describe('copias externas (B2, API S3)', () => {
  it('SigV4: ejemplo GET de la documentación de AWS', () => {
    const { headers } = signV4({
      method: 'GET', host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', headers: { Range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      accessKey: 'AKIAIOSFODNN7EXAMPLE', secretKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', region: 'us-east-1', now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(headers.authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  });

  it('sube daily/ y weekly/ (una vez por semana), salta lo idéntico, descarga y verifica', async () => {
    const d1 = fakeBackup('2026-10-01T01-17-00Z');
    const now1 = Date.parse('2026-10-01T01:20:00Z');
    const r1 = await uploadBackup(cfg(), d1, { now: now1 });
    expect(r1.daily).toMatchObject({ uploaded: 2, skipped: 0 });
    expect(r1.weekly).toMatchObject({ prefix: 'weekly/2026-10-01T01-17-00Z/', uploaded: 2 });
    expect(objects.get('daily/2026-10-01T01-17-00Z/ws_a.json.gz')?.meta.sha256).toMatch(/^[0-9a-f]{64}$/);

    const again = await uploadBackup(cfg(), d1, { now: now1 });
    expect(again.daily).toMatchObject({ uploaded: 0, skipped: 2 });
    expect(again.weekly).toBeNull();

    const d2 = fakeBackup('2026-10-04T01-17-00Z');
    expect((await uploadBackup(cfg(), d2, { now: Date.parse('2026-10-04T01:20:00Z') })).weekly).toBeNull();
    const d3 = fakeBackup('2026-10-07T01-17-00Z');
    expect((await uploadBackup(cfg(), d3, { now: Date.parse('2026-10-07T01:20:00Z') })).weekly?.prefix).toBe('weekly/2026-10-07T01-17-00Z/');

    expect((await listSets(cfg(), 'daily')).map((s: { stamp: string; complete: boolean }) => [s.stamp, s.complete])).toEqual([
      ['2026-10-01T01-17-00Z', true], ['2026-10-04T01-17-00Z', true], ['2026-10-07T01-17-00Z', true],
    ]);

    const into = path.join(tmp, 'restaurada');
    const got = await downloadSet(cfg(), 'daily', '2026-10-04T01-17-00Z', into);
    expect(got.files).toBe(2);
    expect(fs.readFileSync(path.join(into, 'ws_a.json.gz'), 'utf8')).toBe('datos 2026-10-04T01-17-00Z');

    // Un objeto alterado en el bucket no pasa la verificación (y no se escribe)
    const k = 'daily/2026-10-04T01-17-00Z/ws_a.json.gz';
    const o = objects.get(k)!;
    objects.set(k, { ...o, body: Buffer.from('datos alterados!!!!!!!!!!') });
    await expect(downloadSet(cfg(), 'daily', '2026-10-04T01-17-00Z', path.join(tmp, 'mala'))).rejects.toThrow(/tamaño|sha256/);
    expect(fs.existsSync(path.join(tmp, 'mala', 'ws_a.json.gz'))).toBe(false);
    await expect(downloadSet(cfg(), 'daily', '2020-01-01T00-00-00Z', path.join(tmp, 'nada'))).rejects.toThrow(/offsite\.json/);
  });

  it('backup.mjs: si la subida falla, la copia local vale (sale con 0), se anota y se avisa por ntfy', async () => {
    const dbPath = path.join(tmp, 'prod', 'alldraw.sqlite');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    await new SqliteWorkspaceStore(dbPath).close();
    const b2env = path.join(tmp, 'b2.env');
    fs.writeFileSync(b2env, `B2_KEY_ID=kid\nB2_APP_KEY=secreto\nB2_BUCKET=cubo\nB2_S3_ENDPOINT=${endpoint}\nB2_REGION=us-east-005\n`);
    failPuts = true;
    const env = { PATH: process.env.PATH!, HOME: tmp, DB_PATH: dbPath, BACKUP_DIR: path.join(tmp, 'local'), KEEP_DAYS: '0', B2_ENV_FILE: b2env, NTFY_URL: `${endpoint}/ntfy`, NTFY_TOPIC: 'tema-de-prueba' };
    const r = await new Promise<{ code: number; out: string }>(resolve => {
      execFile(process.execPath, ['scripts/backup.mjs'], { cwd: serverDir, env, timeout: 90_000 }, (err, stdout, stderr) => resolve({ code: err ? Number(err.code) || 1 : 0, out: `${stdout}${stderr}` }));
    });
    failPuts = false;
    expect(r.out).toMatch(/\[backup .*\] ok /);
    expect(r.out).toMatch(/offsite ERROR: PUT .*HTTP 503.*sigue valiendo/);
    expect(r.code).toBe(0);
    expect(ntfy).toEqual([expect.objectContaining({ topic: 'tema-de-prueba', title: expect.stringContaining('copia externa') })]);
    expect(r.out).not.toContain('secreto');
  }, 90_000);
});
