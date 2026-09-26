import type { OrderDto, OrderStatus } from '@ros/shared';

import { tNow } from '../../i18n';

/** What each status means to a guest, in the reader's language. */
export function statusLabel(status: OrderStatus): string {
  return tNow().status[status];
}

export function paymentLabel(status: OrderDto['paymentStatus']): string {
  return tNow().payment[status];
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
