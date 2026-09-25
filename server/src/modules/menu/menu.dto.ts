import type { ModifierGroup, ModifierItem } from '@prisma/client';
import type { MenuItemDto, ModifierGroupDto } from '@ros/shared';

import { timeToClock } from '../../lib/time';
import type { ItemWithGroups } from './menu.repo';

export function toGroupDto(group: ModifierGroup & { items: ModifierItem[] }): ModifierGroupDto {
  return {
    id: group.id,
    name: group.name,
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    items: group.items.map((i) => ({
      id: i.id,
      name: i.name,
      priceDelta: i.priceDelta,
      isAvailable: i.isAvailable,
    })),
  };
}

/** Active groups attached to the item, in their attachment order. */
export function activeGroups(item: ItemWithGroups) {
  return item.modifierGroups.map((link) => link.modifierGroup).filter((g) => g.isActive);
}

export function toItemDto(item: ItemWithGroups, opts: { withGroups?: boolean } = {}): MenuItemDto {
  const groups = activeGroups(item);
  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    price: item.price,
    imageUrl: item.imageUrl,
    isAvailable: item.isAvailable,
    allergens: item.allergens,
    station: item.station,
    availableFrom: timeToClock(item.availableFrom),
    availableTo: timeToClock(item.availableTo),
    modifierGroupCount: groups.length,
    ...(opts.withGroups ? { modifierGroups: groups.map(toGroupDto) } : {}),
  };
}
