/** Cliente de la API del servidor (misma origen; la sesión va en cookie). */
export interface User { id: string; email: string; name: string; isAdmin: boolean }
export type Role = 'owner' | 'editor' | 'viewer';
export interface WorkspaceInfo { id: string; name: string; ownerId: string; createdAt: string; updatedAt: string; role: Role }
export interface ShareLink { token: string; url: string; role: 'editor' | 'viewer'; createdAt: string; expiresAt: string | null }
export interface ApiKey { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; key?: string }

let bearer: string | null = null;
export function setBearer(t: string | null) { bearer = t; }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const r = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? r.statusText);
  return data as T;
}
export class ApiError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

export const api = {
  available: () => fetch('/api/notations', { method: 'HEAD' }).then(r => r.ok || r.status === 405, () => false),
  me: () => req<{ user: User }>('GET', '/api/auth/me').then(r => r.user, () => null),
  login: (email: string, password: string) => req<{ user: User; token: string }>('POST', '/api/auth/login', { email, password }),
  register: (email: string, name: string, password: string) => req<{ user: User; token: string }>('POST', '/api/auth/register', { email, name, password }),
  logout: () => req<void>('POST', '/api/auth/logout'),
  workspaces: () => req<{ workspaces: WorkspaceInfo[] } | WorkspaceInfo[]>('GET', '/api/workspaces').then(r => Array.isArray(r) ? r : r.workspaces),
  workspace: (id: string) => req<WorkspaceInfo>('GET', `/api/workspaces/${encodeURIComponent(id)}`),
  createWorkspace: (name: string, initial?: unknown) => req<WorkspaceInfo>('POST', '/api/workspaces', initial ? { name, initial } : { name }),
  renameWorkspace: (id: string, name: string) => req<WorkspaceInfo>('PATCH', `/api/workspaces/${encodeURIComponent(id)}`, { name }),
  deleteWorkspace: (id: string) => req<void>('DELETE', `/api/workspaces/${encodeURIComponent(id)}`),
  links: (id: string) => req<{ links: ShareLink[] }>('GET', `/api/workspaces/${encodeURIComponent(id)}/links`).then(r => r.links),
  createLink: (id: string, role: 'editor' | 'viewer') => req<ShareLink>('POST', `/api/workspaces/${encodeURIComponent(id)}/links`, { role }),
  deleteLink: (id: string, token: string) => req<void>('DELETE', `/api/workspaces/${encodeURIComponent(id)}/links/${encodeURIComponent(token)}`),
  keys: () => req<{ keys: ApiKey[] } | ApiKey[]>('GET', '/api/keys').then(r => Array.isArray(r) ? r : r.keys),
  createKey: (name: string) => req<ApiKey>('POST', '/api/keys', { name }),
  deleteKey: (id: string) => req<void>('DELETE', `/api/keys/${encodeURIComponent(id)}`),
};
