import type { Branch, Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

export type BranchRow = Branch;

/** Branches in display order; inactive ones only when asked (the admin screen). */
export function list(includeInactive = false) {
  return prisma().branch.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
  });
}

export function findById(id: string, db: Db = prisma()) {
  return db.branch.findUnique({ where: { id } });
}

export function update(id: string, data: Prisma.BranchUpdateInput, db: Db = prisma()) {
  return db.branch.update({ where: { id }, data });
}
