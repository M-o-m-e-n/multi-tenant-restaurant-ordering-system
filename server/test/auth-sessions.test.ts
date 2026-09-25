import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma } from '../src/lib/prisma';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });
const refresh = (cookie: string) =>
  request(app).post('/api/v1/auth/refresh').set('X-Refresh-Request', '1').set('Cookie', cookie);

describe('logout and sessions', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('I31: after logout the same cookie cannot refresh', async () => {
    const user = await makeUser();
    const { cookie } = await loginAs(app, user.email);

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    expect(String(out.headers['set-cookie'])).toMatch(/rt=;/);

    const res = await refresh(cookie);
    expect(res.status).toBe(401);
    expect(['REFRESH_TOKEN_INVALID', 'SESSION_REVOKED']).toContain(res.body.error.code);
  });

  it('logout without a cookie still succeeds', async () => {
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(204);
  });

  it('lists active sessions, marks the current one, and revokes one by id', async () => {
    const user = await makeUser();
    const phone = await loginAs(app, user.email);
    const laptop = await loginAs(app, user.email);

    const list = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${laptop.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    const current = list.body.data.filter((s: { current: boolean }) => s.current);
    expect(current).toHaveLength(1);
    const other = list.body.data.find((s: { current: boolean }) => !s.current);

    const del = await request(app)
      .delete(`/api/v1/auth/sessions/${other.familyId}`)
      .set('Authorization', `Bearer ${laptop.accessToken}`);
    expect(del.status).toBe(204);
    expect((await refresh(phone.cookie)).status).toBe(401);
    expect((await refresh(laptop.cookie)).status).toBe(200);
  });

  it('will not revoke another user’s session', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const aSession = await loginAs(app, a.email);
    const bSession = await loginAs(app, b.email);
    const bList = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${bSession.accessToken}`);
    const res = await request(app)
      .delete(`/api/v1/auth/sessions/${bList.body.data[0].familyId}`)
      .set('Authorization', `Bearer ${aSession.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('logout-all ends every session', async () => {
    const user = await makeUser();
    const one = await loginAs(app, user.email);
    const two = await loginAs(app, user.email);
    const res = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${two.accessToken}`);
    expect(res.status).toBe(204);
    expect((await refresh(one.cookie)).status).toBe(401);
    expect((await refresh(two.cookie)).status).toBe(401);
  });
});
