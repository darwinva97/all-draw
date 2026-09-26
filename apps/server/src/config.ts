/** Configuración por variables de entorno (ver README). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApiConfig } from '@all-draw/server-core';

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
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): Config {
  const dataDir = env.DATA_DIR ?? path.resolve(env.HOME ?? '.', '.alldraw-data');
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
  };
}
