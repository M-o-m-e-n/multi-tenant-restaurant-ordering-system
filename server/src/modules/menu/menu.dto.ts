import type { ModifierGroup, ModifierItem, Prisma } from '@prisma/client';
import {
  type MenuItemDto,
  type ModifierGroupDto,
  type Translations,
  translationsSchema,
} from '@ros/shared';

import { timeToClock } from '../../lib/time';
import type { ItemWithGroups } from './menu.repo';

// Wide enough for any stored row; the admin schemas enforce the real limits on write.
const storedTranslations = translationsSchema(500, 2000);

/**
 * The `translations` column as a DTO field (ADR-037). Rows are written only
 * through the strict admin schemas or the seed; anything unexpected reads as none.
 */
export function toTranslations(json: Prisma.JsonValue): Translations {
  const parsed = storedTranslations.safeParse(json);
  return parsed.success ? parsed.data : {};
}

export function toGroupDto(group: ModifierGroup & { items: ModifierItem[] }): ModifierGroupDto {
  return {
    id: group.id,
    name: group.name,
    translations: toTranslations(group.translations),
    minSelect: group.minSelect,
    maxSelect: group.maxSelect,
    items: group.items.map((i) => ({
      id: i.id,
      name: i.name,
      translations: toTranslations(i.translations),
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
    translations: toTranslations(item.translations),
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
