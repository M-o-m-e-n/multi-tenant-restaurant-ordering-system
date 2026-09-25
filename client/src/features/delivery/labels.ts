import type { DeliveryStatus } from '@ros/shared';

/** What each delivery step means, in words (never colour alone, NFR-U3). */
export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  PENDING: 'Awaiting a driver',
  ASSIGNED: 'Driver assigned',
  PICKED_UP: 'On the way',
  DELIVERED: 'Delivered',
};
