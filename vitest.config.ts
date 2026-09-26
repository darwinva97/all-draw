import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts?(x)', 'apps/**/test/**/*.test.ts'],
    // apps/worker usa @cloudflare/vitest-pool-workers (vitest 4 + workerd): `pnpm --filter @all-draw/worker test`
    exclude: ['**/node_modules/**', '**/dist/**', '_research/**', 'apps/worker/**'],
  },
});
