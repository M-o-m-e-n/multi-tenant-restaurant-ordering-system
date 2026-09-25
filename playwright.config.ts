import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke (LLD §10.3, M13-S7) against the production builds: the bundled API
 * and `vite preview` proxying to it, so the refresh cookie and sockets behave
 * as in development. Run with `npm run e2e`, which builds first; globalSetup
 * reseeds the dev database (E2E_SKIP_SEED=1 skips that).
 *
 * Ports default to the dev ones (4000/5173). Set E2E_API_PORT / E2E_WEB_PORT
 * to run the suite's own stack beside a dev session that is already using
 * them — the dev servers keep their rate limits, the test stack has none.
 */
const apiPort = process.env.E2E_API_PORT ?? '4000';
const webPort = process.env.E2E_WEB_PORT ?? '5173';
const web = `http://localhost:${webPort}`;

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
    baseURL: web,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run start -w server',
      url: `http://localhost:${apiPort}/health`,
      reuseExistingServer: true,
      timeout: 60_000,
      // Many logins from one IP: the limiter is off for this run only (refused in production).
      env: {
        PORT: apiPort,
        CLIENT_ORIGINS: web,
        PUBLIC_APP_URL: web,
        RATE_LIMITS_DISABLED: 'true',
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npm run preview -w client -- --port ${webPort} --strictPort`,
      url: web,
      reuseExistingServer: true,
      timeout: 60_000,
      env: { API_TARGET: `http://localhost:${apiPort}` },
    },
  ],
});
