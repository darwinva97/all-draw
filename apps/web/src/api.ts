/** Cliente de la API del servidor (misma origen; la sesión va en cookie). */
export interface User { id: string; email: string; name: string; isAdmin: boolean }
export type Role = 'owner' | 'editor' | 'viewer';
export interface WorkspaceInfo { id: string; name: string; ownerId: string; createdAt: string; updatedAt: string; role: Role }
export interface ShareLink { token: string; url: string; role: 'editor' | 'viewer'; createdAt: string; expiresAt: string | null }
export interface ApiKey { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; key?: string }
export interface SnapshotInfo { id: string; workspaceId: string; createdAt: string; authorId: string | null; author: { id: string; name: string } | null; label: string | null; size: number }
export type RegistrationMode = 'open' | 'invite' | 'closed';
export interface AdminUser extends User { createdAt: string }
/** Cuotas de la cuenta (`GET /api/auth/me`); `limit: null` = sin límite. */
export interface Quotas { workspaces: { used: number; limit: number | null }; docBytes: { limit: number | null } }
export interface DeleteAccountResult { ok: true; deleted: string[]; transferred: { id: string; to: string }[] }

let bearer: string | null = null;
export function setBearer(t: string | null) { bearer = t; }

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  // `x-requested-with` es la marca anti-CSRF que el servidor exige a las peticiones con cookie que modifican algo.
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-requested-with': 'all-draw' };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  let r: Response;
  try { r = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new ApiError(0, (e as Error).message || 'network error'); } // sin red o servidor caído
  // Una respuesta HTML a una ruta /api es la página de la app (sin servidor detrás): se trata como "servidor no disponible".
  if (r.ok && (r.headers.get('content-type') ?? '').includes('text/html')) throw new ApiError(0, 'no api');
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? r.statusText, data as Record<string, unknown>);
  return data as T;
}
export class ApiError extends Error {
  status: number;
  /** Código de error del servidor (`quota_workspaces`, `doc_too_large`, `form_token`, `last_admin`…), si lo hay. */
  code?: string;
  constructor(status: number, msg: string, data?: Record<string, unknown>) { super(msg); this.status = status; if (typeof data?.code === 'string') this.code = data.code; }
  /** Sin conexión con el servidor (status 0): se puede reintentar. */
  get network(): boolean { return this.status === 0; }
}
/** ¿Es un fallo de red (y no un rechazo del servidor)? */
export const isNetworkError = (e: unknown): boolean => (e instanceof ApiError && e.network) || e instanceof TypeError;

// Anti-abuso del registro: el servidor da un `formToken` con `GET /api/auth/config` y no acepta el registro
// hasta pasados `formMinMs`. Una persona tarda más en rellenar el formulario; si no, se espera lo que falte.
let form: { token: string; minMs: number; at: number } | null = null;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function loadAuthConfig(): Promise<RegistrationMode> {
  const r = await req<{ registration: RegistrationMode; formToken?: string; formMinMs?: number }>('GET', '/api/auth/config');
  form = r.formToken ? { token: r.formToken, minMs: r.formMinMs ?? 0, at: Date.now() } : null;
  return r.registration;
}
async function register(email: string, name: string, password: string, inviteCode?: string, website?: string) {
  for (let attempt = 0; ; attempt++) {
    if (!form || Date.now() - form.at > 12 * 3_600_000) await loadAuthConfig().catch(() => null);
    if (form) await sleep(Math.max(0, form.at + form.minMs + 150 - Date.now()));
    const body: Record<string, string> = { email, name, password };
    if (inviteCode) body.inviteCode = inviteCode;
    if (form) body.formToken = form.token;
    if (website) body.website = website;
    try { return await req<{ user: User; token: string }>('POST', '/api/auth/register', body); }
    catch (e) { if (attempt === 0 && e instanceof ApiError && e.code === 'form_token') { form = null; continue; } throw e; }
  }
}

/** Descarga un JSON de la API como fichero (exportación de datos). */
async function download(path: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = { 'x-requested-with': 'all-draw' };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const r = await fetch(path, { headers, credentials: 'same-origin' });
  if (!r.ok) { const data = await r.json().catch(() => ({})) as Record<string, unknown>; throw new ApiError(r.status, String(data.error ?? r.statusText), data); }
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const api = {
  available: () => fetch('/api/notations', { method: 'HEAD' }).then(r => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) || r.status === 405, () => false),
  me: () => req<{ user: User }>('GET', '/api/auth/me').then(r => r.user, () => null),
  login: (email: string, password: string) => req<{ user: User; token: string }>('POST', '/api/auth/login', { email, password }),
  /** `website` es la trampa para bots del formulario (un campo oculto que una persona deja vacío). */
  register,
  account: () => req<{ user: User; quotas: Quotas }>('GET', '/api/auth/me'),
  updateMe: (patch: { name?: string; email?: string; password?: string }) => req<{ user: User }>('PATCH', '/api/auth/me', patch).then(r => r.user),
  exportData: () => download('/api/auth/export', 'alldraw-export.json'),
  deleteAccount: (password: string) => req<DeleteAccountResult>('DELETE', '/api/auth/account', { password }),
  logout: () => req<void>('POST', '/api/auth/logout'),
  logoutAll: () => req<void>('DELETE', '/api/auth/sessions'),
  authConfig: () => loadAuthConfig().catch(() => 'open' as RegistrationMode),
  changePassword: (current: string, password: string) => req<{ ok: true }>('POST', '/api/auth/password', { current, password }),
  adminUsers: () => req<{ users: AdminUser[] }>('GET', '/api/admin/users').then(r => r.users),
  adminSetAdmin: (id: string, isAdmin: boolean) => req<{ user: AdminUser }>('PATCH', `/api/admin/users/${encodeURIComponent(id)}`, { isAdmin }).then(r => r.user),
  adminReset: (id: string) => req<{ password: string }>('POST', `/api/admin/users/${encodeURIComponent(id)}/reset`).then(r => r.password),
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
  snapshots: (id: string) => req<{ snapshots: SnapshotInfo[] }>('GET', `/api/workspaces/${encodeURIComponent(id)}/snapshots`).then(r => r.snapshots),
  createSnapshot: (id: string, label?: string) => req<SnapshotInfo>('POST', `/api/workspaces/${encodeURIComponent(id)}/snapshots`, label ? { label } : {}),
  snapshot: (id: string, sid: string) => req<unknown>('GET', `/api/workspaces/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(sid)}`),
  restoreSnapshot: (id: string, sid: string) => req<{ ok: true }>('POST', `/api/workspaces/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(sid)}/restore`),
  deleteSnapshot: (id: string, sid: string) => req<void>('DELETE', `/api/workspaces/${encodeURIComponent(id)}/snapshots/${encodeURIComponent(sid)}`),
};
