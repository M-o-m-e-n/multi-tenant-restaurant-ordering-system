import { execSync } from 'node:child_process';

/**
 * Every run starts from the deterministic demo seed. Set `E2E_SKIP_SEED=1`
 * to run read-only specs (such as the axe sweep) against dev servers you are
 * using, without wiping their data.
 */
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === '1') return;
  execSync('npm run db:seed', { stdio: 'ignore' });
}
