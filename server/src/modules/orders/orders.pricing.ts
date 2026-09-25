import {
  type CartLineDto,
  computeTotals,
  DomainError,
  lineTotal,
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
 * Resolve requested lines against the database (CART-07, AC-17): re-read each
 * item, refuse anything 86'd, inactive or outside its schedule window, and
 * re-resolve every modifier to its authoritative delta. Shared by pricing a
 * new cart and by appending to an existing order.
 *
 * @throws DomainError EMPTY_CART
 * @throws ConflictError ITEM_UNAVAILABLE (409) listing the offending items
 * @throws BusinessRuleError INVALID_MODIFIER_SELECTION
 */
export async function resolveLines(
  items: readonly CartLineDto[],
  settings: Settings,
  opts: { db?: Db; now?: Date } = {},
): Promise<PricedLine[]> {
  const db = opts.db ?? prisma();
  const now = opts.now ?? new Date();
  if (items.length === 0) {
    throw new DomainError('EMPTY_CART', 'Add at least one item before checking out.');
  }

  const ids = [...new Set(items.map((i) => i.menuItemId))];
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

  return items.map((line) => {
    const item = rows.get(line.menuItemId);
    if (!item) throw new Error('unreachable: availability checked above');
    const sel = resolveSelections(item, line.modifierItemIds);
    return {
      menuItemId: item.id,
      nameSnapshot: item.name,
      unitPrice: item.price,
      qty: line.qty,
      modifiers: sel.modifiers,
      modifierTotal: sel.modifierTotal,
      lineTotal: lineTotal({
        unitPrice: item.price,
        qty: line.qty,
        modifierDeltas: sel.modifierDeltas,
      }),
      notes: line.notes ?? null,
      station: item.station,
    };
  });
}

/** A resolved line as the pricing engine sees it. */
export function toCartLine(
  l: Pick<PricedLine, 'menuItemId' | 'unitPrice' | 'qty' | 'modifierTotal'>,
) {
  return {
    menuItemId: l.menuItemId,
    unitPrice: l.unitPrice,
    qty: l.qty,
    modifierDeltas: [l.modifierTotal],
  };
}

/**
 * Price a cart from the database, never from the client (CART-06, PAY-07):
 * resolve the lines, resolve the discount against the engine's own subtotal,
 * then call the same computeTotals the client runs.
 *
 * @throws DomainError EMPTY_CART | DISCOUNT_*
 * @throws ConflictError ITEM_UNAVAILABLE
 * @throws BusinessRuleError INVALID_MODIFIER_SELECTION
 */
export async function priceCart(
  input: PriceCartInput,
  settings: Settings,
  opts: { db?: Db; now?: Date } = {},
): Promise<PricedCart> {
  const db = opts.db ?? prisma();
  const now = opts.now ?? new Date();
  const lines = await resolveLines(input.items, settings, { db, now });
  const ctx = pricingContext(settings);
  const cartLines = lines.map(toCartLine);

  // The subtotal the discount is judged against comes from the same engine.
  const undiscounted = computeTotals({ orderType: input.type, lines: cartLines, ctx });
  const discount = input.discountCode
    ? await applyCode(input.discountCode, undiscounted.totals.subtotal, now, db)
    : null;

  const { totals } = computeTotals({
    orderType: input.type,
    lines: cartLines,
    discount: discount?.pricing ?? null,
    tipAmount: input.tipAmount ?? 0,
    ctx,
  });
  return { lines, totals, discount, ctx };
}
