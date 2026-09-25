import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma } from '../src/lib/prisma';
import { resetDb } from './helpers/db';

describe('auth rate limit', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('returns 429 RATE_LIMITED with Retry-After on the 11th login in 15 minutes', async () => {
    const app = createApp({ rateLimits: true });
    const attempt = () =>
      request(app).post('/api/v1/auth/login').send({ email: 'x@x.test', password: 'wrong-pass' });

    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
