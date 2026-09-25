import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke (LLD §10.3, M13-S7) against the production builds: the bundled API
 * on :4000 and `vite preview` on :5173 (same origin as development, so the
 * refresh cookie and sockets behave the same). Run with `npm run e2e`, which
 * builds first; globalSetup reseeds the dev database.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run start -w server',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60_000,
      // Many logins from one IP: the limiter is off for this run only (refused in production).
      env: { RATE_LIMITS_DISABLED: 'true', LOG_LEVEL: 'warn' },
    },
    {
      command: 'npm run preview -w client -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
