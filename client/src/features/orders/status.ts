import type { OrderDto, OrderStatus } from '@ros/shared';

/** What each status means to a guest. */
export function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'PLACED':
      return 'Order received';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'PREPARING':
      return 'Being prepared';
    case 'READY':
      return 'Ready';
    case 'SERVED':
      return 'Served';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function paymentLabel(status: OrderDto['paymentStatus']): string {
  switch (status) {
    case 'UNPAID':
      return 'Not paid yet';
    case 'PARTIALLY_PAID':
      return 'Partly paid';
    case 'PAID':
      return 'Paid';
    case 'REFUNDED':
      return 'Refunded';
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/** The happy path the tracker draws as steps (ORD-03). */
export const TRACKER_STEPS: OrderStatus[] = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
];
