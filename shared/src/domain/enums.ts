// Literal unions backed by const arrays (CODING-STANDARDS §2: no TS enums).
// Members mirror the Prisma enums exactly (LLD §2.1).

export const ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

/**
 * Kitchen lifecycle. Deliberately has no `REFUNDED`: a refund is a payment
 * event and never changes what happened to the order (LLD §2.1, BR-07).
 */
export const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** The order's aggregate payment position, always derived from payment rows. */
export const PAYMENT_STATUSES = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The state of one Payment record. */
export const PAYMENT_STATES = ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_METHODS = ['STRIPE', 'CASH'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TABLE_STATUSES = ['FREE', 'SEATED', 'DIRTY'] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const DISCOUNT_TYPES = ['PERCENT', 'FIXED'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DELIVERY_STATUSES = ['PENDING', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const RESERVATION_STATUSES = ['PENDING', 'SEATED', 'CANCELLED', 'COMPLETED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** Orders that still occupy the kitchen or a table (BR-08). */
export const OPEN_ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SERVED',
] as const satisfies readonly OrderStatus[];

/** Statuses in which items may still be appended (ORD-12, BR-14). */
export const AMENDABLE_ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
] as const satisfies readonly OrderStatus[];
