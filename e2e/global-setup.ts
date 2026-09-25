import { execSync } from 'node:child_process';

/** Every run starts from the deterministic demo seed. */
export default function globalSetup(): void {
  execSync('npm run db:seed', { stdio: 'ignore' });
}
