import { describe, expect, it } from 'vitest';

import { computeTotals } from './pricing';

// The worked example from MILESTONES M1-S3 and API-CONTRACT §9 PricingBreakdown.
describe('computeTotals worked example', () => {
  it('prices the reference dine-in order to a total of 4592', () => {
    const { totals, lines } = computeTotals({
      orderType: 'DINE_IN',
      lines: [
        { menuItemId: 'a', unitPrice: 1000, qty: 2, modifierDeltas: [200, -100] },
        { menuItemId: 'b', unitPrice: 1550, qty: 1, modifierDeltas: [] },
      ],
      discount: { type: 'PERCENT', value: 1000 },
      tipAmount: 500,
      ctx: { taxBps: 875, serviceChargeBps: 1250, serviceChargeTaxable: false, deliveryFee: 499 },
    });

    expect(lines.map((l) => l.lineTotal)).toEqual([2200, 1550]);
    expect(totals).toEqual({
      subtotal: 3750,
      discountAmount: 375,
      serviceCharge: 422,
      taxAmount: 295,
      deliveryFee: 0,
      tipAmount: 500,
      total: 4592,
    });
  });
});
