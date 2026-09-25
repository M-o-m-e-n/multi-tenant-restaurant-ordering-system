import { describe, expect, it } from 'vitest';

import { ORDER_STATUSES, PAYMENT_STATUSES } from './enums';

describe('enums', () => {
  it('has exactly seven order statuses and no REFUNDED among them', () => {
    expect(ORDER_STATUSES).toHaveLength(7);
    expect(ORDER_STATUSES).not.toContain('REFUNDED');
  });

  it('carries PARTIALLY_PAID as an order payment status', () => {
    expect(PAYMENT_STATUSES).toContain('PARTIALLY_PAID');
  });
});
