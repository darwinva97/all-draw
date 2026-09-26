/**
 * Batería de contrato de `WorkspaceStore`: la misma para cada adaptador (memoria, SQLite, Postgres,
 * D1). `factory` devuelve un store **vacío** (cada test crea el suyo y lo cierra).
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { WorkspaceStore } from '../src/store/types';

export function storeContractTests(name: string, factory: () => WorkspaceStore | Promise<WorkspaceStore>) {
  describe(`WorkspaceStore ${name}`, () => {
    it('usuarios, sesiones, api keys', async () => {
      const s = await factory();
      const u = await s.createUser({ email: 'A@X.io', name: 'A', passwordHash: 'h', isAdmin: true });
      expect(u.email).toBe('a@x.io');
      expect(await s.getUserByEmail('a@x.io')).toEqual(u);
      expect(await s.getUser('usr_nope')).toBeNull();
      await expect(s.createUser({ email: 'a@x.io', name: 'B', passwordHash: 'h' })).rejects.toThrow();
      expect(await s.countUsers()).toBe(1);
      await s.setPasswordHash(u.id, 'h2');
      expect((await s.getUser(u.id))?.passwordHash).toBe('h2');
      await s.createSession(u.id, 'th', new Date(Date.now() + 10_000).toISOString());
      expect((await s.getSession('th'))?.userId).toBe(u.id);
      await s.createSession(u.id, 'old', new Date(Date.now() - 10_000).toISOString());
      expect(await s.getSession('old')).toBeNull();
      await s.deleteSession('th');
      expect(await s.getSession('th')).toBeNull();
      const k = await s.createApiKey({ userId: u.id, name: 'k', prefix: 'adk_12', keyHash: 'kh' });
      expect((await s.resolveApiKey('kh'))?.id).toBe(k.id);
      expect(await s.resolveApiKey('nope')).toBeNull();
      await s.touchApiKey(k.id);
      expect((await s.listApiKeys(u.id))[0]?.lastUsedAt).toBeTruthy();
      expect(await s.deleteApiKey('otro', k.id)).toBe(false);
      expect(await s.deleteApiKey(u.id, k.id)).toBe(true);
      expect(await s.listApiKeys(u.id)).toEqual([]);
      await s.close();
    });

    it('espacios, roles, miembros, enlaces, docs', async () => {
      const s = await factory();
      const a = await s.createUser({ email: 'a@x.io', name: 'A', passwordHash: 'h' });
      const b = await s.createUser({ email: 'b@x.io', name: 'B', passwordHash: 'h' });
      const w = await s.createWorkspace({ ownerId: a.id, name: 'W' });
      expect(await s.getRole(w.id, a.id)).toBe('owner');
      expect(await s.getRole(w.id, b.id)).toBeNull();
      expect(await s.getRole('ws_nope', a.id)).toBeNull();
      await s.setRole(w.id, b.id, 'viewer');
      expect(await s.getRole(w.id, b.id)).toBe('viewer');
      await s.setRole(w.id, b.id, 'editor');
      expect((await s.listWorkspaces(b.id))[0]).toMatchObject({ id: w.id, role: 'editor' });
      expect((await s.listWorkspaces(a.id))[0]).toMatchObject({ id: w.id, role: 'owner' });
      expect((await s.listAllWorkspaces()).map(x => x.id)).toEqual([w.id]);
      expect((await s.listMembers(w.id))[0]).toMatchObject({ userId: b.id, role: 'editor', user: { email: 'b@x.io' } });
      await s.setRole(w.id, b.id, null);
      expect(await s.listMembers(w.id)).toEqual([]);
      expect(await s.listWorkspaces(b.id)).toEqual([]);
      expect((await s.updateMeta(w.id, { name: 'W2' }))?.name).toBe('W2');
      expect((await s.getWorkspace(w.id))?.name).toBe('W2');
      expect((await s.updateMeta(w.id, { ownerId: b.id }))?.ownerId).toBe(b.id);
      expect(await s.getRole(w.id, b.id)).toBe('owner');
      expect(await s.updateMeta('ws_nope', { name: 'x' })).toBeNull();

      const l = await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'lnk_1' });
      expect(await s.resolveShareLink('lnk_1')).toEqual(l);
      await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'lnk_old', expiresAt: new Date(Date.now() - 1000).toISOString() });
      expect(await s.resolveShareLink('lnk_old')).toBeNull();
      expect((await s.listShareLinks(w.id)).length).toBe(2);
      expect(await s.deleteShareLink('ws_otro', 'lnk_1')).toBe(false);
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
      // saveDoc reemplaza el estado y vacía la cola
      const d2 = new Y.Doc(); d2.getMap('meta').set('name', 'dos');
      await s.saveDoc(w.id, Y.encodeStateAsUpdate(d2));
      const again = new Y.Doc(); Y.applyUpdate(again, (await s.loadDoc(w.id))!);
      expect(again.getMap('meta').get('name')).toBe('dos');
      expect(again.getMap('meta').get('x')).toBeUndefined();

      await s.deleteWorkspace(w.id);
      expect(await s.getWorkspace(w.id)).toBeNull();
      expect(await s.loadDoc(w.id)).toBeNull();
      expect(await s.listShareLinks(w.id)).toEqual([]);
      await s.close();
    });
  });
}
