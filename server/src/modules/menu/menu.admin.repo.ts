import type { Prisma } from '@prisma/client';

import type { Tx } from '../../lib/prisma';

// Prisma writes for the admin menu. Every function runs inside the caller's
// transaction so the audit row commits with the change.

export const categories = {
  find: (tx: Tx, id: string) => tx.menuCategory.findUnique({ where: { id } }),
  create: (tx: Tx, data: Prisma.MenuCategoryUncheckedCreateInput) =>
    tx.menuCategory.create({ data }),
  update: (tx: Tx, id: string, data: Prisma.MenuCategoryUncheckedUpdateInput) =>
    tx.menuCategory.update({ where: { id }, data }),
  maxSortOrder: async (tx: Tx) =>
    (await tx.menuCategory.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0,
};

export const items = {
  find: (tx: Tx, id: string) => tx.menuItem.findUnique({ where: { id } }),
  create: (tx: Tx, data: Prisma.MenuItemUncheckedCreateInput) => tx.menuItem.create({ data }),
  update: (tx: Tx, id: string, data: Prisma.MenuItemUncheckedUpdateInput) =>
    tx.menuItem.update({ where: { id }, data }),
};

export const groups = {
  find: (tx: Tx, id: string) =>
    tx.modifierGroup.findUnique({ where: { id }, include: { items: true } }),
  create: (tx: Tx, data: Prisma.ModifierGroupUncheckedCreateInput) =>
    tx.modifierGroup.create({ data, include: { items: true } }),
  update: (tx: Tx, id: string, data: Prisma.ModifierGroupUncheckedUpdateInput) =>
    tx.modifierGroup.update({ where: { id }, data, include: { items: true } }),
};

export const options = {
  find: (tx: Tx, id: string) => tx.modifierItem.findUnique({ where: { id } }),
  create: (tx: Tx, data: Prisma.ModifierItemUncheckedCreateInput) =>
    tx.modifierItem.create({ data }),
  update: (tx: Tx, id: string, data: Prisma.ModifierItemUncheckedUpdateInput) =>
    tx.modifierItem.update({ where: { id }, data }),
  delete: (tx: Tx, id: string) => tx.modifierItem.delete({ where: { id } }),
};

export const attachments = {
  upsert: (tx: Tx, menuItemId: string, modifierGroupId: string, sortOrder: number) =>
    tx.menuItemModifierGroup.upsert({
      where: { menuItemId_modifierGroupId: { menuItemId, modifierGroupId } },
      create: { menuItemId, modifierGroupId, sortOrder },
      update: { sortOrder },
    }),
  delete: (tx: Tx, menuItemId: string, modifierGroupId: string) =>
    tx.menuItemModifierGroup.deleteMany({ where: { menuItemId, modifierGroupId } }),
  count: (tx: Tx, menuItemId: string) => tx.menuItemModifierGroup.count({ where: { menuItemId } }),
};
