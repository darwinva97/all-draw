/**
 * `WorkspaceStore` sobre SQL de SQLite, independiente del motor: todo el SQL vive aquí y cada backend
 * aporta un `SqlDriver` (`one`/`all`/`run`/`batch`). Mismo esquema que `apps/server/src/store/sqlite.ts`
 * (`migrations/*.sql` = `src/migrations.ts`). Backends:
 *
 *   - D1 (`d1Driver`, en `d1.ts`): migraciones con `wrangler d1 migrations apply`.
 *   - SQLite del Durable Object `RegistryDO` (`sqlStorageDriver`, en `do-sql.ts`): migraciones al arrancar el DO.
 *
 * Los BLOB van como `ArrayBuffer` y vuelven como `ArrayBuffer`/`Uint8Array`. Los documentos viven en el
 * Durable Object de cada espacio (`WorkspaceDO`), así que `loadDoc` / `saveDoc` / `appendUpdate` aquí sólo
 * se usan como copia de respaldo/exportación (el DO no las llama).
 */
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import { importRows, type ImportResult, type ImportRows } from './import';
import type { ApiKey, Member, MemberRole, Role, Session, ShareLink, Snapshot, SnapshotMeta, User, WorkspaceRow, WorkspaceStore } from '@all-draw/server-core';

const now = () => new Date().toISOString();
export type Row = Record<string, unknown>;
export interface SqlStatement { sql: string; params: unknown[] }
/** Lo mínimo que el store necesita de un motor SQLite. `run` y `batch` devuelven filas modificadas. */
export interface SqlDriver {
  one<T = Row>(sql: string, params: unknown[]): Promise<T | null>;
  all<T = Row>(sql: string, params: unknown[]): Promise<T[]>;
  run(sql: string, params: unknown[]): Promise<number>;
  /** Todas o ninguna (transacción). */
  batch(statements: SqlStatement[]): Promise<number[]>;
}
const bytes = (v: unknown): Uint8Array => v instanceof ArrayBuffer ? new Uint8Array(v) : v instanceof Uint8Array ? v : Uint8Array.from(v as number[]);
const blob = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer;

export class SqlWorkspaceStore implements WorkspaceStore {
  constructor(readonly driver: SqlDriver) {}

  private one<T = Row>(sql: string, ...params: unknown[]) { return this.driver.one<T>(sql, params); }
  private all<T = Row>(sql: string, ...params: unknown[]) { return this.driver.all<T>(sql, params); }
  private run(sql: string, ...params: unknown[]) { return this.driver.run(sql, params); }

  private user(r: Row | null): User | null {
    return r ? { id: r.id as string, email: r.email as string, name: r.name as string, passwordHash: r.password_hash as string, isAdmin: !!r.is_admin, createdAt: r.created_at as string } : null;
  }
  private workspace(r: Row | null): WorkspaceRow | null {
    return r ? { id: r.id as string, ownerId: r.owner_id as string, name: r.name as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string } : null;
  }
  private apiKey(r: Row | null): ApiKey | null {
    return r ? { id: r.id as string, userId: r.user_id as string, name: r.name as string, prefix: r.prefix as string, keyHash: r.key_hash as string, createdAt: r.created_at as string, lastUsedAt: (r.last_used_at as string | null) ?? null } : null;
  }
  private link(r: Row | null): ShareLink | null {
    return r ? { token: r.token as string, workspaceId: r.workspace_id as string, role: r.role as MemberRole, createdBy: r.created_by as string, createdAt: r.created_at as string, expiresAt: (r.expires_at as string | null) ?? null } : null;
  }
  private snapshotMeta(r: Row): SnapshotMeta {
    return { id: r.id as string, workspaceId: r.workspace_id as string, createdAt: r.created_at as string, authorId: (r.author_id as string | null) ?? null, label: (r.label as string | null) ?? null, size: Number(r.size) };
  }

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string }): Promise<User> {
    const user: User = { id: u.id ?? newId('usr'), email: u.email.trim().toLowerCase(), name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now() };
    try {
      await this.run('INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, user.email, user.name, user.passwordHash, user.isAdmin ? 1 : 0, user.createdAt);
    } catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return user;
  }
  async getUser(id: string) { return this.user(await this.one('SELECT * FROM users WHERE id = ?', id)); }
  async getUserByEmail(email: string) { return this.user(await this.one('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase())); }
  async countUsers() { return Number((await this.one<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n); }
  async listUsers() { return (await this.all('SELECT * FROM users ORDER BY created_at')).map(r => this.user(r)!); }
  async setPasswordHash(userId: string, passwordHash: string) { await this.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId); }
  async updateUser(id: string, patch: { name?: string; email?: string; isAdmin?: boolean }) {
    const u = await this.getUser(id); if (!u) return null;
    const next = { ...u, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}), ...(patch.isAdmin !== undefined ? { isAdmin: patch.isAdmin } : {}) };
    try { await this.run('UPDATE users SET name = ?, email = ?, is_admin = ? WHERE id = ?', next.name, next.email, next.isAdmin ? 1 : 0, id); }
    catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return next;
  }
  async deleteUser(id: string) {
    await this.driver.batch([
      { sql: 'DELETE FROM sessions WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM api_keys WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM workspace_members WHERE user_id = ?', params: [id] },
      { sql: 'UPDATE snapshots SET author_id = NULL WHERE author_id = ?', params: [id] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [id] },
    ]);
  }

  async createSession(userId: string, tokenHash: string, expiresAt: string): Promise<Session> {
    const s: Session = { tokenHash, userId, createdAt: now(), expiresAt };
    await this.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', tokenHash, userId, s.createdAt, expiresAt);
    return s;
  }
  async getSession(tokenHash: string) {
    const r = await this.one('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
    if (!r) return null;
    if ((r.expires_at as string) < now()) { await this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); return null; }
    return { tokenHash, userId: r.user_id as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string };
  }
  async touchSession(tokenHash: string, expiresAt: string) { await this.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', expiresAt, tokenHash); }
  async deleteSession(tokenHash: string) { await this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); }
  async deleteUserSessions(userId: string, exceptTokenHash?: string) {
    if (exceptTokenHash) await this.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', userId, exceptTokenHash);
    else await this.run('DELETE FROM sessions WHERE user_id = ?', userId);
  }
  async purgeExpiredSessions() { return this.run('DELETE FROM sessions WHERE expires_at < ?', now()); }

  async createApiKey(k: { userId: string; name: string; prefix: string; keyHash: string }): Promise<ApiKey> {
    const key: ApiKey = { id: newId('key'), ...k, createdAt: now(), lastUsedAt: null };
    await this.run('INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', key.id, key.userId, key.name, key.prefix, key.keyHash, key.createdAt);
    return key;
  }
  async listApiKeys(userId: string) { return (await this.all('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', userId)).map(r => this.apiKey(r)!); }
  async resolveApiKey(keyHash: string) { return this.apiKey(await this.one('SELECT * FROM api_keys WHERE key_hash = ?', keyHash)); }
  async deleteApiKey(userId: string, id: string) { return (await this.run('DELETE FROM api_keys WHERE id = ? AND user_id = ?', id, userId)) > 0; }
  async touchApiKey(id: string) { await this.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), id); }

  async listWorkspaces(userId: string) {
    const rows = await this.all<Row & { role: string }>(
      `SELECT w.*, 'owner' AS role FROM workspaces w WHERE w.owner_id = ?
       UNION ALL
       SELECT w.*, m.role AS role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = ? AND w.owner_id != ?
       ORDER BY updated_at DESC`, userId, userId, userId);
    return rows.map(r => ({ ...this.workspace(r)!, role: r.role as Role }));
  }
  async listAllWorkspaces() { return (await this.all('SELECT * FROM workspaces ORDER BY updated_at DESC')).map(r => this.workspace(r)!); }
  async countOwnedWorkspaces(userId: string) { return Number((await this.one<{ n: number }>('SELECT COUNT(*) AS n FROM workspaces WHERE owner_id = ?', userId))!.n); }
  async getWorkspace(id: string) { return this.workspace(await this.one('SELECT * FROM workspaces WHERE id = ?', id)); }
  async createWorkspace(w: { ownerId: string; name: string; id?: string }): Promise<WorkspaceRow> {
    const t = now();
    const row: WorkspaceRow = { id: w.id ?? newId('ws'), ownerId: w.ownerId, name: w.name, createdAt: t, updatedAt: t };
    await this.run('INSERT INTO workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', row.id, row.ownerId, row.name, t, t);
    return row;
  }
  async updateMeta(id: string, patch: { name?: string; ownerId?: string }) {
    const w = await this.getWorkspace(id); if (!w) return null;
    const name = patch.name ?? w.name, ownerId = patch.ownerId ?? w.ownerId, t = now();
    await this.run('UPDATE workspaces SET name = ?, owner_id = ?, updated_at = ? WHERE id = ?', name, ownerId, t, id);
    return { ...w, name, ownerId, updatedAt: t };
  }
  async deleteWorkspace(id: string) { await this.run('DELETE FROM workspaces WHERE id = ?', id); }

  async loadDoc(id: string) {
    const base = await this.one<{ state: ArrayBuffer }>('SELECT state FROM docs WHERE workspace_id = ?', id);
    const extra = await this.all<{ data: ArrayBuffer }>('SELECT data FROM doc_updates WHERE workspace_id = ? ORDER BY id', id);
    if (!base && extra.length === 0) return null;
    const parts = [...(base ? [bytes(base.state)] : []), ...extra.map(e => bytes(e.data))];
    return parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts);
  }
  async saveDoc(id: string, update: Uint8Array) {
    const t = now();
    await this.driver.batch([
      { sql: 'INSERT INTO docs (workspace_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at', params: [id, blob(update), t] },
      { sql: 'DELETE FROM doc_updates WHERE workspace_id = ?', params: [id] },
      { sql: 'UPDATE workspaces SET updated_at = ? WHERE id = ?', params: [t, id] },
    ]);
  }
  async appendUpdate(id: string, update: Uint8Array) {
    await this.run('INSERT INTO doc_updates (workspace_id, data, created_at) VALUES (?, ?, ?)', id, blob(update), now());
  }

  async getRole(workspaceId: string, userId: string): Promise<Role | null> {
    const w = await this.one('SELECT owner_id FROM workspaces WHERE id = ?', workspaceId);
    if (!w) return null;
    if (w.owner_id === userId) return 'owner';
    const m = await this.one('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', workspaceId, userId);
    return (m?.role as Role | undefined) ?? null;
  }
  async setRole(workspaceId: string, userId: string, role: MemberRole | null) {
    if (!role) { await this.run('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', workspaceId, userId); return; }
    await this.run('INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role', workspaceId, userId, role, now());
  }
  async listMembers(workspaceId: string) {
    return (await this.all('SELECT m.*, u.email, u.name FROM workspace_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at', workspaceId)).map(r => ({
      workspaceId, userId: r.user_id as string, role: r.role as MemberRole, createdAt: r.created_at as string,
      user: r.email ? { id: r.user_id as string, email: r.email as string, name: r.name as string } : null,
    } satisfies Member & { user: Pick<User, 'id' | 'email' | 'name'> | null }));
  }

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null };
    await this.run('INSERT INTO share_links (token, workspace_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', link.token, link.workspaceId, link.role, link.createdBy, link.createdAt, link.expiresAt);
    return link;
  }
  async listShareLinks(workspaceId: string) { return (await this.all('SELECT * FROM share_links WHERE workspace_id = ? ORDER BY created_at', workspaceId)).map(r => this.link(r)!); }
  async resolveShareLink(token: string) {
    const l = this.link(await this.one('SELECT * FROM share_links WHERE token = ?', token));
    if (!l) return null;
    if (l.expiresAt && l.expiresAt < now()) return null;
    return l;
  }
  async deleteShareLink(workspaceId: string, token: string) { return (await this.run('DELETE FROM share_links WHERE token = ? AND workspace_id = ?', token, workspaceId)) > 0; }

  // Instantáneas: en el worker las guarda el Durable Object en su storage (`do.ts`); esta implementación
  // mantiene el contrato `WorkspaceStore` (copia de respaldo / migraciones desde SQLite).
  async createSnapshot(s: { workspaceId: string; authorId: string | null; label: string | null; data: Uint8Array; id?: string }): Promise<SnapshotMeta> {
    const meta: SnapshotMeta = { id: s.id ?? newId('snp'), workspaceId: s.workspaceId, createdAt: now(), authorId: s.authorId, label: s.label, size: s.data.byteLength };
    await this.run('INSERT INTO snapshots (id, workspace_id, created_at, author_id, label, data, size) VALUES (?, ?, ?, ?, ?, ?, ?)', meta.id, meta.workspaceId, meta.createdAt, meta.authorId, meta.label, blob(s.data), meta.size);
    return meta;
  }
  async listSnapshots(workspaceId: string) {
    return (await this.all('SELECT id, workspace_id, created_at, author_id, label, size FROM snapshots WHERE workspace_id = ? ORDER BY created_at DESC, id DESC', workspaceId)).map(r => this.snapshotMeta(r));
  }
  async getSnapshot(workspaceId: string, id: string): Promise<Snapshot | null> {
    const r = await this.one('SELECT * FROM snapshots WHERE id = ? AND workspace_id = ?', id, workspaceId);
    return r ? { ...this.snapshotMeta(r), data: bytes(r.data) } : null;
  }
  async deleteSnapshot(workspaceId: string, id: string) { return (await this.run('DELETE FROM snapshots WHERE id = ? AND workspace_id = ?', id, workspaceId)) > 0; }
  async pruneSnapshots(workspaceId: string, keep: number) {
    const total = Number((await this.one<{ n: number }>('SELECT COUNT(*) AS n FROM snapshots WHERE workspace_id = ?', workspaceId))!.n);
    if (total <= keep) return 0;
    return this.run('DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots WHERE workspace_id = ? AND label IS NULL ORDER BY created_at ASC, id ASC LIMIT ?)', workspaceId, total - keep);
  }

  /** Importación de cuentas desde otra instalación (`POST /api/admin/import`): ver `import.ts`. */
  importRows(rows: ImportRows): Promise<ImportResult> { return importRows(this.driver, rows); }

  async close() { /* ni D1 ni el DO tienen conexión que cerrar */ }
}
