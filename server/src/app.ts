import express, { type Express } from 'express';

/**
 * Build the Express application without listening, so tests can import it
 * and drive it with supertest (HLD §4).
 */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
