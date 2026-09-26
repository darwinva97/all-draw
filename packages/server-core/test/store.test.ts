import { MemoryWorkspaceStore } from '../src/store/memory';
import { storeContractTests } from './store-contract';

storeContractTests('memory', () => new MemoryWorkspaceStore());
