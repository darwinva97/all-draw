/** Tipos de `env` en los tests (`cloudflare:test` / `cloudflare:workers` usan `Cloudflare.Env`). */
import type { Env as WorkerEnv } from '../src/env';
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv { TEST_MIGRATIONS: import('@cloudflare/vitest-pool-workers').D1Migration[] }
  }
}
