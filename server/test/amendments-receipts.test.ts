import { bps } from '@ros/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { setPaymentGateway } from '../src/lib/payment-gateway';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { menuChanged } from '../src/modules/menu';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';
import { FakeGateway } from './helpers/payments';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('amendments, tips and receipts', () => {
  let menu: Awaited<ReturnType<typeof seedMenu>>;
  let customer: string;
  let staff: string;
  let table: { qrToken: string };
  let events: PublishedEvent[];
  let detach: () => void;

  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    setPaymentGateway(new FakeGateway());
    menu = await seedMenu();
    customer = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    staff = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
    table = await prisma().table.create({ data: { number: '9', qrToken: 'c'.repeat(32) } });
    events = [];
    detach = addTransport((e) => events.push(e));
  });
  afterEach(() => detach());
  afterAll(async () => {
    setPaymentGateway(undefined);
    await disconnectPrisma();
  });

  /** Dine-in: one burger (Large) with a 500 tip. */
  async function placeDineIn() {
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(customer))
      .send({
        type: 'DINE_IN',
        tableToken: table.qrToken,
        items: [
          { menuItemId: menu.items.burger.id, qty: 1, modifierItemIds: [menu.options.large] },
        ],
        tipAmount: 500,
      });
    expect(res.status).toBe(201);
    return res.body as {
      id: string;
      totals: { total: number; taxAmount: number; subtotal: number; tipAmount: number };
    };
  }

  const append = (id: string, items: object[], token = customer) =>
    request(app).post(`/api/v1/orders/${id}/items`).set(bearer(token)).send({ items });

  const bump = (id: string, to: string) =>
    request(app).patch(`/api/v1/orders/${id}/status`).set(bearer(staff)).send({ to });

  it('I17: appending to a PAID order raises the total and drops it to PARTIALLY_PAID (AC-14)', async () => {
    const order = await placeDineIn();
    await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id })
      .expect(200);

    const res = await append(order.id, [{ menuItemId: menu.items.lemonade.id, qty: 2 }]);
    expect(res.status).toBe(200);
    expect(res.body.totals.subtotal).toBe(order.totals.subtotal + 900);
    expect(res.body.totals.total).toBeGreaterThan(order.totals.total);
    expect(res.body.paymentStatus).toBe('PARTIALLY_PAID');
    expect(res.body.balanceDue).toBe(res.body.totals.total - order.totals.total);

    const log = await prisma().auditLog.findFirst({ where: { action: 'ORDER_ITEMS_APPENDED' } });
    const diff = log?.diff as {
      before: { totals: { total: number } };
      after: { totals: { total: number }; lines: unknown[] };
    };
    expect(diff.before.totals.total).toBe(order.totals.total);
    expect(diff.after.totals.total).toBe(res.body.totals.total);
    expect(diff.after.lines).toHaveLength(1);

    // The balance is collectable by cash (AC-14).
    const settle = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id });
    expect(settle.body.order.paymentStatus).toBe('PAID');
  });

  it('announces an amendment as order:status with from === to, and new lines carry a later addedAt', async () => {
    const order = await placeDineIn();
    events.length = 0;
    const res = await append(order.id, [
      { menuItemId: menu.items.lemonade.id, qty: 1, notes: 'no ice' },
    ]);
    const status = events.find((e) => e.name === 'order:status' && e.rooms.includes('kitchen'));
    const payload = status?.payload as { from: string; to: string };
    expect(payload.from).toBe(payload.to);
    const items = res.body.items as { nameSnapshot: string; addedAt: string }[];
    expect(items.map((i) => i.nameSnapshot)).toEqual(['Wagyu Burger', 'Lemonade']);
    expect(items[1]!.addedAt >= items[0]!.addedAt).toBe(true);
  });

  it('I18: refuses to append once the order is READY (BR-14)', async () => {
    const order = await placeDineIn();
    for (const to of ['CONFIRMED', 'PREPARING', 'READY']) await bump(order.id, to).expect(200);
    const res = await append(order.id, [{ menuItemId: menu.items.lemonade.id, qty: 1 }]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_NOT_AMENDABLE');
  });

  it('allows appending while PREPARING, by staff too', async () => {
    const order = await placeDineIn();
    for (const to of ['CONFIRMED', 'PREPARING']) await bump(order.id, to).expect(200);
    const res = await append(order.id, [{ menuItemId: menu.items.lemonade.id, qty: 1 }], staff);
    expect(res.status).toBe(200);
  });

  it('reprices with the rates the order was placed under, not current settings (ORD-13)', async () => {
    const order = await placeDineIn();
    await prisma().setting.create({ data: { key: 'taxBps', value: '2000' } });
    invalidateSettingsCache();
    const res = await append(order.id, [{ menuItemId: menu.items.lemonade.id, qty: 2 }]);
    const subtotal = order.totals.subtotal + 900;
    // Tax still at the original 8.75% over both rounds, service charge at 10%.
    expect(res.body.totals.taxAmount).toBe(bps(subtotal, 875));
    expect(res.body.totals.serviceCharge).toBe(bps(subtotal, 1000));
    expect(res.body.totals.tipAmount).toBe(500);
  });

  it('validates appended lines like a new order (AC-17) and hides others’ orders', async () => {
    const order = await placeDineIn();
    const bad = await append(order.id, [
      { menuItemId: menu.items.burger.id, qty: 1, modifierItemIds: [] },
    ]);
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('INVALID_MODIFIER_SELECTION');

    const other = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    expect(
      (await append(order.id, [{ menuItemId: menu.items.lemonade.id, qty: 1 }], other)).status,
    ).toBe(404);
  });

  it('I27: the receipt shows what was charged even after the menu price changes (AC-19)', async () => {
    const order = await placeDineIn();
    await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id, tipAmount: 200 });
    await prisma().menuItem.update({
      where: { id: menu.items.burger.id },
      data: { price: 9999, name: 'Renamed' },
    });

    const res = await request(app).get(`/api/v1/orders/${order.id}/receipt`).set(bearer(customer));
    expect(res.status).toBe(200);
    expect(res.body.lines[0]).toMatchObject({
      name: 'Wagyu Burger',
      qty: 1,
      unitPrice: 1850,
      modifiers: [{ name: 'Large', priceDelta: 400 }],
      lineTotal: 2250,
    });
    expect(res.body.totals.total).toBe(order.totals.total);
    expect(res.body).toMatchObject({ table: '9', orderNumber: 'A-1001', paymentStatus: 'PAID' });
    expect(res.body.payments).toEqual([
      expect.objectContaining({
        method: 'CASH',
        amount: order.totals.total,
        tipAmount: 200,
        state: 'SUCCEEDED',
      }),
    ]);
  });

  it('AC-15: a checkout tip is in the total but not in tax or discount, and shows as its own line', async () => {
    const order = await placeDineIn();
    const noTip = await request(app)
      .post('/api/v1/orders/preview')
      .send({
        type: 'DINE_IN',
        items: [
          { menuItemId: menu.items.burger.id, qty: 1, modifierItemIds: [menu.options.large] },
        ],
      });
    expect(order.totals.total - noTip.body.totals.total).toBe(500);
    expect(order.totals.taxAmount).toBe(noTip.body.totals.taxAmount);
    const receipt = await request(app)
      .get(`/api/v1/orders/${order.id}/receipt`)
      .set(bearer(customer));
    expect(receipt.body.totals.tipAmount).toBe(500);
  });

  it('serves receipts to the owner and staff only (PRINT-04)', async () => {
    const order = await placeDineIn();
    expect(
      (await request(app).get(`/api/v1/orders/${order.id}/receipt`).set(bearer(staff))).status,
    ).toBe(200);
    const other = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    expect(
      (await request(app).get(`/api/v1/orders/${order.id}/receipt`).set(bearer(other))).status,
    ).toBe(404);
  });
});
