/**
 * Adaptador Postgres con `pg` (pool). Mismas tablas y consultas que `sqlite.ts` traducidas:
 * `BLOB` → `BYTEA`, booleanos → `BOOLEAN`, `AUTOINCREMENT` → `BIGSERIAL`, `?` → `$n`.
 *
 * Migraciones idempotentes al conectar (`schema_migrations` + `pg_advisory_xact_lock` para que
 * varios procesos arrancando a la vez no se pisen). Se elige con `DATABASE_URL`.
 */
import pg from 'pg';
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import { MAX_NOTIFICATIONS_PER_USER, applyUserPatch, type AccountToken, type AccountTokenKind, type ApiKey, type Member, type MemberRole, type Notification, type NotificationKind, type Role, type Session, type SessionMeta, type ShareLink, type Snapshot, type SnapshotMeta, type User, type UserPatch, type WorkspaceRow, type WorkspaceStore } from '@all-draw/server-core';

const { Pool } = pg;
const now = () => new Date().toISOString();
const LOCK_KEY = 0x616c6c64; // 'alld'

export const MIGRATIONS: string[] = [
  // v1 — idéntica a sqlite.ts v1
  `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  );
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS workspaces_owner ON workspaces(owner_id);
  CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS members_user ON workspace_members(user_id);
  CREATE TABLE IF NOT EXISTS share_links (
    token TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT
  );
  CREATE INDEX IF NOT EXISTS share_links_ws ON share_links(workspace_id);
  CREATE TABLE IF NOT EXISTS docs (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    state BYTEA NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS doc_updates (
    id BIGSERIAL PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    data BYTEA NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS doc_updates_ws ON doc_updates(workspace_id);
  `,
  // v2 — índice para purgar sesiones caducadas
  `
  CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires_at);
  `,
  // v3 — historial de versiones
  `
  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    author_id TEXT,
    label TEXT,
    data BYTEA NOT NULL,
    size INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS snapshots_ws ON snapshots(workspace_id, created_at);
  `,
  // v4 — cuentas (correo verificado, idioma, preferencias), sesiones activas, tokens por correo y notificaciones (= sqlite.ts v4)
  `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device TEXT;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip TEXT;
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TEXT;
  CREATE TABLE IF NOT EXISTS account_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('reset','verify')),
    email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS account_tokens_user ON account_tokens(user_id, kind);
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id, created_at);
  `,
];

type Row = Record<string, unknown>;
const bytes = (v: unknown): Uint8Array => v instanceof Uint8Array ? new Uint8Array(v.buffer, v.byteOffset, v.byteLength) : new Uint8Array(v as ArrayBuffer);

export class PostgresWorkspaceStore implements WorkspaceStore {
  private constructor(readonly pool: pg.Pool) {}

  /** Abre el pool y aplica las migraciones pendientes. */
  static async connect(connectionString: string, opts: { max?: number } = {}): Promise<PostgresWorkspaceStore> {
    const pool = new Pool({ connectionString, max: opts.max ?? 8 });
    const store = new PostgresWorkspaceStore(pool);
    try { await store.migrate(); } catch (e) { await pool.end(); throw e; }
    return store;
  }

  private async migrate() {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
      await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
      const cur = Number((await c.query<{ v: string | number }>('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations')).rows[0]!.v);
      for (let v = cur; v < MIGRATIONS.length; v++) {
        await c.query(MIGRATIONS[v]!);
        await c.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [v + 1, now()]);
      }
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  /** Vacía todas las tablas (sólo para tests). */
  async truncateAll() {
    await this.pool.query('TRUNCATE users, sessions, api_keys, workspaces, workspace_members, share_links, docs, doc_updates, snapshots, account_tokens, notifications CASCADE');
  }

  private async one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> { return ((await this.pool.query(sql, params)).rows[0] as T | undefined) ?? null; }
  private async all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> { return (await this.pool.query(sql, params)).rows as T[]; }
  private async run(sql: string, params: unknown[] = []): Promise<number> { return (await this.pool.query(sql, params)).rowCount ?? 0; }

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
    return r ? { token: r.token as string, workspaceId: r.workspace_id as string, role: r.role as MemberRole, createdBy: r.created_by as string, createdAt: r.created_at as string, expiresAt: (r.expires_at as string | null) ?? null } : null;
  }
  private snapshotMeta(r: Row): SnapshotMeta {
    return { id: r.id as string, workspaceId: r.workspace_id as string, createdAt: r.created_at as string, authorId: (r.author_id as string | null) ?? null, label: (r.label as string | null) ?? null, size: Number(r.size) };
  }

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string; locale?: string | null }): Promise<User> {
    const user: User = { id: u.id ?? newId('usr'), email: u.email.trim().toLowerCase(), name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now(), emailVerifiedAt: null, locale: u.locale ?? null, notifyEmail: true };
    try {
      await this.run('INSERT INTO users (id, email, name, password_hash, is_admin, created_at, locale) VALUES ($1, $2, $3, $4, $5, $6, $7)', [user.id, user.email, user.name, user.passwordHash, user.isAdmin, user.createdAt, user.locale]);
    } catch (e) { if ((e as { code?: string }).code === '23505') throw new Error('email ya registrado'); throw e; }
    return user;
  }
  async getUser(id: string) { return this.user(await this.one('SELECT * FROM users WHERE id = $1', [id])); }
  async getUserByEmail(email: string) { return this.user(await this.one('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()])); }
  async countUsers() { return Number((await this.one<{ n: string }>('SELECT COUNT(*) AS n FROM users'))!.n); }
  async listUsers() { return (await this.all('SELECT * FROM users ORDER BY created_at')).map(r => this.user(r)!); }
  async setPasswordHash(userId: string, passwordHash: string) { await this.run('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]); }
  async updateUser(id: string, patch: UserPatch) {
    const u = await this.getUser(id); if (!u) return null;
    const next = applyUserPatch(u, patch);
    try { await this.run('UPDATE users SET name = $1, email = $2, is_admin = $3, email_verified_at = $4, locale = $5, notify_email = $6 WHERE id = $7', [next.name, next.email, next.isAdmin, next.emailVerifiedAt, next.locale, next.notifyEmail, id]); }
    catch (e) { if ((e as { code?: string }).code === '23505') throw new Error('email ya registrado'); throw e; }
    return next;
  }
  async deleteUser(id: string) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      await c.query('DELETE FROM api_keys WHERE user_id = $1', [id]);
      await c.query('DELETE FROM workspace_members WHERE user_id = $1', [id]);
      await c.query('UPDATE snapshots SET author_id = NULL WHERE author_id = $1', [id]);
      await c.query('DELETE FROM account_tokens WHERE user_id = $1', [id]);
      await c.query('DELETE FROM notifications WHERE user_id = $1', [id]);
      await c.query('DELETE FROM users WHERE id = $1', [id]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  async createSession(userId: string, tokenHash: string, expiresAt: string, meta: SessionMeta = {}): Promise<Session> {
    const t = now();
    const s: Session = { tokenHash, userId, createdAt: t, expiresAt, device: meta.device ?? null, ip: meta.ip ?? null, lastUsedAt: t };
    await this.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, device, ip, last_used_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [tokenHash, userId, t, expiresAt, s.device, s.ip, t]);
    return s;
  }
  async getSession(tokenHash: string) {
    const r = await this.one('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);
    if (!r) return null;
    if ((r.expires_at as string) < now()) { await this.run('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); return null; }
    return this.session(r);
  }
  async touchSession(tokenHash: string, expiresAt: string) { await this.run('UPDATE sessions SET expires_at = $1 WHERE token_hash = $2', [expiresAt, tokenHash]); }
  async markSessionUsed(tokenHash: string, at: string, ip: string | null) { await this.run('UPDATE sessions SET last_used_at = $1, ip = COALESCE($2, ip) WHERE token_hash = $3', [at, ip, tokenHash]); }
  async listUserSessions(userId: string) {
    return (await this.all('SELECT * FROM sessions WHERE user_id = $1 AND expires_at >= $2 ORDER BY COALESCE(last_used_at, created_at) DESC', [userId, now()])).map(r => this.session(r));
  }
  async deleteSession(tokenHash: string) { await this.run('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); }
  async deleteUserSessions(userId: string, exceptTokenHash?: string) {
    if (exceptTokenHash) await this.run('DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2', [userId, exceptTokenHash]);
    else await this.run('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
  async purgeExpiredSessions() {
    const t = now();
    await this.run('DELETE FROM account_tokens WHERE expires_at < $1', [t]);
    return this.run('DELETE FROM sessions WHERE expires_at < $1', [t]);
  }

  async createAccountToken(a: Omit<AccountToken, 'createdAt'>): Promise<AccountToken> {
    const tok: AccountToken = { ...a, email: a.email.trim().toLowerCase(), createdAt: now() };
    await this.run('INSERT INTO account_tokens (token_hash, user_id, kind, email, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', [tok.tokenHash, tok.userId, tok.kind, tok.email, tok.createdAt, tok.expiresAt]);
    return tok;
  }
  async consumeAccountToken(tokenHash: string, kind: AccountTokenKind): Promise<AccountToken | null> {
    const r = await this.one('DELETE FROM account_tokens WHERE token_hash = $1 AND kind = $2 RETURNING *', [tokenHash, kind]);
    if (!r || (r.expires_at as string) < now()) return null;
    return { tokenHash: r.token_hash as string, userId: r.user_id as string, kind: r.kind as AccountTokenKind, email: r.email as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string };
  }
  async deleteAccountTokens(userId: string, kind?: AccountTokenKind) {
    if (kind) await this.run('DELETE FROM account_tokens WHERE user_id = $1 AND kind = $2', [userId, kind]);
    else await this.run('DELETE FROM account_tokens WHERE user_id = $1', [userId]);
  }

  async createNotification(n: { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }): Promise<Notification | null> {
    const row: Notification = { id: n.id ?? newId('ntf'), userId: n.userId, kind: n.kind, workspaceId: n.workspaceId, payload: n.payload, createdAt: now(), readAt: null };
    const changes = await this.run('INSERT INTO notifications (id, user_id, kind, workspace_id, payload, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING', [row.id, row.userId, row.kind, row.workspaceId, JSON.stringify(row.payload), row.createdAt]);
    if (!changes) return null;
    await this.run('DELETE FROM notifications WHERE user_id = $1 AND id NOT IN (SELECT id FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2)', [row.userId, MAX_NOTIFICATIONS_PER_USER]);
    return row;
  }
  async listNotifications(userId: string, limit: number) {
    return (await this.all('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2', [userId, Math.max(0, limit)])).map(r => this.notification(r));
  }
  async countUnreadNotifications(userId: string) { return Number((await this.one<{ n: string }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]))!.n); }
  async markNotificationsRead(userId: string, ids?: string[]) {
    const t = now();
    if (!ids) return this.run('UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL', [t, userId]);
    if (ids.length === 0) return 0;
    return this.run('UPDATE notifications SET read_at = $1 WHERE user_id = $2 AND read_at IS NULL AND id = ANY($3)', [t, userId, ids]);
  }

  async createApiKey(k: { userId: string; name: string; prefix: string; keyHash: string }): Promise<ApiKey> {
    const key: ApiKey = { id: newId('key'), ...k, createdAt: now(), lastUsedAt: null };
    await this.run('INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [key.id, key.userId, key.name, key.prefix, key.keyHash, key.createdAt]);
    return key;
  }
  async listApiKeys(userId: string) { return (await this.all('SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC', [userId])).map(r => this.apiKey(r)!); }
  async resolveApiKey(keyHash: string) { return this.apiKey(await this.one('SELECT * FROM api_keys WHERE key_hash = $1', [keyHash])); }
  async deleteApiKey(userId: string, id: string) { return (await this.run('DELETE FROM api_keys WHERE id = $1 AND user_id = $2', [id, userId])) > 0; }
  async touchApiKey(id: string) { await this.run('UPDATE api_keys SET last_used_at = $1 WHERE id = $2', [now(), id]); }

  async listWorkspaces(userId: string) {
    const rows = await this.all<Row & { role: string }>(
      `SELECT w.*, 'owner' AS role FROM workspaces w WHERE w.owner_id = $1
       UNION ALL
       SELECT w.*, m.role AS role FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id WHERE m.user_id = $1 AND w.owner_id != $1
       ORDER BY updated_at DESC`, [userId]);
    return rows.map(r => ({ ...this.workspace(r)!, role: r.role as Role }));
  }
  async listAllWorkspaces() { return (await this.all('SELECT * FROM workspaces ORDER BY updated_at DESC')).map(r => this.workspace(r)!); }
  async countOwnedWorkspaces(userId: string) { return Number((await this.one<{ n: string }>('SELECT COUNT(*) AS n FROM workspaces WHERE owner_id = $1', [userId]))!.n); }
  async getWorkspace(id: string) { return this.workspace(await this.one('SELECT * FROM workspaces WHERE id = $1', [id])); }
  async createWorkspace(w: { ownerId: string; name: string; id?: string }): Promise<WorkspaceRow> {
    const t = now();
    const row: WorkspaceRow = { id: w.id ?? newId('ws'), ownerId: w.ownerId, name: w.name, createdAt: t, updatedAt: t };
    await this.run('INSERT INTO workspaces (id, owner_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [row.id, row.ownerId, row.name, t, t]);
    return row;
  }
  async updateMeta(id: string, patch: { name?: string; ownerId?: string }) {
    const w = await this.getWorkspace(id); if (!w) return null;
    const name = patch.name ?? w.name, ownerId = patch.ownerId ?? w.ownerId, t = now();
    await this.run('UPDATE workspaces SET name = $1, owner_id = $2, updated_at = $3 WHERE id = $4', [name, ownerId, t, id]);
    return { ...w, name, ownerId, updatedAt: t };
  }
  async deleteWorkspace(id: string) { await this.run('DELETE FROM workspaces WHERE id = $1', [id]); }

  async loadDoc(id: string) {
    const base = await this.one<{ state: Uint8Array }>('SELECT state FROM docs WHERE workspace_id = $1', [id]);
    const extra = await this.all<{ data: Uint8Array }>('SELECT data FROM doc_updates WHERE workspace_id = $1 ORDER BY id', [id]);
    if (!base && extra.length === 0) return null;
    const parts = [...(base ? [bytes(base.state)] : []), ...extra.map(e => bytes(e.data))];
    return parts.length === 1 ? parts[0]! : Y.mergeUpdates(parts);
  }
  async saveDoc(id: string, update: Uint8Array) {
    const t = now();
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('INSERT INTO docs (workspace_id, state, updated_at) VALUES ($1, $2, $3) ON CONFLICT (workspace_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at', [id, Buffer.from(update.buffer, update.byteOffset, update.byteLength), t]);
      await c.query('DELETE FROM doc_updates WHERE workspace_id = $1', [id]);
      await c.query('UPDATE workspaces SET updated_at = $1 WHERE id = $2', [t, id]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  async appendUpdate(id: string, update: Uint8Array) {
    await this.run('INSERT INTO doc_updates (workspace_id, data, created_at) VALUES ($1, $2, $3)', [id, Buffer.from(update.buffer, update.byteOffset, update.byteLength), now()]);
  }

  async getRole(workspaceId: string, userId: string): Promise<Role | null> {
    const w = await this.one('SELECT owner_id FROM workspaces WHERE id = $1', [workspaceId]);
    if (!w) return null;
    if (w.owner_id === userId) return 'owner';
    const m = await this.one('SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, userId]);
    return (m?.role as Role | undefined) ?? null;
  }
  async setRole(workspaceId: string, userId: string, role: MemberRole | null) {
    if (!role) { await this.run('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [workspaceId, userId]); return; }
    await this.run('INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = excluded.role', [workspaceId, userId, role, now()]);
  }
  async listMembers(workspaceId: string) {
    return (await this.all('SELECT m.*, u.email, u.name FROM workspace_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.workspace_id = $1 ORDER BY m.created_at', [workspaceId])).map(r => ({
      workspaceId, userId: r.user_id as string, role: r.role as MemberRole, createdAt: r.created_at as string,
      user: r.email ? { id: r.user_id as string, email: r.email as string, name: r.name as string } : null,
    } satisfies Member & { user: Pick<User, 'id' | 'email' | 'name'> | null }));
  }

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null };
    await this.run('INSERT INTO share_links (token, workspace_id, role, created_by, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)', [link.token, link.workspaceId, link.role, link.createdBy, link.createdAt, link.expiresAt]);
    return link;
  }
  async listShareLinks(workspaceId: string) { return (await this.all('SELECT * FROM share_links WHERE workspace_id = $1 ORDER BY created_at', [workspaceId])).map(r => this.link(r)!); }
  async resolveShareLink(token: string) {
    const l = this.link(await this.one('SELECT * FROM share_links WHERE token = $1', [token]));
    if (!l) return null;
    if (l.expiresAt && l.expiresAt < now()) return null;
    return l;
  }
  async deleteShareLink(workspaceId: string, token: string) { return (await this.run('DELETE FROM share_links WHERE token = $1 AND workspace_id = $2', [token, workspaceId])) > 0; }

  async createSnapshot(s: { workspaceId: string; authorId: string | null; label: string | null; data: Uint8Array; id?: string }): Promise<SnapshotMeta> {
    const meta: SnapshotMeta = { id: s.id ?? newId('snp'), workspaceId: s.workspaceId, createdAt: now(), authorId: s.authorId, label: s.label, size: s.data.byteLength };
    await this.run('INSERT INTO snapshots (id, workspace_id, created_at, author_id, label, data, size) VALUES ($1, $2, $3, $4, $5, $6, $7)', [meta.id, meta.workspaceId, meta.createdAt, meta.authorId, meta.label, Buffer.from(s.data.buffer, s.data.byteOffset, s.data.byteLength), meta.size]);
    return meta;
  }
  async listSnapshots(workspaceId: string) {
    return (await this.all('SELECT id, workspace_id, created_at, author_id, label, size FROM snapshots WHERE workspace_id = $1 ORDER BY created_at DESC, id DESC', [workspaceId])).map(r => this.snapshotMeta(r));
  }
  async getSnapshot(workspaceId: string, id: string): Promise<Snapshot | null> {
    const r = await this.one('SELECT * FROM snapshots WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return r ? { ...this.snapshotMeta(r), data: bytes(r.data) } : null;
  }
  async deleteSnapshot(workspaceId: string, id: string) { return (await this.run('DELETE FROM snapshots WHERE id = $1 AND workspace_id = $2', [id, workspaceId])) > 0; }
  async pruneSnapshots(workspaceId: string, keep: number) {
    const total = Number((await this.one<{ n: string }>('SELECT COUNT(*) AS n FROM snapshots WHERE workspace_id = $1', [workspaceId]))!.n);
    if (total <= keep) return 0;
    return this.run('DELETE FROM snapshots WHERE id IN (SELECT id FROM snapshots WHERE workspace_id = $1 AND label IS NULL ORDER BY created_at ASC, id ASC LIMIT $2)', [workspaceId, total - keep]);
  }

  /** Tamaño de la base de datos (`pg_database_size`), para `/metrics`. */
  async dbSizeBytes(): Promise<number> { return Number((await this.one<{ n: string }>('SELECT pg_database_size(current_database()) AS n'))!.n); }

  async close() { await this.pool.end(); }
}
