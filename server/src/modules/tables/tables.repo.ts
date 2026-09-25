import type { Prisma, Table } from '@prisma/client';
import { OPEN_ORDER_STATUSES, type TableStatus } from '@ros/shared';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

const withOpenOrders = {
  _count: { select: { orders: { where: { status: { in: [...OPEN_ORDER_STATUSES] } } } } },
} satisfies Prisma.TableInclude;

export type TableWithOpenOrders = Prisma.TableGetPayload<{ include: typeof withOpenOrders }>;

export function listTables(): Promise<TableWithOpenOrders[]> {
  return prisma().table.findMany({ include: withOpenOrders });
}

export function findById(id: string, db: Db = prisma()): Promise<Table | null> {
  return db.table.findUnique({ where: { id } });
}

export function findWithOpenOrders(
  id: string,
  db: Db = prisma(),
): Promise<TableWithOpenOrders | null> {
  return db.table.findUnique({ where: { id }, include: withOpenOrders });
}

export function findByToken(qrToken: string, db: Db = prisma()): Promise<Table | null> {
  return db.table.findUnique({ where: { qrToken } });
}

export function create(data: Prisma.TableCreateInput, db: Db = prisma()): Promise<Table> {
  return db.table.create({ data });
}

export function update(
  id: string,
  data: Prisma.TableUpdateInput,
  db: Db = prisma(),
): Promise<Table> {
  return db.table.update({ where: { id }, data });
}

/**
 * Move a table between statuses only if it is still in `from`. Zero rows means
 * someone else moved it first; the database arbitrates (CODING-STANDARDS §10).
 */
export async function transition(
  id: string,
  from: TableStatus,
  to: TableStatus,
  db: Db,
): Promise<boolean> {
  const { count } = await db.table.updateMany({
    where: { id, status: from },
    data: { status: to },
  });
  return count === 1;
}

export function openOrders(tableId: string, db: Db) {
  return db.order.findMany({
    where: { tableId, status: { in: [...OPEN_ORDER_STATUSES] } },
    select: { id: true, orderNumber: true, status: true },
    orderBy: { placedAt: 'asc' },
  });
}
