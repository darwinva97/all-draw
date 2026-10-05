/**
 * Batería de contrato de `WorkspaceStore`: la misma para cada adaptador (memoria, SQLite, Postgres,
 * D1). `factory` devuelve un store **vacío** (cada test crea el suyo y lo cierra).
 */
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { MAX_NOTIFICATIONS_PER_USER, MAX_WEBHOOK_DELIVERIES, type WebhookDelivery, type WorkspaceStore } from '../src/store/types';

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
    it('cuentas v4: verificación, idioma, preferencias y sesiones activas', async () => {
      const s = await factory();
      const u = await s.createUser({ email: 'v@x.io', name: 'V', passwordHash: 'h', locale: 'en' });
      expect(u).toMatchObject({ emailVerifiedAt: null, locale: 'en', notifyEmail: true });
      expect(await s.getUser(u.id)).toMatchObject({ emailVerifiedAt: null, locale: 'en', notifyEmail: true });
      const at = new Date().toISOString();
      expect(await s.updateUser(u.id, { emailVerifiedAt: at, locale: 'es', notifyEmail: false })).toMatchObject({ emailVerifiedAt: at, locale: 'es', notifyEmail: false });
      expect(await s.getUserByEmail('v@x.io')).toMatchObject({ emailVerifiedAt: at, locale: 'es', notifyEmail: false });
      expect((await s.updateUser(u.id, { name: 'V2' }))).toMatchObject({ name: 'V2', emailVerifiedAt: at, notifyEmail: false });
      expect((await s.updateUser(u.id, { emailVerifiedAt: null }))?.emailVerifiedAt).toBeNull();

      const later = new Date(Date.now() + 60_000).toISOString();
      await s.createSession(u.id, 'sa', later, { device: 'Firefox;Linux;desktop', ip: '203.0.113.0' });
      await new Promise(r => setTimeout(r, 5));
      await s.createSession(u.id, 'sb', later);
      await s.createSession(u.id, 'sc', new Date(Date.now() - 1000).toISOString());
      const other = await s.createUser({ email: 'o@x.io', name: 'O', passwordHash: 'h' });
      await s.createSession(other.id, 'so', later);
      let list = await s.listUserSessions(u.id);
      expect(list.map(x => x.tokenHash)).toEqual(['sb', 'sa']);
      expect(list[1]).toMatchObject({ device: 'Firefox;Linux;desktop', ip: '203.0.113.0' });
      expect(list[1]!.lastUsedAt).toBeTruthy();
      const used = new Date(Date.now() + 5000).toISOString();
      await s.markSessionUsed('sa', used, '198.51.100.0');
      await s.markSessionUsed('sb', new Date(Date.now() + 1000).toISOString(), null);
      list = await s.listUserSessions(u.id);
      expect(list.map(x => x.tokenHash)).toEqual(['sa', 'sb']);
      expect(list[0]).toMatchObject({ lastUsedAt: used, ip: '198.51.100.0' });
      expect((await s.getSession('sa'))?.device).toBe('Firefox;Linux;desktop');
      await s.close();
    });

    it('tokens de correo: un solo uso, por tipo, caducidad y borrado', async () => {
      const s = await factory();
      const u = await s.createUser({ email: 't@x.io', name: 'T', passwordHash: 'h' });
      const soon = new Date(Date.now() + 60_000).toISOString();
      const tok = await s.createAccountToken({ tokenHash: 'r1', userId: u.id, kind: 'reset', email: 'T@x.io', expiresAt: soon });
      expect(tok).toMatchObject({ email: 't@x.io', kind: 'reset' });
      expect(await s.consumeAccountToken('r1', 'verify')).toBeNull(); // otro tipo: no se gasta
      expect(await s.consumeAccountToken('r1', 'reset')).toMatchObject({ userId: u.id, email: 't@x.io', kind: 'reset' });
      expect(await s.consumeAccountToken('r1', 'reset')).toBeNull(); // un solo uso
      await s.createAccountToken({ tokenHash: 'old', userId: u.id, kind: 'verify', email: 't@x.io', expiresAt: new Date(Date.now() - 1000).toISOString() });
      expect(await s.consumeAccountToken('old', 'verify')).toBeNull();
      await s.createAccountToken({ tokenHash: 'v1', userId: u.id, kind: 'verify', email: 'nuevo@x.io', expiresAt: soon });
      await s.createAccountToken({ tokenHash: 'r2', userId: u.id, kind: 'reset', email: 't@x.io', expiresAt: soon });
      await s.deleteAccountTokens(u.id, 'reset');
      expect(await s.consumeAccountToken('r2', 'reset')).toBeNull();
      expect((await s.consumeAccountToken('v1', 'verify'))?.email).toBe('nuevo@x.io');
      await s.createAccountToken({ tokenHash: 'v2', userId: u.id, kind: 'verify', email: 't@x.io', expiresAt: soon });
      await s.createAccountToken({ tokenHash: 'gone', userId: u.id, kind: 'reset', email: 't@x.io', expiresAt: new Date(Date.now() - 1000).toISOString() });
      await s.purgeExpiredSessions();
      await s.deleteAccountTokens(u.id);
      expect(await s.consumeAccountToken('v2', 'verify')).toBeNull();
      // Borrar la cuenta borra sus tokens
      await s.createAccountToken({ tokenHash: 'v3', userId: u.id, kind: 'verify', email: 't@x.io', expiresAt: soon });
      await s.deleteUser(u.id);
      expect(await s.consumeAccountToken('v3', 'verify')).toBeNull();
      await s.close();
    });

    it('notificaciones: crear (idempotente con id), listar, contar, marcar leídas y borrar en cascada', async () => {
      const s = await factory();
      const a = await s.createUser({ email: 'na@x.io', name: 'A', passwordHash: 'h' });
      const b = await s.createUser({ email: 'nb@x.io', name: 'B', passwordHash: 'h' });
      const w = await s.createWorkspace({ ownerId: a.id, name: 'W' });
      const n1 = await s.createNotification({ id: 'ntf_fijo', userId: b.id, kind: 'mention', workspaceId: w.id, payload: { excerpt: 'hola «@B»', n: 1 } });
      expect(n1).toMatchObject({ id: 'ntf_fijo', userId: b.id, kind: 'mention', workspaceId: w.id, payload: { excerpt: 'hola «@B»', n: 1 }, readAt: null });
      expect(await s.createNotification({ id: 'ntf_fijo', userId: b.id, kind: 'mention', workspaceId: w.id, payload: {} })).toBeNull();
      await new Promise(r => setTimeout(r, 5));
      const n2 = await s.createNotification({ userId: b.id, kind: 'shared', workspaceId: w.id, payload: { role: 'editor' } });
      await s.createNotification({ userId: a.id, kind: 'role', workspaceId: null, payload: {} });
      expect((await s.listNotifications(b.id, 10)).map(n => n.id)).toEqual([n2!.id, 'ntf_fijo']);
      expect(await s.listNotifications(b.id, 1)).toHaveLength(1);
      expect(await s.countUnreadNotifications(b.id)).toBe(2);
      expect(await s.markNotificationsRead(b.id, ['ntf_fijo', 'ajena'])).toBe(1);
      expect(await s.markNotificationsRead(a.id, [n2!.id])).toBe(0); // de otro usuario: no
      expect(await s.countUnreadNotifications(b.id)).toBe(1);
      expect((await s.listNotifications(b.id, 10)).find(n => n.id === 'ntf_fijo')?.readAt).toBeTruthy();
      expect(await s.markNotificationsRead(b.id, [])).toBe(0);
      expect(await s.markNotificationsRead(b.id)).toBe(1);
      expect(await s.countUnreadNotifications(b.id)).toBe(0);
      // Borrar el espacio borra sus notificaciones; borrar la cuenta, las suyas
      await s.deleteWorkspace(w.id);
      expect(await s.listNotifications(b.id, 10)).toEqual([]);
      expect(await s.listNotifications(a.id, 10)).toHaveLength(1);
      await s.deleteUser(a.id);
      expect(await s.countUnreadNotifications(a.id)).toBe(0);
      await s.close();
    });

    it('notificaciones: poda a las más recientes', async () => {
      const s = await factory();
      const u = await s.createUser({ email: 'p@x.io', name: 'P', passwordHash: 'h' });
      for (let i = 0; i < MAX_NOTIFICATIONS_PER_USER + 3; i++) await s.createNotification({ id: `ntf_${String(i).padStart(4, '0')}`, userId: u.id, kind: 'role', workspaceId: null, payload: { i } });
      const list = await s.listNotifications(u.id, 1000);
      expect(list).toHaveLength(MAX_NOTIFICATIONS_PER_USER);
      expect(list.some(n => n.id === 'ntf_0000')).toBe(false);
      expect(list.some(n => n.id === `ntf_${String(MAX_NOTIFICATIONS_PER_USER + 2).padStart(4, '0')}`)).toBe(true);
      await s.close();
    });

    it('enlaces de inserción (con vista) y webhooks', async () => {
      const s = await factory();
      const a = await s.createUser({ email: 'w@x.io', name: 'W', passwordHash: 'h' });
      const w = await s.createWorkspace({ ownerId: a.id, name: 'W' });
      const w2 = await s.createWorkspace({ ownerId: a.id, name: 'W2' });
      // Enlaces: `viewId` se guarda y vuelve; los normales, `null`
      const e = await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'emb_1', viewId: 'v1' });
      expect(e.viewId).toBe('v1');
      expect((await s.resolveShareLink('emb_1'))?.viewId).toBe('v1');
      const n = await s.createShareLink({ workspaceId: w.id, role: 'viewer', createdBy: a.id, token: 'lnk_n' });
      expect(n.viewId ?? null).toBeNull();
      expect((await s.resolveShareLink('lnk_n'))?.viewId ?? null).toBeNull();
      expect((await s.listShareLinks(w.id)).map(l => [l.token, l.viewId ?? null]).sort()).toEqual([['emb_1', 'v1'], ['lnk_n', null]]);

      const h = await s.createWebhook({ workspaceId: w.id, url: 'https://example.com/h', events: ['comment.created', 'member.added'], format: 'json', lang: 'en', secret: 'whsec_abc', createdBy: a.id });
      expect(h).toMatchObject({ workspaceId: w.id, url: 'https://example.com/h', events: ['comment.created', 'member.added'], format: 'json', lang: 'en', secret: 'whsec_abc', createdBy: a.id, deliveries: [] });
      expect(h.id).toMatch(/^whk_/);
      expect(await s.getWebhook(w.id, h.id)).toEqual(h);
      expect(await s.getWebhook(w2.id, h.id)).toBeNull();
      const h2 = await s.createWebhook({ workspaceId: w.id, url: 'https://hooks.slack.com/services/x', events: ['workspace.changed'], format: 'slack', lang: 'es', secret: 'whsec_def', createdBy: a.id });
      await s.createWebhook({ workspaceId: w2.id, url: 'https://example.com/otro', events: ['snapshot.created'], format: 'json', lang: 'es', secret: 'whsec_ghi', createdBy: a.id });
      expect((await s.listWebhooks(w.id)).map(x => x.id).sort()).toEqual([h.id, h2.id].sort());
      // Registro de entregas: la más reciente primero, sustituye por id y se queda en las 20 últimas
      const d = (i: number, extra: Partial<WebhookDelivery> = {}): WebhookDelivery => ({ id: `dlv_${i}`, event: 'comment.created', at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), status: 500, ok: false, ms: i, attempts: 1, pending: true, error: 'HTTP 500', ...extra });
      for (let i = 0; i < MAX_WEBHOOK_DELIVERIES + 4; i++) await s.recordWebhookDelivery(w.id, h.id, d(i));
      let got = (await s.getWebhook(w.id, h.id))!.deliveries;
      expect(got).toHaveLength(MAX_WEBHOOK_DELIVERIES);
      expect(got[0]!.id).toBe(`dlv_${MAX_WEBHOOK_DELIVERIES + 3}`);
      expect(got.some(x => x.id === 'dlv_0')).toBe(false);
      await s.recordWebhookDelivery(w.id, h.id, d(10, { status: 200, ok: true, attempts: 2, pending: false, error: null }));
      got = (await s.getWebhook(w.id, h.id))!.deliveries;
      expect(got[0]).toMatchObject({ id: 'dlv_10', status: 200, ok: true, attempts: 2, pending: false, error: null });
      expect(got.filter(x => x.id === 'dlv_10')).toHaveLength(1);
      expect(got).toHaveLength(MAX_WEBHOOK_DELIVERIES);
      await s.recordWebhookDelivery(w2.id, h.id, d(99)); // de otro espacio: no hace nada
      await s.recordWebhookDelivery(w.id, 'whk_nope', d(98));
      expect((await s.getWebhook(w.id, h.id))!.deliveries.some(x => x.id === 'dlv_99')).toBe(false);
      expect((await s.getWebhook(w.id, h2.id))!.deliveries).toEqual([]);
      // Borrar
      expect(await s.deleteWebhook(w2.id, h.id)).toBe(false);
      expect(await s.deleteWebhook(w.id, h.id)).toBe(true);
      expect(await s.deleteWebhook(w.id, h.id)).toBe(false);
      expect((await s.listWebhooks(w.id)).map(x => x.id)).toEqual([h2.id]);
      // Borrar el espacio borra sus webhooks (y sus enlaces de inserción)
      await s.deleteWorkspace(w.id);
      expect(await s.listWebhooks(w.id)).toEqual([]);
      expect(await s.getWebhook(w.id, h2.id)).toBeNull();
      expect(await s.resolveShareLink('emb_1')).toBeNull();
      expect(await s.listWebhooks(w2.id)).toHaveLength(1);
      await s.close();
    });
  });
}
