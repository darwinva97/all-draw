/** Tests dentro de workerd (D1 + Durable Objects reales en miniflare). Requiere vitest 4 (dependencia local). */
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [cloudflareTest(async () => ({
    wrangler: { configPath: './wrangler.toml' },
    miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') } },
  }))],
  test: { include: ['test/**/*.test.ts'], setupFiles: ['./test/apply-migrations.ts'], testTimeout: 20_000 },
});
