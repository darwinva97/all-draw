/** Producción en el servidor Node real: log de accesos, /metrics, /api/status, security.txt, cabeceras, límites de WebSocket, cuota por WS, apagado ordenado, SQLite y copia final al borrar una cuenta. */
import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as Y from 'yjs';
import WebSocket from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { exampleWorkspace } from '@all-draw/core';
import { HTTP_TIMEOUTS, WS_RESTART, WS_TOO_MANY } from '../src/app';
import { readCommit } from '../src/build';
import { Metrics, routeOf } from '../src/metrics';
import { SqliteWorkspaceStore } from '../src/store/sqlite';
import type { WorkspaceStore } from '../src/store/types';
import type { Config } from '../src/config';
import type { LogLevel } from '@all-draw/server-core';
import { client, register, startServer, until, type TestServer } from './helpers';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-prod-'));
const servers: TestServer<any>[] = [];
afterAll(async () => { for (const s of servers) await s.close().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); });
type StartOpts = { store?: WorkspaceStore; config?: Partial<Config>; logLevel?: LogLevel };
const start = async (opts: StartOpts = {}) => { const s = await startServer(opts as StartOpts & { store: WorkspaceStore }); servers.push(s); return s; };

/** Abre un WebSocket y recoge mensajes y el código de cierre. */
function openWs(url: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(url, { headers });
  const messages: Uint8Array[] = [];
  const closed = new Promise<number>(r => ws.on('close', (c: number) => r(c)));
  const opened = new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  ws.on('error', () => {});
  ws.on('message', (d: Buffer) => messages.push(new Uint8Array(d)));
  return { ws, messages, closed, opened };
}
const updateMsg = (u: Uint8Array) => { const e = encoding.createEncoder(); encoding.writeVarUint(e, 0); syncProtocol.writeUpdate(e, u); return encoding.toUint8Array(e); };

describe('log de accesos y métricas', () => {
  it('una línea JSON por petición: método, ruta sin tokens, estado, ms, usuario, IP truncada', async () => {
    const s = await start({ logLevel: 'debug' });
    const a = await register(s.url, 'ana@example.com');
    await fetch(`${s.url}/api/auth/me?token=lnk_secreto123`, { headers: { authorization: `Bearer ${a.token}`, 'x-forwarded-for': '203.0.113.77, 10.0.0.1' } });
    await until(() => s.logs.some(l => l.msg === 'http' && l.path === '/api/auth/me'));
    const line = s.logs.find(l => l.msg === 'http' && l.path === '/api/auth/me')!;
    expect(line).toMatchObject({ level: 'info', method: 'GET', status: 200, user: a.user.id, ip: '203.0.113.0' });
    expect(typeof line.ms).toBe('number');
    expect(JSON.stringify(s.logs)).not.toContain('secreto123');
    await fetch(`${s.url}/api/workspaces`);
    await until(() => s.logs.some(l => l.msg === 'http' && l.path === '/api/workspaces' && l.status === 401));
    expect(s.logs.find(l => l.path === '/api/workspaces')).toMatchObject({ user: 'anon', ip: '127.0.0.0' });
  });

  it('/metrics: sólo local sin proxy o con METRICS_TOKEN; contadores, p50/p95 y gauges', async () => {
    const s = await start({ store: new SqliteWorkspaceStore(path.join(tmp, 'metrics.sqlite')), config: { metricsToken: 'tok-metricas' } });
    const a = await register(s.url, 'ana@example.com');
    const id = (await a.api.post('/api/workspaces', { name: 'x' })).body.id;
    for (let i = 0; i < 3; i++) await a.api.get(`/api/workspaces/${id}`);
    const r = await fetch(`${s.url}/metrics`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/plain');
    const text = await r.text();
    expect(text).toMatch(/alldraw_http_requests_total\{method="GET",route="\/api\/workspaces\/:id",status="200"\} 3/);
    expect(text).toMatch(/alldraw_http_request_duration_seconds\{route="\/api\/workspaces\/:id",quantile="0.95"\} \d/);
    expect(text).toMatch(/alldraw_docs_live \d/);
    expect(text).toMatch(/alldraw_ws_connections 0/);
    expect(Number(/alldraw_db_size_bytes (\d+)/.exec(text)![1])).toBeGreaterThan(0);
    expect(text).toContain('alldraw_build_info{version="0.0.0-test",commit="test"');
    expect(text).not.toContain(id);
    // detrás de Caddy (x-forwarded-for) no, salvo con el token
    expect((await fetch(`${s.url}/metrics`, { headers: { 'x-forwarded-for': '198.51.100.1' } })).status).toBe(403);
    expect((await fetch(`${s.url}/metrics`, { headers: { 'x-forwarded-for': '198.51.100.1', authorization: 'Bearer otro' } })).status).toBe(403);
    expect((await fetch(`${s.url}/metrics`, { headers: { 'x-forwarded-for': '198.51.100.1', authorization: 'Bearer tok-metricas' } })).status).toBe(200);
  });

  it('routeOf y percentiles', () => {
    expect(routeOf('/api/workspaces/ws_1/snapshots/snp_2/restore?x=1')).toBe('/api/workspaces/:id/snapshots/:id/restore');
    expect(routeOf('/api/workspaces/ws_1/views/v_1/svg')).toBe('/api/workspaces/:id/views/:id/svg');
    expect(routeOf('/api/keys/key_1')).toBe('/api/keys/:id');
    expect(routeOf('/assets/index-abc.js')).toBe('static');
    const m = new Metrics();
    for (let i = 1; i <= 100; i++) m.observe('GET', '/api/notations', 200, i);
    const p = m.percentiles('/api/notations');
    expect(p.count).toBe(100);
    expect(p.p50).toBeCloseTo(0.05, 3);
    expect(p.p95).toBeCloseTo(0.095, 3);
    m.observe('GET', '/api/nada/123', 404, 1);
    expect(m.render()).toContain('route="unmatched"');
  });
});

describe('estado, security.txt y cabeceras', () => {
  it('/api/status público con versión, commit y BD', async () => {
    const s = await start({ store: new SqliteWorkspaceStore(path.join(tmp, 'status.sqlite')) });
    const r = await client(s.url).get('/api/status');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'ok', version: '0.0.0-test', commit: 'test', runtime: 'node', db: { ok: true } });
  });

  it('/.well-known/security.txt', async () => {
    const s = await start({ config: { publicUrl: 'https://alldraw.example' } });
    const r = await fetch(`${s.url}/.well-known/security.txt`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/plain');
    const txt = await r.text();
    expect(txt).toContain('Contact: https://github.com/darwinva97/all-draw/security');
    expect(txt).toContain('Canonical: https://alldraw.example/.well-known/security.txt');
    expect(Date.parse(/Expires: (\S+)/.exec(txt)![1]!)).toBeGreaterThan(Date.now());
  });

  it('COOP y CORP same-origin en estáticos y API; timeouts del servidor HTTP', async () => {
    const dir = fs.mkdtempSync(path.join(tmp, 'static-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
    const s = await start({ config: { staticDir: dir } });
    for (const p of ['/', '/api/notations', '/healthz']) {
      const r = await fetch(s.url + p);
      expect(r.headers.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(r.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    }
    expect(s.app.server.headersTimeout).toBe(HTTP_TIMEOUTS.headersTimeout);
    expect(s.app.server.requestTimeout).toBe(HTTP_TIMEOUTS.requestTimeout);
    expect(s.app.server.keepAliveTimeout).toBe(HTTP_TIMEOUTS.keepAliveTimeout);
  });

  it('el commit sale de ALLDRAW_COMMIT o de git', () => {
    expect(readCommit({ ALLDRAW_COMMIT: 'deadbee' })).toBe('deadbee');
    expect(readCommit({})).toMatch(/^[0-9a-f]{4,40}$/);
  });
});

describe('WebSocket: límites, cuota y apagado ordenado', () => {
  it('MAX_WS_PER_IP y MAX_WS_PER_WORKSPACE → cierre 4429', async () => {
    const s = await start({ config: { maxWsPerIp: 2, maxWsPerWorkspace: 100 } });
    const a = await register(s.url, 'ana@example.com');
    const id = (await a.api.post('/api/workspaces', { name: 'x' })).body.id;
    const url = `${s.wsUrl}/${id}?token=${a.token}`;
    const c1 = openWs(url), c2 = openWs(url);
    await c1.opened; await c2.opened;
    await until(() => s.app.docs.size === 1);
    const c3 = openWs(url);
    expect(await c3.closed).toBe(WS_TOO_MANY);
    c1.ws.close(); await c1.closed;
    await new Promise(r => setTimeout(r, 50));
    const c4 = openWs(url);
    await c4.opened; // se libera el hueco
    c2.ws.close(); c4.ws.close();
    expect((await fetch(`${s.url}/metrics`).then(r => r.text()))).toMatch(/alldraw_ws_rejected_total\{reason="per_ip"\} 1/);

    const s2 = await start({ config: { maxWsPerIp: 0, maxWsPerWorkspace: 1 } });
    const b = await register(s2.url, 'bea@example.com');
    const id2 = (await b.api.post('/api/workspaces', { name: 'y' })).body.id;
    const d1 = openWs(`${s2.wsUrl}/${id2}?token=${b.token}`);
    await d1.opened;
    await new Promise(r => setTimeout(r, 50));
    expect(await openWs(`${s2.wsUrl}/${id2}?token=${b.token}`).closed).toBe(WS_TOO_MANY);
    d1.ws.close();
  });

  it('MAX_DOC_BYTES por WebSocket: el update que se pasa se descarta con permissionDenied', async () => {
    const s = await start({ config: { maxDocBytes: 3000 } });
    const a = await register(s.url, 'ana@example.com');
    const id = (await a.api.post('/api/workspaces', { name: 'x' })).body.id;
    const c = openWs(`${s.wsUrl}/${id}?token=${a.token}`);
    await c.opened;
    const doc = new Y.Doc();
    doc.getMap('elements').set('grande', 'x'.repeat(10_000));
    c.ws.send(updateMsg(Y.encodeStateAsUpdate(doc)));
    await until(() => c.messages.some(m => m[0] === 2));
    const dec = decoding.createDecoder(c.messages.find(m => m[0] === 2)!);
    decoding.readVarUint(dec); decoding.readVarUint(dec);
    expect(JSON.parse(decoding.readVarString(dec))).toEqual({ error: 'doc_too_large', limit: 3000 });
    const live = await s.app.docs.get(id);
    expect(live.doc.getMap('elements').get('grande')).toBeUndefined();
    c.ws.close();
  });

  it('close(): cierra los WebSockets con 1012 y guarda los docs con cambios', async () => {
    const dbPath = path.join(tmp, 'shutdown.sqlite');
    const s = await startServer({ store: new SqliteWorkspaceStore(dbPath) });
    const a = await register(s.url, 'ana@example.com');
    const id = (await a.api.post('/api/workspaces', { name: 'x' })).body.id;
    const c = openWs(`${s.wsUrl}/${id}?token=${a.token}`);
    await c.opened;
    const doc = new Y.Doc();
    doc.getMap('meta').set('apagado', 'guardado');
    c.ws.send(updateMsg(Y.encodeStateAsUpdate(doc)));
    await until(() => (s.app.docs.size === 1));
    await new Promise(r => setTimeout(r, 30));
    const closing = s.close();
    expect(await c.closed).toBe(WS_RESTART);
    await closing;
    const reopened = new SqliteWorkspaceStore(dbPath);
    const saved = new Y.Doc(); Y.applyUpdate(saved, (await reopened.loadDoc(id))!);
    expect(saved.getMap('meta').get('apagado')).toBe('guardado');
    await reopened.close();
  });
});

describe('SQLite y borrar cuenta en el VPS', () => {
  it('PRAGMA: WAL, synchronous NORMAL, foreign_keys, busy_timeout', async () => {
    const store = new SqliteWorkspaceStore(path.join(tmp, 'pragmas.sqlite'));
    const get = (p: string) => Object.values(store.db.prepare(`PRAGMA ${p}`).get() as Record<string, unknown>)[0];
    expect(get('journal_mode')).toBe('wal');
    expect(get('synchronous')).toBe(1);
    expect(get('foreign_keys')).toBe(1);
    expect(get('busy_timeout')).toBe(5000);
    expect(store.dbSizeBytes()).toBeGreaterThan(0);
    await store.close();
    await store.close(); // idempotente
  });

  it('DELETE /api/auth/account escribe la copia final en BACKUP_DIR/deleted (restaurable con restore.mjs)', async () => {
    const backupDir = path.join(tmp, 'backups');
    const s = await start({ store: new SqliteWorkspaceStore(path.join(tmp, 'account.sqlite')), config: { backupDir } });
    await register(s.url, 'admin@example.com');
    const a = await register(s.url, 'ana@example.com');
    const id = (await a.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;
    const r = await fetch(`${s.url}/api/auth/account`, { method: 'DELETE', headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ password: 'contraseña-larga' }) });
    expect(r.status).toBe(200);
    const files = fs.readdirSync(path.join(backupDir, 'deleted'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(new RegExp(`${id}\\.json\\.gz$`));
    expect((fs.statSync(path.join(backupDir, 'deleted', files[0]!)).mode & 0o777).toString(8)).toBe('600');
    const archive = JSON.parse(gunzipSync(fs.readFileSync(path.join(backupDir, 'deleted', files[0]!))).toString());
    expect(archive).toMatchObject({ format: 'all-draw-backup/1', reason: 'account-deleted', workspace: { id, ownerEmail: 'ana@example.com' } });
    expect(Object.keys(archive.snapshot.elements).length).toBeGreaterThan(0);
    expect(await s.store.getWorkspace(id)).toBeNull();
    expect(await s.store.getUserByEmail('ana@example.com')).toBeNull();
  });
});
