import {
  type CartLineDto,
  computeTotals,
  DomainError,
  type ModifierSnapshot,
  type OrderType,
  type PricingBreakdown,
  type PricingContext,
  type Settings,
} from '@ros/shared';

import { ConflictError } from '../../lib/errors';
import { prisma, type Tx } from '../../lib/prisma';
import { localClock, timeToClock, withinWindow } from '../../lib/time';
import { type AppliedDiscount, applyCode } from '../discounts';
import { findItemsForPricing, resolveSelections } from '../menu';

type Db = Tx | ReturnType<typeof prisma>;

/** One line priced from the database, ready to snapshot onto an OrderItem (ORD-05). */
export interface PricedLine {
  menuItemId: string;
  nameSnapshot: string;
  unitPrice: number;
  qty: number;
  modifiers: ModifierSnapshot[];
  modifierTotal: number;
  lineTotal: number;
  notes: string | null;
  station: string | null;
}

export interface PricedCart {
  lines: PricedLine[];
  totals: PricingBreakdown;
  discount: AppliedDiscount | null;
  ctx: PricingContext;
}

export interface PriceCartInput {
  type: OrderType;
  items: readonly CartLineDto[];
  discountCode?: string | undefined;
  tipAmount?: number | undefined;
}

/** The pricing inputs from settings — exactly what GET /settings gives the client. */
export function pricingContext(settings: Settings): PricingContext {
  return {
    taxBps: settings.taxBps,
    serviceChargeBps: settings.serviceChargeBps,
    serviceChargeTaxable: settings.serviceChargeTaxable,
    deliveryFee: settings.deliveryFee,
  };
}

/**
 * Price a cart from the database, never from the client (CART-06, PAY-07):
 * re-read every item, refuse unavailable ones, re-resolve every modifier,
 * resolve the discount, then call the same computeTotals the client runs.
 *
 * @throws DomainError EMPTY_CART | DISCOUNT_*
 * @throws ConflictError ITEM_UNAVAILABLE (409) listing the offending items (CART-07)
 * @throws BusinessRuleError INVALID_MODIFIER_SELECTION (AC-17)
 */
export async function priceCart(
  input: PriceCartInput,
  settings: Settings,
  opts: { db?: Db; now?: Date } = {},
): Promise<PricedCart> {
  const db = opts.db ?? prisma();
  const now = opts.now ?? new Date();
  if (input.items.length === 0) {
    throw new DomainError('EMPTY_CART', 'Add at least one item before checking out.');
  }

  const ids = [...new Set(input.items.map((i) => i.menuItemId))];
  const rows = new Map((await findItemsForPricing(ids, db)).map((r) => [r.id, r]));
  const clock = localClock(now, settings.timezone);
  const unavailable = ids.filter((id) => {
    const row = rows.get(id);
    return (
      !row?.isActive ||
      !row.isAvailable ||
      !withinWindow(clock, timeToClock(row.availableFrom), timeToClock(row.availableTo))
    );
  });
  if (unavailable.length > 0) {
    const names = unavailable.map((id) => rows.get(id)?.name).filter(Boolean);
    throw new ConflictError(
      'ITEM_UNAVAILABLE',
      names.length > 0
        ? `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available. Remove ${names.length === 1 ? 'it' : 'them'} to continue.`
        : 'An item in your cart is no longer on the menu.',
      { menuItemIds: unavailable },
    );
  }

  const resolved = input.items.map((line) => {
    const item = rows.get(line.menuItemId);
    if (!item) throw new Error('unreachable: availability checked above');
    const sel = resolveSelections(item, line.modifierItemIds);
    return { line, item, sel };
  });

  const ctx = pricingContext(settings);
  const cartLines = resolved.map(({ line, item, sel }) => ({
    menuItemId: item.id,
    unitPrice: item.price,
    qty: line.qty,
    modifierDeltas: sel.modifierDeltas,
  }));

  // The subtotal the discount is judged against comes from the same engine.
  const undiscounted = computeTotals({ orderType: input.type, lines: cartLines, ctx });
  const discount = input.discountCode
    ? await applyCode(input.discountCode, undiscounted.totals.subtotal, now, db)
    : null;

  const { totals, lines } = computeTotals({
    orderType: input.type,
    lines: cartLines,
    discount: discount?.pricing ?? null,
    tipAmount: input.tipAmount ?? 0,
    ctx,
  });

  return {
    lines: resolved.map(({ line, item, sel }, i) => ({
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPrice: item.price,
      qty: line.qty,
      modifiers: sel.modifiers,
      modifierTotal: sel.modifierTotal,
      lineTotal: lines[i]?.lineTotal ?? 0,
      notes: line.notes ?? null,
      station: item.station,
    })),
    totals,
    discount,
    ctx,
  };
}
