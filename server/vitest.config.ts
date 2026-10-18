import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A private tenant pack's tests run too when it is checked out (ADR-032).
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', '../tenants/*/server/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one database, so files run one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
