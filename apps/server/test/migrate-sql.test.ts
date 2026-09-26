/** Generador SQL de `apps/worker/scripts/migrate-sql.mjs` sobre una SQLite temporal; el SQL se aplica a otra BD vacía. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';
import { MIGRATIONS, SqliteWorkspaceStore } from '../src/store/sqlite';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore módulo JS sin tipos
import { RESET_PREFIX, generateMigrationSql, sqlLiteral } from '../../worker/scripts/migrate-sql.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'alldraw-migrate-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('migrate-sql', () => {
  it('escapa literales', () => {
    expect(sqlLiteral(null)).toBe('NULL');
    expect(sqlLiteral("O'Brien")).toBe("'O''Brien'");
    expect(sqlLiteral(1)).toBe('1');
    expect(sqlLiteral(true)).toBe('1');
  });

  it('genera INSERTs aplicables en una D1/SQLite vacía y marca los scrypt$', async () => {
    const src = new SqliteWorkspaceStore(path.join(tmp, 'src.sqlite'));
    const ana = await src.createUser({ email: 'ana@x.io', name: "Ana O'Neil", passwordHash: 'pbkdf2$100000$aa$bb', isAdmin: true });
    const bob = await src.createUser({ email: 'bob@x.io', name: 'Bob', passwordHash: 'scrypt$sal$hash' });
    const ws = await src.createWorkspace({ ownerId: ana.id, name: 'Proyecto "X"' });
    await src.setRole(ws.id, bob.id, 'editor');
    await src.createShareLink({ workspaceId: ws.id, role: 'viewer', createdBy: ana.id, token: 'lnk_abc', expiresAt: null });
    await src.createApiKey({ userId: ana.id, name: 'agente', prefix: 'adk_1234', keyHash: 'h1' });
    await src.createSession(ana.id, 'sess', new Date(Date.now() + 1000).toISOString());
    await src.saveDoc(ws.id, new Uint8Array([1, 2, 3]));

    const gen = generateMigrationSql(src.db);
    expect(gen.stats).toEqual({ users: 2, workspaces: 1, members: 1, links: 1, apiKeys: 1, needsReset: 1 });
    expect(gen.needsReset).toEqual([{ id: bob.id, email: 'bob@x.io' }]);
    expect(gen.workspaces).toEqual([{ id: ws.id, name: 'Proyecto "X"', ownerId: ana.id }]);
    expect(gen.sql).not.toMatch(/INSERT OR IGNORE INTO (sessions|docs|doc_updates)/);
    expect(gen.sql).not.toMatch(/^BEGIN/m);

    // Se aplica sobre el esquema de D1 (mismo SQL que MIGRATIONS[0]) y se puede repetir sin duplicar.
    const dst = new DatabaseSync(path.join(tmp, 'dst.sqlite'));
    dst.exec(MIGRATIONS[0]!);
    dst.exec(gen.sql);
    dst.exec(gen.sql);
    const users = dst.prepare('SELECT * FROM users ORDER BY email').all() as Record<string, unknown>[];
    expect(users.map(u => [u.email, u.name, u.password_hash, u.is_admin])).toEqual([
      ['ana@x.io', "Ana O'Neil", 'pbkdf2$100000$aa$bb', 1],
      ['bob@x.io', 'Bob', `${RESET_PREFIX}scrypt$sal$hash`, 0],
    ]);
    expect((dst.prepare('SELECT name FROM workspaces').get() as { name: string }).name).toBe('Proyecto "X"');
    expect(dst.prepare('SELECT * FROM workspace_members').all()).toMatchObject([{ workspace_id: ws.id, user_id: bob.id, role: 'editor' }]);
    expect(dst.prepare('SELECT * FROM share_links').all()).toMatchObject([{ token: 'lnk_abc', role: 'viewer', expires_at: null }]);
    expect(dst.prepare('SELECT * FROM api_keys').all()).toMatchObject([{ user_id: ana.id, prefix: 'adk_1234', key_hash: 'h1', last_used_at: null }]);
    expect((dst.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }).n).toBe(0);
    dst.close();
    await src.close();
  });
});
