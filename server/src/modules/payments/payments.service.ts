import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import {
  type CashPaymentDto,
  type CreateIntentDto,
  type IntentResponse,
  type OrderDto,
  type OrderPaymentsResponse,
  paidSum,
  type PaymentDto,
  type PaymentsConfig,
  type RefundDto,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { type IdempotencyContext, requestHash, withIdempotency } from '../../lib/idempotency';
import { logger } from '../../lib/logger';
import { paymentGateway } from '../../lib/payment-gateway';
import { prisma, type Tx } from '../../lib/prisma';
import type { AuthUser } from '../../types/express';
import {
  announcePayment,
  getOrder,
  loadOrder,
  type PaymentSnapshot,
  syncPaymentStatus,
} from '../orders';
import * as repo from './payments.repo';

const notFound = () => new NotFoundError('ORDER_NOT_FOUND', 'No such order.');

export function toPaymentDto(p: repo.PaymentWithActor): PaymentDto {
  return {
    id: p.id,
    method: p.method,
    amount: p.amount,
    tipAmount: p.tipAmount,
    state: p.state,
    actor: p.actor,
    createdAt: p.createdAt.toISOString(),
  };
}

export function config(): PaymentsConfig {
  const g = paymentGateway();
  return { cardEnabled: g.cardEnabled, publishableKey: g.publishableKey };
}

/**
 * Load an order someone may pay for. Customers pay only their own; a counter
 * order has no owner, so only staff can take payment on it (LLD §1, §4.5).
 */
async function payableOrder(tx: Tx, orderId: string, actor: AuthUser) {
  const order = await loadOrder(orderId, tx);
  if (!order) throw notFound();
  if (actor.role === 'CUSTOMER' && order.userId !== actor.id) throw notFound();
  if (order.status === 'CANCELLED') {
    throw new ConflictError(
      'ORDER_CANCELLED',
      'This order was cancelled; there is nothing to pay.',
    );
  }
  if (order.paymentStatus === 'PAID') {
    throw new BusinessRuleError('PAYMENT_EXCEEDS_BALANCE', 'This order is already paid in full.');
  }
  const balance = order.total - paidSum(order.payments);
  return { order, balance };
}

/**
 * The amount this payment settles: the whole balance by default, less for a
 * split (PAY-06). Never more than what is owed (BR-09).
 */
function chargeable(requested: number | undefined, balance: number): number {
  const amount = requested ?? balance;
  if (balance <= 0) throw new BusinessRuleError('ZERO_TOTAL', 'Nothing is owed on this order.');
  if (amount <= 0 || amount > balance) {
    throw new BusinessRuleError(
      'PAYMENT_EXCEEDS_BALANCE',
      `The most this payment can be is ${balance} cents, the outstanding balance.`,
      { balanceDue: balance },
    );
  }
  return amount;
}

/**
 * Start a card payment (PAY-01, PAY-07). The amount always comes from the
 * database, never the client; the precondition is "not yet PAID" rather than
 * "UNPAID", so a second split intent is possible (PAY-06).
 */
export async function createIntent(
  dto: CreateIntentDto,
  actor: AuthUser,
  idempotencyKey?: string,
): Promise<{ status: number; body: IntentResponse; replayed: boolean }> {
  const gateway = paymentGateway();
  const idem: IdempotencyContext | null = idempotencyKey
    ? {
        key: idempotencyKey,
        userId: actor.id,
        endpoint: 'POST /payments/intent',
        hash: requestHash(dto),
      }
    : null;

  return withIdempotency(idem, async (tx) => {
    const { order, balance } = await payableOrder(tx, dto.orderId, actor);
    const amount = chargeable(dto.amount, balance);
    const intent = await gateway.createIntent({
      amount,
      currency: order.currency,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      // A retried request with the same key must not create a second intent at Stripe either.
      idempotencyKey: idempotencyKey
        ? `intent:${actor.id}:${idempotencyKey}`
        : `intent:${randomUUID()}`,
    });
    const payment = await repo.create(tx, {
      orderId: order.id,
      method: 'STRIPE',
      amount,
      state: 'PENDING',
      stripePaymentIntentId: intent.id,
    });
    if (!gateway.publishableKey) throw new Error('card payment enabled without a publishable key');
    return {
      status: 200,
      body: {
        clientSecret: intent.clientSecret,
        publishableKey: gateway.publishableKey,
        amount,
        currency: order.currency,
        paymentId: payment.id,
      },
    };
  });
}

/**
 * Record a cash payment (PAY-05), with an optional cash tip (TIP-02). Staff
 * only; the cashier is recorded.
 */
export async function markCash(
  dto: CashPaymentDto,
  actor: AuthUser,
): Promise<{ order: OrderDto; payment: PaymentDto }> {
  const { payment, snapshot } = await prisma().$transaction(async (tx) => {
    const { order, balance } = await payableOrder(tx, dto.orderId, actor);
    const amount = chargeable(dto.amount, balance);
    const created = await repo.create(tx, {
      orderId: order.id,
      method: 'CASH',
      amount,
      tipAmount: dto.tipAmount ?? 0,
      state: 'SUCCEEDED',
      actorId: actor.id,
    });
    return { payment: created, snapshot: await syncPaymentStatus(order.id, tx) };
  });
  announcePayment(snapshot);
  return { order: await getOrder(dto.orderId, actor), payment: toPaymentDto(payment) };
}

/**
 * Stripe webhook (PAY-03, PAY-08). Signature first; then, in one transaction,
 * the event id is inserted as a primary key — a duplicate fails that insert and
 * we return having done nothing (AC-6). Stripe gets a quick 200 either way.
 * @returns whether the event was new
 */
export async function handleWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<boolean> {
  const event = paymentGateway().constructEvent(rawBody, signature);
  let snapshot: PaymentSnapshot | null = null;
  try {
    await prisma().$transaction(async (tx) => {
      await repo.recordWebhookEvent(tx, event.id, event.type);
      if (!event.intentId) return;
      const payment = await repo.findByIntent(tx, event.intentId);
      if (!payment) {
        logger().warn(
          { eventId: event.id, intentId: event.intentId },
          'webhook for an unknown intent',
        );
        return;
      }
      if (event.type === 'payment_intent.succeeded') {
        await repo.moveState(tx, payment.id, 'PENDING', { state: 'SUCCEEDED' });
      } else if (event.type === 'payment_intent.payment_failed') {
        // The record fails; the order stays UNPAID so the guest can retry (PAY-04).
        await repo.moveState(tx, payment.id, 'PENDING', { state: 'FAILED' });
      } else {
        return;
      }
      snapshot = await syncPaymentStatus(payment.orderId, tx);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false;
    throw err;
  }
  if (snapshot) announcePayment(snapshot);
  return true;
}

/**
 * Refund every successful payment on a COMPLETED or CANCELLED order (PAY-09).
 * Card refunds go to Stripe first, each with its own idempotency key, so a
 * retry after a database failure refunds nothing twice; cash is reversed in
 * the records only. Payment status becomes REFUNDED; the order's status is
 * never touched (BR-07, AC-13).
 * @throws BusinessRuleError REFUND_NOT_AVAILABLE
 */
export async function refund(
  dto: RefundDto,
  actor: AuthUser,
): Promise<{ order: OrderDto; payment: PaymentDto }> {
  const order = await loadOrder(dto.orderId);
  if (!order) throw notFound();
  if (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
    throw new BusinessRuleError(
      'REFUND_NOT_AVAILABLE',
      'Only a completed or cancelled order can be refunded. Cancel it first.',
    );
  }
  const payments = (await repo.listForOrder(order.id)).filter((p) => p.state === 'SUCCEEDED');
  if (payments.length === 0) {
    throw new BusinessRuleError(
      'REFUND_NOT_AVAILABLE',
      'This order has no successful payment to refund.',
    );
  }

  const refundIds = new Map<string, string>();
  for (const p of payments) {
    if (p.method === 'STRIPE' && p.stripePaymentIntentId) {
      const r = await paymentGateway().refund({
        paymentIntentId: p.stripePaymentIntentId,
        amount: p.amount,
        idempotencyKey: `refund:${p.id}`,
      });
      refundIds.set(p.id, r.id);
    }
  }

  const snapshot = await prisma().$transaction(async (tx) => {
    for (const p of payments) {
      await repo.moveState(tx, p.id, 'SUCCEEDED', {
        state: 'REFUNDED',
        stripeRefundId: refundIds.get(p.id) ?? null,
      });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'ORDER_REFUNDED',
      entity: 'Order',
      entityId: order.id,
      after: {
        reason: dto.reason,
        payments: payments.map((p) => ({ id: p.id, method: p.method, amount: p.amount })),
      },
    });
    return syncPaymentStatus(order.id, tx);
  });
  announcePayment(snapshot);

  const latest = (await repo.listForOrder(order.id)).find((p) => p.id === payments[0]?.id);
  if (!latest) throw notFound();
  return { order: await getOrder(order.id, actor), payment: toPaymentDto(latest) };
}

export async function listForOrder(
  orderId: string,
  actor: AuthUser,
): Promise<OrderPaymentsResponse> {
  const order = await getOrder(orderId, actor); // ownership check: 404 for others (NFR-S9)
  const rows = await repo.listForOrder(orderId);
  return {
    data: rows.map(toPaymentDto),
    amountPaid: order.amountPaid,
    balanceDue: order.balanceDue,
  };
}

/**
 * Safety net for lost webhooks (NFR-R4, R2): ask Stripe about card payments
 * still pending after two minutes and settle them the same way the webhook
 * would. An order stuck UNPAID against a succeeded intent heals itself.
 */
export async function reconcilePayments(now = new Date()): Promise<number> {
  const gateway = paymentGateway();
  if (!gateway.cardEnabled) return 0;
  const stale = await repo.stalePending(new Date(now.getTime() - 2 * 60_000));
  let settled = 0;
  for (const p of stale) {
    if (!p.stripePaymentIntentId) continue;
    const intent = await gateway.retrieveIntent(p.stripePaymentIntentId);
    const next =
      intent.status === 'succeeded' ? 'SUCCEEDED' : intent.status === 'canceled' ? 'FAILED' : null;
    if (!next) continue;
    const snapshot = await prisma().$transaction(async (tx) => {
      if (!(await repo.moveState(tx, p.id, 'PENDING', { state: next }))) return null;
      return syncPaymentStatus(p.orderId, tx);
    });
    if (snapshot) {
      announcePayment(snapshot);
      settled++;
    }
  }
  return settled;
}
