import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma } from '../src/lib/prisma';
import { signAccessToken } from '../src/modules/auth/auth.tokens';
import { loginAs, makeUser, PASSWORD } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('authentication and role checks', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('I1: register → login → me', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Jane', email: 'jane@x.test', password: PASSWORD });
    expect(reg.status).toBe(201);

    const { accessToken } = await loginAs(app, 'jane@x.test');
    const me = await request(app).get('/api/v1/auth/me').set(bearer(accessToken));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ email: 'jane@x.test', role: 'CUSTOMER' });
    expect(me.body.passwordHash).toBeUndefined();
  });

  it('rejects a missing or bogus token with 401 UNAUTHENTICATED', async () => {
    for (const headers of [{}, bearer('garbage')]) {
      const res = await request(app).get('/api/v1/auth/me').set(headers);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('I3: a customer calling an admin route gets 403', async () => {
    const customer = await makeUser('CUSTOMER');
    const { accessToken } = await loginAs(app, customer.email);
    const res = await request(app).get('/api/v1/staff/users').set(bearer(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('I24: a disabled account fails on its very next request with ACCOUNT_DISABLED (AC-18)', async () => {
    const admin = await makeUser('ADMIN');
    const staff = await makeUser('STAFF');
    const adminToken = (await loginAs(app, admin.email)).accessToken;
    const staffToken = (await loginAs(app, staff.email)).accessToken;

    // Warm the auth cache, so the test proves invalidation rather than a cold read.
    expect((await request(app).get('/api/v1/auth/me').set(bearer(staffToken))).status).toBe(200);

    const disable = await request(app)
      .patch(`/api/v1/staff/users/${staff.id}`)
      .set(bearer(adminToken))
      .send({ isActive: false });
    expect(disable.status).toBe(200);

    const next = await request(app).get('/api/v1/auth/me').set(bearer(staffToken));
    expect(next.status).toBe(401);
    expect(next.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('applies a demotion on the next request even though the token still says ADMIN', async () => {
    const boss = await makeUser('ADMIN');
    const other = await makeUser('ADMIN');
    const otherToken = (await loginAs(app, other.email)).accessToken;
    expect((await request(app).get('/api/v1/staff/users').set(bearer(otherToken))).status).toBe(
      200,
    );

    const bossToken = (await loginAs(app, boss.email)).accessToken;
    await request(app)
      .patch(`/api/v1/staff/users/${other.id}`)
      .set(bearer(bossToken))
      .send({ role: 'STAFF' });

    const res = await request(app).get('/api/v1/staff/users').set(bearer(otherToken));
    expect(res.status).toBe(403);
  });

  it('ignores a forged role claim because the role is re-read from the database', async () => {
    const customer = await makeUser('CUSTOMER');
    const { token } = await signAccessToken({
      userId: customer.id,
      role: 'ADMIN',
      name: 'x',
      sessionId: customer.id,
    });
    const res = await request(app).get('/api/v1/staff/users').set(bearer(token));
    expect(res.status).toBe(403);
  });
});
