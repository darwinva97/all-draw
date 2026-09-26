import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'packages/**/src/**/*.test.ts', 'apps/**/src/**/*.test.ts?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '_research/**'],
  },
});
