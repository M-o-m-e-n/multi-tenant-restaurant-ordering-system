import { describe, expect, it } from 'vitest';

import { canAdvanceDelivery, canAssignDriver, NEXT_DELIVERY_STATUS } from './delivery-status';

describe('delivery status', () => {
  it('moves forward one step at a time and stops at DELIVERED', () => {
    expect(canAdvanceDelivery('PENDING', 'ASSIGNED')).toBe(true);
    expect(canAdvanceDelivery('ASSIGNED', 'PICKED_UP')).toBe(true);
    expect(canAdvanceDelivery('PICKED_UP', 'DELIVERED')).toBe(true);
    expect(canAdvanceDelivery('PENDING', 'PICKED_UP')).toBe(false);
    expect(canAdvanceDelivery('DELIVERED', 'PICKED_UP')).toBe(false);
    expect(NEXT_DELIVERY_STATUS.DELIVERED).toBeNull();
  });

  it('allows reassigning a driver only before pick-up', () => {
    expect(canAssignDriver('PENDING')).toBe(true);
    expect(canAssignDriver('ASSIGNED')).toBe(true);
    expect(canAssignDriver('PICKED_UP')).toBe(false);
    expect(canAssignDriver('DELIVERED')).toBe(false);
  });
});
