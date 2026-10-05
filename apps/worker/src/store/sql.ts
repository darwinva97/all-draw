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
import { importRows, replaceRows, type ImportResult, type ImportRows, type ReplaceResult } from './import';
import { MAX_NOTIFICATIONS_PER_USER, applyUserPatch, pushDelivery, webhookFromRow, type NewWebhook, type Webhook, type WebhookDelivery, type AccountToken, type AccountTokenKind, type ApiKey, type Member, type MemberRole, type Notification, type NotificationKind, type Role, type Session, type SessionMeta, type ShareLink, type Snapshot, type SnapshotMeta, type User, type UserPatch, type WorkspaceRow, type WorkspaceStore } from '@all-draw/server-core';

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
    return r ? {
      id: r.id as string, email: r.email as string, name: r.name as string, passwordHash: r.password_hash as string, isAdmin: !!r.is_admin, createdAt: r.created_at as string,
      emailVerifiedAt: (r.email_verified_at as string | null) ?? null, locale: (r.locale as string | null) ?? null, notifyEmail: r.notify_email === undefined || r.notify_email === null ? true : !!r.notify_email,
    } : null;
  }
  private session(r: Row): Session {
    return { tokenHash: r.token_hash as string, userId: r.user_id as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string, device: (r.device as string | null) ?? null, ip: (r.ip as string | null) ?? null, lastUsedAt: (r.last_used_at as string | null) ?? null };
  }
  private notification(r: Row): Notification {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(String(r.payload)) as Record<string, unknown>; } catch { /* payload corrupto: vacío */ }
    return { id: r.id as string, userId: r.user_id as string, kind: r.kind as NotificationKind, workspaceId: (r.workspace_id as string | null) ?? null, payload, createdAt: r.created_at as string, readAt: (r.read_at as string | null) ?? null };
  }
  private workspace(r: Row | null): WorkspaceRow | null {
    return r ? { id: r.id as string, ownerId: r.owner_id as string, name: r.name as string, createdAt: r.created_at as string, updatedAt: r.updated_at as string } : null;
  }
  private apiKey(r: Row | null): ApiKey | null {
    return r ? { id: r.id as string, userId: r.user_id as string, name: r.name as string, prefix: r.prefix as string, keyHash: r.key_hash as string, createdAt: r.created_at as string, lastUsedAt: (r.last_used_at as string | null) ?? null } : null;
  }
  private link(r: Row | null): ShareLink | null {
    return r ? { token: r.token as string, workspaceId: r.workspace_id as string, role: r.role as MemberRole, createdBy: r.created_by as string, createdAt: r.created_at as string, expiresAt: (r.expires_at as string | null) ?? null, viewId: (r.view_id as string | null) ?? null } : null;
  }
  private snapshotMeta(r: Row): SnapshotMeta {
    return { id: r.id as string, workspaceId: r.workspace_id as string, createdAt: r.created_at as string, authorId: (r.author_id as string | null) ?? null, label: (r.label as string | null) ?? null, size: Number(r.size) };
  }

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string; locale?: string | null }): Promise<User> {
    const user: User = { id: u.id ?? newId('usr'), email: u.email.trim().toLowerCase(), name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now(), emailVerifiedAt: null, locale: u.locale ?? null, notifyEmail: true };
    try {
      await this.run('INSERT INTO users (id, email, name, password_hash, is_admin, created_at, locale) VALUES (?, ?, ?, ?, ?, ?, ?)', user.id, user.email, user.name, user.passwordHash, user.isAdmin ? 1 : 0, user.createdAt, user.locale);
    } catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return user;
  }
  async getUser(id: string) { return this.user(await this.one('SELECT * FROM users WHERE id = ?', id)); }
  async getUserByEmail(email: string) { return this.user(await this.one('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase())); }
  async countUsers() { return Number((await this.one<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n); }
  async listUsers() { return (await this.all('SELECT * FROM users ORDER BY created_at')).map(r => this.user(r)!); }
  async setPasswordHash(userId: string, passwordHash: string) { await this.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId); }
  async updateUser(id: string, patch: UserPatch) {
    const u = await this.getUser(id); if (!u) return null;
    const next = applyUserPatch(u, patch);
    try { await this.run('UPDATE users SET name = ?, email = ?, is_admin = ?, email_verified_at = ?, locale = ?, notify_email = ? WHERE id = ?', next.name, next.email, next.isAdmin ? 1 : 0, next.emailVerifiedAt, next.locale, next.notifyEmail ? 1 : 0, id); }
    catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return next;
  }
  async deleteUser(id: string) {
    await this.driver.batch([
      { sql: 'DELETE FROM sessions WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM api_keys WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM workspace_members WHERE user_id = ?', params: [id] },
      { sql: 'UPDATE snapshots SET author_id = NULL WHERE author_id = ?', params: [id] },
      { sql: 'DELETE FROM account_tokens WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM notifications WHERE user_id = ?', params: [id] },
      { sql: 'DELETE FROM users WHERE id = ?', params: [id] },
    ]);
  }

  async createSession(userId: string, tokenHash: string, expiresAt: string, meta: SessionMeta = {}): Promise<Session> {
    const t = now();
    const s: Session = { tokenHash, userId, createdAt: t, expiresAt, device: meta.device ?? null, ip: meta.ip ?? null, lastUsedAt: t };
    await this.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, device, ip, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)', tokenHash, userId, t, expiresAt, s.device, s.ip, t);
    return s;
  }
  async getSession(tokenHash: string) {
    const r = await this.one('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
    if (!r) return null;
    if ((r.expires_at as string) < now()) { await this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); return null; }
    return this.session(r);
  }
  async touchSession(tokenHash: string, expiresAt: string) { await this.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', expiresAt, tokenHash); }
  async markSessionUsed(tokenHash: string, at: string, ip: string | null) { await this.run('UPDATE sessions SET last_used_at = ?, ip = COALESCE(?, ip) WHERE token_hash = ?', at, ip, tokenHash); }
  async listUserSessions(userId: string) {
    return (await this.all('SELECT * FROM sessions WHERE user_id = ? AND expires_at >= ? ORDER BY COALESCE(last_used_at, created_at) DESC', userId, now())).map(r => this.session(r));
  }
  async deleteSession(tokenHash: string) { await this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); }
  async deleteUserSessions(userId: string, exceptTokenHash?: string) {
    if (exceptTokenHash) await this.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', userId, exceptTokenHash);
    else await this.run('DELETE FROM sessions WHERE user_id = ?', userId);
  }
  async purgeExpiredSessions() {
    const t = now();
    await this.run('DELETE FROM account_tokens WHERE expires_at < ?', t);
    return this.run('DELETE FROM sessions WHERE expires_at < ?', t);
  }

  async createAccountToken(a: Omit<AccountToken, 'createdAt'>): Promise<AccountToken> {
    const tok: AccountToken = { ...a, email: a.email.trim().toLowerCase(), createdAt: now() };
    await this.run('INSERT INTO account_tokens (token_hash, user_id, kind, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', tok.tokenHash, tok.userId, tok.kind, tok.email, tok.createdAt, tok.expiresAt);
    return tok;
  }
  async consumeAccountToken(tokenHash: string, kind: AccountTokenKind): Promise<AccountToken | null> {
    // `DELETE … RETURNING`: atómico en D1 y en el SQLite del DO; sólo una petición gasta el token.
    const r = await this.one('DELETE FROM account_tokens WHERE token_hash = ? AND kind = ? RETURNING *', tokenHash, kind);
    if (!r || (r.expires_at as string) < now()) return null;
    return { tokenHash: r.token_hash as string, userId: r.user_id as string, kind: r.kind as AccountTokenKind, email: r.email as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string };
  }
  async deleteAccountTokens(userId: string, kind?: AccountTokenKind) {
    if (kind) await this.run('DELETE FROM account_tokens WHERE user_id = ? AND kind = ?', userId, kind);
    else await this.run('DELETE FROM account_tokens WHERE user_id = ?', userId);
  }

  async createNotification(n: { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }): Promise<Notification | null> {
    const row: Notification = { id: n.id ?? newId('ntf'), userId: n.userId, kind: n.kind, workspaceId: n.workspaceId, payload: n.payload, createdAt: now(), readAt: null };
    const [changes] = await this.driver.batch([
      { sql: 'INSERT OR IGNORE INTO notifications (id, user_id, kind, workspace_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)', params: [row.id, row.userId, row.kind, row.workspaceId, JSON.stringify(row.payload), row.createdAt] },
      { sql: 'DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?)', params: [row.userId, row.userId, MAX_NOTIFICATIONS_PER_USER] },
    ]);
    return changes ? row : null;
  }
  async listNotifications(userId: string, limit: number) {
    return (await this.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', userId, Math.max(0, limit))).map(r => this.notification(r));
  }
  async countUnreadNotifications(userId: string) { return Number((await this.one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', userId))!.n); }
  async markNotificationsRead(userId: string, ids?: string[]) {
    const t = now();
    if (!ids) return this.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', t, userId);
    if (ids.length === 0) return 0;
    return this.run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`, t, userId, ...ids);
  }

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
  async deleteWorkspace(id: string) {
    // Las notificaciones se borran a mano: no se cuenta con que el motor tenga las claves foráneas activas.
    await this.driver.batch([{ sql: 'DELETE FROM notifications WHERE workspace_id = ?', params: [id] }, { sql: 'DELETE FROM webhooks WHERE workspace_id = ?', params: [id] }, { sql: 'DELETE FROM workspaces WHERE id = ?', params: [id] }]);
  }

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

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null; viewId?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null, viewId: l.viewId ?? null };
    await this.run('INSERT INTO share_links (token, workspace_id, role, created_by, created_at, expires_at, view_id) VALUES (?, ?, ?, ?, ?, ?, ?)', link.token, link.workspaceId, link.role, link.createdBy, link.createdAt, link.expiresAt, link.viewId);
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

  async createWebhook(w: NewWebhook): Promise<Webhook> {
    const row: Webhook = { id: w.id ?? newId('whk'), workspaceId: w.workspaceId, url: w.url, events: [...w.events], format: w.format, lang: w.lang, secret: w.secret, createdBy: w.createdBy, createdAt: now(), deliveries: [] };
    await this.run('INSERT INTO webhooks (id, workspace_id, url, events, format, lang, secret, created_by, created_at, deliveries) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', row.id, row.workspaceId, row.url, JSON.stringify(row.events), row.format, row.lang, row.secret, row.createdBy, row.createdAt, '[]');
    return row;
  }
  async listWebhooks(workspaceId: string) { return (await this.all('SELECT * FROM webhooks WHERE workspace_id = ? ORDER BY created_at, id', workspaceId)).map(webhookFromRow); }
  async getWebhook(workspaceId: string, id: string) { const r = await this.one('SELECT * FROM webhooks WHERE id = ? AND workspace_id = ?', id, workspaceId); return r ? webhookFromRow(r) : null; }
  async deleteWebhook(workspaceId: string, id: string) { return (await this.run('DELETE FROM webhooks WHERE id = ? AND workspace_id = ?', id, workspaceId)) > 0; }
  async recordWebhookDelivery(workspaceId: string, id: string, d: WebhookDelivery) {
    const h = await this.getWebhook(workspaceId, id);
    if (h) await this.run('UPDATE webhooks SET deliveries = ? WHERE id = ?', JSON.stringify(pushDelivery(h.deliveries, d)), id);
  }

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
  /** Modo `replace` de la importación (copia de respaldo `STANDBY`): el registro queda idéntico a `rows`. Ver `import.ts`. */
  replaceRows(rows: ImportRows): Promise<ReplaceResult> { return replaceRows(this.driver, rows); }

  async close() { /* ni D1 ni el DO tienen conexión que cerrar */ }
}
