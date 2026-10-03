/**
 * Arranque: configuración, store (Postgres si hay `DATABASE_URL`, si no SQLite), migración de ficheros
 * antiguos y escucha. Apagado ordenado con SIGTERM/SIGINT (systemd manda SIGTERM al parar o reiniciar):
 * deja de aceptar conexiones, cierra los WebSockets con 1012 (los clientes reconectan solos), guarda los
 * documentos vivos y cierra la base de datos; si algo se cuelga, sale a los 10 s.
 */
import fs from 'node:fs';
import { jsonLogger } from '@all-draw/server-core';
import { createApp, type App } from './app';
import { buildInfo } from './build';
import { configFromEnv } from './config';
import { importLegacyFiles } from './legacy';
import { PostgresWorkspaceStore } from './store/postgres';
import { SqliteWorkspaceStore } from './store/sqlite';
import type { WorkspaceStore } from './store/types';

let stopping = false;
let app: App | undefined;
let store: WorkspaceStore | undefined;
const config = configFromEnv();
const logger = jsonLogger({ level: config.logLevel, write: line => process.stdout.write(line + '\n') });
process.on('unhandledRejection', e => logger.error('promesa rechazada sin capturar', { err: e }));
process.on('uncaughtException', e => { logger.error('excepción sin capturar', { err: e }); void shutdown('uncaughtException', 1); });

fs.mkdirSync(config.dataDir, { recursive: true });
store = config.databaseUrl ? await PostgresWorkspaceStore.connect(config.databaseUrl) : new SqliteWorkspaceStore(config.dbPath);
const storeLabel = config.databaseUrl ? `Postgres ${new URL(config.databaseUrl).host}` : `SQLite ${config.dbPath}`;
await importLegacyFiles(store, config.dataDir);
const build = buildInfo(config.databaseUrl ? 'postgres' : 'sqlite');
app = createApp(config, store, { logger, build });

app.server.listen(config.port, config.host, () => {
  logger.info('arrancado', {
    url: `http://${config.host}:${config.port}`, version: build.version, commit: build.commit, db: storeLabel, static: config.staticDir,
    registration: config.allowRegistration ? (config.inviteCode ? 'invite' : 'open') : 'closed', node: process.version,
  });
});

async function shutdown(signal: string, code = 0) {
  if (stopping) return; stopping = true;
  logger.info('apagando: guardando y cerrando', { signal });
  const t = setTimeout(() => { logger.error('apagado forzado: algo no cerró en 10 s'); process.exit(1); }, 10_000);
  t.unref();
  if (!app) process.exit(code || 1);
  try { await app.close(); } catch (e) { logger.error('cerrando el servidor', { err: e }); code = 1; }
  try { await store?.close(); } catch (e) { logger.error('cerrando la base de datos', { err: e }); code = 1; }
  logger.info('apagado', { signal });
  clearTimeout(t);
  process.exit(code);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
