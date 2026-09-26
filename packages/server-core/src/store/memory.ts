/** Adaptador en memoria: tests y pruebas rápidas. Referencia de semántica para los demás adaptadores. */
import * as Y from 'yjs';
import { newId } from '@all-draw/core';
import type { ApiKey, Member, MemberRole, Role, Session, ShareLink, User, WorkspaceRow, WorkspaceStore } from './types';

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

  async createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string }): Promise<User> {
    const email = u.email.trim().toLowerCase();
    if ([...this.users.values()].some(x => x.email === email)) throw new Error('email ya registrado');
    const user: User = { id: u.id ?? newId('usr'), email, name: u.name, passwordHash: u.passwordHash, isAdmin: !!u.isAdmin, createdAt: now() };
    this.users.set(user.id, user);
    return user;
  }
  async getUser(id: string) { return this.users.get(id) ?? null; }
  async getUserByEmail(email: string) { const e = email.trim().toLowerCase(); return [...this.users.values()].find(u => u.email === e) ?? null; }
  async countUsers() { return this.users.size; }
  async setPasswordHash(userId: string, passwordHash: string) { const u = this.users.get(userId); if (u) u.passwordHash = passwordHash; }

  async createSession(userId: string, tokenHash: string, expiresAt: string): Promise<Session> {
    const s: Session = { tokenHash, userId, createdAt: now(), expiresAt };
    this.sessions.set(tokenHash, s); return s;
  }
  async getSession(tokenHash: string) {
    const s = this.sessions.get(tokenHash);
    if (!s) return null;
    if (s.expiresAt < now()) { this.sessions.delete(tokenHash); return null; }
    return s;
  }
  async deleteSession(tokenHash: string) { this.sessions.delete(tokenHash); }

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

  async close() { /* nada */ }
}
