/** Configuración por variables de entorno (ver README). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_MAX_DOC_BYTES, DEFAULT_MAX_WORKSPACES_PER_USER, DEFAULT_REGISTER_MIN_MS, DEFAULT_TRUSTED_PROXIES, parseLogLevel, type ApiConfig, type LogLevel, type MailEnv } from '@all-draw/server-core';

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
  /**
   * `TRUSTED_PROXIES`: de quién se cree `X-Forwarded-For` / `CF-Connecting-IP` para saber la IP real del cliente (límites
   * anti-abuso y log). IPs, redes CIDR y `loopback`, `private`, `cloudflare`; por defecto `loopback,cloudflare`; vacío = nadie.
   */
  trustedProxies: string;
  /**
   * ¿Es producción? (`NODE_ENV=production` o `PUBLIC_URL` con https). Decide el correo por defecto: `none` en producción
   * (nada de enlaces de restablecimiento en el log), `log` en desarrollo.
   */
  production: boolean;
  /** Variables del correo tal cual (`MAIL_PROVIDER`, `MAIL_FROM`, `MAIL_HTTP_*`, `SMTP_*`); las interpreta `mailerFromEnv`. */
  mail: MailEnv;
  /** `REQUIRE_EMAIL_VERIFICATION=true`: hay que verificar el correo para crear espacios en el servidor (sólo con correo). */
  requireEmailVerification: boolean;
}

const MAIL_KEYS = ['MAIL_PROVIDER', 'MAIL_FROM', 'MAIL_HTTP_URL', 'MAIL_HTTP_TOKEN', 'MAIL_HTTP_FORMAT', 'MAIL_HTTP_TEMPLATE', 'MAIL_HTTP_AUTH_HEADER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_SECURE'] as const;

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
    trustedProxies: env.TRUSTED_PROXIES ?? DEFAULT_TRUSTED_PROXIES,
    production: env.NODE_ENV === 'production' || /^https:\/\//i.test(env.PUBLIC_URL ?? ''),
    mail: Object.fromEntries(MAIL_KEYS.filter(k => env[k] !== undefined).map(k => [k, env[k]])) as MailEnv,
    requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION === 'true',
  };
}
