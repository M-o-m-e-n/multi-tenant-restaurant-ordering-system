import type { MenuDto, MenuItemDto } from '@ros/shared';

/**
 * The dishes the carousel features: configurable or premium-priced plates
 * first, then the rest of the menu to fill the rail.
 */
export function pickSignatures(menu: MenuDto | undefined, limit = 8): MenuItemDto[] {
  const all = menu?.categories.flatMap((c) => c.items) ?? [];
  const star = (i: MenuItemDto) => i.modifierGroupCount > 0 || i.price >= 1400;
  return [...all.filter(star), ...all.filter((i) => !star(i))].slice(0, limit);
}
