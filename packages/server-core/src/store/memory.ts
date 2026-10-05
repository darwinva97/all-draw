/** Adaptador en memoria: tests y pruebas rápidas. Referencia de semántica para los demás adaptadores. */
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import { MAX_NOTIFICATIONS_PER_USER, type AccountToken, type AccountTokenKind, type ApiKey, type Member, type MemberRole, type Notification, type NotificationKind, type Role, type Session, type SessionMeta, type ShareLink, type Snapshot, type SnapshotMeta, type User, type UserPatch, type WorkspaceRow, type WorkspaceStore } from './types';

const now = () => new Date().toISOString();

export class MemoryWorkspaceStore implements WorkspaceStore {
  users = new Map<string, User>();
  sessions = new Map<string, Session>();
  apiKeys = new Map<string, ApiKey>();
  workspaces = new Map<string, WorkspaceRow>();
  members = new Map<string, Member>(); // `${workspaceId}/${userId}`
  links = new Map<string, ShareLink>();
  docs = new Map<string, Uint8Array>();
  pending = new Map<string, Uint8Array[]>();
  snapshots = new Map<string, Snapshot>();
  accountTokens = new Map<string, AccountToken>();
  notifications = new Map<string, Notification>();

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string; locale?: string | null }): Promise<User> {
    const email = u.email.trim().toLowerCase();
    if ([...this.users.values()].some(x => x.email === email)) throw new Error('email ya registrado');
    const user: User = { id: u.id ?? newId('usr'), email, name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now(), emailVerifiedAt: null, locale: u.locale ?? null, notifyEmail: true };
    this.users.set(user.id, user);
    return user;
  }
  async getUser(id: string) { return this.users.get(id) ?? null; }
  async getUserByEmail(email: string) { const e = email.trim().toLowerCase(); return [...this.users.values()].find(u => u.email === e) ?? null; }
  async countUsers() { return this.users.size; }
  async listUsers() { return [...this.users.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  async setPasswordHash(userId: string, passwordHash: string) { const u = this.users.get(userId); if (u) u.passwordHash = passwordHash; }
  async updateUser(id: string, patch: UserPatch) {
    const u = this.users.get(id); if (!u) return null;
    if (patch.email !== undefined) {
      const email = patch.email.trim().toLowerCase();
      if ([...this.users.values()].some(x => x.email === email && x.id !== id)) throw new Error('email ya registrado');
      u.email = email;
    }
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.isAdmin !== undefined) u.isAdmin = patch.isAdmin;
    if (patch.emailVerifiedAt !== undefined) u.emailVerifiedAt = patch.emailVerifiedAt;
    if (patch.locale !== undefined) u.locale = patch.locale;
    if (patch.notifyEmail !== undefined) u.notifyEmail = patch.notifyEmail;
    return u;
  }
  async deleteUser(id: string) {
    this.users.delete(id);
    for (const [k, s] of this.sessions) if (s.userId === id) this.sessions.delete(k);
    for (const [k, key] of this.apiKeys) if (key.userId === id) this.apiKeys.delete(k);
    for (const [k, m] of this.members) if (m.userId === id) this.members.delete(k);
    for (const sn of this.snapshots.values()) if (sn.authorId === id) sn.authorId = null;
    for (const [k, t] of this.accountTokens) if (t.userId === id) this.accountTokens.delete(k);
    for (const [k, n] of this.notifications) if (n.userId === id) this.notifications.delete(k);
  }

  async createSession(userId: string, tokenHash: string, expiresAt: string, meta: SessionMeta = {}): Promise<Session> {
    const t = now();
    const s: Session = { tokenHash, userId, createdAt: t, expiresAt, device: meta.device ?? null, ip: meta.ip ?? null, lastUsedAt: t };
    this.sessions.set(tokenHash, s); return s;
  }
  async getSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    if (!s) return null;
    if (s.expiresAt < now()) { this.sessions.delete(tokenHash); return null; }
    return s;
  }
  async touchSession(tokenHash: string, expiresAt: string) { const s = this.sessions.get(tokenHash); if (s) s.expiresAt = expiresAt; }
  async markSessionUsed(tokenHash: string, at: string, ip: string | null) { const s = this.sessions.get(tokenHash); if (s) { s.lastUsedAt = at; if (ip) s.ip = ip; } }
  async listUserSessions(userId: string) {
    const t = now();
    return [...this.sessions.values()].filter(s => s.userId === userId && s.expiresAt >= t).sort((a, b) => (b.lastUsedAt ?? b.createdAt).localeCompare(a.lastUsedAt ?? a.createdAt));
  }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }
  async deleteUserSessions(userId: string, exceptTokenHash?: string) {
    for (const [k, s] of this.sessions) if (s.userId === userId && k !== exceptTokenHash) this.sessions.delete(k);
  }
  async purgeExpiredSessions() {
    const t = now(); let n = 0;
    for (const [k, s] of this.sessions) if (s.expiresAt < t) { this.sessions.delete(k); n++; }
    for (const [k, a] of this.accountTokens) if (a.expiresAt < t) this.accountTokens.delete(k);
    return n;
  }

  async createAccountToken(a: Omit<AccountToken, 'createdAt'>): Promise<AccountToken> {
    const tok: AccountToken = { ...a, email: a.email.trim().toLowerCase(), createdAt: now() };
    this.accountTokens.set(tok.tokenHash, tok); return tok;
  }
  async consumeAccountToken(tokenHash: string, kind: AccountTokenKind) {
    const a = this.accountTokens.get(tokenHash);
    if (!a || a.kind !== kind) return null;
    this.accountTokens.delete(tokenHash);
    return a.expiresAt < now() ? null : a;
  }
  async deleteAccountTokens(userId: string, kind?: AccountTokenKind) {
    for (const [k, a] of this.accountTokens) if (a.userId === userId && (!kind || a.kind === kind)) this.accountTokens.delete(k);
  }

  async createNotification(n: { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }): Promise<Notification | null> {
    const id = n.id ?? newId('ntf');
    if (this.notifications.has(id)) return null;
    const row: Notification = { id, userId: n.userId, kind: n.kind, workspaceId: n.workspaceId, payload: structuredClone(n.payload), createdAt: now(), readAt: null };
    this.notifications.set(id, row);
    const mine = [...this.notifications.values()].filter(x => x.userId === n.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    for (const old of mine.slice(MAX_NOTIFICATIONS_PER_USER)) this.notifications.delete(old.id);
    return { ...row, payload: structuredClone(row.payload) };
  }
  async listNotifications(userId: string, limit: number) {
    return [...this.notifications.values()].filter(x => x.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(0, Math.max(0, limit)).map(x => ({ ...x, payload: structuredClone(x.payload) }));
  }
  async countUnreadNotifications(userId: string) { return [...this.notifications.values()].filter(x => x.userId === userId && !x.readAt).length; }
  async markNotificationsRead(userId: string, ids?: string[]) {
    const t = now(); let n = 0;
    const want = ids ? new Set(ids) : null;
    for (const x of this.notifications.values()) if (x.userId === userId && !x.readAt && (!want || want.has(x.id))) { x.readAt = t; n++; }
    return n;
  }

  async createApiKey(k: { userId: string; name: string; prefix: string; keyHash: string }): Promise<ApiKey> {
    const key: ApiKey = { id: newId('key'), ...k, createdAt: now(), lastUsedAt: null };
    this.apiKeys.set(key.id, key); return key;
  }
  async listApiKeys(userId: string) { return [...this.apiKeys.values()].filter(k => k.userId === userId); }
  async resolveApiKey(keyHash: string) { return [...this.apiKeys.values()].find(k => k.keyHash === keyHash) ?? null; }
  async deleteApiKey(userId: string, id: string) { const k = this.apiKeys.get(id); if (!k || k.userId !== userId) return false; this.apiKeys.delete(id); return true; }
  async touchApiKey(id: string) { const k = this.apiKeys.get(id); if (k) k.lastUsedAt = now(); }

  async listWorkspaces(userId: string) {
    const out: (WorkspaceRow & { role: Role })[] = [];
    for (const w of this.workspaces.values()) {
      const role = await this.getRole(w.id, userId);
      if (role) out.push({ ...w, role });
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async listAllWorkspaces() { return [...this.workspaces.values()]; }
  async countOwnedWorkspaces(userId: string) { return [...this.workspaces.values()].filter(w => w.ownerId === userId).length; }
  async getWorkspace(id: string) { return this.workspaces.get(id) ?? null; }
  async createWorkspace(w: { ownerId: string; name: string; id?: string }): Promise<WorkspaceRow> {
    const t = now();
    const row: WorkspaceRow = { id: w.id ?? newId('ws'), ownerId: w.ownerId, name: w.name, createdAt: t, updatedAt: t };
    this.workspaces.set(row.id, row); return row;
  }
  async updateMeta(id: string, patch: { name?: string; ownerId?: string }) {
    const w = this.workspaces.get(id); if (!w) return null;
    if (patch.name !== undefined) w.name = patch.name;
    if (patch.ownerId !== undefined) w.ownerId = patch.ownerId;
    w.updatedAt = now(); return w;
  }
  async deleteWorkspace(id: string) {
    this.workspaces.delete(id); this.docs.delete(id); this.pending.delete(id);
    for (const [k, m] of this.members) if (m.workspaceId === id) this.members.delete(k);
    for (const [k, l] of this.links) if (l.workspaceId === id) this.links.delete(k);
    for (const [k, sn] of this.snapshots) if (sn.workspaceId === id) this.snapshots.delete(k);
    for (const [k, n] of this.notifications) if (n.workspaceId === id) this.notifications.delete(k);
  }

  async loadDoc(id: string) {
    const base = this.docs.get(id), extra = this.pending.get(id) ?? [];
    if (!base && extra.length === 0) return null;
    return Y.mergeUpdates([...(base ? [base] : []), ...extra]);
  }
  async saveDoc(id: string, update: Uint8Array) {
    this.docs.set(id, update); this.pending.delete(id);
    const w = this.workspaces.get(id); if (w) w.updatedAt = now();
  }
  async appendUpdate(id: string, update: Uint8Array) {
    const list = this.pending.get(id) ?? []; list.push(update); this.pending.set(id, list);
  }

  async getRole(workspaceId: string, userId: string): Promise<Role | null> {
    const w = this.workspaces.get(workspaceId); if (!w) return null;
    if (w.ownerId === userId) return 'owner';
    return this.members.get(`${workspaceId}/${userId}`)?.role ?? null;
  }
  async setRole(workspaceId: string, userId: string, role: MemberRole | null) {
    const k = `${workspaceId}/${userId}`;
    if (!role) this.members.delete(k);
    else this.members.set(k, { workspaceId, userId, role, createdAt: this.members.get(k)?.createdAt ?? now() });
  }
  async listMembers(workspaceId: string) {
    return [...this.members.values()].filter(m => m.workspaceId === workspaceId).map(m => {
      const u = this.users.get(m.userId);
      return { ...m, user: u ? { id: u.id, email: u.email, name: u.name } : null };
    });
  }

  async createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null }): Promise<ShareLink> {
    const link: ShareLink = { token: l.token, workspaceId: l.workspaceId, role: l.role, createdBy: l.createdBy, createdAt: now(), expiresAt: l.expiresAt ?? null };
    this.links.set(link.token, link); return link;
  }
  async listShareLinks(workspaceId: string) { return [...this.links.values()].filter(l => l.workspaceId === workspaceId); }
  async resolveShareLink(token: string) {
    const l = this.links.get(token); if (!l) return null;
    if (l.expiresAt && l.expiresAt < now()) return null;
    return l;
  }
  async deleteShareLink(workspaceId: string, token: string) { const l = this.links.get(token); if (!l || l.workspaceId !== workspaceId) return false; this.links.delete(token); return true; }

  async createSnapshot(s: { workspaceId: string; authorId: string | null; label: string | null; data: Uint8Array; id?: string }): Promise<SnapshotMeta> {
    const snap: Snapshot = { id: s.id ?? newId('snp'), workspaceId: s.workspaceId, createdAt: now(), authorId: s.authorId, label: s.label, size: s.data.byteLength, data: s.data };
    this.snapshots.set(snap.id, snap);
    const { data: _d, ...meta } = snap; return meta;
  }
  async listSnapshots(workspaceId: string): Promise<SnapshotMeta[]> {
    return [...this.snapshots.values()].filter(s => s.workspaceId === workspaceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).map(({ data: _d, ...m }) => m);
  }
  async getSnapshot(workspaceId: string, id: string) { const s = this.snapshots.get(id); return s && s.workspaceId === workspaceId ? s : null; }
  async deleteSnapshot(workspaceId: string, id: string) { const s = this.snapshots.get(id); if (!s || s.workspaceId !== workspaceId) return false; this.snapshots.delete(id); return true; }
  async pruneSnapshots(workspaceId: string, keep: number) {
    const all = await this.listSnapshots(workspaceId);
    let excess = all.length - keep, n = 0;
    for (const s of [...all].reverse()) { if (excess <= 0) break; if (s.label === null) { this.snapshots.delete(s.id); excess--; n++; } }
    return n;
  }

  async close() { /* nada */ }
}
