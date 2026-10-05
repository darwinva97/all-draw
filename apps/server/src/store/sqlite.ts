/**
 * Adaptador SQLite con `node:sqlite` (incluido en Node ≥ 22.13). Un fichero, sin dependencias
 * nativas externas. Las migraciones se aplican al abrir (`schema_migrations`).
 *
 * El esquema es SQL estándar: `postgres.ts` es una traducción directa (`BLOB` → `BYTEA`,
 * `INTEGER` booleanos → `BOOLEAN`, `?` → `$n`) y `apps/worker/migrations/0001_init.sql` (D1) es este mismo SQL.
 */
import { statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import { MAX_NOTIFICATIONS_PER_USER, applyUserPatch, pushDelivery, webhookFromRow, type NewWebhook, type Webhook, type WebhookDelivery, type AccountToken, type AccountTokenKind, type ApiKey, type Member, type MemberRole, type Notification, type NotificationKind, type Role, type Session, type SessionMeta, type ShareLink, type Snapshot, type SnapshotMeta, type User, type UserPatch, type WorkspaceRow, type WorkspaceStore } from '@all-draw/server-core';

const now = () => new Date().toISOString();

export const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );
  CREATE TABLE workspaces (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX workspaces_owner ON workspaces(owner_id);
  CREATE TABLE workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE INDEX members_user ON workspace_members(user_id);
  CREATE TABLE share_links (
    token TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT
  );
  CREATE INDEX share_links_ws ON share_links(workspace_id);
  CREATE TABLE docs (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    state BLOB NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE doc_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX doc_updates_ws ON doc_updates(workspace_id);
  `,
  // v2 — caducidad de sesiones: índice para la limpieza periódica (`purgeExpiredSessions`). Igual que apps/worker/migrations/0002_sessions_expiry.sql.
  `
  CREATE INDEX sessions_expires ON sessions(expires_at);
  `,
  // v3 — historial de versiones. Igual que apps/worker/migrations/0003_snapshots.sql.
  `
  CREATE TABLE snapshots (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    author_id TEXT,
    label TEXT,
    data BLOB NOT NULL,
    size INTEGER NOT NULL
  );
  CREATE INDEX snapshots_ws ON snapshots(workspace_id, created_at);
  `,
  // v4 — cuentas: correo verificado, idioma y preferencias; sesiones activas (dispositivo, IP truncada, último uso);
  // tokens de un solo uso por correo (restablecer, verificar) y centro de notificaciones. Igual que apps/worker/migrations/0004_accounts.sql.
  `
  ALTER TABLE users ADD COLUMN email_verified_at TEXT;
  ALTER TABLE users ADD COLUMN locale TEXT;
  ALTER TABLE users ADD COLUMN notify_email INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE sessions ADD COLUMN device TEXT;
  ALTER TABLE sessions ADD COLUMN ip TEXT;
  ALTER TABLE sessions ADD COLUMN last_used_at TEXT;
  CREATE TABLE account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('reset','verify')),
    email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX account_tokens_user ON account_tokens(user_id, kind);
  CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX notifications_user ON notifications(user_id, created_at);
  `,
  // v5 — integraciones: enlaces de inserción con alcance a una vista (`share_links.view_id`) y webhooks por espacio
  // (eventos y últimas entregas en JSON). Igual que apps/worker/migrations/0005_integrations.sql.
  `
  ALTER TABLE share_links ADD COLUMN view_id TEXT;
  CREATE TABLE webhooks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    format TEXT NOT NULL,
    lang TEXT NOT NULL DEFAULT 'es',
    secret TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deliveries TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX webhooks_ws ON webhooks(workspace_id, created_at);
  `,
];

type Row = Record<string, unknown>;


/**
 * Ajustes de la conexión (no se guardan en el fichero salvo `journal_mode`):
 *   - WAL: lectores (copias, scripts) no bloquean al escritor;
 *   - `synchronous = NORMAL`: con WAL es seguro ante caídas del proceso; ante un corte de luz se pueden perder
 *     las últimas transacciones, nunca corromper la BD (los docs se reescriben enteros en cada guardado);
 *   - `foreign_keys`: borrados en cascada (sesiones, miembros, enlaces, docs, instantáneas);
 *   - `busy_timeout`: espera hasta 5 s si otro proceso (backup, mantenimiento) tiene el cerrojo;
 *   - `journal_size_limit`: el `-wal` no se queda en cientos de MB tras un pico;
 *   - `temp_store = MEMORY`: ordenaciones y temporales sin tocar disco.
 */
export const SQLITE_PRAGMAS = [
  'PRAGMA journal_mode = WAL',
  'PRAGMA synchronous = NORMAL',
  'PRAGMA foreign_keys = ON',
  'PRAGMA busy_timeout = 5000',
  'PRAGMA journal_size_limit = 67108864',
  'PRAGMA temp_store = MEMORY',
];

export class SqliteWorkspaceStore implements WorkspaceStore {
  readonly db: DatabaseSync;

  constructor(readonly path: string) {
    this.db = new DatabaseSync(path);
    for (const p of SQLITE_PRAGMAS) this.db.exec(p);
    this.migrate();
  }

  private migrate() {
    this.db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const cur = (this.db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations').get() as { v: number }).v;
    for (let v = cur; v < MIGRATIONS.length; v++) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[v]!);
        this.db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(v + 1, now());
        this.db.exec('COMMIT');
      } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    }
  }

  private one<T>(sql: string, ...params: unknown[]): T | null { return (this.db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null; }
  private all<T>(sql: string, ...params: unknown[]): T[] { return this.db.prepare(sql).all(...(params as never[])) as T[]; }
  private run(sql: string, ...params: unknown[]) { return this.db.prepare(sql).run(...(params as never[])); }

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
      this.run('INSERT INTO users (id, email, name, password_hash, is_admin, created_at, locale) VALUES (?, ?, ?, ?, ?, ?, ?)', user.id, user.email, user.name, user.passwordHash, user.isAdmin ? 1 : 0, user.createdAt, user.locale);
    } catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return user;
  }
  async getUser(id: string) { return this.user(this.one('SELECT * FROM users WHERE id = ?', id)); }
  async getUserByEmail(email: string) { return this.user(this.one('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase())); }
  async countUsers() { return (this.one<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n; }
  async listUsers() { return this.all<Row>('SELECT * FROM users ORDER BY created_at').map(r => this.user(r)!); }
  async setPasswordHash(userId: string, passwordHash: string) { this.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId); }
  async updateUser(id: string, patch: UserPatch) {
    const u = await this.getUser(id); if (!u) return null;
    const next = applyUserPatch(u, patch);
    try { this.run('UPDATE users SET name = ?, email = ?, is_admin = ?, email_verified_at = ?, locale = ?, notify_email = ? WHERE id = ?', next.name, next.email, next.isAdmin ? 1 : 0, next.emailVerifiedAt, next.locale, next.notifyEmail ? 1 : 0, id); }
    catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return next;
  }
  async deleteUser(id: string) {
    this.db.exec('BEGIN');
    try {
      this.run('DELETE FROM sessions WHERE user_id = ?', id);
      this.run('DELETE FROM api_keys WHERE user_id = ?', id);
      this.run('DELETE FROM workspace_members WHERE user_id = ?', id);
      this.run('UPDATE snapshots SET author_id = NULL WHERE author_id = ?', id);
      this.run('DELETE FROM account_tokens WHERE user_id = ?', id);
      this.run('DELETE FROM notifications WHERE user_id = ?', id);
      this.run('DELETE FROM users WHERE id = ?', id);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  async createSession(userId: string, tokenHash: string, expiresAt: string, meta: SessionMeta = {}): Promise<Session> {
    const t = now();
    const s: Session = { tokenHash, userId, createdAt: t, expiresAt, device: meta.device ?? null, ip: meta.ip ?? null, lastUsedAt: t };
    this.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, device, ip, last_used_at) VALUES (?, ?, ?, ?, ?, ?, ?)', tokenHash, userId, t, expiresAt, s.device, s.ip, t);
    return s;
  }
  async getSession(tokenHash: string) {
    const r = this.one<Row>('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
    if (!r) return null;
    if ((r.expires_at as string) < now()) { this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); return null; }
    return this.session(r);
  }
  async touchSession(tokenHash: string, expiresAt: string) { this.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', expiresAt, tokenHash); }
  async markSessionUsed(tokenHash: string, at: string, ip: string | null) { this.run('UPDATE sessions SET last_used_at = ?, ip = COALESCE(?, ip) WHERE token_hash = ?', at, ip, tokenHash); }
  async listUserSessions(userId: string) {
    return this.all<Row>('SELECT * FROM sessions WHERE user_id = ? AND expires_at >= ? ORDER BY COALESCE(last_used_at, created_at) DESC', userId, now()).map(r => this.session(r));
  }
  async deleteSession(tokenHash: string) { this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); }
  async deleteUserSessions(userId: string, exceptTokenHash?: string) {
    if (exceptTokenHash) this.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', userId, exceptTokenHash);
    else this.run('DELETE FROM sessions WHERE user_id = ?', userId);
  }
  async purgeExpiredSessions() {
    const t = now();
    this.run('DELETE FROM account_tokens WHERE expires_at < ?', t);
    return Number(this.run('DELETE FROM sessions WHERE expires_at < ?', t).changes);
  }

  async createAccountToken(a: Omit<AccountToken, 'createdAt'>): Promise<AccountToken> {
    const tok: AccountToken = { ...a, email: a.email.trim().toLowerCase(), createdAt: now() };
    this.run('INSERT INTO account_tokens (token_hash, user_id, kind, email, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', tok.tokenHash, tok.userId, tok.kind, tok.email, tok.createdAt, tok.expiresAt);
    return tok;
  }
  async consumeAccountToken(tokenHash: string, kind: AccountTokenKind): Promise<AccountToken | null> {
    const r = this.one<Row>('DELETE FROM account_tokens WHERE token_hash = ? AND kind = ? RETURNING *', tokenHash, kind);
    if (!r || (r.expires_at as string) < now()) return null;
    return { tokenHash: r.token_hash as string, userId: r.user_id as string, kind: r.kind as AccountTokenKind, email: r.email as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string };
  }
  async deleteAccountTokens(userId: string, kind?: AccountTokenKind) {
    if (kind) this.run('DELETE FROM account_tokens WHERE user_id = ? AND kind = ?', userId, kind);
    else this.run('DELETE FROM account_tokens WHERE user_id = ?', userId);
  }

  async createNotification(n: { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }): Promise<Notification | null> {
    const row: Notification = { id: n.id ?? newId('ntf'), userId: n.userId, kind: n.kind, workspaceId: n.workspaceId, payload: n.payload, createdAt: now(), readAt: null };
    const changes = Number(this.run('INSERT OR IGNORE INTO notifications (id, user_id, kind, workspace_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)', row.id, row.userId, row.kind, row.workspaceId, JSON.stringify(row.payload), row.createdAt).changes);
    if (!changes) return null;
    this.run('DELETE FROM notifications WHERE user_id = ? AND id NOT IN (SELECT id FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?)', row.userId, row.userId, MAX_NOTIFICATIONS_PER_USER);
    return row;
  }
  async listNotifications(userId: string, limit: number) {
    return this.all<Row>('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', userId, Math.max(0, limit)).map(r => this.notification(r));
  }
  async countUnreadNotifications(userId: string) { return Number(this.one<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', userId)!.n); }
  async markNotificationsRead(userId: string, ids?: string[]) {
    const t = now();
    if (!ids) return Number(this.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', t, userId).changes);
    if (ids.length === 0) return 0;
    return Number(this.run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${ids.map(() => '?').join(', ')})`, t, userId, ...ids).changes);
  }

  async createApiKey(k: { userId: string; name: string; prefix: string; keyHash: string }): Promise<ApiKey> {
    const key: ApiKey = { id: newId('key'), ...k, createdAt: now(), lastUsedAt: null };
    this.run('INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)', key.id, key.userId, key.name, key.prefix, key.keyHash, key.createdAt);
    return key;
  }
  async listApiKeys(userId: string) { return this.all<Row>('SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC', userId).map(r => this.apiKey(r)!); }
  async resolveApiKey(keyHash: string) { return this.apiKey(this.one('SELECT * FROM api_keys WHERE key_hash = ?', keyHash)); }
  async deleteApiKey(userId: string, id: string) { return this.run('DELETE FROM api_keys WHERE id = ? AND user_id = ?', id, userId).changes > 0; }
  async touchApiKey(id: string) { this.run('UPDATE api_keys SET last_used_at = ? WHERE id = ?', now(), id); }

  async listWorkspaces(userId: string) {
    const rows = this.all<Row & { role: string }>(
      `SELECT w.*, 'owner' AS role FROM workspaces w WHERE w.owner_id = ?
       UNION ALL
       SELECT w.*, m.role AS role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = ? AND w.owner_id != ?
       ORDER BY updated_at DESC`, userId, userId, userId);
    return rows.map(r => ({ ...this.workspace(r)!, role: r.role as Role }));
  }
  async listAllWorkspaces() { return this.all<Row>('SELECT * FROM workspaces ORDER BY updated_at DESC').map(r => this.workspace(r)!); }
  async countOwnedWorkspaces(userId: string) { return Number(this.one<{ n: number }>('SELECT COUNT(*) AS n FROM workspaces WHERE owner_id = ?', userId)!.n); }
  async getWorkspace(id: string) { return this.workspace(this.one('SELECT * FROM workspaces WHERE id = ?', id)); }
  async createWorkspace(w: { ownerId: string; name: string; id?: string }): Promise<WorkspaceRow> {
    const t = now();
    const row: WorkspaceRow = { id: w.id ?? newId('ws'), ownerId: w.ownerId, name: w.name, createdAt: t, updatedAt: t };
    this.run('INSERT INTO workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', row.id, row.ownerId, row.name, t, t);
    return row;
  }
  async updateMeta(id: string, patch: { name?: string; ownerId?: string }) {
    const w = await this.getWorkspace(id); if (!w) return null;
    const name = patch.name ?? w.name, ownerId = patch.ownerId ?? w.ownerId, t = now();
    this.run('UPDATE workspaces SET name = ?, owner_id = ?, updated_at = ? WHERE id = ?', name, ownerId, t, id);
    return { ...w, name, ownerId, updatedAt: t };
  }
  async deleteWorkspace(id: string) { this.run('DELETE FROM workspaces WHERE id = ?', id); }

  async loadDoc(id: string) {
    const base = this.one<{ state: Uint8Array }>('SELECT state FROM docs WHERE workspace_id = ?', id);
    const extra = this.all<{ data: Uint8Array }>('SELECT data FROM doc_updates WHERE workspace_id = ? ORDER BY id', id);
    if (!base && extra.length === 0) return null;
    const parts = [...(base ? [new Uint8Array(base.state)] : []), ...extra.map(e => new Uint8Array(e.data))];
    return parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts);
  }
  async saveDoc(id: string, update: Uint8Array) {
    const t = now();
    this.db.exec('BEGIN');
    try {
      this.run('INSERT INTO docs (workspace_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at', id, update, t);
      this.run('DELETE FROM doc_updates WHERE workspace_id = ?', id);
      this.run('UPDATE workspaces SET updated_at = ? WHERE id = ?', t, id);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  async appendUpdate(id: string, update: Uint8Array) {
    this.run('INSERT INTO doc_updates (workspace_id, data, created_at) VALUES (?, ?, ?)', id, update, now());
  }

  async getRole(workspaceId: string, userId: string): Promise<Role | null> {
    const w = this.one<Row>('SELECT owner_id FROM workspaces WHERE id = ?', workspaceId);
    if (!w) return null;
    if (w.owner_id === userId) return 'owner';
    const m = this.one<Row>('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', workspaceId, userId);
    return (m?.role as Role | undefined) ?? null;
  }
  async setRole(workspaceId: string, userId: string, role: MemberRole | null) {
    if (!role) { this.run('DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?', workspaceId, userId); return; }
    this.run('INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role', workspaceId, userId, role, now());
  }
  async listMembers(workspaceId: string) {
    return this.all<Row>('SELECT m.*, u.email, u.name FROM workspace_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at', workspaceId).map(r => ({
      workspaceId, userId: r.user_id as string, role: r.role as MemberRole, createdAt: r.created_at as string,
      user: r.email ? { id: r.user_id as string, email: r.email as string, name: r.name as string } : null,
    } satisfies Member & { user: Pick<User, 'id' | 'email' | 'name'> | null }));
  }

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null; viewId?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null, viewId: l.viewId ?? null };
    this.run('INSERT INTO share_links (token, workspace_id, role, created_by, created_at, expires_at, view_id) VALUES (?, ?, ?, ?, ?, ?, ?)', link.token, link.workspaceId, link.role, link.createdBy, link.createdAt, link.expiresAt, link.viewId);
    return link;
  }
  async listShareLinks(workspaceId: string) { return this.all<Row>('SELECT * FROM share_links WHERE workspace_id = ? ORDER BY created_at', workspaceId).map(r => this.link(r)!); }
  async resolveShareLink(token: string) {
    const l = this.link(this.one('SELECT * FROM share_links WHERE token = ?', token));
    if (!l) return null;
    if (l.expiresAt && l.expiresAt < now()) return null;
    return l;
  }
  async deleteShareLink(workspaceId: string, token: string) { return this.run('DELETE FROM share_links WHERE token = ? AND workspace_id = ?', token, workspaceId).changes > 0; }

  async createWebhook(w: NewWebhook): Promise<Webhook> {
    const row: Webhook = { id: w.id ?? newId('whk'), workspaceId: w.workspaceId, url: w.url, events: [...w.events], format: w.format, lang: w.lang, secret: w.secret, createdBy: w.createdBy, createdAt: now(), deliveries: [] };
    this.run('INSERT INTO webhooks (id, workspace_id, url, events, format, lang, secret, created_by, created_at, deliveries) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', row.id, row.workspaceId, row.url, JSON.stringify(row.events), row.format, row.lang, row.secret, row.createdBy, row.createdAt, '[]');
    return row;
  }
  async listWebhooks(workspaceId: string) { return this.all<Row>('SELECT * FROM webhooks WHERE workspace_id = ? ORDER BY created_at, id', workspaceId).map(webhookFromRow); }
  async getWebhook(workspaceId: string, id: string) { const r = this.one<Row>('SELECT * FROM webhooks WHERE id = ? AND workspace_id = ?', id, workspaceId); return r ? webhookFromRow(r) : null; }
  async deleteWebhook(workspaceId: string, id: string) { return this.run('DELETE FROM webhooks WHERE id = ? AND workspace_id = ?', id, workspaceId).changes > 0; }
  async recordWebhookDelivery(workspaceId: string, id: string, d: WebhookDelivery) {
    const h = await this.getWebhook(workspaceId, id);
    if (h) this.run('UPDATE webhooks SET deliveries = ? WHERE id = ?', JSON.stringify(pushDelivery(h.deliveries, d)), id);
  }

  async createSnapshot(s: { workspaceId: string; authorId: string | null; label: string | null; data: Uint8Array; id?: string }): Promise<SnapshotMeta> {
    const meta: SnapshotMeta = { id: s.id ?? newId('snp'), workspaceId: s.workspaceId, createdAt: now(), authorId: s.authorId, label: s.label, size: s.data.byteLength };
    this.run('INSERT INTO snapshots (id, workspace_id, created_at, author_id, label, data, size) VALUES (?, ?, ?, ?, ?, ?, ?)', meta.id, meta.workspaceId, meta.createdAt, meta.authorId, meta.label, s.data, meta.size);
    return meta;
  }
  async listSnapshots(workspaceId: string) {
    return this.all<Row>('SELECT id, workspace_id, created_at, author_id, label, size FROM snapshots WHERE workspace_id = ? ORDER BY created_at DESC, id DESC', workspaceId).map(r => this.snapshotMeta(r));
  }
  async getSnapshot(workspaceId: string, id: string): Promise<Snapshot | null> {
    const r = this.one<Row>('SELECT * FROM snapshots WHERE id = ? AND workspace_id = ?', id, workspaceId);
    return r ? { ...this.snapshotMeta(r), data: new Uint8Array(r.data as Uint8Array) } : null;
  }
  async deleteSnapshot(workspaceId: string, id: string) { return this.run('DELETE FROM snapshots WHERE id = ? AND workspace_id = ?', id, workspaceId).changes > 0; }
  async pruneSnapshots(workspaceId: string, keep: number) {
    const total = this.one<{ n: number }>('SELECT COUNT(*) AS n FROM snapshots WHERE workspace_id = ?', workspaceId)!.n;
    if (total <= keep) return 0;
    return Number(this.run('DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots WHERE workspace_id = ? AND label IS NULL ORDER BY created_at ASC, id ASC LIMIT ?)', workspaceId, total - keep).changes);
  }

  /** Bytes en disco (BD + `-wal`), para `/metrics`. */
  dbSizeBytes(): number {
    let n = 0;
    for (const f of [this.path, `${this.path}-wal`]) { try { n += statSync(f).size; } catch { /* no existe */ } }
    return n;
  }

  async close() {
    if (!this.db.isOpen) return;
    try { this.db.exec('PRAGMA optimize'); } catch { /* no es grave */ }
    this.db.close();
  }
}
