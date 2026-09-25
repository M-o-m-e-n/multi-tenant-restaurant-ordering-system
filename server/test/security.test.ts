import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';

/**
 * The NFR-S sweep (M13-S4). Every mutating endpoint in LLD §5 is listed with
 * the least role that may call it; the test proves the server enforces it
 * (NFR-S4), so a route added without a guard fails here.
 */
type Gate = 'AUTH' | 'STAFF' | 'ADMIN';
const ID = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';

const MUTATIONS: [method: 'post' | 'put' | 'patch' | 'delete', path: string, gate: Gate][] = [
  ['post', '/auth/logout-all', 'AUTH'],
  ['delete', `/auth/sessions/${ID}`, 'AUTH'],
  ['post', '/discounts/validate', 'AUTH'],
  ['post', '/staff/discounts', 'ADMIN'],
  ['patch', `/staff/discounts/${ID}`, 'ADMIN'],
  ['delete', `/staff/discounts/${ID}`, 'ADMIN'],
  ['post', '/staff/menu/categories', 'ADMIN'],
  ['patch', `/staff/menu/categories/${ID}`, 'ADMIN'],
  ['delete', `/staff/menu/categories/${ID}`, 'ADMIN'],
  ['post', '/staff/menu/items', 'ADMIN'],
  ['patch', `/staff/menu/items/${ID}`, 'ADMIN'],
  ['delete', `/staff/menu/items/${ID}`, 'ADMIN'],
  ['patch', `/staff/menu/items/${ID}/availability`, 'STAFF'],
  ['post', `/staff/menu/items/${ID}/modifier-groups`, 'ADMIN'],
  ['delete', `/staff/menu/items/${ID}/modifier-groups/${ID}`, 'ADMIN'],
  ['post', '/staff/menu/modifier-groups', 'ADMIN'],
  ['patch', `/staff/menu/modifier-groups/${ID}`, 'ADMIN'],
  ['delete', `/staff/menu/modifier-groups/${ID}`, 'ADMIN'],
  ['post', `/staff/menu/modifier-groups/${ID}/items`, 'ADMIN'],
  ['patch', `/staff/menu/modifier-groups/${ID}/items/${ID}`, 'ADMIN'],
  ['delete', `/staff/menu/modifier-groups/${ID}/items/${ID}`, 'ADMIN'],
  ['post', '/orders', 'AUTH'],
  ['post', `/orders/${ID}/items`, 'AUTH'],
  ['patch', `/orders/${ID}/status`, 'STAFF'],
  ['patch', `/orders/${ID}/delivery`, 'STAFF'],
  ['post', `/orders/${ID}/cancel`, 'AUTH'],
  ['post', '/payments/intent', 'AUTH'],
  ['post', '/payments/cash', 'STAFF'],
  ['post', '/payments/refund', 'ADMIN'],
  ['post', '/reservations', 'AUTH'],
  ['patch', `/reservations/${ID}`, 'STAFF'],
  ['put', '/staff/settings', 'ADMIN'],
  ['post', '/tables', 'ADMIN'],
  ['patch', `/tables/${ID}`, 'STAFF'],
  ['post', `/tables/${ID}/regenerate-qr`, 'ADMIN'],
  ['post', `/tables/${ID}/close`, 'STAFF'],
  ['post', `/tables/${ID}/clean`, 'STAFF'],
  ['post', '/staff/users', 'ADMIN'],
  ['patch', `/staff/users/${ID}`, 'ADMIN'],
];

const app = createApp({ rateLimits: false });
let customer: string;
let staff: string;

beforeAll(async () => {
  await resetDb();
  customer = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
  staff = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
});
afterAll(disconnectPrisma);

const call = (method: (typeof MUTATIONS)[number][0], path: string, token?: string) => {
  const req = request(app)[method](`/api/v1${path}`).send({});
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('NFR-S4: every mutating endpoint is guarded on the server', () => {
  it.each(MUTATIONS)('%s %s refuses an anonymous caller', async (method, path) => {
    const res = await call(method, path);
    expect(res.status).toBe(401);
  });

  it.each(MUTATIONS.filter(([, , gate]) => gate !== 'AUTH'))(
    '%s %s refuses a customer',
    async (method, path) => {
      const res = await call(method, path, customer);
      expect(res.status).toBe(403);
    },
  );

  it.each(MUTATIONS.filter(([, , gate]) => gate === 'ADMIN'))(
    '%s %s refuses staff',
    async (method, path) => {
      const res = await call(method, path, staff);
      expect(res.status).toBe(403);
    },
  );
});

describe('NFR-S8: rate limits on order placement and refresh', () => {
  it('answers the 31st POST /orders in five minutes from one user with 429', async () => {
    const limited = createApp({ rateLimits: true });
    const token = (await loginAs(limited, (await makeUser('CUSTOMER')).email)).accessToken;
    const place = () =>
      request(limited).post('/api/v1/orders').set('Authorization', `Bearer ${token}`).send({});
    for (let i = 0; i < 30; i++) expect((await place()).status).toBe(400);
    const res = await place();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('NFR-S9: public endpoints expose no PII', () => {
  it('a QR resolve returns the table summary only', async () => {
    await prisma().table.create({ data: { number: '9', qrToken: 'f'.repeat(32) } });
    const res = await request(app).get(`/api/v1/tables/qr/${'f'.repeat(32)}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body as object).sort()).toEqual(['id', 'number', 'seats', 'status']);
  });

  it('public settings carry no secrets or staff-only values', async () => {
    const res = await request(app).get('/api/v1/settings');
    const text = JSON.stringify(res.body);
    for (const key of ['kds', 'orderNumberPrefix', 'secret', 'password']) {
      expect(text).not.toContain(key);
    }
  });

  it('a customer cannot read another customer’s order', async () => {
    const other = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    const res = await request(app)
      .get(`/api/v1/orders/${ID}`)
      .set('Authorization', `Bearer ${other}`);
    expect(res.status).toBe(404);
  });
});
