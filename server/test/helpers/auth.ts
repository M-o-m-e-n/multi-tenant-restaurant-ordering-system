import type { Role } from '@ros/shared';
import type { Express } from 'express';
import request from 'supertest';

import { hashPassword } from '../../src/modules/auth/auth.password';
import { createUser } from '../../src/modules/auth/auth.repo';

export const PASSWORD = 'correct horse battery';

/** Create a user directly (staff and admin cannot self-register). */
export async function makeUser(
  role: Role = 'CUSTOMER',
  email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2)}@x.test`,
) {
  return createUser({
    name: `${role} user`,
    email,
    passwordHash: await hashPassword(PASSWORD),
    role,
  });
}

/** The raw `rt=` cookie pair from a response, ready to send back. */
export function refreshCookieOf(res: request.Response): string {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = header?.find((c) => c.startsWith('rt='));
  if (!cookie) throw new Error('no refresh cookie in response');
  return cookie.split(';')[0]!;
}

/** Log in through the API and return the access token and the refresh cookie. */
export async function loginAs(app: Express, email: string, password = PASSWORD) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return {
    accessToken: res.body.accessToken as string,
    cookie: refreshCookieOf(res),
    user: res.body.user as { id: string; role: Role },
  };
}
