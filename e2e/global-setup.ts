import { execSync } from 'node:child_process';

/**
 * Every run starts from the deterministic demo seed of the tenant being
 * tested (VITE_TENANT, Fork & Flame by default; ADR-032). Set
 * `E2E_SKIP_SEED=1` to run read-only specs (such as the axe sweep) against
 * dev servers you are using, without wiping their data.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === '1') return;
  execSync('npm run db:seed', {
    stdio: 'ignore',
    env: { ...process.env, SEED_TENANT: process.env.VITE_TENANT ?? 'forkandflame' },
  });
}
