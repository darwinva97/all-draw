/**
 * Correo y registro a partir del `Env` del worker, compartidos por el worker (API) y el `WorkspaceDO` (menciones en
 * los comentarios nuevos, que se detectan en el doc vivo del DO).
 *
 * En Workers sólo hay `none` (por defecto), `log` y `http`: no hay SMTP (sin sockets TCP de uso general). Si la
 * configuración del correo está mal, se registra el error y se sigue **sin correo** (`email: false`): mejor una web sin
 * «¿Olvidaste tu contraseña?» que una web caída.
 */
import { Notifier, jsonLogger, mailerFromEnv, noneMailer, parseLogLevel, type Logger, type Mailer, type WorkspaceStore } from '@all-draw/server-core';
import type { Env } from './env';
import { D1WorkspaceStore } from './store/d1';
import { registryStore, REGISTRY_NAME, type RegistryStub, type RegistryWorkspaceStore } from './store/do-sql';

export function workerMailer(env: Env, logger: Logger): Mailer {
  try { return mailerFromEnv(env, { logger, production: true }); }
  catch (e) { logger.error('correo mal configurado: se sigue sin correo', { err: e }); return noneMailer; }
}

/** El registro (D1 si hay binding `DB`; si no, el `RegistryDO`), igual que `boot()` en `index.ts`. */
export function registryFromEnv(env: Env): RegistryWorkspaceStore {
  return env.DB ? new D1WorkspaceStore(env.DB) : registryStore(env.REGISTRY, () => env.REGISTRY.get(env.REGISTRY.idFromName(env.REGISTRY_NAME || REGISTRY_NAME)) as unknown as RegistryStub);
}

/** Notificador para el DO de un espacio (menciones): registro, correo y log del entorno. */
export function workerNotifier(env: Env, store: WorkspaceStore = registryFromEnv(env)): Notifier {
  const logger = jsonLogger({ level: parseLogLevel(env.LOG_LEVEL) });
  return new Notifier({ store, mailer: workerMailer(env, logger), logger, publicUrl: env.PUBLIC_URL || null });
}
