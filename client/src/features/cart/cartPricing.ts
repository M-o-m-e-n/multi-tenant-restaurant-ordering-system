import {
  bps,
  type CartLineDto,
  computeTotals,
  type OrderType,
  type PricingBreakdown,
  type PricingDiscount,
  type PublicSettings,
} from '@ros/shared';

import type { CartLine, TipChoice } from './cartStore';

/** Cart lines as the API receives them: ids only (PAY-07, AC-17). */
export function toRequestLines(lines: readonly CartLine[]): CartLineDto[] {
  return lines.map((l) => ({
    menuItemId: l.menuItemId,
    qty: l.qty,
    modifierItemIds: l.modifiers.flatMap((g) => g.items.map((i) => i.id)),
    notes: l.notes.trim() || null,
  }));
}

/**
 * The tip in cents. A preset is a percentage of what the food costs after the
 * discount, rounded like every other rate (bps); a custom tip is taken as typed.
 */
export function tipCents(tip: TipChoice, subtotal: number, discountAmount: number): number {
  switch (tip.kind) {
    case 'none':
      return 0;
    case 'preset':
      return bps(Math.max(0, subtotal - discountAmount), tip.bps);
    case 'custom':
      return Math.max(0, tip.cents);
    default: {
      const exhaustive: never = tip;
      return exhaustive;
    }
  }
}

/**
 * Live totals for the cart, through the one shared pricing function — no
 * pricing arithmetic exists in the client outside this call (CART-05, M6-S5).
 */
export function cartTotals(
  lines: readonly CartLine[],
  opts: {
    orderType: OrderType;
    settings: PublicSettings;
    discount: PricingDiscount | null;
    tip: TipChoice;
  },
): PricingBreakdown & { tipAmount: number } {
  const input = {
    orderType: opts.orderType,
    lines: lines.map((l) => ({
      menuItemId: l.menuItemId,
      unitPrice: l.unitPrice,
      qty: l.qty,
      modifierDeltas: l.modifiers.flatMap((g) => g.items.map((i) => i.priceDelta)),
    })),
    discount: opts.discount,
    ctx: opts.settings,
  };
  const base = computeTotals(input).totals;
  const tipAmount = tipCents(opts.tip, base.subtotal, base.discountAmount);
  return computeTotals({ ...input, tipAmount }).totals;
}
