import type { DiscountType, OrderType } from './enums';
import { DomainError } from './errors';
import { assertInteger, bps } from './money';

/** One cart line as priced: every figure is re-read from the database on the server. */
export interface CartLine {
  menuItemId: string;
  /** Base price in cents at pricing time. */
  unitPrice: number;
  qty: number;
  /** Per-unit modifier deltas in cents; may be negative. */
  modifierDeltas: readonly number[];
}

/** A discount that has already passed validation (see evaluateDiscount). */
export interface PricingDiscount {
  type: DiscountType;
  /** Basis points when PERCENT (1000 = 10%), cents when FIXED. */
  value: number;
}

/** The settings the totals chain depends on; the client gets exactly these from GET /settings. */
export interface PricingContext {
  taxBps: number;
  serviceChargeBps: number;
  serviceChargeTaxable: boolean;
  /** Cents; applied to DELIVERY orders only. */
  deliveryFee: number;
}

export interface PricingInput {
  lines: readonly CartLine[];
  orderType: OrderType;
  discount?: PricingDiscount | null;
  /** Cents; negative values are clamped to zero. */
  tipAmount?: number;
  ctx: PricingContext;
}

/** Every component of an order total, in cents. */
export interface PricingBreakdown {
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  taxAmount: number;
  deliveryFee: number;
  tipAmount: number;
  total: number;
}

export interface PricingResult {
  lines: { menuItemId: string; lineTotal: number }[];
  totals: PricingBreakdown;
}

/**
 * Line total in cents: `(unitPrice + Σ modifierDeltas) × qty` (CART-04). Deltas
 * are summed per unit before multiplying.
 */
export function lineTotal(line: Pick<CartLine, 'unitPrice' | 'qty' | 'modifierDeltas'>): number {
  assertInteger(line.unitPrice, 'unitPrice');
  assertInteger(line.qty, 'qty');
  let perUnit = line.unitPrice;
  for (const delta of line.modifierDeltas) {
    assertInteger(delta, 'modifierDelta');
    perUnit += delta;
  }
  return perUnit * line.qty;
}

/**
 * The single pricing function, called by the client for its live preview and
 * by the server with prices re-read from the database (CART-05, CART-06).
 * The step order is the contract (LLD §3.2): BR-01, BR-02, BR-03, BR-10, BR-13.
 *
 * @returns line totals and every total component, all integer cents
 * @throws DomainError EMPTY_CART when there are no lines
 */
export function computeTotals(input: PricingInput): PricingResult {
  const { ctx, orderType } = input;
  if (input.lines.length === 0) {
    throw new DomainError('EMPTY_CART', 'Add at least one item before checking out.');
  }
  assertInteger(ctx.taxBps, 'taxBps');
  assertInteger(ctx.serviceChargeBps, 'serviceChargeBps');
  assertInteger(ctx.deliveryFee, 'deliveryFee');

  // 1–2. Lines and subtotal.
  const lines = input.lines.map((l) => ({ menuItemId: l.menuItemId, lineTotal: lineTotal(l) }));
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // 3. Discount, applied to the subtotal only and never below zero (DISC-04, DISC-05).
  const discountAmount = discountFor(subtotal, input.discount ?? null);

  // 4. What the discount leaves.
  const taxable = subtotal - discountAmount;

  // 5. Service charge on dine-in only (BR-02).
  const serviceCharge = orderType === 'DINE_IN' ? bps(taxable, ctx.serviceChargeBps) : 0;

  // 6–7. Tax base includes the service charge only when the setting says so (BR-03).
  const taxBase = taxable + (ctx.serviceChargeTaxable ? serviceCharge : 0);
  const taxAmount = bps(taxBase, ctx.taxBps);

  // 8. Delivery fee is never discounted (BR-10).
  const deliveryFee = orderType === 'DELIVERY' ? ctx.deliveryFee : 0;

  // 9. Tip is never discounted or taxed, and is added last (BR-13).
  const tip = input.tipAmount ?? 0;
  assertInteger(tip, 'tipAmount');
  const tipAmount = Math.max(0, tip);

  // 10. Total (BR-01).
  const total = taxable + serviceCharge + taxAmount + deliveryFee + tipAmount;

  return {
    lines,
    totals: { subtotal, discountAmount, serviceCharge, taxAmount, deliveryFee, tipAmount, total },
  };
}

function discountFor(subtotal: number, discount: PricingDiscount | null): number {
  if (!discount || subtotal <= 0) return 0;
  assertInteger(discount.value, 'discount.value');
  switch (discount.type) {
    case 'PERCENT':
      return Math.min(bps(subtotal, discount.value), subtotal);
    case 'FIXED':
      return Math.min(Math.max(0, discount.value), subtotal);
    default: {
      const exhaustive: never = discount.type;
      throw new Error(`Unhandled discount type: ${String(exhaustive)}`);
    }
  }
}
