import type { Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

/** An item with its attached modifier groups and their options, in display order. */
const itemInclude = {
  modifierGroups: {
    orderBy: { sortOrder: 'asc' },
    include: { modifierGroup: { include: { items: { orderBy: { priceDelta: 'asc' } } } } },
  },
} satisfies Prisma.MenuItemInclude;

export type ItemWithGroups = Prisma.MenuItemGetPayload<{ include: typeof itemInclude }>;

// Only its type is used: the where filters below do not change the payload shape.
const _treeInclude = { items: { include: itemInclude } } satisfies Prisma.MenuCategoryInclude;
export type CategoryTree = Prisma.MenuCategoryGetPayload<{ include: typeof _treeInclude }>;

/**
 * The whole menu — categories, items, attached groups and options — in one
 * findMany. Prisma resolves the nested includes with one query per relation
 * level, however many items there are, so there is no N+1 (M4-S1).
 * @param includeInactive the admin view needs soft-deleted rows too
 */
export function findMenuTree(includeInactive = false): Promise<CategoryTree[]> {
  return prisma().menuCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      items: {
        where: includeInactive ? {} : { isActive: true },
        orderBy: { name: 'asc' },
        include: itemInclude,
      },
    },
  });
}

export function findItem(id: string, db: Db = prisma()): Promise<ItemWithGroups | null> {
  return db.menuItem.findUnique({ where: { id }, include: itemInclude });
}

export function findItemsForPricing(ids: string[], db: Db): Promise<ItemWithGroups[]> {
  return db.menuItem.findMany({ where: { id: { in: ids } }, include: itemInclude });
}

export function findModifierGroups(includeInactive = false) {
  return prisma().modifierGroup.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
    include: { items: { orderBy: { priceDelta: 'asc' } } },
  });
}

export function findUnavailableItems() {
  return prisma().menuItem.findMany({
    where: { isActive: true, isAvailable: false },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
