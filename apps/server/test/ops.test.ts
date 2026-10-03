/** Operaciones: mantenimiento semanal de la SQLite (compactación de `doc_updates`, VACUUM…) y simulacro de restauración de la última copia. */
import { afterAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import * as Y from 'yjs';
import { exampleWorkspace } from '@all-draw/core';
import { compactDocUpdates, runMaintenance } from '../src/maintenance';
import { SqliteWorkspaceStore } from '../src/store/sqlite';
import { register, startServer } from './helpers';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-ops-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const run = (script: string, env: Record<string, string>, args: string[] = []) => new Promise<{ code: number; out: string }>(resolve => {
  execFile(process.execPath, [script, ...args], { cwd: serverDir, env: { PATH: process.env.PATH!, HOME: tmp, ...env }, timeout: 90_000 }, (err, stdout, stderr) => {
    resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: `${stdout}${stderr}` });
  });
});

describe('mantenimiento de la SQLite', () => {
  it('compacta doc_updates en docs.state sin perder nada, purga sesiones y hace VACUUM', async () => {
    const dbPath = path.join(tmp, 'maint.sqlite');
    const store = new SqliteWorkspaceStore(dbPath);
    const u = await store.createUser({ email: 'a@x.io', name: 'A', passwordHash: 'h' });
    const w = await store.createWorkspace({ ownerId: u.id, name: 'W' });
    const d = new Y.Doc();
    d.getMap('meta').set('name', 'base');
    await store.saveDoc(w.id, Y.encodeStateAsUpdate(d));
    let sv = Y.encodeStateVector(d);
    for (const k of ['uno', 'dos', 'tres']) { d.getMap('meta').set(k, k); await store.appendUpdate(w.id, Y.encodeStateAsUpdate(d, sv)); sv = Y.encodeStateVector(d); }
    await store.createSession(u.id, 'vieja', new Date(Date.now() - 1000).toISOString());
    await store.close();

    const db = new DatabaseSync(dbPath);
    const r = runMaintenance(db, dbPath);
    expect(r).toMatchObject({ check: 'ok', compacted: { workspaces: 1, updates: 3 }, expiredSessions: 1, vacuum: true });
    expect((db.prepare('SELECT COUNT(*) AS n FROM doc_updates').get() as { n: number }).n).toBe(0);
    expect(compactDocUpdates(db)).toEqual({ workspaces: 0, updates: 0 });
    db.close();

    const again = new SqliteWorkspaceStore(dbPath);
    const merged = new Y.Doc(); Y.applyUpdate(merged, (await again.loadDoc(w.id))!);
    expect(merged.getMap('meta').toJSON()).toEqual({ name: 'base', uno: 'uno', dos: 'dos', tres: 'tres' });
    await again.close();
  });

  it('scripts/maintenance.mjs', async () => {
    const dbPath = path.join(tmp, 'maint-script.sqlite');
    await new SqliteWorkspaceStore(dbPath).close();
    const r = await run('scripts/maintenance.mjs', { DB_PATH: dbPath });
    expect(r.out).toMatch(/\[maintenance .*\] ok .*check ok/);
    expect(r.code).toBe(0);
  }, 60_000);
});

describe('simulacro de restauración', () => {
  it('backup.mjs → restore-drill.mjs: restaura la última copia en un DATA_DIR temporal, valida cada espacio y para', async () => {
    const dbPath = path.join(tmp, 'prod', 'alldraw.sqlite');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const s = await startServer({ store: new SqliteWorkspaceStore(dbPath) });
    const a = await register(s.url, 'ana@example.com');
    await a.api.post('/api/workspaces', { initial: exampleWorkspace() });
    await a.api.post('/api/workspaces', { name: 'vacío' });
    await s.close();

    const backupDir = path.join(tmp, 'backups');
    const b = await run('scripts/backup.mjs', { DB_PATH: dbPath, BACKUP_DIR: backupDir, KEEP_DAYS: '0' });
    expect(b.out).toMatch(/ok .*2 espacios \(0 con error\)/);
    expect(b.code).toBe(0);
    const before = fs.readFileSync(dbPath);

    const r = await run('scripts/restore-drill.mjs', { BACKUP_DIR: backupDir });
    expect(r.out).toMatch(/\[restore-drill .*\] ok .*2\/2 espacios validados \(manifiesto: 2\), 0 fallos/);
    expect(r.code).toBe(0);
    const last = JSON.parse(fs.readFileSync(path.join(backupDir, 'restore-drill.last.json'), 'utf8'));
    expect(last).toMatchObject({ ok: true, workspaces: 2, expected: 2, checked: 2, exitCode: 0, failures: [] });
    // La BD original no se toca (el admin técnico sólo existe en la copia temporal)
    expect(fs.readFileSync(dbPath).equals(before)).toBe(true);
    expect(fs.readdirSync(os.tmpdir()).some(n => n.startsWith('alldraw-drill-') && fs.existsSync(path.join(os.tmpdir(), n, 'alldraw.sqlite')) && fs.statSync(path.join(os.tmpdir(), n)).mtimeMs > Date.now() - 5000)).toBe(false);
  }, 120_000);

  it('sin copias → sale con 2', async () => {
    const r = await run('scripts/restore-drill.mjs', { BACKUP_DIR: path.join(tmp, 'no-existe') });
    expect(r.code).toBe(2);
  }, 30_000);
});
