import cors from 'cors';
import type { RequestHandler } from 'express';

import { getEnv } from '../config/env';

/**
 * CORS against the explicit allow-list from CLIENT_ORIGINS, with credentials
 * so the refresh cookie travels (NFR-S8, LLD §9). A wildcard is impossible
 * alongside credentials and env parsing refuses one. Requests without an
 * Origin (same-origin, curl, server-to-server) pass through untouched.
 */
export function corsMiddleware(): RequestHandler {
  const allowed = new Set(getEnv().CLIENT_ORIGINS);
  return cors({
    origin: (origin, callback) => {
      callback(null, origin === undefined || allowed.has(origin));
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Refresh-Request',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
  });
}
