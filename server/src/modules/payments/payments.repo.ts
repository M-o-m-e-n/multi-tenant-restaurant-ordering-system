import type { PaymentState, Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

const withActor = { actor: { select: { id: true, name: true } } } satisfies Prisma.PaymentInclude;
export type PaymentWithActor = Prisma.PaymentGetPayload<{ include: typeof withActor }>;

export function listForOrder(orderId: string, db: Db = prisma()): Promise<PaymentWithActor[]> {
  return db.payment.findMany({
    where: { orderId },
    include: withActor,
    orderBy: { createdAt: 'asc' },
  });
}

export function create(
  tx: Tx,
  data: Prisma.PaymentUncheckedCreateInput,
): Promise<PaymentWithActor> {
  return tx.payment.create({ data, include: withActor });
}

export function findByIntent(tx: Tx, intentId: string) {
  return tx.payment.findFirst({ where: { stripePaymentIntentId: intentId } });
}

/** Move a payment only if it is still in `from`; zero rows means it already moved. */
export async function moveState(
  tx: Tx,
  id: string,
  from: PaymentState,
  data: Prisma.PaymentUncheckedUpdateInput,
): Promise<boolean> {
  const { count } = await tx.payment.updateMany({ where: { id, state: from }, data });
  return count === 1;
}

/**
 * Record a webhook event id. The primary key is the one dedupe mechanism
 * (PAY-08): a duplicate insert fails, and the caller treats that as "seen".
 */
export function recordWebhookEvent(tx: Tx, id: string, type: string) {
  return tx.webhookEvent.create({ data: { id, type } });
}

/** Card payments still pending after `olderThan`, for the reconciliation job. */
export function stalePending(olderThan: Date) {
  return prisma().payment.findMany({
    where: {
      state: 'PENDING',
      method: 'STRIPE',
      createdAt: { lt: olderThan },
      stripePaymentIntentId: { not: null },
    },
    select: { id: true, orderId: true, stripePaymentIntentId: true },
    take: 100,
  });
}
