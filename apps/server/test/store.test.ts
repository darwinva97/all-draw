import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { SqliteWorkspaceStore } from '../src/store/sqlite';
import type { WorkspaceStore } from '../src/store/types';

const adapters: [string, () => WorkspaceStore][] = [
  ['memory', () => new MemoryWorkspaceStore()],
  ['sqlite', () => new SqliteWorkspaceStore(':memory:')],
];

describe.each(adapters)('WorkspaceStore %s', (_name, make) => {
  it('usuarios, sesiones, api keys', async () => {
    const s = make();
    const u = await s.createUser({ email: 'A@X.io', name: 'A', passwordHash: 'h', isAdmin: true });
    expect(u.email).toBe('a@x.io');
    expect(await s.getUserByEmail('a@x.io')).toEqual(u);
    await expect(s.createUser({ email: 'a@x.io', name: 'B', passwordHash: 'h' })).rejects.toThrow();
    expect(await s.countUsers()).toBe(1);
    await s.createSession(u.id, 'th', new Date(Date.now() + 10_000).toISOString());
    expect((await s.getSession('th'))?.userId).toBe(u.id);
    await s.createSession(u.id, 'old', new Date(Date.now() - 10_000).toISOString());
    expect(await s.getSession('old')).toBeNull();
    await s.deleteSession('th');
    expect(await s.getSession('th')).toBeNull();
    const k = await s.createApiKey({ userId: u.id, name: 'k', prefix: 'adk_12', keyHash: 'kh' });
    expect((await s.resolveApiKey('kh'))?.id).toBe(k.id);
    await s.touchApiKey(k.id);
    expect((await s.listApiKeys(u.id))[0]?.lastUsedAt).toBeTruthy();
    expect(await s.deleteApiKey('otro', k.id)).toBe(false);
    expect(await s.deleteApiKey(u.id, k.id)).toBe(true);
    await s.close();
  });

  it('espacios, roles, miembros, enlaces, docs', async () => {
    const s = make();
    const a = await s.createUser({ email: 'a@x.io', name: 'A', passwordHash: 'h' });
    const b = await s.createUser({ email: 'b@x.io', name: 'B', passwordHash: 'h' });
    const w = await s.createWorkspace({ ownerId: a.id, name: 'W' });
    expect(await s.getRole(w.id, a.id)).toBe('owner');
    expect(await s.getRole(w.id, b.id)).toBeNull();
    await s.setRole(w.id, b.id, 'viewer');
    expect(await s.getRole(w.id, b.id)).toBe('viewer');
    await s.setRole(w.id, b.id, 'editor');
    expect((await s.listWorkspaces(b.id))[0]).toMatchObject({ id: w.id, role: 'editor' });
    expect((await s.listMembers(w.id))[0]).toMatchObject({ userId: b.id, role: 'editor', user: { email: 'b@x.io' } });
    await s.setRole(w.id, b.id, null);
    expect(await s.listMembers(w.id)).toEqual([]);
    expect((await s.updateMeta(w.id, { name: 'W2' }))?.name).toBe('W2');
    expect((await s.getWorkspace(w.id))?.name).toBe('W2');

    const l = await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'lnk_1' });
    expect(await s.resolveShareLink('lnk_1')).toEqual(l);
    await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'lnk_old', expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(await s.resolveShareLink('lnk_old')).toBeNull();
    expect((await s.listShareLinks(w.id)).length).toBe(2);
    expect(await s.deleteShareLink(w.id, 'lnk_1')).toBe(true);

    expect(await s.loadDoc(w.id)).toBeNull();
    const d = new Y.Doc(); d.getMap('meta').set('name', 'uno');
    await s.saveDoc(w.id, Y.encodeStateAsUpdate(d));
    const sv = d.getMap('meta').size; d.getMap('meta').set('x', 1);
    await s.appendUpdate(w.id, Y.encodeStateAsUpdate(d));
    const merged = new Y.Doc(); Y.applyUpdate(merged, (await s.loadDoc(w.id))!);
    expect(merged.getMap('meta').get('name')).toBe('uno');
    expect(merged.getMap('meta').get('x')).toBe(1);
    expect(sv).toBe(1);

    await s.deleteWorkspace(w.id);
    expect(await s.getWorkspace(w.id)).toBeNull();
    expect(await s.loadDoc(w.id)).toBeNull();
    expect(await s.listShareLinks(w.id)).toEqual([]);
    await s.close();
  });
});
