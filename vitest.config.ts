import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts?(x)', 'apps/**/test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '_research/**'],
  },
});
