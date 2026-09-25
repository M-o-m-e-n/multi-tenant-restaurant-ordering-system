import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { addTransport, type PublishedEvent } from '../src/lib/events';
import { setPaymentGateway, StripeGateway } from '../src/lib/payment-gateway';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { menuChanged } from '../src/modules/menu';
import { reconcilePayments } from '../src/modules/payments';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';
import { FakeGateway, signedEvent } from './helpers/payments';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('payments', () => {
  let gateway: FakeGateway;
  let menu: Awaited<ReturnType<typeof seedMenu>>;
  let customer: string;
  let staff: string;
  let admin: string;
  let events: PublishedEvent[];
  let detach: () => void;

  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    gateway = new FakeGateway();
    setPaymentGateway(gateway);
    menu = await seedMenu();
    customer = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    staff = (await loginAs(app, (await makeUser('STAFF')).email)).accessToken;
    admin = (await loginAs(app, (await makeUser('ADMIN')).email)).accessToken;
    events = [];
    detach = addTransport((e) => events.push(e));
  });
  afterEach(() => detach());
  afterAll(async () => {
    setPaymentGateway(undefined);
    await disconnectPrisma();
  });

  /** A takeaway of two lemonades: 900 + 79 tax = 979. */
  async function placeOrder(token = customer): Promise<{ id: string; total: number }> {
    const res = await request(app)
      .post('/api/v1/orders')
      .set(bearer(token))
      .send({
        type: 'TAKEAWAY',
        customer: { name: 'Jo', phone: '+15550101' },
        items: [{ menuItemId: menu.items.lemonade.id, qty: 2 }],
      });
    expect(res.status).toBe(201);
    return { id: res.body.id as string, total: res.body.totals.total as number };
  }

  const intent = (orderId: string, amount?: number, token = customer) =>
    request(app)
      .post('/api/v1/payments/intent')
      .set(bearer(token))
      .send({ orderId, ...(amount ? { amount } : {}) });

  const webhook = (e: { body: string; signature: string }) =>
    request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', e.signature)
      .send(e.body);

  const orderOf = (id: string, token = customer) =>
    request(app).get(`/api/v1/orders/${id}`).set(bearer(token));

  it('creates an intent for the server-computed balance, never a client total (PAY-01, PAY-07)', async () => {
    const order = await placeOrder();
    const res = await intent(order.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      amount: order.total,
      currency: 'usd',
      publishableKey: 'pk_test_fake',
    });
    expect(res.body.clientSecret).toMatch(/_secret_/);
    // The Stripe idempotency key travels as the SDK options argument (M9-S3).
    expect(gateway.createCalls[0]?.idempotencyKey).toMatch(/^intent:/);

    const over = await intent(order.id, order.total + 1);
    expect(over.status).toBe(422);
    expect(over.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  it('I8: a signed payment_intent.succeeded marks the order PAID (AC-5)', async () => {
    const order = await placeOrder();
    await intent(order.id);
    const res = await webhook(signedEvent('payment_intent.succeeded', 'pi_test_1'));
    expect(res.status).toBe(200);
    expect((await orderOf(order.id)).body).toMatchObject({
      paymentStatus: 'PAID',
      amountPaid: order.total,
      balanceDue: 0,
    });
    const changed = events.find((e) => e.name === 'payment:changed');
    expect(changed?.rooms).toEqual(['pos', 'admin', `customer:${order.id}`]);
  });

  it('I9: a replayed event returns 200 and writes nothing (PAY-08, AC-6)', async () => {
    const order = await placeOrder();
    await intent(order.id);
    const event = signedEvent('payment_intent.succeeded', 'pi_test_1', 'evt_replayed');
    expect((await webhook(event)).status).toBe(200);
    const eventsAfterFirst = events.length;
    expect((await webhook(event)).status).toBe(200);
    expect(await prisma().webhookEvent.count()).toBe(1);
    expect(await prisma().payment.count({ where: { state: 'SUCCEEDED' } })).toBe(1);
    expect(events.length).toBe(eventsAfterFirst);
  });

  it('rejects a bad signature with 400 WEBHOOK_INVALID_SIGNATURE', async () => {
    const e = signedEvent('payment_intent.succeeded', 'pi_test_1');
    const res = await webhook({ body: e.body, signature: 't=1,v1=deadbeef' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WEBHOOK_INVALID_SIGNATURE');
  });

  it('leaves the order UNPAID and retryable when the card fails (PAY-04)', async () => {
    const order = await placeOrder();
    await intent(order.id);
    await webhook(signedEvent('payment_intent.payment_failed', 'pi_test_1'));
    expect((await orderOf(order.id)).body.paymentStatus).toBe('UNPAID');
    expect((await prisma().payment.findFirst())?.state).toBe('FAILED');
    expect((await intent(order.id)).status).toBe(200);
  });

  it('I10: a customer cannot record cash; staff can, and the cashier is recorded (AC-8)', async () => {
    const order = await placeOrder();
    const denied = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(customer))
      .send({ orderId: order.id });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id, tipAmount: 300 });
    expect(ok.status).toBe(200);
    expect(ok.body.payment).toMatchObject({
      method: 'CASH',
      amount: order.total,
      tipAmount: 300,
      state: 'SUCCEEDED',
    });
    expect(ok.body.payment.actor.name).toBe('STAFF user');
    // The cash tip is not payment toward the order (TIP-02).
    expect(ok.body.order).toMatchObject({ paymentStatus: 'PAID', amountPaid: order.total });
  });

  it('I20: splits card and cash, then refuses a third payment (PAY-06)', async () => {
    const order = await placeOrder();
    await intent(order.id, 400);
    await webhook(signedEvent('payment_intent.succeeded', 'pi_test_1'));
    expect((await orderOf(order.id)).body).toMatchObject({
      paymentStatus: 'PARTIALLY_PAID',
      balanceDue: order.total - 400,
    });

    // A second intent is allowed while PARTIALLY_PAID, but not beyond the balance.
    expect((await intent(order.id, order.total)).status).toBe(422);

    const cash = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id });
    expect(cash.body.payment.amount).toBe(order.total - 400);
    expect(cash.body.order.paymentStatus).toBe('PAID');

    const third = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id, amount: 100 });
    expect(third.status).toBe(422);
    expect(third.body.error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });

  it('I19: pay by card, cancel while PLACED, refund — REFUNDED and still CANCELLED (AC-13)', async () => {
    const order = await placeOrder();
    await intent(order.id);
    await webhook(signedEvent('payment_intent.succeeded', 'pi_test_1'));

    const early = await request(app)
      .post('/api/v1/payments/refund')
      .set(bearer(admin))
      .send({ orderId: order.id, reason: 'x' });
    expect(early.status).toBe(422);
    expect(early.body.error.code).toBe('REFUND_NOT_AVAILABLE');

    await request(app)
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set(bearer(customer))
      .send({})
      .expect(200);

    const byStaff = await request(app)
      .post('/api/v1/payments/refund')
      .set(bearer(staff))
      .send({ orderId: order.id, reason: 'x' });
    expect(byStaff.status).toBe(403);

    const res = await request(app)
      .post('/api/v1/payments/refund')
      .set(bearer(admin))
      .send({ orderId: order.id, reason: 'Guest cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
    expect(res.body.payment.state).toBe('REFUNDED');
    expect(gateway.refunds).toEqual([
      {
        paymentIntentId: 'pi_test_1',
        amount: order.total,
        idempotencyKey: expect.stringMatching(/^refund:/),
      },
    ]);
    expect(await prisma().auditLog.count({ where: { action: 'ORDER_REFUNDED' } })).toBe(1);

    const again = await request(app)
      .post('/api/v1/payments/refund')
      .set(bearer(admin))
      .send({ orderId: order.id, reason: 'x' });
    expect(again.body.error.code).toBe('REFUND_NOT_AVAILABLE');
  });

  it('replays an intent for a repeated Idempotency-Key instead of charging twice', async () => {
    const order = await placeOrder();
    const send = () =>
      request(app)
        .post('/api/v1/payments/intent')
        .set(bearer(customer))
        .set('Idempotency-Key', 'pay-attempt-001')
        .send({ orderId: order.id });
    const a = await send();
    const b = await send();
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.body.clientSecret).toBe(a.body.clientSecret);
    expect(gateway.createCalls).toHaveLength(1);
    expect(await prisma().payment.count()).toBe(1);
  });

  it('keeps another customer from paying or seeing an order’s payments', async () => {
    const order = await placeOrder();
    const other = (await loginAs(app, (await makeUser('CUSTOMER')).email)).accessToken;
    expect((await intent(order.id, undefined, other)).status).toBe(404);
    expect(
      (await request(app).get(`/api/v1/payments/order/${order.id}`).set(bearer(other))).status,
    ).toBe(404);
    const mine = await request(app).get(`/api/v1/payments/order/${order.id}`).set(bearer(customer));
    expect(mine.body).toMatchObject({ data: [], amountPaid: 0, balanceDue: order.total });
  });

  it('heals an order whose webhook never arrived (M9-S10, NFR-R4)', async () => {
    const order = await placeOrder();
    await intent(order.id);
    await prisma().payment.updateMany({ data: { createdAt: new Date(Date.now() - 10 * 60_000) } });
    gateway.intents.set('pi_test_1', { id: 'pi_test_1', status: 'succeeded', amount: order.total });
    expect(await reconcilePayments()).toBe(1);
    expect((await orderOf(order.id)).body.paymentStatus).toBe('PAID');
  });

  it('switches card payment off without Stripe keys; cash still works (NFR-R6)', async () => {
    setPaymentGateway(new StripeGateway({}));
    const order = await placeOrder();
    expect((await request(app).get('/api/v1/payments/config')).body).toEqual({
      cardEnabled: false,
      publishableKey: null,
    });
    const res = await intent(order.id);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENTS_UNAVAILABLE');
    expect(await prisma().payment.count()).toBe(0);
    const cash = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id });
    expect(cash.status).toBe(200);
  });

  it('refuses payment on a cancelled order', async () => {
    const order = await placeOrder();
    await request(app)
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set(bearer(customer))
      .send({})
      .expect(200);
    const res = await request(app)
      .post('/api/v1/payments/cash')
      .set(bearer(staff))
      .send({ orderId: order.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ORDER_CANCELLED');
  });
});
