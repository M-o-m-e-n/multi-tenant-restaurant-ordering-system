import type { DiscountType } from './enums';
import type { DomainErrorCode } from './errors';
import type { PricingDiscount } from './pricing';

/** The fields of a stored discount that decide whether it applies. */
export interface DiscountRule {
  code: string;
  type: DiscountType;
  /** Basis points when PERCENT, cents when FIXED. */
  value: number;
  /** Minimum subtotal in cents. */
  minOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export type DiscountRejection = Extract<DomainErrorCode, `DISCOUNT_${string}`>;

export type DiscountEvaluation =
  { ok: true; discount: PricingDiscount } | { ok: false; code: DiscountRejection; message: string };

/** Promo codes are stored and compared upper-cased (LLD §2.2). */
export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Decide whether a discount applies to a subtotal at a moment in time
 * (LLD §3.3). Pure: the caller loads the rule, and the redemption itself is
 * counted atomically at placement (DISC-06), so passing here never reserves one.
 *
 * @param rule the stored discount, or null when the code matched nothing
 * @param subtotalCents the cart subtotal the discount would apply to
 * @param now the instant to check the active window against
 * @returns the pricing discount, or the specific rejection code
 */
export function evaluateDiscount(
  rule: DiscountRule | null,
  subtotalCents: number,
  now: Date,
): DiscountEvaluation {
  if (!rule) {
    return { ok: false, code: 'DISCOUNT_NOT_FOUND', message: 'That promo code does not exist.' };
  }
  if (!rule.isActive) {
    return {
      ok: false,
      code: 'DISCOUNT_INACTIVE',
      message: `${rule.code} is no longer available. Try another code.`,
    };
  }
  if (rule.startsAt && now < rule.startsAt) {
    return {
      ok: false,
      code: 'DISCOUNT_INACTIVE',
      message: `${rule.code} is not active yet. It starts on ${rule.startsAt.toISOString().slice(0, 10)}.`,
    };
  }
  if (rule.endsAt && now > rule.endsAt) {
    return {
      ok: false,
      code: 'DISCOUNT_EXPIRED',
      message: `${rule.code} expired on ${rule.endsAt.toISOString().slice(0, 10)}. Try another code, or continue without one.`,
    };
  }
  if (subtotalCents < rule.minOrder) {
    return {
      ok: false,
      code: 'DISCOUNT_MIN_NOT_MET',
      message: `${rule.code} needs a subtotal of at least ${rule.minOrder} cents.`,
    };
  }
  if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) {
    return {
      ok: false,
      code: 'DISCOUNT_LIMIT_REACHED',
      message: `${rule.code} has been fully redeemed.`,
    };
  }
  return { ok: true, discount: { type: rule.type, value: rule.value } };
}
