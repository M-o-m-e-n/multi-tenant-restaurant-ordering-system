import {
  AMENDABLE_ORDER_STATUSES,
  type ModifierSnapshot,
  nextStatuses,
  type OrderDto,
  type OrderStatus,
  paidSum,
} from '@ros/shared';

import type { AuthUser } from '../../types/express';
import type { OrderWithRelations } from './orders.repo';

function modifiersOf(json: unknown): OrderDto['items'][number]['modifiers'] {
  if (!Array.isArray(json)) return [];
  return (json as ModifierSnapshot[]).map((g) => ({
    groupName: g.groupName,
    items: g.items.map((i) => ({ name: i.name, priceDelta: i.priceDelta })),
  }));
}

/** Staff, or the customer who owns the order, may see contact details (NFR-S9). */
export function canSeeContact(
  order: Pick<OrderWithRelations, 'userId'>,
  viewer: AuthUser,
): boolean {
  return viewer.role !== 'CUSTOMER' || order.userId === viewer.id;
}

/**
 * The only shape an order leaves the server in. Values come from the order's
 * own snapshots, never from the live menu (ORD-05).
 */
export function toOrderDto(order: OrderWithRelations, viewer: AuthUser): OrderDto {
  const amountPaid = paidSum(order.payments);
  const contact = canSeeContact(order, viewer);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    businessDate: order.businessDate.toISOString().slice(0, 10),
    type: order.type,
    status: order.status,
    paymentStatus: order.paymentStatus,
    amountPaid,
    balanceDue: Math.max(0, order.total - amountPaid),
    table: order.table,
    ...(contact ? { customer: { name: order.customerName, phone: order.customerPhone } } : {}),
    ...(order.type === 'DELIVERY'
      ? {
          delivery:
            contact && order.delivery
              ? {
                  address: order.delivery.address,
                  note: order.delivery.addressNote,
                  status: order.delivery.status,
                  driverName: order.delivery.driverName,
                }
              : null,
        }
      : {}),
    items: order.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      nameSnapshot: i.nameSnapshot,
      unitPrice: i.unitPrice,
      qty: i.qty,
      modifiers: modifiersOf(i.modifiersJson),
      modifierTotal: i.modifierTotal,
      lineTotal: i.lineTotal,
      notes: i.notes,
      station: i.station,
      addedAt: i.addedAt.toISOString(),
    })),
    totals: {
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      serviceCharge: order.serviceCharge,
      taxAmount: order.taxAmount,
      deliveryFee: order.deliveryFee,
      tipAmount: order.tipAmount,
      total: order.total,
      currency: order.currency,
    },
    discountCode: order.discountCode,
    notes: order.notes,
    placedAt: order.placedAt.toISOString(),
    completedAt: order.completedAt?.toISOString() ?? null,
    nextStatuses: nextStatuses(order.status, viewer.role),
    isAmendable: (AMENDABLE_ORDER_STATUSES as readonly OrderStatus[]).includes(order.status),
  };
}
