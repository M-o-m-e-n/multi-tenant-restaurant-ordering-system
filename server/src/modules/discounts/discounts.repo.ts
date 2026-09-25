import type { Discount, Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

export function findByCode(code: string, db: Db = prisma()): Promise<Discount | null> {
  return db.discount.findUnique({ where: { code } });
}

export function findById(id: string, db: Db = prisma()): Promise<Discount | null> {
  return db.discount.findUnique({ where: { id } });
}

export function list(): Promise<Discount[]> {
  return prisma().discount.findMany({ orderBy: [{ isActive: 'desc' }, { code: 'asc' }] });
}

export function create(data: Prisma.DiscountCreateInput, db: Db): Promise<Discount> {
  return db.discount.create({ data });
}

export function update(id: string, data: Prisma.DiscountUpdateInput, db: Db): Promise<Discount> {
  return db.discount.update({ where: { id }, data });
}

/**
 * Increment usedCount only while under the limit. Returns rows affected: zero
 * means another checkout took the last redemption (DISC-06, LLD §3.3).
 */
export function redeemIfAvailable(id: string, tx: Tx): Promise<number> {
  return tx.$executeRaw`
    UPDATE "Discount" SET "usedCount" = "usedCount" + 1
     WHERE "id" = ${id}::uuid
       AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
}
