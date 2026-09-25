import type { DeliveryStatus } from './enums';

/**
 * A delivery moves strictly forward, one step at a time (DEL-03):
 * PENDING → ASSIGNED → PICKED_UP → DELIVERED. It runs independently of the
 * order's own status, so the kitchen and the driver never block each other.
 */
export const NEXT_DELIVERY_STATUS: Record<DeliveryStatus, DeliveryStatus | null> = {
  PENDING: 'ASSIGNED',
  ASSIGNED: 'PICKED_UP',
  PICKED_UP: 'DELIVERED',
  DELIVERED: null,
};

export function canAdvanceDelivery(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return NEXT_DELIVERY_STATUS[from] === to;
}

/** A driver may be (re)assigned until the food has left the building (DEL-04). */
export function canAssignDriver(status: DeliveryStatus): boolean {
  return status === 'PENDING' || status === 'ASSIGNED';
}
