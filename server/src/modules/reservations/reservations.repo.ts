import type { Prisma, ReservationStatus } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

const include = { table: { select: { id: true, number: true } } } as const;

export type ReservationWithTable = Prisma.ReservationGetPayload<{ include: typeof include }>;

export function create(data: Prisma.ReservationUncheckedCreateInput, db: Db = prisma()) {
  return db.reservation.create({ data, include });
}

export function findById(id: string, db: Db = prisma()) {
  return db.reservation.findUnique({ where: { id }, include });
}

/** Bookings whose slot falls in `[from, to)`, earliest first. */
export function listBetween(from: Date, to: Date) {
  return prisma().reservation.findMany({
    where: { slotAt: { gte: from, lt: to } },
    include,
    orderBy: [{ slotAt: 'asc' }, { guestName: 'asc' }],
  });
}

/**
 * Move a booking only if it is still in `from`; zero rows means someone else
 * moved it first (the conditional-update rule, R9).
 */
export async function transition(
  tx: Tx,
  id: string,
  from: ReservationStatus,
  data: { status: ReservationStatus; tableId?: string },
): Promise<boolean> {
  const { count } = await tx.reservation.updateMany({ where: { id, status: from }, data });
  return count === 1;
}

/** PENDING bookings whose slot lies in `[since, before)`. */
export function pendingBetween(since: Date, before: Date) {
  return prisma().reservation.findMany({
    where: { status: 'PENDING', slotAt: { gte: since, lt: before } },
    select: { id: true, slotAt: true, guestName: true },
  });
}

export function findTable(id: string, db: Db = prisma()) {
  return db.table.findUnique({ where: { id }, select: { id: true, isActive: true } });
}
