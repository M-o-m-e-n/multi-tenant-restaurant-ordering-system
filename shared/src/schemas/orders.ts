import { z } from 'zod';

import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
  ORDER_STATUSES,
  ORDER_TYPES,
} from '../domain/enums';
import { businessDate, nonNegativeCents, paginationShape, repeatable, uuid } from './common';

/** One requested line: ids only. The server re-resolves every price (PAY-07, AC-17). */
export const cartLineSchema = z
  .object({
    menuItemId: uuid,
    qty: z.number().int().min(1).max(99),
    modifierItemIds: z.array(uuid).max(20).default([]),
    notes: z.string().trim().max(300).nullish(),
  })
  .strict();
export type CartLineDto = z.infer<typeof cartLineSchema>;

// Empty item lists are well-formed; EMPTY_CART is a business rule (422), not a 400.
const items = z.array(cartLineSchema).max(50);
const tipAmount = nonNegativeCents.max(1_000_000).optional();
const discountCode = z.string().trim().min(1).max(40).optional();

export const previewOrderSchema = z
  .object({
    type: z.enum(ORDER_TYPES),
    items,
    discountCode,
    tipAmount,
  })
  .strict();
export type PreviewOrderDto = z.infer<typeof previewOrderSchema>;

const customer = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(30),
  })
  .strict();

const delivery = z
  .object({
    address: z.string().trim().min(5).max(300),
    note: z.string().trim().max(120).optional(),
  })
  .strict();

/**
 * POST /orders. `tableToken` identifies the table; a `tableId` is rejected as
 * an unknown field so the table can only come from the QR token (AC-12).
 */
export const createOrderSchema = z
  .object({
    type: z.enum(ORDER_TYPES),
    tableToken: z.string().trim().min(16).max(64).optional(),
    customer: customer.optional(),
    delivery: delivery.optional(),
    items,
    discountCode,
    tipAmount,
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (o.type === 'DINE_IN' && !o.tableToken) {
      ctx.addIssue({ code: 'custom', path: ['tableToken'], message: 'Scan the table QR code.' });
    }
    if (o.type !== 'DINE_IN' && o.tableToken) {
      ctx.addIssue({ code: 'custom', path: ['tableToken'], message: 'Only dine-in orders.' });
    }
    if (o.type !== 'DINE_IN' && !o.customer) {
      ctx.addIssue({ code: 'custom', path: ['customer'], message: 'Name and phone required.' });
    }
    if (o.type === 'DELIVERY' && !o.delivery) {
      ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'Delivery address required.' });
    }
    if (o.type !== 'DELIVERY' && o.delivery) {
      ctx.addIssue({ code: 'custom', path: ['delivery'], message: 'Only delivery orders.' });
    }
  });
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

/** POST /orders/:id/items — append a later round (ORD-12). */
export const appendItemsSchema = z.object({ items }).strict();
export type AppendItemsDto = z.infer<typeof appendItemsSchema>;

/** PATCH /orders/:id/status */
export const transitionSchema = z
  .object({
    to: z.enum(ORDER_STATUSES),
    reason: z.string().trim().max(200).nullish(),
  })
  .strict();
export type TransitionDto = z.infer<typeof transitionSchema>;

/**
 * PATCH /orders/:id/delivery (DEL-04): assign or reassign a driver, advance the
 * delivery one step, or both. Naming a driver on a PENDING delivery assigns it.
 */
export const updateDeliverySchema = z
  .object({
    driverName: z.string().trim().min(1).max(80).optional(),
    status: z.enum(DELIVERY_STATUSES).optional(),
  })
  .strict()
  .refine((d) => d.driverName !== undefined || d.status !== undefined, {
    message: 'Give a driver, a status, or both.',
  });
export type UpdateDeliveryDto = z.infer<typeof updateDeliverySchema>;

/** POST /orders/:id/cancel */
export const cancelOrderSchema = z
  .object({ reason: z.string().trim().max(200).optional() })
  .strict();
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;

/** GET /orders — `from`/`to` are business dates (API-CONTRACT §12). */
export const listOrdersQuerySchema = z
  .object({
    status: repeatable(z.enum(ORDER_STATUSES)).optional(),
    type: z.enum(ORDER_TYPES).optional(),
    from: businessDate.optional(),
    to: businessDate.optional(),
    tableId: uuid.optional(),
    ...paginationShape,
  })
  .strict();
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

// ---- Response shapes (API-CONTRACT §9 OrderDto) ----

export interface OrderItemDto {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  unitPrice: number;
  qty: number;
  modifiers: { groupName: string; items: { name: string; priceDelta: number }[] }[];
  modifierTotal: number;
  lineTotal: number;
  notes: string | null;
  station: string | null;
  /** When the line was added; later rounds are badged on the KDS (ORD-12). */
  addedAt: string;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  businessDate: string;
  type: (typeof ORDER_TYPES)[number];
  status: (typeof ORDER_STATUSES)[number];
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';
  amountPaid: number;
  balanceDue: number;
  table: { id: string; number: string } | null;
  /** Owner and staff only (NFR-S9). */
  customer?: { name: string | null; phone: string | null };
  delivery?: {
    address: string;
    note: string | null;
    status: DeliveryStatus;
    driverName: string | null;
  } | null;
  items: OrderItemDto[];
  totals: {
    subtotal: number;
    discountAmount: number;
    serviceCharge: number;
    taxAmount: number;
    deliveryFee: number;
    tipAmount: number;
    total: number;
    currency: string;
  };
  discountCode: string | null;
  notes: string | null;
  placedAt: string;
  completedAt: string | null;
  /** Role-filtered for the caller; drives the action buttons (LLD §5.3). */
  nextStatuses: (typeof ORDER_STATUSES)[number][];
  isAmendable: boolean;
}

export interface OrderEventDto {
  fromStatus: (typeof ORDER_STATUSES)[number] | null;
  toStatus: (typeof ORDER_STATUSES)[number];
  actor: { id: string; name: string } | null;
  reason: string | null;
  at: string;
}

/** GET /orders/:id/receipt — built only from values stored on the order (PRINT-02, AC-19). */
export interface ReceiptDto {
  orderId: string;
  orderNumber: string;
  businessDate: string;
  issuedAt: string;
  placedAt: string;
  restaurant: { name: string };
  type: (typeof ORDER_TYPES)[number];
  table: string | null;
  customerName: string | null;
  lines: {
    name: string;
    qty: number;
    unitPrice: number;
    modifiers: { name: string; priceDelta: number }[];
    notes: string | null;
    lineTotal: number;
  }[];
  totals: OrderDto['totals'];
  discountCode: string | null;
  payments: {
    method: 'STRIPE' | 'CASH';
    amount: number;
    tipAmount: number;
    state: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
    at: string;
  }[];
  paymentStatus: OrderDto['paymentStatus'];
  amountPaid: number;
  balanceDue: number;
}
