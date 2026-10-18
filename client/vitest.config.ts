import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests run against the default tenant (brand/types.ts `Tenant`).
export default defineConfig({
  resolve: {
    alias: {
      '@tenant': fileURLToPath(new URL('./src/tenants/forkandflame/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
