/**
 * `WorkspaceStore`: todo lo que el servidor persiste (usuarios, sesiones, API keys, espacios,
 * miembros, enlaces y documentos Yjs) detrás de una interfaz asíncrona para poder cambiar
 * SQLite por Postgres o un Durable Object sin tocar la API.
 *
 * Los documentos Yjs se guardan como **update binario completo** (`saveDoc`) más una cola de
 * updates incrementales (`appendUpdate`) que `loadDoc` funde; así un adaptador puede compactar
 * cuando quiera. Las tablas están descritas en `apps/server/README.md`; adaptadores: `memory.ts` (aquí), `sqlite.ts` y `postgres.ts` (`@all-draw/server`), `d1.ts` (`@all-draw/worker`).
 */

export type Role = 'owner' | 'editor' | 'viewer';
/** Roles asignables a miembros y enlaces (el dueño es `workspaces.owner_id`). */
export type MemberRole = Exclude<Role, 'owner'>;

export const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
export const atLeast = (role: Role | null | undefined, min: Role): boolean => !!role && ROLE_RANK[role] >= ROLE_RANK[min];

export interface User {
  id: string;
  email: string;
  name: string;
  /** `pbkdf2$<iter>$<saltHex>$<hashHex>` (o `scrypt$<saltHex>$<hashHex>` heredado); vacío = la cuenta no puede iniciar sesión con contraseña. */
  passwordHash: string;
  isAdmin: boolean;
  createdAt: string;
  /** Cuándo verificó su correo actual (enlace de `POST /api/auth/verify`); `null` = sin verificar. */
  emailVerifiedAt: string | null;
  /** Idioma de la cuenta (`es` | `en`) para los correos; `null` = el del navegador con el que se registró no se supo. */
  locale: string | null;
  /** Preferencia «recibir por correo» (menciones, si el servidor tiene correo). */
  notifyEmail: boolean;
}

/** Campos que se pueden cambiar de una cuenta (`updateUser`). */
export interface UserPatch { name?: string; email?: string; isAdmin?: boolean; emailVerifiedAt?: string | null; locale?: string | null; notifyEmail?: boolean }
/** Aplica un `UserPatch` (normaliza el correo). Común a los adaptadores SQL. */
export function applyUserPatch(u: User, patch: UserPatch): User {
  return {
    ...u,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
    ...(patch.isAdmin !== undefined ? { isAdmin: patch.isAdmin } : {}),
    ...(patch.emailVerifiedAt !== undefined ? { emailVerifiedAt: patch.emailVerifiedAt } : {}),
    ...(patch.locale !== undefined ? { locale: patch.locale } : {}),
    ...(patch.notifyEmail !== undefined ? { notifyEmail: patch.notifyEmail } : {}),
  };
}

export interface Session {
  /** Hash del token (nunca se guarda el token en claro). */
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  /** Resumen del navegador (`navegador;sistema;tipo`, ver `describeUserAgent`); nunca el user-agent entero. */
  device?: string | null;
  /** IP truncada (`truncateIp`) de la última petición. */
  ip?: string | null;
  /** Último uso (se apunta como mucho cada `SESSION_TOUCH_MS`). */
  lastUsedAt?: string | null;
}
/** Datos de una sesión al crearla (para la lista de sesiones activas). */
export interface SessionMeta { device?: string | null; ip?: string | null }

/** Token de un solo uso enviado por correo: restablecer la contraseña o verificar un correo. Sólo se guarda su hash. */
export type AccountTokenKind = 'reset' | 'verify';
export interface AccountToken {
  tokenHash: string;
  userId: string;
  kind: AccountTokenKind;
  /** Correo al que se envió (en `verify`, el que queda verificado: el actual o el nuevo si se está cambiando). */
  email: string;
  createdAt: string;
  expiresAt: string;
}

/** Tipos de notificación (ver `notifications.ts`). */
export type NotificationKind = 'mention' | 'shared' | 'role' | 'restored';
export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  workspaceId: string | null;
  /** Datos para pintarla (nombre del espacio, quién, extracto…); JSON en la BD. */
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}
/** Notificaciones que se guardan por cuenta; al pasarse se borran las más antiguas. */
export const MAX_NOTIFICATIONS_PER_USER = 200;

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  /** Primeros caracteres de la clave, para reconocerla en listados. */
  prefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface WorkspaceRow {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member { workspaceId: string; userId: string; role: MemberRole; createdAt: string }

export interface ShareLink {
  token: string;
  workspaceId: string;
  role: MemberRole;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
}

/** Instantánea del contenido de un espacio (historial de versiones). `data` es un update Yjs completo. */
export interface SnapshotMeta {
  id: string;
  workspaceId: string;
  createdAt: string;
  /** Usuario que la creó; `null` si fue automática o por enlace compartido. */
  authorId: string | null;
  /** Etiqueta puesta por el usuario; `null` = automática (candidata a poda). */
  label: string | null;
  /** Bytes de `data`. */
  size: number;
}
export interface Snapshot extends SnapshotMeta { data: Uint8Array }

/** Persistencia de instantáneas: la implementan los `WorkspaceStore` y el storage del Durable Object. */
export interface SnapshotStore {
  createSnapshot(s: { workspaceId: string; authorId: string | null; label: string | null; data: Uint8Array; id?: string }): Promise<SnapshotMeta>;
  /** Más recientes primero. */
  listSnapshots(workspaceId: string): Promise<SnapshotMeta[]>;
  getSnapshot(workspaceId: string, id: string): Promise<Snapshot | null>;
  deleteSnapshot(workspaceId: string, id: string): Promise<boolean>;
  /** Borra las instantáneas **sin etiqueta** más antiguas hasta que no queden más de `keep`; devuelve cuántas borró. */
  pruneSnapshots(workspaceId: string, keep: number): Promise<number>;
}

export interface WorkspaceStore extends SnapshotStore {
  // Usuarios
  createUser(u: { email: string; name: string; passwordHash: string; isAdmin?: boolean; id?: string; locale?: string | null }): Promise<User>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  countUsers(): Promise<number>;
  listUsers(): Promise<User[]>;
  /** Cambia el hash de contraseña (p. ej. al migrar de scrypt a PBKDF2 tras un login correcto). */
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  /** Cambia nombre, email (normalizado; lanza `email ya registrado` si está cogido), rol de admin, verificación, idioma o preferencias. `null` si no existe. */
  updateUser(id: string, patch: UserPatch): Promise<User | null>;
  /**
   * Borra la cuenta y lo que cuelga de ella: sesiones, API keys, membresías, tokens de correo y notificaciones; las instantáneas que firmó
   * quedan con `authorId = null`. **No** toca los espacios de los que es dueño: el llamador los transfiere
   * o borra antes (la API lo hace en `DELETE /api/auth/account`).
   */
  deleteUser(id: string): Promise<void>;

  // Sesiones (el token en claro sólo lo ve el cliente; aquí va su hash). `getSession` no devuelve caducadas.
  createSession(userId: string, tokenHash: string, expiresAt: string, meta?: SessionMeta): Promise<Session>;
  getSession(tokenHash: string): Promise<Session | null>;
  /** Renueva la caducidad (sesión deslizante). */
  touchSession(tokenHash: string, expiresAt: string): Promise<void>;
  /** Apunta el último uso de una sesión y la IP (truncada) desde la que llegó. */
  markSessionUsed(tokenHash: string, at: string, ip: string | null): Promise<void>;
  /** Sesiones vigentes de un usuario, la más reciente primero. */
  listUserSessions(userId: string): Promise<Session[]>;
  deleteSession(tokenHash: string): Promise<void>;
  /** Cierra todas las sesiones de un usuario (salvo `exceptTokenHash`, si se da). */
  deleteUserSessions(userId: string, exceptTokenHash?: string): Promise<void>;
  /** Borra las sesiones caducadas (y los tokens de correo caducados); devuelve cuántas sesiones. */
  purgeExpiredSessions(): Promise<number>;

  // Tokens de correo (restablecer contraseña, verificar correo): de un solo uso, sólo el hash.
  createAccountToken(t: Omit<AccountToken, 'createdAt'>): Promise<AccountToken>;
  /** Lo gasta: lo borra y lo devuelve si existía, era de ese tipo y no había caducado (atómico: sólo uno lo consigue). */
  consumeAccountToken(tokenHash: string, kind: AccountTokenKind): Promise<AccountToken | null>;
  /** Borra los tokens de un usuario (de un tipo o todos). */
  deleteAccountTokens(userId: string, kind?: AccountTokenKind): Promise<void>;

  // Notificaciones
  /** Crea una notificación; con `id` dado y ya existente no hace nada y devuelve `null` (idempotente). Poda las de más de `MAX_NOTIFICATIONS_PER_USER`. */
  createNotification(n: { id?: string; userId: string; kind: NotificationKind; workspaceId: string | null; payload: Record<string, unknown> }): Promise<Notification | null>;
  /** Las más recientes primero. */
  listNotifications(userId: string, limit: number): Promise<Notification[]>;
  countUnreadNotifications(userId: string): Promise<number>;
  /** Marca como leídas las indicadas (o todas si `ids` falta); devuelve cuántas cambiaron. */
  markNotificationsRead(userId: string, ids?: string[]): Promise<number>;

  // API keys
  createApiKey(k: { userId: string; name: string; prefix: string; keyHash: string }): Promise<ApiKey>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  resolveApiKey(keyHash: string): Promise<ApiKey | null>;
  deleteApiKey(userId: string, id: string): Promise<boolean>;
  touchApiKey(id: string): Promise<void>;

  // Espacios
  listWorkspaces(userId: string): Promise<(WorkspaceRow & { role: Role })[]>;
  listAllWorkspaces(): Promise<WorkspaceRow[]>;
  /** Espacios de los que el usuario es dueño (cuota `MAX_WORKSPACES_PER_USER`). */
  countOwnedWorkspaces(userId: string): Promise<number>;
  getWorkspace(id: string): Promise<WorkspaceRow | null>;
  createWorkspace(w: { ownerId: string; name: string; id?: string }): Promise<WorkspaceRow>;
  updateMeta(id: string, patch: { name?: string; ownerId?: string }): Promise<WorkspaceRow | null>;
  deleteWorkspace(id: string): Promise<void>;

  // Documento Yjs
  loadDoc(id: string): Promise<Uint8Array | null>;
  saveDoc(id: string, update: Uint8Array): Promise<void>;
  appendUpdate(id: string, update: Uint8Array): Promise<void>;

  // Permisos
  getRole(workspaceId: string, userId: string): Promise<Role | null>;
  setRole(workspaceId: string, userId: string, role: MemberRole | null): Promise<void>;
  listMembers(workspaceId: string): Promise<(Member & { user: Pick<User, 'id' | 'email' | 'name'> | null })[]>;

  // Enlaces compartidos
  createShareLink(l: { workspaceId: string; role: MemberRole; createdBy: string; token: string; expiresAt?: string | null }): Promise<ShareLink>;
  listShareLinks(workspaceId: string): Promise<ShareLink[]>;
  resolveShareLink(token: string): Promise<ShareLink | null>;
  deleteShareLink(workspaceId: string, token: string): Promise<boolean>;

  close(): Promise<void>;
}
