import { createApp } from '../src/app';
import { listRoutes } from '../src/openapi/routes';

// Prints every METHOD /path the server mounts (compare with LLD §5).
process.stdout.write(`${listRoutes(createApp({ rateLimits: false })).join('\n')}\n`);
