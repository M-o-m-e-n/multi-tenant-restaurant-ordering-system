import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

/** Bring the integration-test database up to the current migrations once per run. */
export default function setup(): void {
  config({ quiet: true });
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is not set; see server/.env.example');
  }
  execSync('npx prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
