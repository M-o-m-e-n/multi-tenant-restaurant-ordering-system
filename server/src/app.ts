import cookieParser from 'cookie-parser';
import express, { type Express, type RequestHandler, Router } from 'express';

import { errorHandler, notFoundHandler } from './middleware/errors';
import { requestId } from './middleware/request-id';
import { authRouter } from './modules/auth/auth.routes';

export interface AppOptions {
  /** Rate limiting is on by default; integration tests turn it off per app instance. */
  rateLimits?: boolean;
}

const passThrough: RequestHandler = (_req, _res, next) => next();

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
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = Router();
  api.use('/auth', authRouter({ credentialLimiter: passThrough }));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
