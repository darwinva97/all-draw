/** Contrato de `WorkspaceStore` (batería compartida en `@all-draw/server-core/test/store-contract`) contra memoria y SQLite. */
import { storeContractTests } from '@all-draw/server-core/test/store-contract';
import { MemoryWorkspaceStore } from '../src/store/memory';
import { SqliteWorkspaceStore } from '../src/store/sqlite';

storeContractTests('memory', () => new MemoryWorkspaceStore());
storeContractTests('sqlite', () => new SqliteWorkspaceStore(':memory:'));
