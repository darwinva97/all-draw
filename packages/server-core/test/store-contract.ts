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
      await s.touchSession('th', new Date(Date.now() + 99_000).toISOString());
      expect(Date.parse((await s.getSession('th'))!.expiresAt)).toBeGreaterThan(Date.now() + 50_000);
      await s.deleteSession('th');
      expect(await s.getSession('th')).toBeNull();
      // Varias sesiones: cerrar todas menos una; purgar caducadas
      await s.createSession(u.id, 's1', new Date(Date.now() + 10_000).toISOString());
      await s.createSession(u.id, 's2', new Date(Date.now() + 10_000).toISOString());
      await s.createSession(u.id, 's3', new Date(Date.now() - 10_000).toISOString());
      expect(await s.purgeExpiredSessions()).toBe(1);
      await s.deleteUserSessions(u.id, 's2');
      expect(await s.getSession('s1')).toBeNull();
      expect((await s.getSession('s2'))?.userId).toBe(u.id);
      await s.deleteUserSessions(u.id);
      expect(await s.getSession('s2')).toBeNull();
      expect((await s.listUsers()).map(x => x.email)).toEqual(['a@x.io']);
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

      // Instantáneas: orden, datos, poda de las no etiquetadas más antiguas
      const data = (n: number) => new Uint8Array([n, n, n]);
      const s1 = await s.createSnapshot({ workspaceId: w.id, authorId: a.id, label: null, data: data(1) });
      await new Promise(r => setTimeout(r, 5));
      const s2 = await s.createSnapshot({ workspaceId: w.id, authorId: null, label: 'hito', data: data(2) });
      await new Promise(r => setTimeout(r, 5));
      const s3 = await s.createSnapshot({ workspaceId: w.id, authorId: a.id, label: null, data: new Uint8Array([3, 3, 3, 3]) });
      expect(s3.size).toBe(4);
      expect((await s.listSnapshots(w.id)).map(x => x.id)).toEqual([s3.id, s2.id, s1.id]);
      expect((await s.listSnapshots(w.id))[1]).toMatchObject({ label: 'hito', authorId: null, size: 3 });
      expect([...(await s.getSnapshot(w.id, s2.id))!.data]).toEqual([2, 2, 2]);
      expect(await s.getSnapshot('ws_otro', s2.id)).toBeNull();
      expect(await s.pruneSnapshots(w.id, 3)).toBe(0);
      expect(await s.pruneSnapshots(w.id, 1)).toBe(2); // s1 y s3 (sin etiqueta); 'hito' se queda aunque sea la más antigua
      expect((await s.listSnapshots(w.id)).map(x => x.id)).toEqual([s2.id]);
      expect(await s.deleteSnapshot('ws_otro', s2.id)).toBe(false);
      expect(await s.deleteSnapshot(w.id, s2.id)).toBe(true);
      expect(await s.listSnapshots(w.id)).toEqual([]);
      await s.createSnapshot({ workspaceId: w.id, authorId: null, label: null, data: data(9) });

      await s.deleteWorkspace(w.id);
      expect(await s.getWorkspace(w.id)).toBeNull();
      expect(await s.loadDoc(w.id)).toBeNull();
      expect(await s.listShareLinks(w.id)).toEqual([]);
      expect(await s.listSnapshots(w.id)).toEqual([]);
      await s.close();
    });

    it('cuentas: updateUser, deleteUser y countOwnedWorkspaces', async () => {
      const s = await factory();
      const a = await s.createUser({ email: 'a@x.io', name: 'A', passwordHash: 'h' });
      const b = await s.createUser({ email: 'b@x.io', name: 'B', passwordHash: 'h' });
      expect(await s.updateUser('usr_nope', { name: 'x' })).toBeNull();
      expect(await s.updateUser(a.id, { name: 'Ana', email: ' NUEVA@X.io ' })).toMatchObject({ id: a.id, name: 'Ana', email: 'nueva@x.io', isAdmin: false });
      expect(await s.getUserByEmail('a@x.io')).toBeNull();
      expect((await s.getUserByEmail('nueva@x.io'))?.name).toBe('Ana');
      await expect(s.updateUser(a.id, { email: 'b@x.io' })).rejects.toThrow(/email ya registrado/);
      expect((await s.updateUser(a.id, { isAdmin: true }))?.isAdmin).toBe(true);
      expect((await s.getUser(a.id))?.isAdmin).toBe(true);

      const wa = await s.createWorkspace({ ownerId: a.id, name: 'de A' });
      await s.createWorkspace({ ownerId: a.id, name: 'otro de A' });
      const wb = await s.createWorkspace({ ownerId: b.id, name: 'de B' });
      expect(await s.countOwnedWorkspaces(a.id)).toBe(2);
      expect(await s.countOwnedWorkspaces(b.id)).toBe(1);
      expect(await s.countOwnedWorkspaces('usr_nope')).toBe(0);

      // b es editor en un espacio de a, tiene sesión, clave e instantánea firmada
      await s.setRole(wa.id, b.id, 'editor');
      await s.createSession(b.id, 'sb', new Date(Date.now() + 60_000).toISOString());
      await s.createApiKey({ userId: b.id, name: 'k', prefix: 'adk_b', keyHash: 'kb' });
      const snap = await s.createSnapshot({ workspaceId: wa.id, authorId: b.id, label: 'de b', data: new Uint8Array([1]) });
      await s.setRole(wb.id, b.id, null);
      await s.deleteWorkspace(wb.id); // el llamador borra o transfiere los espacios propios antes
      await s.deleteUser(b.id);
      expect(await s.getUser(b.id)).toBeNull();
      expect(await s.getSession('sb')).toBeNull();
      expect(await s.resolveApiKey('kb')).toBeNull();
      expect(await s.getRole(wa.id, b.id)).toBeNull();
      expect(await s.listMembers(wa.id)).toEqual([]);
      expect((await s.listSnapshots(wa.id)).find(x => x.id === snap.id)?.authorId).toBeNull();
      expect(await s.countUsers()).toBe(1);
      expect((await s.getWorkspace(wa.id))?.ownerId).toBe(a.id);
      await s.close();
    });
  });
}
