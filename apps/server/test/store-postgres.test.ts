/**
 * Contrato de `WorkspaceStore` contra Postgres. Se salta si no hay `TEST_DATABASE_URL`:
 *
 *   TEST_DATABASE_URL=postgres://user:pass@127.0.0.1:5432/alldraw_test pnpm --filter @all-draw/server test
 *
 * Cada test vacía las tablas (se usa una BD de pruebas dedicada; nunca la de producción).
 */
import { describe } from 'vitest';
import { storeContractTests } from '@all-draw/server-core/test/store-contract';
import { PostgresWorkspaceStore } from '../src/store/postgres';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('postgres', () => {
  storeContractTests('postgres', async () => {
    const s = await PostgresWorkspaceStore.connect(url!);
    await s.truncateAll();
    return s;
  });
});
