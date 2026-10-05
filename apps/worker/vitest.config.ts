/**
 * Tests dentro de workerd (Durable Objects, D1 y WebSocket reales en miniflare, sin cuenta ni red).
 * Dos proyectos con los mismos tests: `do` (configuración de `wrangler.toml`: registro en el `RegistryDO`,
 * sin D1; el registro se abre en los tests aunque en producción esté cerrado) y `d1` (igual, más un binding `DB` de D1 local con `migrations/` aplicadas). Requiere vitest 4.
 * En los dos, `STANDBY` va a `"false"` (en `wrangler.toml` es `"true"`). El proyecto `standby` corre sólo `test/standby/`
 * con `STANDBY="true"` (copia de respaldo de solo lectura, sincronización con `replace`, rate limit).
 */
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const test = { include: ['test/**/*.test.ts'], exclude: ['test/standby/**'], setupFiles: ['./test/apply-migrations.ts'], testTimeout: 20_000 };
const bindings = async () => ({ TEST_MIGRATIONS: await readD1Migrations('./migrations'), IMPORT_SECRET: 'secreto-de-prueba', ALLOW_REGISTRATION: 'true', REGISTRY_NAME: 'registry', REGISTER_MIN_MS: '0', LOG_LEVEL: 'warn', ALLDRAW_COMMIT: 'abc1234', STANDBY: 'false', WEBHOOKS_DEBOUNCE_MS: '100' });

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
      {
        plugins: [cloudflareTest(async () => ({ wrangler: { configPath: './wrangler.toml' }, miniflare: { bindings: { ...(await bindings()), STANDBY: 'true' } } }))],
        test: { ...test, include: ['test/standby/**/*.test.ts'], exclude: [], name: 'standby' },
      },
    ],
  },
});
