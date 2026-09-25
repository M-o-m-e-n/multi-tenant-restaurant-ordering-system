import type { Prisma } from '@prisma/client';
import type { DeliveryStatus, OrderStatus, OrderType, PaymentStatus } from '@ros/shared';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

export const orderInclude = {
  items: { orderBy: [{ lineNo: 'asc' }] },
  table: { select: { id: true, number: true } },
  delivery: true,
  payments: { select: { amount: true, state: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function findOrder(id: string, db: Db = prisma()): Promise<OrderWithRelations | null> {
  return db.order.findUnique({ where: { id }, include: orderInclude });
}

export interface OrderFilter {
  userId?: string;
  status?: OrderStatus[];
  type?: OrderType;
  from?: Date;
  to?: Date;
  tableId?: string;
}

function where(f: OrderFilter): Prisma.OrderWhereInput {
  return {
    ...(f.userId ? { userId: f.userId } : {}),
    ...(f.status?.length ? { status: { in: f.status } } : {}),
    ...(f.type ? { type: f.type } : {}),
    ...(f.tableId ? { tableId: f.tableId } : {}),
    ...(f.from || f.to
      ? { businessDate: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
      : {}),
  };
}

export async function listOrders(
  filter: OrderFilter,
  page: number,
  limit: number,
): Promise<{ rows: OrderWithRelations[]; total: number }> {
  const [rows, total] = await prisma().$transaction([
    prisma().order.findMany({
      where: where(filter),
      include: orderInclude,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma().order.count({ where: where(filter) }),
  ]);
  return { rows, total };
}

/**
 * Next order number for a business date, atomically: the first order of the
 * day inserts the row, every later one increments it (LLD §3.4, ORD-10).
 * Concurrent placements serialise on the row, so numbers never collide.
 */
export async function allocateOrderNumber(tx: Tx, businessDate: Date): Promise<number> {
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "OrderSequence" ("businessDate", "lastValue")
    VALUES (${businessDate}::date, 1001)
    ON CONFLICT ("businessDate")
    DO UPDATE SET "lastValue" = "OrderSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  const value = rows[0]?.lastValue;
  if (value === undefined) throw new Error('order sequence returned no row');
  return value;
}

export function insertOrder(tx: Tx, data: Prisma.OrderUncheckedCreateInput) {
  return tx.order.create({ data });
}

export function insertItems(tx: Tx, data: Prisma.OrderItemCreateManyInput[]) {
  return tx.orderItem.createMany({ data });
}

export function insertEvent(tx: Tx, data: Prisma.OrderEventUncheckedCreateInput) {
  return tx.orderEvent.create({ data });
}

export function insertDelivery(tx: Tx, data: Prisma.DeliveryUncheckedCreateInput) {
  return tx.delivery.create({ data });
}

/**
 * Update a delivery only if it is still in `from`; zero rows means someone
 * else moved it first (the same conditional-update rule as `moveStatus`).
 */
export async function updateDelivery(
  tx: Tx,
  orderId: string,
  from: DeliveryStatus,
  data: { status: DeliveryStatus; driverName: string | null },
): Promise<boolean> {
  const { count } = await tx.delivery.updateMany({ where: { orderId, status: from }, data });
  return count === 1;
}

/**
 * Move an order only if it is still in `from`. This conditional update is the
 * concurrency control: zero rows means someone else moved it first (R9).
 */
export async function moveStatus(
  tx: Tx,
  id: string,
  from: OrderStatus,
  to: OrderStatus,
): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id, status: from },
    data: { status: to, ...(to === 'COMPLETED' ? { completedAt: new Date() } : {}) },
  });
  return count === 1;
}

export function listEvents(orderId: string) {
  return prisma().orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true } } },
  });
}

/** Payment records and total, for deriving the payment status. */
export function paymentBasis(tx: Tx, orderId: string) {
  return tx.order.findUnique({
    where: { id: orderId },
    select: { total: true, payments: { select: { amount: true, state: true } } },
  });
}

/** The only write of Order.paymentStatus in the codebase (LLD §4.5). */
export function writePaymentStatus(tx: Tx, orderId: string, paymentStatus: PaymentStatus) {
  return tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
}

/**
 * Replace an order's totals only if nobody changed it since we read it: the
 * conditional update on updatedAt stops an append racing a status move past
 * PREPARING (CODING-STANDARDS §10).
 */
export async function updateTotalsIfUnchanged(
  tx: Tx,
  id: string,
  seen: { status: OrderStatus; updatedAt: Date },
  totals: Prisma.OrderUncheckedUpdateInput,
): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id, status: seen.status, updatedAt: seen.updatedAt },
    data: totals,
  });
  return count === 1;
}

export async function nextLineNo(tx: Tx, orderId: string): Promise<number> {
  const agg = await tx.orderItem.aggregate({ where: { orderId }, _max: { lineNo: true } });
  return (agg._max.lineNo ?? 0) + 1;
}

/** Payment records as a receipt shows them. */
export function receiptPayments(orderId: string) {
  return prisma().payment.findMany({
    where: { orderId, state: { in: ['SUCCEEDED', 'REFUNDED'] } },
    orderBy: { createdAt: 'asc' },
    select: { method: true, amount: true, tipAmount: true, state: true, createdAt: true },
  });
}
