import 'dotenv/config';

import { createServer } from 'node:http';

import { createApp } from './app';
import { EnvError, getEnv } from './config/env';
import { startJobs } from './jobs';
import { logger } from './lib/logger';
import { disconnectPrisma } from './lib/prisma';

/** Bootstrap order: env → http → jobs (sockets join in M8). */
function main(): void {
  const env = getEnv();
  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger().info({ port: env.PORT }, 'api listening');
  });

  const stopJobs = startJobs();

  const shutdown = (signal: string): void => {
    logger().info({ signal }, 'shutting down');
    stopJobs();
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
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
