/** Configuración por variables de entorno (ver README). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MAX_DOC_BYTES, DEFAULT_MAX_WORKSPACES_PER_USER, DEFAULT_REGISTER_MIN_MS, parseLogLevel, type ApiConfig, type LogLevel } from '@all-draw/server-core';

export interface Config extends ApiConfig {
  host: string;
  port: number;
  dataDir: string;
  staticDir: string;
  dbPath: string;
  /** Si está, se usa Postgres (`pg`) en vez de SQLite. */
  databaseUrl: string | null;
  /** Si está, los hashes de sesión son HMAC con este secreto (una fuga de la BD no sirve para nada sin él). */
  sessionSecret: string | null;
  allowRegistration: boolean;
  /** Fuerza `Secure` en la cookie aunque la petición llegue por http (detrás de un proxy sin `x-forwarded-proto`). */
  cookieSecure: boolean;
  /** URL pública (para construir enlaces compartidos); si falta se deduce de la petición. */
  publicUrl: string | null;
  /** Si está, el registro exige este código de invitación. */
  inviteCode: string | null;
  /** `LOG_LEVEL`: debug | info | warn | error | silent. */
  logLevel: LogLevel;
  /** `METRICS_TOKEN`: si está, `/metrics` también responde con `Authorization: Bearer <token>` (además de desde 127.0.0.1 sin proxy). */
  metricsToken: string | null;
  /** WebSockets simultáneos por IP (`MAX_WS_PER_IP`, 30) y por espacio (`MAX_WS_PER_WORKSPACE`, 100); 0 = sin límite. */
  maxWsPerIp: number;
  maxWsPerWorkspace: number;
  /** Copias de seguridad (`BACKUP_DIR`): aquí van, en `deleted/`, las copias finales de los espacios borrados con una cuenta. */
  backupDir: string;
  maxWorkspacesPerUser: number;
  maxDocBytes: number;
  registerMinMs: number;
}

const int = (v: string | undefined, fallback: number): number => {
  if (v === undefined || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const home = env.HOME ?? '.';
  const dataDir = env.DATA_DIR ?? path.resolve(home, '.alldraw-data');
  return {
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? 4002),
    dataDir,
    staticDir: env.STATIC_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist'),
    dbPath: env.DB_PATH ?? path.join(dataDir, 'alldraw.sqlite'),
    databaseUrl: env.DATABASE_URL || null,
    sessionSecret: env.SESSION_SECRET || null,
    allowRegistration: env.ALLOW_REGISTRATION !== 'false',
    cookieSecure: env.COOKIE_SECURE === 'true',
    publicUrl: env.PUBLIC_URL || null,
    inviteCode: env.INVITE_CODE || null,
    logLevel: parseLogLevel(env.LOG_LEVEL),
    metricsToken: env.METRICS_TOKEN || null,
    maxWsPerIp: int(env.MAX_WS_PER_IP, 30),
    maxWsPerWorkspace: int(env.MAX_WS_PER_WORKSPACE, 100),
    backupDir: env.BACKUP_DIR ?? path.join(home, '.alldraw-backups'),
    maxWorkspacesPerUser: int(env.MAX_WORKSPACES_PER_USER, DEFAULT_MAX_WORKSPACES_PER_USER),
    maxDocBytes: int(env.MAX_DOC_BYTES, DEFAULT_MAX_DOC_BYTES),
    registerMinMs: int(env.REGISTER_MIN_MS, DEFAULT_REGISTER_MIN_MS),
  };
}
