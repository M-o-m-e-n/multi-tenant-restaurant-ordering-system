import type { ModifierGroupDto, ModifierSnapshot } from '@ros/shared';

/** Chosen option ids per group. */
export type Selection = Record<string, string[]>;

/**
 * Toggle an option. Single-choice groups (max 1) behave like radio buttons;
 * multi-choice groups refuse a pick beyond maxSelect.
 */
export function toggleOption(sel: Selection, group: ModifierGroupDto, optionId: string): Selection {
  const current = sel[group.id] ?? [];
  if (current.includes(optionId)) {
    return { ...sel, [group.id]: current.filter((id) => id !== optionId) };
  }
  if (group.maxSelect === 1) return { ...sel, [group.id]: [optionId] };
  if (current.length >= group.maxSelect) return sel;
  return { ...sel, [group.id]: [...current, optionId] };
}

/** Groups still short of their minimum; "Add to cart" stays disabled until empty (CART-03). */
export function unmetGroups(
  groups: readonly ModifierGroupDto[],
  sel: Selection,
): ModifierGroupDto[] {
  return groups.filter((g) => (sel[g.id]?.length ?? 0) < g.minSelect);
}

/** Sensible starting choice: the first available option of every exactly-one group. */
export function defaultSelection(groups: readonly ModifierGroupDto[]): Selection {
  const sel: Selection = {};
  for (const g of groups) {
    const first = g.items.find((i) => i.isAvailable);
    if (g.minSelect === 1 && g.maxSelect === 1 && first) sel[g.id] = [first.id];
  }
  return sel;
}

/** The chosen options as the snapshot the cart keeps (and the server re-checks). */
export function toSnapshot(
  groups: readonly ModifierGroupDto[],
  sel: Selection,
): ModifierSnapshot[] {
  return groups
    .map((g) => ({
      groupId: g.id,
      groupName: g.name,
      items: g.items
        .filter((i) => sel[g.id]?.includes(i.id))
        .map((i) => ({ id: i.id, name: i.name, priceDelta: i.priceDelta })),
    }))
    .filter((g) => g.items.length > 0);
}
