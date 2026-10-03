/** Cliente de la API del servidor (misma origen; la sesión va en cookie). */
import { getLang, t } from '@all-draw/i18n';
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

/**
 * Errores del servidor en el idioma de la interfaz. El servidor responde `{ error, code, …vars }`: `error` en español
 * (compatibilidad) y `code` estable. Aquí cada `code` tiene su texto (clave en español, con las variables de la
 * respuesta) y se traduce con `t()`. Sin `code` conocido se traduce el propio `error` si el diccionario lo tiene
 * (p. ej. los «… desde una sesión»), y si no se deja tal cual.
 */
export const SERVER_ERRORS: Record<string, string> = {
  body_too_large: 'Cuerpo demasiado grande',
  csrf: 'Petición rechazada por seguridad (CSRF): recarga la página.',
  unauthenticated: 'Identifícate: cookie de sesión o Authorization: Bearer <token>',
  account_required: 'Esta operación requiere una cuenta, no un enlace compartido',
  workspace_not_found: 'El espacio no existe',
  no_access: 'No tienes acceso a este espacio',
  login_required: 'Identifícate para acceder al espacio',
  role_required: 'Se requiere el rol «{required}» (tienes «{role}»)',
  admin_only: 'Solo administradores',
  too_many_reports: 'Demasiados informes de error; gracias, ya tenemos bastantes',
  too_many_registrations: 'Demasiados registros desde esta dirección; espera un rato',
  registration_rejected: 'Registro rechazado',
  registration_closed: 'El registro está cerrado',
  bad_invite_code: 'Código de invitación incorrecto',
  email_taken: 'Ese email ya está registrado',
  too_many_attempts: 'Demasiados intentos; espera unos minutos',
  bad_credentials: 'Email o contraseña incorrectos',
  password_required: 'Para cambiar el email escribe tu contraseña actual',
  wrong_password: 'La contraseña no es correcta',
  last_admin: 'Eres el único administrador: nombra antes a otro administrador (Cuenta → Usuarios del servidor)',
  archive_failed: 'No se pudo guardar la copia final de un espacio; no se ha borrado nada. Inténtalo más tarde.',
  wrong_current_password: 'La contraseña actual no es correcta',
  user_not_found: 'Usuario desconocido',
  admin_required: 'Tiene que quedar al menos un administrador',
  key_not_found: 'No existe esa clave',
  quota_workspaces: 'Has llegado al máximo de {limit} espacios por cuenta: borra los que ya no uses para crear otros.',
  doc_too_large: 'El espacio supera el tamaño máximo ({size}). Reparte el modelo en varios espacios.',
  invalid_workspace: 'initial no es un Workspace válido',
  link_cannot_change_owner: 'Un enlace compartido no puede cambiar el dueño',
  owner_not_found: 'ownerId no existe',
  owner_has_no_role: 'El dueño no necesita rol',
  too_many_links: 'Demasiados enlaces creados; espera unos minutos',
  link_not_found: 'No existe ese enlace',
  view_not_found: 'La vista no existe',
  snapshot_not_found: 'No existe esa instantánea',
  link_expired: 'Este enlace caducó el {date}: pide uno nuevo a quien te lo compartió',
};
const ROLE_NAMES: Record<string, string> = { owner: 'propietario', editor: 'puede editar', viewer: 'solo lectura' };
const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(n % (1024 * 1024) ? 1 : 0)} MB` : `${Math.round(n / 1024)} KB`);

/** Texto del error de una respuesta de la API en el idioma activo (`code` → diccionario; si no, el `error` traducido). */
export function serverErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const code = typeof data.code === 'string' ? data.code : '';
  const key = SERVER_ERRORS[code];
  if (key) {
    const vars: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === 'string' || typeof v === 'number') vars[k] = v;
    if (typeof data.required === 'string') vars.required = t(ROLE_NAMES[data.required] ?? data.required);
    if (typeof data.role === 'string') vars.role = t(ROLE_NAMES[data.role] ?? data.role);
    if (typeof data.limit === 'number') vars.size = fmtBytes(data.limit);
    if (typeof data.expiresAt === 'string') vars.date = data.expiresAt.slice(0, 10);
    return t(key, vars);
  }
  const error = typeof data.error === 'string' ? data.error : fallback;
  return t(error);
}

/** `opts.bearer: false` no manda el token de enlace aunque haya uno: la petición va sólo con la cookie de sesión. */
async function req<T>(method: string, path: string, body?: unknown, opts: { bearer?: boolean } = {}): Promise<T> {
  // `x-requested-with` es la marca anti-CSRF que el servidor exige a las peticiones con cookie que modifican algo.
  // `accept-language`: el idioma de la interfaz (el servidor responde con `code` estable y el texto se traduce aquí).
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-requested-with': 'all-draw', 'accept-language': getLang() };
  if (bearer && opts.bearer !== false) headers.authorization = `Bearer ${bearer}`;
  let r: Response;
  try { r = await fetch(path, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (e) { throw new ApiError(0, (e as Error).message || 'network error'); } // sin red o servidor caído
  // Una respuesta HTML a una ruta /api es la página de la app (sin servidor detrás): se trata como "servidor no disponible".
  if (r.ok && (r.headers.get('content-type') ?? '').includes('text/html')) throw new ApiError(0, 'no api');
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, serverErrorMessage(data as Record<string, unknown>, r.statusText), data as Record<string, unknown>);
  return data as T;
}
export class ApiError extends Error {
  status: number;
  /** Código de error del servidor (`quota_workspaces`, `doc_too_large`, `form_token`, `last_admin`…), si lo hay. */
  code?: string;
  /** Campos rechazados por la validación (`code: 'validation'`), p. ej. `['email', 'name']`. */
  fields?: string[];
  constructor(status: number, msg: string, data?: Record<string, unknown>) {
    super(msg); this.status = status;
    if (typeof data?.code === 'string') this.code = data.code;
    if (Array.isArray(data?.fields)) this.fields = data.fields.filter((f): f is string => typeof f === 'string');
  }
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

/** Última cuenta con sesión (`localStorage('alldraw:account')`, la escribe el editor): con ella, sin red, el inicio no muestra la portada. */
export const ACCOUNT_KEY = 'alldraw:account';
export function cachedAccount(): { id: string; name: string } | null {
  try { const a = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as { id?: unknown; name?: unknown } | null; return a && typeof a.id === 'string' && typeof a.name === 'string' ? { id: a.id, name: a.name } : null; } catch { return null; }
}
/** Al cerrar sesión se olvida la última cuenta (sin red, este navegador ya no es «de nadie con sesión»). */
function forgetAccount() { try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* sin almacenamiento */ } }

/** Descarga un JSON de la API como fichero (exportación de datos). */
async function download(path: string, fallbackName: string): Promise<void> {
  const headers: Record<string, string> = { 'x-requested-with': 'all-draw', 'accept-language': getLang() };
  if (bearer) headers.authorization = `Bearer ${bearer}`;
  const r = await fetch(path, { headers, credentials: 'same-origin' });
  if (!r.ok) { const data = await r.json().catch(() => ({})) as Record<string, unknown>; throw new ApiError(r.status, serverErrorMessage(data, r.statusText), data); }
  const name = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const api = {
  available: () => fetch('/api/notations', { method: 'HEAD' }).then(r => (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) || r.status === 405, () => false),
  /**
   * ¿Hay servidor y quién soy? Una sola petición (`GET /api/auth/session`, 200 también sin sesión): ni 401 en la consola
   * ni la sonda `HEAD /api/notations` en cada carga. `offline`: no se pudo hablar con el servidor (sin red o caído).
   */
  probe: () => req<{ user: User | null }>('GET', '/api/auth/session', undefined, { bearer: false })
    .then(r => ({ up: true, offline: false, user: r.user ?? null }), (e: unknown) => ({ up: false, offline: isNetworkError(e) && (e as ApiError).message !== 'no api', user: null as User | null })),
  /** Usuario de la sesión o `null` (`GET /api/auth/session` responde 200 también sin sesión: sin 401 en la consola). */
  me: () => req<{ user: User | null }>('GET', '/api/auth/session').then(r => r.user ?? null, () => null),
  /**
   * Usuario de la sesión (cookie), sin el token de enlace que pueda haber puesto un espacio compartido: `null` si no
   * hay sesión; **lanza** si no hay red (para distinguir "sin cuenta" de "sin conexión").
   */
  sessionUser: () => req<{ user: User | null }>('GET', '/api/auth/session', undefined, { bearer: false }).then(r => r.user ?? null, (e: unknown) => { if (isNetworkError(e)) throw e; return null; }),
  login: (email: string, password: string) => req<{ user: User; token: string }>('POST', '/api/auth/login', { email, password }),
  /** `website` es la trampa para bots del formulario (un campo oculto que una persona deja vacío). */
  register,
  account: () => req<{ user: User; quotas: Quotas }>('GET', '/api/auth/me'),
  updateMe: (patch: { name?: string; email?: string; password?: string }) => req<{ user: User }>('PATCH', '/api/auth/me', patch).then(r => r.user),
  exportData: () => download('/api/auth/export', 'alldraw-export.json'),
  deleteAccount: (password: string) => req<DeleteAccountResult>('DELETE', '/api/auth/account', { password }),
  logout: () => req<void>('POST', '/api/auth/logout').finally(forgetAccount),
  /** `revokeKeys`: revocar también las claves API (y desconectar a los agentes que las usan). */
  logoutAll: (revokeKeys = false) => req<void>('DELETE', `/api/auth/sessions${revokeKeys ? '?revokeKeys=true' : ''}`).then(forgetAccount),
  authConfig: () => loadAuthConfig().catch(() => 'open' as RegistrationMode),
  changePassword: (current: string, password: string, revokeKeys = false) => req<{ ok: true }>('POST', '/api/auth/password', { current, password, ...(revokeKeys ? { revokeKeys: true } : {}) }),
  adminUsers: () => req<{ users: AdminUser[] }>('GET', '/api/admin/users').then(r => r.users),
  adminSetAdmin: (id: string, isAdmin: boolean) => req<{ user: AdminUser }>('PATCH', `/api/admin/users/${encodeURIComponent(id)}`, { isAdmin }).then(r => r.user),
  adminReset: (id: string, revokeKeys = false) => req<{ password: string }>('POST', `/api/admin/users/${encodeURIComponent(id)}/reset${revokeKeys ? '?revokeKeys=true' : ''}`).then(r => r.password),
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
