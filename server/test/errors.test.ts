import { DomainError } from '@ros/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ConflictError } from '../src/lib/errors';
import { errorHandler, notFoundHandler } from '../src/middleware/errors';
import { requestId } from '../src/middleware/request-id';
import { h, validate } from '../src/middleware/validate';

function appWith(register: (app: express.Express) => void) {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  register(app);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('error mapping', () => {
  it('maps a typed error to its status and code with a request id', async () => {
    const app = appWith((a) =>
      a.get(
        '/x',
        h(async () => {
          await Promise.resolve();
          throw new ConflictError('ILLEGAL_TRANSITION', 'Nope.');
        }),
      ),
    );
    const res = await request(app).get('/x');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('maps a domain rejection to 422', async () => {
    const app = appWith((a) =>
      a.get('/x', () => {
        throw new DomainError('EMPTY_CART', 'Empty.');
      }),
    );
    const res = await request(app).get('/x');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_CART');
  });

  it('never leaks a stack or internal message on an unknown error', async () => {
    const app = appWith((a) =>
      a.get('/x', () => {
        throw new Error('relation "Order" does not exist at line 42');
      }),
    );
    const res = await request(app).get('/x');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/relation|stack|line 42/);
  });

  it('rejects unknown fields with field-level details', async () => {
    const schema = z.object({ name: z.string() }).strict();
    const app = appWith((a) =>
      a.post('/x', validate({ body: schema }), (_req, res) => {
        res.json({ ok: true });
      }),
    );
    const res = await request(app).post('/x').send({ name: 'a', extra: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fieldErrors).toBeDefined();
  });

  it('answers malformed JSON with a 400, not a 500', async () => {
    const app = appWith((a) => a.post('/x', (_req, res) => res.json({})));
    const res = await request(app)
      .post('/x')
      .set('content-type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the error envelope for an unknown route', async () => {
    const res = await request(appWith(() => undefined)).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
