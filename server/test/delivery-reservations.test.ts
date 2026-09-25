import type { OrderDto } from '@ros/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { addDays, businessDateOf, zonedTimeToUtc } from '../src/lib/time';
import { menuChanged } from '../src/modules/menu';
import { flagOverdueReservations, resetReservationFlags } from '../src/modules/reservations';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
const TZ = 'America/New_York';

let menu: Awaited<ReturnType<typeof seedMenu>>;
let customer: string;
let staff: string;
let events: PublishedEvent[];
let detach: () => void;

beforeEach(async () => {
  await resetDb();
  invalidateSettingsCache();
  menuChanged();
  resetReservationFlags();
  menu = await seedMenu();
  customer = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
  staff = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
  events = [];
  detach = addTransport((e) => events.push(e));
});
afterEach(() => detach());
afterAll(disconnectPrisma);

describe('takeaway and delivery (M12-S1…S3)', () => {
  const contact = { name: 'Jo', phone: '+15550101' };
  const lines = () => [{ menuItemId: menu.items.lemonade.id, qty: 2 }];
  const place = (body: object) =>
    request(app).post('/api/v1/orders').set(bearer(customer)).send(body);
  const patchDelivery = (id: string, body: object, token = staff) =>
    request(app).patch(`/api/v1/orders/${id}/delivery`).set(bearer(token)).send(body);

  async function placeDelivery(extra: object = {}) {
    const res = await place({
      type: 'DELIVERY',
      customer: contact,
      delivery: { address: '12 Bridge St', note: 'ring twice' },
      items: lines(),
      ...extra,
    });
    expect(res.status).toBe(201);
    return res.body as OrderDto;
  }

  it('DEL-01: takeaway needs a name and phone and never binds a table', async () => {
    expect((await place({ type: 'TAKEAWAY', items: lines() })).status).toBe(400);
    const smuggled = await place({
      type: 'TAKEAWAY',
      customer: contact,
      tableToken: 'a'.repeat(32),
      items: lines(),
    });
    expect(smuggled.status).toBe(400);
  });

  it('BR-10: a discount never touches the delivery fee', async () => {
    await prisma().discount.create({ data: { code: 'HALF', type: 'PERCENT', value: 5000 } });
    const order = await placeDelivery({ discountCode: 'HALF' });
    expect(order.totals.deliveryFee).toBe(499);
    expect(order.totals.discountAmount).toBe(Math.round(order.totals.subtotal / 2));
    const { subtotal, discountAmount, serviceCharge, taxAmount, deliveryFee, tipAmount, total } =
      order.totals;
    expect(total).toBe(
      subtotal - discountAmount + serviceCharge + taxAmount + deliveryFee + tipAmount,
    );
  });

  it('DEL-03/04: staff assign a driver and walk the delivery to DELIVERED, independent of the order', async () => {
    const order = await placeDelivery();

    const noDriver = await patchDelivery(order.id, { status: 'ASSIGNED' });
    expect(noDriver.status).toBe(422);
    expect(noDriver.body.error.code).toBe('DRIVER_REQUIRED');

    const assigned = await patchDelivery(order.id, { driverName: 'Ali' });
    expect(assigned.status).toBe(200);
    expect(assigned.body.delivery).toMatchObject({ status: 'ASSIGNED', driverName: 'Ali' });
    expect(assigned.body.status).toBe('PLACED');

    const skip = await patchDelivery(order.id, { status: 'DELIVERED' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('ILLEGAL_TRANSITION');

    const reassigned = await patchDelivery(order.id, { driverName: 'Bea' });
    expect(reassigned.body.delivery).toMatchObject({ status: 'ASSIGNED', driverName: 'Bea' });

    expect((await patchDelivery(order.id, { status: 'PICKED_UP' })).status).toBe(200);
    const late = await patchDelivery(order.id, { driverName: 'Cy' });
    expect(late.status).toBe(409);

    const done = await patchDelivery(order.id, { status: 'DELIVERED' });
    expect(done.body.delivery.status).toBe('DELIVERED');
    expect(done.body.status).toBe('PLACED');

    // Announced as an order:status refresh (from === to), and audited.
    const refresh = events.filter((e) => e.name === 'order:status');
    expect(refresh.length).toBeGreaterThanOrEqual(4);
    expect(
      await prisma().auditLog.count({ where: { action: 'DELIVERY_UPDATE', entityId: order.id } }),
    ).toBe(4);

    // The customer sees the delivery progress on their own order.
    const mine = await request(app).get(`/api/v1/orders/${order.id}`).set(bearer(customer));
    expect(mine.body.delivery).toMatchObject({ status: 'DELIVERED', driverName: 'Bea' });
  });

  it('refuses delivery updates from customers, on takeaways and on cancelled orders', async () => {
    const order = await placeDelivery();
    expect((await patchDelivery(order.id, { driverName: 'Ali' }, customer)).status).toBe(403);

    const takeaway = await place({ type: 'TAKEAWAY', customer: contact, items: lines() });
    const notDelivery = await patchDelivery(takeaway.body.id as string, { driverName: 'Ali' });
    expect(notDelivery.status).toBe(409);
    expect(notDelivery.body.error.code).toBe('NOT_A_DELIVERY');

    await request(app)
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set(bearer(customer))
      .send({ reason: 'changed my mind' });
    const cancelled = await patchDelivery(order.id, { driverName: 'Ali' });
    expect(cancelled.status).toBe(409);
    expect(cancelled.body.error.code).toBe('ILLEGAL_TRANSITION');
  });
});

describe('reservations (M12-S4…S6)', () => {
  const tomorrow = () => addDays(businessDateOf(new Date(), TZ), 1);
  const slot = (hour: number, minute = 0, date = tomorrow()) =>
    zonedTimeToUtc(date, hour, minute, TZ).toISOString();
  const book = (body: object, token = customer) =>
    request(app).post('/api/v1/reservations').set(bearer(token)).send(body);
  const guest = { guestName: 'Ava', guestPhone: '+15550100', partySize: 4 };

  it('TABLE-06: books, lists by business date and cancels', async () => {
    const created = await book({ ...guest, slotAt: slot(19, 30), notes: 'window seat' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'PENDING', table: null, overdue: false });

    await book({ ...guest, guestName: 'Ben', slotAt: slot(12) });
    // 23:30 local is still the same business date even though it is the next day in UTC.
    await book({ ...guest, guestName: 'Late', slotAt: slot(23, 30) });
    await book({ ...guest, guestName: 'Other day', slotAt: slot(19, 0, addDays(tomorrow(), 1)) });

    const list = await request(app)
      .get(`/api/v1/reservations?date=${tomorrow()}`)
      .set(bearer(staff));
    expect(list.status).toBe(200);
    expect(list.body.data.map((r: { guestName: string }) => r.guestName)).toEqual([
      'Ben',
      'Ava',
      'Late',
    ]);

    // Customers can book but not read the book.
    expect((await request(app).get('/api/v1/reservations').set(bearer(customer))).status).toBe(403);

    const id = created.body.id as string;
    const cancel = await request(app)
      .patch(`/api/v1/reservations/${id}`)
      .set(bearer(staff))
      .send({ action: 'cancel' });
    expect(cancel.body.status).toBe('CANCELLED');
    const again = await request(app)
      .patch(`/api/v1/reservations/${id}`)
      .set(bearer(staff))
      .send({ action: 'cancel' });
    expect(again.status).toBe(409);
  });

  it('refuses past or far-future slots, and a customer choosing the table', async () => {
    const past = await book({ ...guest, slotAt: new Date(Date.now() - 60_000).toISOString() });
    expect(past.status).toBe(422);
    expect(past.body.error.code).toBe('RESERVATION_IN_PAST');

    const far = await book({
      ...guest,
      slotAt: new Date(Date.now() + 120 * 86_400_000).toISOString(),
    });
    expect(far.body.error.code).toBe('RESERVATION_TOO_FAR');

    const table = await prisma().table.create({ data: { number: '7', qrToken: 'c'.repeat(32) } });
    expect((await book({ ...guest, slotAt: slot(19), tableId: table.id })).status).toBe(403);
    const pinned = await book({ ...guest, slotAt: slot(19), tableId: table.id }, staff);
    expect(pinned.body.table).toEqual({ id: table.id, number: '7' });
  });

  it('TABLE-06: seating marks the table and the booking SEATED together', async () => {
    const t1 = await prisma().table.create({ data: { number: '1', qrToken: 'd'.repeat(32) } });
    const t2 = await prisma().table.create({
      data: { number: '2', qrToken: 'e'.repeat(32), status: 'SEATED' },
    });
    const r = (await book({ ...guest, slotAt: slot(19) })).body as { id: string };
    const seat = (body: object) =>
      request(app).patch(`/api/v1/reservations/${r.id}`).set(bearer(staff)).send(body);

    const noTable = await seat({ action: 'seat' });
    expect(noTable.status).toBe(422);
    expect(noTable.body.error.code).toBe('TABLE_REQUIRED');

    const occupied = await seat({ action: 'seat', tableId: t2.id });
    expect(occupied.status).toBe(409);
    expect(occupied.body.error.code).toBe('TABLE_OCCUPIED');
    expect((await prisma().reservation.findUnique({ where: { id: r.id } }))?.status).toBe(
      'PENDING',
    );

    const seated = await seat({ action: 'seat', tableId: t1.id });
    expect(seated.status).toBe(200);
    expect(seated.body).toMatchObject({ status: 'SEATED', table: { id: t1.id, number: '1' } });
    expect((await prisma().table.findUnique({ where: { id: t1.id } }))?.status).toBe('SEATED');
    expect(events.find((e) => e.name === 'table:changed')?.payload).toMatchObject({
      tableId: t1.id,
      status: 'SEATED',
    });

    const twice = await seat({ action: 'seat', tableId: t1.id });
    expect(twice.status).toBe(409);
  });

  it('TABLE-07: flags a booking once, 15 minutes after its slot, to the pos room', async () => {
    const base = Date.now();
    const at = (min: number) => new Date(base + min * 60_000);
    const row = await prisma().reservation.create({
      data: { ...guest, slotAt: at(-20) },
    });
    await prisma().reservation.create({ data: { ...guest, slotAt: at(-10) } });
    await prisma().reservation.create({
      data: { ...guest, slotAt: at(-30), status: 'CANCELLED' },
    });

    expect(await flagOverdueReservations(at(0))).toBe(1);
    const flags = events.filter((e) => e.name === 'reservation:flag');
    expect(flags).toEqual([
      {
        name: 'reservation:flag',
        payload: { reservationId: row.id, state: 'OVERDUE' },
        rooms: ['pos'],
      },
    ]);

    // Not raised again on the next tick; the -10 booking crosses the line 6 minutes later.
    expect(await flagOverdueReservations(at(1))).toBe(0);
    expect(await flagOverdueReservations(at(6))).toBe(1);

    const list = await request(app)
      .get(`/api/v1/reservations?date=${businessDateOf(at(-20), TZ)}`)
      .set(bearer(staff));
    const listed = (list.body.data as { id: string; overdue: boolean }[]).find(
      (r) => r.id === row.id,
    );
    expect(listed?.overdue).toBe(true);
  });
});
