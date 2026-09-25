import type { MenuDto, MenuItemDto, ModifierSnapshot } from '@ros/shared';

import { BusinessRuleError, NotFoundError } from '../../lib/errors';
import { localClock, timeToClock, withinWindow } from '../../lib/time';
import { getSettings } from '../settings';
import { activeGroups, toItemDto } from './menu.dto';
import * as repo from './menu.repo';

const CACHE_TTL_MS = 30_000;
let cache: { tree: repo.CategoryTree[]; at: number } | undefined;

/** Listeners told after every menu write, after commit (realtime joins in M8). */
type MenuChange = { itemId?: string; categoryId?: string };
const listeners = new Set<(change: MenuChange) => void>();

export function onMenuChanged(listener: (change: MenuChange) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Called after every committed menu write: drops the cache so the edit is
 * visible immediately, not 30 s later (M4-S3), then notifies listeners.
 */
export function menuChanged(change: MenuChange = {}): void {
  cache = undefined;
  for (const listener of listeners) listener(change);
}

async function tree(): Promise<repo.CategoryTree[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.tree;
  const fresh = await repo.findMenuTree();
  cache = { tree: fresh, at: Date.now() };
  return fresh;
}

/**
 * The public menu (MENU-01): active categories and items within their
 * schedule window in restaurant-local time (MENU-06). 86'd items stay in the
 * list with isAvailable false so the client can show them sold out (MENU-05).
 */
export async function getPublicMenu(now: Date = new Date()): Promise<MenuDto> {
  const [categories, settings] = await Promise.all([tree(), getSettings()]);
  const clock = localClock(now, settings.timezone);
  return {
    categories: categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        items: c.items
          .filter((i) =>
            withinWindow(clock, timeToClock(i.availableFrom), timeToClock(i.availableTo)),
          )
          .map((i) => toItemDto(i)),
      }))
      .filter((c) => c.items.length > 0),
  };
}

/**
 * One item with its modifier groups (BROWSE-03).
 * @throws NotFoundError MENU_ITEM_NOT_FOUND for unknown or soft-deleted items
 */
export async function getItem(id: string): Promise<MenuItemDto> {
  const item = await repo.findItem(id);
  if (!item?.isActive)
    throw new NotFoundError('MENU_ITEM_NOT_FOUND', 'That dish is not on the menu.');
  return toItemDto(item, { withGroups: true });
}

export interface ResolvedSelection {
  /** Per-unit deltas in cents, authoritative from the database. */
  modifierDeltas: number[];
  modifierTotal: number;
  /** What gets snapshotted onto the order line (ORD-05). */
  modifiers: ModifierSnapshot[];
}

function invalid(message: string, details: Record<string, unknown>): BusinessRuleError {
  return new BusinessRuleError('INVALID_MODIFIER_SELECTION', message, details);
}

/**
 * Validate a client's modifier choice against the groups actually attached to
 * the item and return the authoritative deltas (LLD §4.3, AC-17). Rejects a
 * modifier borrowed from another item, an unavailable option, a duplicate, and
 * any group outside its minSelect/maxSelect — the server never prices what it
 * was merely handed (CODING-STANDARDS §8).
 *
 * @throws BusinessRuleError INVALID_MODIFIER_SELECTION with the offending group
 */
export function resolveSelections(
  item: repo.ItemWithGroups,
  modifierItemIds: readonly string[],
): ResolvedSelection {
  const requested = new Set(modifierItemIds);
  if (requested.size !== modifierItemIds.length) {
    throw invalid('Each option can be chosen once.', { menuItemId: item.id, reason: 'DUPLICATE' });
  }

  const groups = activeGroups(item);
  const modifiers: ModifierSnapshot[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    const chosen = group.items.filter((option) => requested.has(option.id));
    for (const option of chosen) {
      seen.add(option.id);
      if (!option.isAvailable) {
        throw invalid(`${option.name} is not available right now.`, {
          menuItemId: item.id,
          groupId: group.id,
          modifierItemId: option.id,
          reason: 'UNAVAILABLE',
        });
      }
    }
    if (chosen.length < group.minSelect || chosen.length > group.maxSelect) {
      const message =
        chosen.length < group.minSelect
          ? `Choose ${group.minSelect === group.maxSelect ? '' : 'at least '}${group.minSelect} ${group.name.toLowerCase()} for ${item.name}.`
          : `Choose at most ${group.maxSelect} ${group.name.toLowerCase()} for ${item.name}.`;
      throw invalid(message, {
        menuItemId: item.id,
        groupId: group.id,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        received: chosen.length,
      });
    }
    if (chosen.length > 0) {
      modifiers.push({
        groupId: group.id,
        groupName: group.name,
        items: chosen.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta })),
      });
    }
  }

  const foreign = [...requested].filter((id) => !seen.has(id));
  if (foreign.length > 0) {
    throw invalid(`That option is not offered on ${item.name}.`, {
      menuItemId: item.id,
      modifierItemIds: foreign,
      reason: 'NOT_OFFERED',
    });
  }

  const modifierDeltas = modifiers.flatMap((g) => g.items.map((i) => i.priceDelta));
  return {
    modifierDeltas,
    modifierTotal: modifierDeltas.reduce((sum, d) => sum + d, 0),
    modifiers,
  };
}

/** Today's 86 list for the admin dashboard (ADM-01). */
export async function unavailableItems(): Promise<{ id: string; name: string }[]> {
  return repo.findUnavailableItems();
}
