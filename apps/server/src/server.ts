/** Arranque: configuración, store (Postgres si hay `DATABASE_URL`, si no SQLite), migración de ficheros antiguos y escucha. */
import fs from 'node:fs';
import { createApp } from './app';
import { configFromEnv } from './config';
import { importLegacyFiles } from './legacy';
import { PostgresWorkspaceStore } from './store/postgres';
import { SqliteWorkspaceStore } from './store/sqlite';
import type { WorkspaceStore } from './store/types';

const config = configFromEnv();
fs.mkdirSync(config.dataDir, { recursive: true });
const store: WorkspaceStore = config.databaseUrl ? await PostgresWorkspaceStore.connect(config.databaseUrl) : new SqliteWorkspaceStore(config.dbPath);
const storeLabel = config.databaseUrl ? `Postgres ${new URL(config.databaseUrl).host}` : `SQLite ${config.dbPath}`;
await importLegacyFiles(store, config.dataDir);
const app = createApp(config, store);

app.server.listen(config.port, config.host, () => {
  console.log(`all-draw en http://${config.host}:${config.port} · BD ${storeLabel} · estáticos ${config.staticDir} · registro ${config.allowRegistration ? 'abierto' : 'cerrado'}`);
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return; stopping = true;
  console.log(`${signal}: guardando y cerrando…`);
  const t = setTimeout(() => process.exit(1), 10_000);
  await app.close();
  await store.close();
  clearTimeout(t);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
