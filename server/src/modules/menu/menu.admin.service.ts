import type {
  AdminMenuDto,
  AttachGroupDto,
  CreateCategoryDto,
  CreateItemDto,
  ModifierGroupDto,
  ModifierGroupInput,
  ModifierItemInput,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateModifierGroupDto,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { prisma, type Tx } from '../../lib/prisma';
import { clockToTime } from '../../lib/time';
import type { AuthUser } from '../../types/express';
import * as admin from './menu.admin.repo';
import { toGroupDto, toItemDto, toTranslations } from './menu.dto';
import * as repo from './menu.repo';
import { menuChanged } from './menu.service';

/**
 * Run one audited menu write in a transaction, then invalidate the cache and
 * notify listeners only after commit (HLD §8.2, ADM-04).
 */
async function audited<T>(
  actor: AuthUser,
  action: string,
  entity: string,
  write: (tx: Tx) => Promise<{ id: string; before: unknown; after: unknown; result: T }>,
  change: (result: T) => { itemId?: string; categoryId?: string } = () => ({}),
): Promise<T> {
  const result = await prisma().$transaction(async (tx) => {
    const r = await write(tx);
    await writeAudit(tx, {
      actorId: actor.id,
      action,
      entity,
      entityId: r.id,
      before: r.before,
      after: r.after,
    });
    return r.result;
  });
  menuChanged(change(result));
  return result;
}

const notFound = (what: string) =>
  new NotFoundError(`${what.toUpperCase().replace(/ /g, '_')}_NOT_FOUND`, `No such ${what}.`);

// ---- Categories (MENU-02) ----

export function createCategory(dto: CreateCategoryDto, actor: AuthUser) {
  return audited(actor, 'MENU_CATEGORY_CREATE', 'MenuCategory', async (tx) => {
    const sortOrder = dto.sortOrder ?? (await admin.categories.maxSortOrder(tx)) + 1;
    const created = await admin.categories.create(tx, {
      name: dto.name,
      description: dto.description ?? null,
      translations: dto.translations ?? {},
      sortOrder,
    });
    return { id: created.id, before: null, after: created, result: created };
  });
}

export function updateCategory(id: string, dto: UpdateCategoryDto, actor: AuthUser) {
  return audited(
    actor,
    'MENU_CATEGORY_UPDATE',
    'MenuCategory',
    async (tx) => {
      const before = await admin.categories.find(tx, id);
      if (!before) throw notFound('category');
      const after = await admin.categories.update(tx, id, dto);
      return { id, before, after, result: after };
    },
    (c) => ({ categoryId: c.id }),
  );
}

/** Soft delete: categories cascade to items, so the row is never removed. */
export function deleteCategory(id: string, actor: AuthUser) {
  return audited(
    actor,
    'MENU_CATEGORY_DELETE',
    'MenuCategory',
    async (tx) => {
      const before = await admin.categories.find(tx, id);
      if (!before) throw notFound('category');
      const after = await admin.categories.update(tx, id, { isActive: false });
      return { id, before, after, result: after };
    },
    (c) => ({ categoryId: c.id }),
  );
}

// ---- Items (MENU-03) ----

async function itemDto(id: string, tx?: Tx) {
  const item = await repo.findItem(id, tx);
  if (!item) throw notFound('menu item');
  return toItemDto(item, { withGroups: true });
}

export function createItem(dto: CreateItemDto, actor: AuthUser) {
  return audited(
    actor,
    'MENU_ITEM_CREATE',
    'MenuItem',
    async (tx) => {
      if (!(await admin.categories.find(tx, dto.categoryId))) throw notFound('category');
      const created = await admin.items.create(tx, {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description ?? null,
        translations: dto.translations ?? {},
        price: dto.price,
        imageUrl: dto.imageUrl ?? null,
        allergens: dto.allergens ?? [],
        station: dto.station ?? null,
        availableFrom: clockToTime(dto.availableFrom) ?? null,
        availableTo: clockToTime(dto.availableTo) ?? null,
      });
      const result = await itemDto(created.id, tx);
      return { id: created.id, before: null, after: result, result };
    },
    (i) => ({ itemId: i.id }),
  );
}

export function updateItem(id: string, dto: UpdateItemDto, actor: AuthUser) {
  return audited(
    actor,
    'MENU_ITEM_UPDATE',
    'MenuItem',
    async (tx) => {
      const before = await admin.items.find(tx, id);
      if (!before) throw notFound('menu item');
      if (dto.categoryId && !(await admin.categories.find(tx, dto.categoryId))) {
        throw notFound('category');
      }
      const from =
        dto.availableFrom === undefined ? before.availableFrom : clockToTime(dto.availableFrom);
      const to = dto.availableTo === undefined ? before.availableTo : clockToTime(dto.availableTo);
      if (((from ?? null) === null) !== ((to ?? null) === null)) {
        throw new ValidationError(
          'VALIDATION_ERROR',
          'Set both ends of the schedule window, or neither.',
        );
      }
      await admin.items.update(tx, id, {
        ...dto,
        availableFrom: clockToTime(dto.availableFrom),
        availableTo: clockToTime(dto.availableTo),
      });
      const result = await itemDto(id, tx);
      return { id, before, after: result, result };
    },
    (i) => ({ itemId: i.id }),
  );
}

/**
 * Soft delete (BR-11). There is deliberately no hard-delete path: orders
 * reference items, and history must survive.
 */
export function deleteItem(id: string, actor: AuthUser) {
  return audited(
    actor,
    'MENU_ITEM_DELETE',
    'MenuItem',
    async (tx) => {
      const before = await admin.items.find(tx, id);
      if (!before) throw notFound('menu item');
      const after = await admin.items.update(tx, id, { isActive: false });
      return { id, before, after, result: after };
    },
    (i) => ({ itemId: i.id }),
  );
}

/** The 86 toggle (MENU-03, AC-7). Staff may use it during service. */
export function setAvailability(id: string, isAvailable: boolean, actor: AuthUser) {
  return audited(
    actor,
    isAvailable ? 'MENU_ITEM_RESTORE' : 'MENU_ITEM_86',
    'MenuItem',
    async (tx) => {
      const before = await admin.items.find(tx, id);
      if (!before?.isActive) throw notFound('menu item');
      await admin.items.update(tx, id, { isAvailable });
      const result = await itemDto(id, tx);
      return { id, before: { isAvailable: before.isAvailable }, after: { isAvailable }, result };
    },
    (i) => ({ itemId: i.id }),
  );
}

// ---- Modifier groups and options (MENU-04) ----

async function groupDto(tx: Tx, id: string): Promise<ModifierGroupDto> {
  const g = await admin.groups.find(tx, id);
  if (!g) throw notFound('modifier group');
  return toGroupDto(g);
}

export function createGroup(dto: ModifierGroupInput, actor: AuthUser) {
  return audited(actor, 'MODIFIER_GROUP_CREATE', 'ModifierGroup', async (tx) => {
    const created = await admin.groups.create(tx, dto);
    const result = toGroupDto(created);
    return { id: created.id, before: null, after: result, result };
  });
}

export function updateGroup(id: string, dto: UpdateModifierGroupDto, actor: AuthUser) {
  return audited(actor, 'MODIFIER_GROUP_UPDATE', 'ModifierGroup', async (tx) => {
    const before = await admin.groups.find(tx, id);
    if (!before) throw notFound('modifier group');
    const minSelect = dto.minSelect ?? before.minSelect;
    const maxSelect = dto.maxSelect ?? before.maxSelect;
    if (maxSelect < minSelect) {
      throw new ValidationError('VALIDATION_ERROR', 'maxSelect must be at least minSelect.');
    }
    const result = toGroupDto(await admin.groups.update(tx, id, dto));
    return { id, before: toGroupDto(before), after: result, result };
  });
}

export function deleteGroup(id: string, actor: AuthUser) {
  return audited(actor, 'MODIFIER_GROUP_DELETE', 'ModifierGroup', async (tx) => {
    const before = await admin.groups.find(tx, id);
    if (!before) throw notFound('modifier group');
    const result = toGroupDto(await admin.groups.update(tx, id, { isActive: false }));
    return { id, before: toGroupDto(before), after: { isActive: false }, result };
  });
}

export function createOption(groupId: string, dto: ModifierItemInput, actor: AuthUser) {
  return audited(actor, 'MODIFIER_ITEM_CREATE', 'ModifierItem', async (tx) => {
    if (!(await admin.groups.find(tx, groupId))) throw notFound('modifier group');
    const created = await admin.options.create(tx, { ...dto, groupId });
    return { id: created.id, before: null, after: created, result: await groupDto(tx, groupId) };
  });
}

export function updateOption(
  groupId: string,
  optionId: string,
  dto: Partial<ModifierItemInput>,
  actor: AuthUser,
) {
  return audited(actor, 'MODIFIER_ITEM_UPDATE', 'ModifierItem', async (tx) => {
    const before = await admin.options.find(tx, optionId);
    if (before?.groupId !== groupId) throw notFound('modifier item');
    const after = await admin.options.update(tx, optionId, dto);
    return { id: optionId, before, after, result: await groupDto(tx, groupId) };
  });
}

/** Options can be removed outright: orders keep their own snapshot of the choice (ORD-05). */
export function deleteOption(groupId: string, optionId: string, actor: AuthUser) {
  return audited(actor, 'MODIFIER_ITEM_DELETE', 'ModifierItem', async (tx) => {
    const before = await admin.options.find(tx, optionId);
    if (before?.groupId !== groupId) throw notFound('modifier item');
    await admin.options.delete(tx, optionId);
    return { id: optionId, before, after: null, result: undefined };
  });
}

export function attachGroup(itemId: string, dto: AttachGroupDto, actor: AuthUser) {
  return audited(
    actor,
    'MENU_ITEM_GROUP_ATTACH',
    'MenuItem',
    async (tx) => {
      if (!(await admin.items.find(tx, itemId))) throw notFound('menu item');
      if (!(await admin.groups.find(tx, dto.modifierGroupId))) throw notFound('modifier group');
      const sortOrder = dto.sortOrder ?? (await admin.attachments.count(tx, itemId));
      await admin.attachments.upsert(tx, itemId, dto.modifierGroupId, sortOrder);
      const result = await itemDto(itemId, tx);
      return { id: itemId, before: null, after: { attached: dto.modifierGroupId }, result };
    },
    (i) => ({ itemId: i.id }),
  );
}

export function detachGroup(itemId: string, groupId: string, actor: AuthUser) {
  return audited(
    actor,
    'MENU_ITEM_GROUP_DETACH',
    'MenuItem',
    async (tx) => {
      await admin.attachments.delete(tx, itemId, groupId);
      return { id: itemId, before: { attached: groupId }, after: null, result: { id: itemId } };
    },
    (i) => ({ itemId: i.id }),
  );
}

/** Everything, including soft-deleted rows, for the admin menu manager. */
export async function adminMenu(): Promise<AdminMenuDto> {
  const [tree, groupRows] = await Promise.all([
    repo.findMenuTree(true),
    repo.findModifierGroups(true),
  ]);
  return {
    categories: tree.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      translations: toTranslations(c.translations),
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      items: c.items.map((i) => ({ ...toItemDto(i, { withGroups: true }), isActive: i.isActive })),
    })),
    modifierGroups: groupRows.map((g) => ({ ...toGroupDto(g), isActive: g.isActive })),
  };
}
