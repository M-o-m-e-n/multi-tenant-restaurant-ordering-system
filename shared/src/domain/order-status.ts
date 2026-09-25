import type { OrderStatus, Role } from './enums';

/** One legal edge of the order lifecycle and the roles allowed to take it. */
export interface Transition {
  from: OrderStatus;
  to: OrderStatus;
  roles: readonly Role[];
}

const STAFF_ONLY: readonly Role[] = ['STAFF', 'ADMIN'];
const ANYONE: readonly Role[] = ['CUSTOMER', 'STAFF', 'ADMIN'];

/**
 * The role gate belongs to the edge, not to a status: from PLACED a customer
 * may cancel but must not confirm, which a status-keyed gate cannot express
 * (LLD §3.1). Only the single next step is legal (BR-12); COMPLETED and
 * CANCELLED have no outgoing edges.
 */
export const ORDER_TRANSITIONS: readonly Transition[] = [
  { from: 'PLACED', to: 'CONFIRMED', roles: STAFF_ONLY },
  { from: 'PLACED', to: 'CANCELLED', roles: ANYONE }, // ORD-09
  { from: 'CONFIRMED', to: 'PREPARING', roles: STAFF_ONLY },
  { from: 'CONFIRMED', to: 'CANCELLED', roles: ANYONE }, // ORD-09
  { from: 'PREPARING', to: 'READY', roles: STAFF_ONLY },
  { from: 'PREPARING', to: 'CANCELLED', roles: STAFF_ONLY },
  { from: 'READY', to: 'SERVED', roles: STAFF_ONLY },
  { from: 'READY', to: 'CANCELLED', roles: STAFF_ONLY },
  { from: 'SERVED', to: 'COMPLETED', roles: STAFF_ONLY },
  { from: 'SERVED', to: 'CANCELLED', roles: STAFF_ONLY },
];

/**
 * The single forward step per status: what a KDS bump means. Kept separate from
 * the edge list so the bump never depends on array order (LLD §3.1).
 */
export const FORWARD_TRANSITION: Readonly<Record<OrderStatus, OrderStatus | null>> = {
  PLACED: 'CONFIRMED',
  CONFIRMED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'SERVED',
  SERVED: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
};

/** Statuses with no outgoing edge. */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['COMPLETED', 'CANCELLED'];

/**
 * Whether `role` may move an order from `from` to `to`.
 * @returns true only for a declared edge whose role list includes `role`
 */
export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  return ORDER_TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}

/**
 * Every status `role` may move an order to from `from`, in declaration order.
 * Drives the client's action buttons, so the UI never offers an illegal move.
 */
export function nextStatuses(from: OrderStatus, role: Role): OrderStatus[] {
  return ORDER_TRANSITIONS.filter((t) => t.from === from && t.roles.includes(role)).map(
    (t) => t.to,
  );
}
