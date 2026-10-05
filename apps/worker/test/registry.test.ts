/** `WorkspaceStore` en workerd: contrato completo sobre el `RegistryDO` (y sobre D1 en el proyecto `d1`) y migraciones del DO. */
import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { storeContractTests } from '@all-draw/server-core/test/store-contract';
import { MIGRATIONS } from '../src/migrations';
import { D1WorkspaceStore } from '../src/store/d1';
import { registryStore, type RegistryStub } from '../src/store/do-sql';

/** Un DO nuevo por test: store vacío. */
storeContractTests('RegistryDO (SQLite del Durable Object)', () => {
  const stub = env.REGISTRY.get(env.REGISTRY.newUniqueId()) as unknown as RegistryStub;
  return registryStore(env.REGISTRY, () => stub);
});

if (env.DB) {
  const db = env.DB;
  storeContractTests('D1', async () => {
    for (const t of ['webhooks', 'snapshots', 'doc_updates', 'docs', 'share_links', 'workspace_members', 'api_keys', 'sessions', 'workspaces', 'users']) await db.prepare(`DELETE FROM ${t}`).run();
    return new D1WorkspaceStore(db);
  });
}

const statements = (sql: string) => sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

describe('RegistryDO: migraciones', () => {
  it('src/migrations.ts = migrations/*.sql', () => {
    expect(MIGRATIONS.length).toBe(env.TEST_MIGRATIONS.length);
    MIGRATIONS.forEach((m, i) => expect(statements(m)).toEqual(env.TEST_MIGRATIONS[i]!.queries.flatMap(statements)));
  });

  it('se aplican al arrancar, una vez, con versión en schema_migrations', async () => {
    const stub = env.REGISTRY.get(env.REGISTRY.idFromName('migraciones'));
    await (stub as unknown as RegistryStub).invoke('countUsers', []);
    const rows = await runInDurableObject(stub, (_i, state) => ({
      versions: state.storage.sql.exec<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version').toArray().map(r => r.version),
      tables: state.storage.sql.exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name").toArray().map(r => r.name),
    }));
    expect(rows.versions).toEqual(MIGRATIONS.map((_, i) => i + 1));
    expect(rows.tables).toEqual(expect.arrayContaining(['users', 'sessions', 'api_keys', 'workspaces', 'workspace_members', 'share_links', 'docs', 'doc_updates', 'snapshots', 'schema_migrations']));
  });

  it('rechaza métodos que no son del store', async () => {
    const stub = env.REGISTRY.get(env.REGISTRY.newUniqueId()) as unknown as { invoke(m: string, a: unknown[]): Promise<unknown> };
    expect(await stub.invoke('constructor', [])).toEqual({ error: expect.stringMatching(/desconocido/) });
    expect(await stub.invoke('driver', [])).toEqual({ error: expect.stringMatching(/desconocido/) });
  });
});
