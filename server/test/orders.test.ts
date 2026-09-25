import { computeTotals } from '@ros/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { menuChanged } from '../src/modules/menu';
import { createOrder } from '../src/modules/orders/orders.service';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('order placement and lifecycle', () => {
  let menu: Awaited<ReturnType<typeof seedMenu>>;
  let customer: { token: string; id: string; name: string };
  let staffToken: string;
  let tableA: { id: string; qrToken: string };
  let tableB: { id: string; qrToken: string };
  let events: PublishedEvent[];
  let detach: () => void;

  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    menu = await seedMenu();
    const c = await makeUser('CUSTOMER');
    customer = { token: (await loginAs(app, c.email)).accessToken, id: c.id, name: c.name };
    staffToken = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
    tableA = await prisma().table.create({ data: { number: 'A', qrToken: 'a'.repeat(32) } });
    tableB = await prisma().table.create({ data: { number: 'B', qrToken: 'b'.repeat(32) } });
    await prisma().discount.create({ data: { code: 'SAVE10', type: 'PERCENT', value: 1000 } });
    events = [];
    detach = addTransport((e) => events.push(e));
  });
  afterEach(() => detach());
  afterAll(disconnectPrisma);

  const burgerLine = () => ({
    menuItemId: menu.items.burger.id,
    qty: 2,
    modifierItemIds: [menu.options.large, menu.options.noBun],
    notes: 'no pickles',
  });

  const place = (body: object, token = customer.token, key?: string) => {
    const req = request(app).post('/api/v1/orders').set(bearer(token));
    return (key ? req.set('Idempotency-Key', key) : req).send(body);
  };

  const dineIn = (extra: object = {}) => ({
    type: 'DINE_IN',
    tableToken: tableA.qrToken,
    items: [burgerLine(), { menuItemId: menu.items.lemonade.id, qty: 1 }],
    ...extra,
  });

  it('I4: places an order whose totals equal computeTotals, with snapshots and a first event', async () => {
    const res = await place(dineIn({ discountCode: 'SAVE10', tipAmount: 250 }));
    expect(res.status).toBe(201);

    const expected = computeTotals({
      orderType: 'DINE_IN',
      lines: [
        { menuItemId: 'b', unitPrice: 1850, qty: 2, modifierDeltas: [400, -100] },
        { menuItemId: 'l', unitPrice: 450, qty: 1, modifierDeltas: [] },
      ],
      discount: { type: 'PERCENT', value: 1000 },
      tipAmount: 250,
      ctx: { taxBps: 875, serviceChargeBps: 1000, serviceChargeTaxable: false, deliveryFee: 499 },
    }).totals;
    const { currency, ...totals } = res.body.totals;
    expect(totals).toEqual(expected);
    expect(currency).toBe('usd');

    expect(res.body).toMatchObject({
      orderNumber: 'A-1001',
      type: 'DINE_IN',
      status: 'PLACED',
      paymentStatus: 'UNPAID',
      balanceDue: expected.total,
      table: { id: tableA.id, number: 'A' },
      discountCode: 'SAVE10',
      isAmendable: true,
      nextStatuses: ['CANCELLED'],
    });
    expect(res.body.items[0]).toMatchObject({
      nameSnapshot: 'Wagyu Burger',
      unitPrice: 1850,
      modifierTotal: 300,
      lineTotal: 4300,
      notes: 'no pickles',
      station: 'grill',
    });

    const evs = await prisma().orderEvent.findMany({ where: { orderId: res.body.id } });
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ fromStatus: null, toStatus: 'PLACED' });
    expect((await prisma().table.findUnique({ where: { id: tableA.id } }))?.status).toBe('SEATED');
    expect((await prisma().discount.findUnique({ where: { code: 'SAVE10' } }))?.usedCount).toBe(1);

    const names = events.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(['order:new', 'order:status', 'table:changed']));
    expect(events.find((e) => e.name === 'order:new')?.rooms).toEqual(['kitchen', 'pos', 'admin']);
  });

  it('keeps the snapshot when the menu item is renamed afterwards (M7-S5)', async () => {
    const res = await place(dineIn());
    await prisma().menuItem.update({
      where: { id: menu.items.burger.id },
      data: { name: 'Renamed', price: 1 },
    });
    const order = await request(app)
      .get(`/api/v1/orders/${res.body.id as string}`)
      .set(bearer(customer.token));
    expect(order.body.items[0].nameSnapshot).toBe('Wagyu Burger');
    expect(order.body.items[0].unitPrice).toBe(1850);
  });

  it('I5: refuses an 86’d item with 409 ITEM_UNAVAILABLE and writes nothing', async () => {
    await prisma().menuItem.update({
      where: { id: menu.items.lemonade.id },
      data: { isAvailable: false },
    });
    menuChanged();
    const res = await place(dineIn());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
    expect(await prisma().order.count()).toBe(0);
    expect(await prisma().orderSequence.count()).toBe(0);
  });

  it('I11: binds the table from the QR token only (AC-12)', async () => {
    const res = await place(dineIn({ tableToken: tableA.qrToken }));
    expect(res.body.table.id).toBe(tableA.id);

    const smuggled = await place({ ...dineIn(), tableId: tableB.id });
    expect(smuggled.status).toBe(400);

    const other = await place(dineIn({ tableToken: tableB.qrToken }));
    expect(other.body.table.id).toBe(tableB.id);
  });

  it('refuses a dine-in order at a dirty table (TABLE_DIRTY)', async () => {
    await prisma().table.update({ where: { id: tableA.id }, data: { status: 'DIRTY' } });
    const res = await place(dineIn());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TABLE_DIRTY');
  });

  it('I15: rejects a borrowed modifier and creates no order (AC-17)', async () => {
    const res = await place({
      type: 'TAKEAWAY',
      customer: { name: 'Jo', phone: '+15550101' },
      items: [
        {
          menuItemId: menu.items.burger.id,
          qty: 1,
          modifierItemIds: [menu.options.regular, menu.options.stuffedCrust],
        },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_MODIFIER_SELECTION');
    expect(await prisma().order.count()).toBe(0);
  });

  it('places takeaway and delivery orders with contact details and the delivery fee', async () => {
    const takeaway = await place({
      type: 'TAKEAWAY',
      customer: { name: 'Jo', phone: '+15550101' },
      items: [{ menuItemId: menu.items.lemonade.id, qty: 2 }],
    });
    expect(takeaway.status).toBe(201);
    expect(takeaway.body.table).toBeNull();
    expect(takeaway.body.customer).toEqual({ name: 'Jo', phone: '+15550101' });

    const delivery = await place({
      type: 'DELIVERY',
      customer: { name: 'Jo', phone: '+15550101' },
      delivery: { address: '12 Bridge St', note: 'ring twice' },
      items: [{ menuItemId: menu.items.lemonade.id, qty: 2 }],
    });
    expect(delivery.status).toBe(201);
    expect(delivery.body.totals.deliveryFee).toBe(499);
    expect(delivery.body.delivery).toMatchObject({ address: '12 Bridge St', status: 'PENDING' });
    expect(delivery.body.orderNumber).toBe('A-1002');
  });

  it('I16: two concurrent checkouts cannot both take the last redemption (DISC-06)', async () => {
    await prisma().discount.create({
      data: { code: 'LAST', type: 'FIXED', value: 100, usageLimit: 1 },
    });
    const body = {
      type: 'TAKEAWAY',
      customer: { name: 'Jo', phone: '+15550101' },
      items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      discountCode: 'LAST',
    };
    const [a, b] = await Promise.all([place(body), place(body)]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    const loser = a.status === 422 ? a : b;
    expect(loser.body.error.code).toBe('DISCOUNT_LIMIT_REACHED');
    expect((await prisma().discount.findUnique({ where: { code: 'LAST' } }))?.usedCount).toBe(1);
    expect(await prisma().order.count()).toBe(1);
  });

  it('allocates distinct numbers to concurrent placements (M7-S2)', async () => {
    const body = {
      type: 'TAKEAWAY',
      customer: { name: 'Jo', phone: '+15550101' },
      items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
    };
    const results = await Promise.all(Array.from({ length: 6 }, () => place(body)));
    const numbers = results.map((r) => r.body.orderNumber as string).sort();
    expect(new Set(numbers).size).toBe(6);
    expect(numbers[0]).toBe('A-1001');
  });

  it('I21: replays the original 201 for a repeated Idempotency-Key and refuses a changed body', async () => {
    const first = await place(dineIn(), customer.token, 'order-intent-0001');
    const again = await place(dineIn(), customer.token, 'order-intent-0001');
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma().order.count()).toBe(1);

    const changed = await place(
      dineIn({ notes: 'different' }),
      customer.token,
      'order-intent-0001',
    );
    expect(changed.status).toBe(422);
    expect(changed.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('I22: an order at 00:30 local in a UTC+3 zone gets the local business date (AC-16)', async () => {
    await prisma().setting.create({ data: { key: 'timezone', value: 'Europe/Moscow' } });
    invalidateSettingsCache();
    const actor = {
      id: customer.id,
      role: 'CUSTOMER' as const,
      name: customer.name,
      sessionId: customer.id,
    };
    const { body } = await createOrder(
      {
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1, modifierItemIds: [] }],
      },
      actor,
      { now: new Date('2026-09-24T21:30:00Z') },
    );
    expect(body.businessDate).toBe('2026-09-25');
  });

  it('I23: reissues A-1001 on the next business date without a unique violation', async () => {
    const actor = {
      id: customer.id,
      role: 'CUSTOMER' as const,
      name: customer.name,
      sessionId: customer.id,
    };
    const dto = {
      type: 'TAKEAWAY' as const,
      customer: { name: 'Jo', phone: '+15550101' },
      items: [{ menuItemId: menu.items.lemonade.id, qty: 1, modifierItemIds: [] }],
    };
    const day1 = await createOrder(dto, actor, { now: new Date('2026-09-24T16:00:00Z') });
    const day2 = await createOrder(dto, actor, { now: new Date('2026-09-25T16:00:00Z') });
    expect(day1.body.orderNumber).toBe('A-1001');
    expect(day2.body.orderNumber).toBe('A-1001');
    expect(day1.body.businessDate).not.toBe(day2.body.businessDate);
  });

  it('I6 / AC-3: walks PLACED → COMPLETED and refuses an illegal move with 409', async () => {
    const { body: order } = await place(dineIn());
    for (const to of ['CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED']) {
      const res = await request(app)
        .patch(`/api/v1/orders/${order.id as string}/status`)
        .set(bearer(staffToken))
        .send({ to });
      expect(res.status, to).toBe(200);
      expect(res.body.status).toBe(to);
    }
    const back = await request(app)
      .patch(`/api/v1/orders/${order.id as string}/status`)
      .set(bearer(staffToken))
      .send({ to: 'PREPARING' });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe('ILLEGAL_TRANSITION');

    const done = await prisma().order.findUnique({ where: { id: order.id as string } });
    expect(done?.completedAt).not.toBeNull();
    const timeline = await request(app)
      .get(`/api/v1/orders/${order.id as string}/events`)
      .set(bearer(customer.token));
    expect(timeline.body.data.map((e: { toStatus: string }) => e.toStatus)).toEqual([
      'PLACED',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'SERVED',
      'COMPLETED',
    ]);
  });

  it('refuses a skip-forward (BR-12)', async () => {
    const { body: order } = await place(dineIn());
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id as string}/status`)
      .set(bearer(staffToken))
      .send({ to: 'PREPARING' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('I7: two concurrent bumps — one wins, one gets 409', async () => {
    const { body: order } = await place(dineIn());
    const bump = () =>
      request(app)
        .patch(`/api/v1/orders/${order.id as string}/status`)
        .set(bearer(staffToken))
        .send({ to: 'CONFIRMED' });
    const [a, b] = await Promise.all([bump(), bump()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(['CONCURRENT_UPDATE', 'ILLEGAL_TRANSITION']).toContain(loser.body.error.code);
    expect(await prisma().orderEvent.count({ where: { orderId: order.id as string } })).toBe(2);
  });

  it('lets a customer cancel only from PLACED or CONFIRMED (ORD-09, M7-S11)', async () => {
    const { body: first } = await place(dineIn());
    const ok = await request(app)
      .post(`/api/v1/orders/${first.id as string}/cancel`)
      .set(bearer(customer.token))
      .send({ reason: 'Changed my mind' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('CANCELLED');
    expect(events.some((e) => e.name === 'order:removed')).toBe(true);

    const { body: second } = await place(dineIn());
    for (const to of ['CONFIRMED', 'PREPARING']) {
      await request(app)
        .patch(`/api/v1/orders/${second.id as string}/status`)
        .set(bearer(staffToken))
        .send({ to });
    }
    const late = await request(app)
      .post(`/api/v1/orders/${second.id as string}/cancel`)
      .set(bearer(customer.token))
      .send({});
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('stops a customer bumping their own order through the staff route', async () => {
    const { body: order } = await place(dineIn());
    const res = await request(app)
      .patch(`/api/v1/orders/${order.id as string}/status`)
      .set(bearer(customer.token))
      .send({ to: 'CONFIRMED' });
    expect(res.status).toBe(403);
  });

  it('M7-S10: scopes lists by role and answers another customer’s order with 404', async () => {
    const { body: mine } = await place(dineIn());
    const other = await makeUser('CUSTOMER');
    const otherToken = (await loginAs(app, other.email)).accessToken;
    await place(
      {
        type: 'TAKEAWAY',
        customer: { name: 'O', phone: '+15550102' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 1 }],
      },
      otherToken,
    );

    const peek = await request(app)
      .get(`/api/v1/orders/${mine.id as string}`)
      .set(bearer(otherToken));
    expect(peek.status).toBe(404);
    expect(peek.body.error.code).toBe('ORDER_NOT_FOUND');

    const myList = await request(app).get('/api/v1/orders').set(bearer(customer.token));
    expect(myList.body.meta.total).toBe(1);
    const staffList = await request(app)
      .get('/api/v1/orders?status=PLACED&limit=10')
      .set(bearer(staffToken));
    expect(staffList.body.meta.total).toBe(2);
    expect(staffList.body.data[0].nextStatuses).toEqual(['CONFIRMED', 'CANCELLED']);
  });
});
