import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { dateOnly } from '../src/lib/time';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function tokenFor(role: 'ADMIN' | 'STAFF' | 'CUSTOMER') {
  const user = await makeUser(role);
  return (await loginAs(app, user.email)).accessToken;
}

describe('tables and QR sessions', () => {
  let admin: string;
  let staff: string;
  let events: PublishedEvent[];
  let detach: () => void;

  beforeEach(async () => {
    await resetDb();
    admin = await tokenFor('ADMIN');
    staff = await tokenFor('STAFF');
    events = [];
    detach = addTransport((e) => events.push(e));
  });
  afterEach(() => detach());
  afterAll(disconnectPrisma);

  async function createTable(number = '7') {
    const res = await request(app)
      .post('/api/v1/tables')
      .set(bearer(admin))
      .send({ number, seats: 4 });
    expect(res.status).toBe(201);
    return res.body as { id: string; qrToken: string; qrUrl: string };
  }

  it('creates tables with 32-hex tokens and refuses a duplicate number (M5-S1)', async () => {
    const a = await createTable('7');
    const b = await createTable('8');
    expect(a.qrToken).toMatch(/^[0-9a-f]{32}$/);
    expect(a.qrToken).not.toBe(b.qrToken);
    expect(a.qrUrl).toBe(`http://localhost:5173/t/${a.qrToken}`);

    const dup = await request(app).post('/api/v1/tables').set(bearer(admin)).send({ number: '7' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('TABLE_NUMBER_TAKEN');
  });

  it('I26: GET /tables/qr/:token resolves without changing status (AC-12)', async () => {
    const t = await createTable();
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get(`/api/v1/tables/qr/${t.qrToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: t.id, number: '7', seats: 4, status: 'FREE' });
      expect(res.body.qrToken).toBeUndefined();
    }
    expect((await prisma().table.findUnique({ where: { id: t.id } }))?.status).toBe('FREE');
    expect(events.filter((e) => e.name === 'table:changed')).toHaveLength(1); // only the create
  });

  it('seats a FREE table on POST /tables/sessions and joins a SEATED one (M5-S3)', async () => {
    const t = await createTable();
    const first = await request(app).post('/api/v1/tables/sessions').send({ token: t.qrToken });
    expect(first.status).toBe(201);
    expect(first.body.table.status).toBe('SEATED');
    const second = await request(app).post('/api/v1/tables/sessions').send({ token: t.qrToken });
    expect(second.status).toBe(201);
    expect(second.body.table.status).toBe('SEATED');
    expect(
      events.filter(
        (e) => e.name === 'table:changed' && (e.payload as { status: string }).status === 'SEATED',
      ),
    ).toHaveLength(1);
  });

  it('refuses a session on a DIRTY table with 409 TABLE_DIRTY', async () => {
    const t = await createTable();
    await prisma().table.update({ where: { id: t.id }, data: { status: 'DIRTY' } });
    const res = await request(app).post('/api/v1/tables/sessions').send({ token: t.qrToken });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLE_DIRTY');
  });

  it('I12: will not close a table with open orders (BR-08, AC-11)', async () => {
    const t = await createTable();
    await request(app).post('/api/v1/tables/sessions').send({ token: t.qrToken });
    await prisma().order.create({
      data: {
        orderNumber: 'A-1001',
        businessDate: dateOnly('2026-09-25'),
        type: 'DINE_IN',
        tableId: t.id,
        subtotal: 1000,
        taxAmount: 88,
        total: 1088,
      },
    });
    const res = await request(app).post(`/api/v1/tables/${t.id}/close`).set(bearer(staff));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLE_HAS_OPEN_ORDERS');
    expect(res.body.error.details.orders[0].orderNumber).toBe('A-1001');

    const map = await request(app).get('/api/v1/tables').set(bearer(staff));
    expect(map.body.data[0]).toMatchObject({ number: '7', status: 'SEATED', openOrders: 1 });
  });

  it('closes SEATED → DIRTY and cleans DIRTY → FREE (M5-S4, M5-S5)', async () => {
    const t = await createTable();
    await request(app).post('/api/v1/tables/sessions').send({ token: t.qrToken });
    const closed = await request(app).post(`/api/v1/tables/${t.id}/close`).set(bearer(staff));
    expect(closed.body.status).toBe('DIRTY');
    const cleaned = await request(app).post(`/api/v1/tables/${t.id}/clean`).set(bearer(staff));
    expect(cleaned.body.status).toBe('FREE');
    const again = await request(app).post(`/api/v1/tables/${t.id}/clean`).set(bearer(staff));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TABLE_NOT_DIRTY');
  });

  it('stops the old token resolving after regeneration (M5-S6)', async () => {
    const t = await createTable();
    const res = await request(app).post(`/api/v1/tables/${t.id}/regenerate-qr`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/v1/tables/qr/${t.qrToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/tables/qr/${res.body.qrToken as string}`)).status).toBe(
      200,
    );
  });

  it('exports a QR code as SVG and PNG (M5-S7)', async () => {
    const t = await createTable();
    const svg = await request(app)
      .get(`/api/v1/tables/${t.id}/qr.svg`)
      .set(bearer(admin))
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.on('data', (chunk: Buffer) => (text += chunk.toString()));
        res.on('end', () => done(null, text));
      });
    expect(svg.status).toBe(200);
    expect(svg.headers['content-type']).toMatch(/image\/svg\+xml/);
    expect(svg.body as string).toContain('<svg');
    const png = await request(app).get(`/api/v1/tables/${t.id}/qr.png`).set(bearer(admin));
    expect(png.headers['content-type']).toBe('image/png');
  });

  it('keeps staff to status changes and admins to structural ones', async () => {
    const t = await createTable();
    const rename = await request(app)
      .patch(`/api/v1/tables/${t.id}`)
      .set(bearer(staff))
      .send({ number: '9' });
    expect(rename.status).toBe(403);
    const mark = await request(app)
      .patch(`/api/v1/tables/${t.id}`)
      .set(bearer(staff))
      .send({ status: 'DIRTY' });
    expect(mark.status).toBe(200);
    expect(mark.body.status).toBe('DIRTY');
  });

  it('keeps the map from customers', async () => {
    const customer = await tokenFor('CUSTOMER');
    expect((await request(app).get('/api/v1/tables').set(bearer(customer))).status).toBe(403);
  });
});
