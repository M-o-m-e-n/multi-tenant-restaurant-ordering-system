import 'dotenv/config';

import { EnvError, getEnv } from './config/env';

function main(): void {
  getEnv();
}

try {
  main();
} catch (err) {
  if (err instanceof EnvError) {
    // A named list of problems, not a stack trace (HLD §11.4).
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}
