import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { loginAs, makeUser, refreshCookieOf } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });

const refresh = (cookie?: string) => {
  const req = request(app).post('/api/v1/auth/refresh').set('X-Refresh-Request', '1');
  return cookie ? req.set('Cookie', cookie) : req;
};

describe('POST /auth/refresh', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('I28: issues a new access token and rotates the refresh token', async () => {
    const user = await makeUser('STAFF');
    const { cookie } = await loginAs(app, user.email);

    const res = await refresh(cookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.expiresIn).toBe(900);
    const next = refreshCookieOf(res);
    expect(next).not.toBe(cookie);

    const tokens = await prisma().refreshToken.findMany({ orderBy: { createdAt: 'asc' } });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.revokedAt).not.toBeNull();
    expect(tokens[0]!.replacedById).toBe(tokens[1]!.id);
    expect(tokens[1]!.familyId).toBe(tokens[0]!.familyId);

    // The new access token works.
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('I29: replaying a rotated token revokes the whole family (AC-21)', async () => {
    const user = await makeUser('STAFF');
    const { cookie: stolen } = await loginAs(app, user.email);
    const legit = refreshCookieOf(await refresh(stolen));

    const replay = await refresh(stolen);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_REVOKED');
    expect(String(replay.headers['set-cookie'])).toMatch(/rt=;/);

    // The legitimate holder is logged out too: every token in the family is dead.
    const after = await refresh(legit);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_REVOKED');
    expect(await prisma().refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('I30: refuses to refresh a disabled account', async () => {
    const user = await makeUser('STAFF');
    const { cookie } = await loginAs(app, user.email);
    await prisma().user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(res.body.accessToken).toBeUndefined();
  });

  it('answers a missing or unknown cookie with REFRESH_TOKEN_INVALID', async () => {
    for (const cookie of [undefined, 'rt=not-a-real-token']) {
      const res = await refresh(cookie);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('REFRESH_TOKEN_INVALID');
    }
  });

  it('answers an expired token with SESSION_EXPIRED', async () => {
    const user = await makeUser('STAFF');
    const { cookie } = await loginAs(app, user.email);
    await prisma().refreshToken.updateMany({
      data: {
        createdAt: new Date(Date.now() - 40 * 86_400_000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('requires the X-Refresh-Request header (CSRF barrier)', async () => {
    const user = await makeUser('STAFF');
    const { cookie } = await loginAs(app, user.email);
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('I32: 48 hours of refreshes every 15 minutes never needs credentials (AC-20)', async () => {
    const user = await makeUser('STAFF');
    let { cookie } = await loginAs(app, user.email);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const start = Date.now();
      for (let i = 1; i <= 192; i++) {
        vi.setSystemTime(start + i * 15 * 60_000);
        const res = await refresh(cookie);
        expect(res.status).toBe(200);
        cookie = refreshCookieOf(res);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
