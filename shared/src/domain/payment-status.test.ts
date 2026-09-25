import { describe, expect, it } from 'vitest';

import { derivePaymentStatus, paidSum } from './payment-status';

describe('derivePaymentStatus', () => {
  it('is UNPAID with no successful payment, whatever failed or is pending', () => {
    expect(derivePaymentStatus([], 1000)).toBe('UNPAID');
    expect(
      derivePaymentStatus(
        [
          { amount: 1000, state: 'FAILED' },
          { amount: 1000, state: 'PENDING' },
        ],
        1000,
      ),
    ).toBe('UNPAID');
  });

  it('is PARTIALLY_PAID then PAID as split payments arrive (PAY-06)', () => {
    const card = { amount: 600, state: 'SUCCEEDED' as const };
    expect(derivePaymentStatus([card], 1000)).toBe('PARTIALLY_PAID');
    expect(derivePaymentStatus([card, { amount: 400, state: 'SUCCEEDED' }], 1000)).toBe('PAID');
  });

  it('drops a paid order back to PARTIALLY_PAID when its total rises (BR-14, AC-14)', () => {
    const payments = [{ amount: 1000, state: 'SUCCEEDED' as const }];
    expect(derivePaymentStatus(payments, 1000)).toBe('PAID');
    expect(derivePaymentStatus(payments, 1450)).toBe('PARTIALLY_PAID');
  });

  it('is REFUNDED once every successful payment has been refunded (BR-07)', () => {
    expect(derivePaymentStatus([{ amount: 1000, state: 'REFUNDED' }], 1000)).toBe('REFUNDED');
  });

  it('sums only successful amounts', () => {
    expect(
      paidSum([
        { amount: 500, state: 'SUCCEEDED' },
        { amount: 300, state: 'PENDING' },
        { amount: 200, state: 'REFUNDED' },
      ]),
    ).toBe(500);
  });
});
