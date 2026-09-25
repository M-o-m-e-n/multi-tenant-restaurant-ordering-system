import express, { type Express, Router } from 'express';

import { errorHandler, notFoundHandler } from './middleware/errors';
import { requestId } from './middleware/request-id';

export interface AppOptions {
  /** Rate limiting is on by default; integration tests turn it off per app instance. */
  rateLimits?: boolean;
}

/**
 * Build the Express application without listening, so tests can import it
 * and drive it with supertest (HLD §4).
 */
export function createApp(_options: AppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(requestId);
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = Router();
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
