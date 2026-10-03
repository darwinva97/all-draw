/**
 * Tests dentro de workerd (Durable Objects, D1 y WebSocket reales en miniflare, sin cuenta ni red).
 * Dos proyectos con los mismos tests: `do` (configuración de `wrangler.toml`: registro en el `RegistryDO`,
 * sin D1; el registro se abre en los tests aunque en producción esté cerrado) y `d1` (igual, más un binding `DB` de D1 local con `migrations/` aplicadas). Requiere vitest 4.
 */
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const test = { include: ['test/**/*.test.ts'], setupFiles: ['./test/apply-migrations.ts'], testTimeout: 20_000 };
const bindings = async () => ({ TEST_MIGRATIONS: await readD1Migrations('./migrations'), IMPORT_SECRET: 'secreto-de-prueba', ALLOW_REGISTRATION: 'true', REGISTRY_NAME: 'registry', REGISTER_MIN_MS: '0', LOG_LEVEL: 'warn', ALLDRAW_COMMIT: 'abc1234' });

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cloudflareTest(async () => ({ wrangler: { configPath: './wrangler.toml' }, miniflare: { bindings: await bindings() } }))],
        test: { ...test, name: 'do' },
      },
      {
        plugins: [cloudflareTest(async () => ({ wrangler: { configPath: './wrangler.toml' }, miniflare: { bindings: await bindings(), d1Databases: ['DB'] } }))],
        test: { ...test, name: 'd1' },
      },
    ],
  },
});
