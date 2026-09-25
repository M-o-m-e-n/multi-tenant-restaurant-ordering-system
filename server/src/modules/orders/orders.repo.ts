import type { Prisma } from '@prisma/client';
import type { OrderStatus, OrderType } from '@ros/shared';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

export const orderInclude = {
  items: { orderBy: [{ addedAt: 'asc' }, { id: 'asc' }] },
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
