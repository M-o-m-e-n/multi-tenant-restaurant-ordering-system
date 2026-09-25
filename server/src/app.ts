import cookieParser from 'cookie-parser';
import express, { type Express, Router } from 'express';

import { corsMiddleware } from './middleware/cors';
import { errorHandler, notFoundHandler } from './middleware/errors';
import { limiter, LIMITS } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { authRouter } from './modules/auth';
import { discountsRouter, staffDiscountsRouter } from './modules/discounts';
import { publicMenuRouter, staffMenuRouter } from './modules/menu';
import { ordersRouter } from './modules/orders';
import { kdsSettingsRouter, publicSettingsRouter, staffSettingsRouter } from './modules/settings';
import { tablesRouter } from './modules/tables';
import { usersRouter } from './modules/users';

export interface AppOptions {
  /** Rate limiting is on by default; integration tests turn it off per app instance. */
  rateLimits?: boolean;
}

/**
 * Build the Express application without listening, so tests can import it
 * and drive it with supertest (HLD §4).
 */
export function createApp(options: AppOptions = {}): Express {
  const limits = options.rateLimits ?? true;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(requestId);
  app.use(corsMiddleware());
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = Router();
  api.use(limiter(LIMITS.general, limits));
  api.use(
    '/auth',
    authRouter({
      credentialLimiter: limiter(LIMITS.credentials, limits),
      refreshLimiter: limiter(LIMITS.refresh, limits),
    }),
  );
  api.use('/menu', publicMenuRouter());
  api.use('/staff/menu', staffMenuRouter());
  api.use('/settings/kds', kdsSettingsRouter());
  api.use('/settings', publicSettingsRouter());
  api.use('/orders', ordersRouter({ placeLimiter: limiter(LIMITS.orders, limits) }));
  api.use('/discounts', discountsRouter());
  api.use('/staff/discounts', staffDiscountsRouter());
  api.use('/staff/settings', staffSettingsRouter());
  api.use('/tables', tablesRouter({ qrLimiter: limiter(LIMITS.qr, limits) }));
  api.use('/staff/users', usersRouter());
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
