/** Seguridad sobre el servidor Node real con SQLite: cabeceras, CSRF con cookie, instantáneas persistidas, WebSocket con enlaces caducados y orígenes ajenos. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { exampleWorkspace } from '@all-draw/core';
import { SqliteWorkspaceStore } from '../src/store/sqlite';
import { client, register, startServer, type TestServer } from './helpers';

let s: TestServer<SqliteWorkspaceStore>;
let dir: string;
let owner: Awaited<ReturnType<typeof register>>;
let wsId: string;
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-sec-'));
  s = await startServer({ store: new SqliteWorkspaceStore(path.join(dir, 'db.sqlite')), config: { staticDir: dir } });
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>x</title>');
  owner = await register(s.url, 'owner@example.com');
  wsId = (await owner.api.post('/api/workspaces', { initial: exampleWorkspace() })).body.id;
});
afterAll(async () => { await s.close(); fs.rmSync(dir, { recursive: true, force: true }); });

const wsClose = (url: string, headers: Record<string, string> = {}) => new Promise<number>(r => { const w = new WebSocket(url, { headers }); w.on('close', (c: number) => r(c)); w.on('error', () => {}); });

describe('cabeceras de seguridad', () => {
  it('estáticos y API llevan CSP, nosniff, referrer y permissions; HSTS sólo tras x-forwarded-proto: https', async () => {
    for (const p of ['/', '/api/notations']) {
      const r = await fetch(s.url + p);
      expect(r.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(r.headers.get('content-security-policy')).toContain("style-src 'self' 'unsafe-inline'");
      expect(r.headers.get('content-security-policy')).toContain('img-src \'self\' data: blob:');
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(r.headers.get('permissions-policy')).toContain('camera=()');
      expect(r.headers.get('strict-transport-security')).toBeNull();
    }
    const https = await fetch(s.url + '/api/notations', { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'alldraw.example.com' } });
    expect(https.headers.get('strict-transport-security')).toContain('max-age=');
    expect(https.headers.get('content-security-policy')).toContain('wss://alldraw.example.com');
  });
});

describe('CSRF por HTTP real', () => {
  it('cookie sin marca → 403; con X-Requested-With → ok; el cliente web la manda', async () => {
    const login = await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'contraseña-larga' }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    const post = (h: Record<string, string>) => fetch(`${s.url}/api/workspaces`, { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...h }, body: JSON.stringify({ name: 'x' }) });
    expect((await post({})).status).toBe(403);
    expect((await post({ origin: 'https://evil.example' })).status).toBe(403);
    expect((await post({ 'x-requested-with': 'all-draw' })).status).toBe(201);
    expect((await post({ origin: new URL(s.url).origin })).status).toBe(201);
    expect((await fetch(`${s.url}/api/workspaces`, { headers: { cookie } })).status).toBe(200);
  });
});

describe('instantáneas en SQLite', () => {
  it('crear, listar, restaurar y podar persisten en la BD; sobreviven a la descarga del doc', async () => {
    const s1 = await owner.api.post(`/api/workspaces/${wsId}/snapshots`, { label: 'inicial' });
    expect(s1.status).toBe(201);
    await owner.api.post(`/api/workspaces/${wsId}/commands`, { commands: [{ type: 'meta', patch: { description: 'cambiado' } }] });
    const s2 = await owner.api.post(`/api/workspaces/${wsId}/snapshots`, {});
    expect(s2.status).toBe(201);
    const rows = s.store.db.prepare('SELECT id, label, size, author_id FROM snapshots WHERE workspace_id = ? ORDER BY created_at').all(wsId) as { id: string; label: string | null; size: number; author_id: string }[];
    expect(rows.map(r => r.id)).toEqual([s1.body.id, s2.body.id]);
    expect(rows[0]).toMatchObject({ label: 'inicial', author_id: owner.user.id });
    expect(rows[1]!.size).toBeGreaterThan(0);
    // Descarga del doc vivo y restauración desde cero
    await s.app.docs.closeAll();
    expect((await owner.api.post(`/api/workspaces/${wsId}/snapshots/${s1.body.id}/restore`)).status).toBe(200);
    expect((await owner.api.get(`/api/workspaces/${wsId}/snapshot`)).body.meta.description ?? '').toBe('');
    expect((await owner.api.get(`/api/workspaces/${wsId}/snapshots`)).body.snapshots).toHaveLength(3);
    // Poda
    for (let i = 0; i < 100; i++) await s.store.createSnapshot({ workspaceId: wsId, authorId: null, label: null, data: new Uint8Array([i]) });
    await owner.api.post(`/api/workspaces/${wsId}/snapshots`, {});
    const left = (await owner.api.get(`/api/workspaces/${wsId}/snapshots`)).body.snapshots as { id: string }[];
    expect(left).toHaveLength(100);
    expect(left.some(x => x.id === s1.body.id)).toBe(true);
    expect((await client(s.url).get(`/api/workspaces/${wsId}/snapshots`)).status).toBe(401);
  });
});

describe('WebSocket', () => {
  it('enlace caducado → 4401; cookie desde otro origen → 4403; cookie del mismo origen → entra', async () => {
    const expired = (await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer', expiresAt: new Date(Date.now() - 1000).toISOString() })).body.token;
    expect(await wsClose(`${s.wsUrl}/${wsId}?token=${expired}`)).toBe(4401);
    const ok = (await owner.api.post(`/api/workspaces/${wsId}/links`, { role: 'viewer' })).body.token;
    const login = await fetch(`${s.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.com', password: 'contraseña-larga' }) });
    const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
    expect(await wsClose(`${s.wsUrl}/${wsId}`, { cookie, origin: 'https://evil.example' })).toBe(4403);
    // Con cookie y origen propio (o con token de enlace desde cualquier origen) el servidor acepta: lo cerramos nosotros
    const open = (url: string, headers: Record<string, string>) => new Promise<boolean>(r => { const w = new WebSocket(url, { headers }); w.on('open', () => { w.close(); r(true); }); w.on('close', () => r(false)); w.on('error', () => r(false)); });
    expect(await open(`${s.wsUrl}/${wsId}`, { cookie, origin: new URL(s.url).origin })).toBe(true);
    expect(await open(`${s.wsUrl}/${wsId}?token=${ok}`, { origin: 'https://evil.example' })).toBe(true);
  });
});
