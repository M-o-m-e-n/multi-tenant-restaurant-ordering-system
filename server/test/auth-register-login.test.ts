import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { makeUser, PASSWORD } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });

describe('POST /auth/register and /auth/login', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('registers a customer, returns an access token and sets the refresh cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Jane', email: 'Jane@Example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'jane@example.com', role: 'CUSTOMER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.expiresIn).toBe(900);

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('rt='),
    );
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(res.body.refreshToken).toBeUndefined();
  });

  it('I2: refuses a duplicate email with 409 EMAIL_TAKEN', async () => {
    const body = { name: 'Jane', email: 'jane@example.com', password: PASSWORD };
    await request(app).post('/api/v1/auth/register').send(body);
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('never lets a registration choose its role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Eve', email: 'eve@x.test', password: PASSWORD, role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(await prisma().user.count()).toBe(0);
  });

  it('logs in with the right password', async () => {
    const user = await makeUser('STAFF', 'sam@x.test');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'SAM@x.test', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });

  it('returns the same 401 for a wrong email and a wrong password', async () => {
    await makeUser('CUSTOMER', 'real@x.test');
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'real@x.test', password: 'nope-nope' });
    const wrongEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@x.test', password: PASSWORD });

    for (const res of [wrongPassword, wrongEmail]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }
    expect(wrongPassword.body.error.message).toBe(wrongEmail.body.error.message);
  });
});
