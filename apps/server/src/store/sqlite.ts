/**
 * Adaptador SQLite con `node:sqlite` (incluido en Node ≥ 22.13). Un fichero, sin dependencias
 * nativas externas. Las migraciones se aplican al abrir (`schema_migrations`).
 *
 * El esquema es SQL estándar: `postgres.ts` es una traducción directa (`BLOB` → `BYTEA`,
 * `INTEGER` booleanos → `BOOLEAN`, `?` → `$n`) y `apps/worker/migrations/0001_init.sql` (D1) es este mismo SQL.
 */
import { DatabaseSync } from 'node:sqlite';
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import type { ApiKey, Member, MemberRole, Role, Session, ShareLink, User, WorkspaceRow, WorkspaceStore } from '@all-draw/server-core';

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
];

type Row = Record<string, unknown>;

export class SqliteWorkspaceStore implements WorkspaceStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
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

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string }): Promise<User> {
    const user: User = { id: u.id ?? newId('usr'), email: u.email.trim().toLowerCase(), name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now() };
    try {
      this.run('INSERT INTO users (id, email, name, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, user.email, user.name, user.passwordHash, user.isAdmin ? 1 : 0, user.createdAt);
    } catch (e) { if (String(e).includes('UNIQUE')) throw new Error('email ya registrado'); throw e; }
    return user;
  }
  async getUser(id: string) { return this.user(this.one('SELECT * FROM users WHERE id = ?', id)); }
  async getUserByEmail(email: string) { return this.user(this.one('SELECT * FROM users WHERE email = ?', email.trim().toLowerCase())); }
  async countUsers() { return (this.one<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n; }
  async setPasswordHash(userId: string, passwordHash: string) { this.run('UPDATE users SET password_hash = ? WHERE id = ?', passwordHash, userId); }

  async createSession(userId: string, tokenHash: string, expiresAt: string): Promise<Session> {
    const s: Session = { tokenHash, userId, createdAt: now(), expiresAt };
    this.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', tokenHash, userId, s.createdAt, expiresAt);
    return s;
  }
  async getSession(tokenHash: string) {
    const r = this.one<Row>('SELECT * FROM sessions WHERE token_hash = ?', tokenHash);
    if (!r) return null;
    if ((r.expires_at as string) < now()) { this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); return null; }
    return { tokenHash, userId: r.user_id as string, createdAt: r.created_at as string, expiresAt: r.expires_at as string };
  }
  async deleteSession(tokenHash: string) { this.run('DELETE FROM sessions WHERE token_hash = ?', tokenHash); }

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

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null };
    this.run('INSERT INTO share_links (token, workspace_id, role, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', link.token, link.workspaceId, link.role, link.createdBy, link.createdAt, link.expiresAt);
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

  async close() { this.db.close(); }
}
