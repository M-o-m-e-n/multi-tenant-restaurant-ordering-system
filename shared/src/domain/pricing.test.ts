import { describe, expect, it } from 'vitest';

import { DomainError } from './errors';
import { bps } from './money';
import { type CartLine, computeTotals, type PricingContext, type PricingInput } from './pricing';

// LLD §10.1 pricing cases P1–P12.

const ctx: PricingContext = {
  taxBps: 875,
  serviceChargeBps: 1000,
  serviceChargeTaxable: false,
  deliveryFee: 499,
};

const line = (unitPrice: number, qty = 1, modifierDeltas: number[] = []): CartLine => ({
  menuItemId: `item-${unitPrice}`,
  unitPrice,
  qty,
  modifierDeltas,
});

const price = (overrides: Partial<PricingInput> = {}) =>
  computeTotals({ orderType: 'TAKEAWAY', lines: [line(1000)], ctx, ...overrides }).totals;

describe('computeTotals', () => {
  it('P1: prices a single line with no modifiers through the whole chain', () => {
    const t = price({ lines: [line(1200, 3)] });
    expect(t.subtotal).toBe(3600);
    expect(t.discountAmount).toBe(0);
    expect(t.serviceCharge).toBe(0);
    expect(t.taxAmount).toBe(bps(3600, 875));
    expect(t.total).toBe(3600 + bps(3600, 875));
  });

  it('P2: sums modifier deltas per unit before multiplying by quantity', () => {
    const t = price({ lines: [line(1000, 2, [200, -100])] });
    expect(t.subtotal).toBe(2200);
  });

  it('P3: rounds a percent discount half away from zero', () => {
    const t = price({ lines: [line(999)], discount: { type: 'PERCENT', value: 1000 } });
    expect(t.discountAmount).toBe(100);
  });

  it('P4: caps a fixed discount at the subtotal so the total never goes negative', () => {
    const t = price({ lines: [line(500)], discount: { type: 'FIXED', value: 2000 } });
    expect(t.discountAmount).toBe(500);
    expect(t.total).toBe(0);
  });

  it('P5: charges no service charge on a takeaway order', () => {
    const t = price({ orderType: 'TAKEAWAY', lines: [line(4000)] });
    expect(t.serviceCharge).toBe(0);
  });

  it('P6: adds the delivery fee on delivery orders and never discounts it', () => {
    const t = price({
      orderType: 'DELIVERY',
      lines: [line(2000)],
      discount: { type: 'PERCENT', value: 5000 },
    });
    expect(t.deliveryFee).toBe(499);
    expect(t.discountAmount).toBe(1000);
    expect(t.total).toBe(1000 + bps(1000, 875) + 499);
  });

  it('P7: taxes the discounted amount, not the subtotal', () => {
    const t = price({ lines: [line(2000)], discount: { type: 'FIXED', value: 500 } });
    expect(t.taxAmount).toBe(bps(1500, 875));
  });

  it('P8: rejects an empty cart', () => {
    expect(() => price({ lines: [] })).toThrow(DomainError);
    try {
      price({ lines: [] });
    } catch (err) {
      expect((err as DomainError).code).toBe('EMPTY_CART');
    }
  });

  it('P9: taxes the service charge only when serviceChargeTaxable is set', () => {
    const base = { orderType: 'DINE_IN' as const, lines: [line(3000)] };
    const untaxed = price({ ...base, ctx: { ...ctx, serviceChargeTaxable: false } });
    const taxed = price({ ...base, ctx: { ...ctx, serviceChargeTaxable: true } });
    expect(untaxed.serviceCharge).toBe(300);
    expect(taxed.taxAmount - untaxed.taxAmount).toBe(bps(untaxed.serviceCharge, ctx.taxBps));
  });

  it('P10: a tip raises the total by exactly the tip and touches nothing else', () => {
    const input = {
      orderType: 'DINE_IN' as const,
      lines: [line(2500, 2)],
      discount: { type: 'PERCENT' as const, value: 1000 },
    };
    const without = price(input);
    const withTip = price({ ...input, tipAmount: 750 });
    expect(withTip.total - without.total).toBe(750);
    expect(withTip.discountAmount).toBe(without.discountAmount);
    expect(withTip.taxAmount).toBe(without.taxAmount);
    expect(withTip.serviceCharge).toBe(without.serviceCharge);
  });

  it('P10b: clamps a negative tip to zero', () => {
    expect(price({ tipAmount: -300 }).tipAmount).toBe(0);
  });

  it('P11: rounds a negative intermediate symmetrically', () => {
    // A negative modifier drives one line below zero; rounding must mirror the positive case.
    const t = price({ lines: [line(1000), line(100, 1, [-105])], ctx: { ...ctx, taxBps: 1000 } });
    expect(t.subtotal).toBe(995);
    expect(t.taxAmount).toBe(100); // 99.5 rounds away from zero
    expect(bps(-5, 1000)).toBe(-1);
    expect(bps(5, 1000)).toBe(1);
  });

  it('P12: works in basis points with no float anywhere in the chain', () => {
    const t = price({ lines: [line(1000)], ctx: { ...ctx, taxBps: 875 } });
    expect(t.taxAmount).toBe(88);
    for (const value of Object.values(t)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('refuses a fractional price rather than silently rounding it', () => {
    expect(() => price({ lines: [line(10.5)] })).toThrow(TypeError);
  });
});
