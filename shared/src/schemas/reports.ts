import { z } from 'zod';

import type { OrderType, PaymentMethod } from '../domain/enums';
import { businessDate } from './common';

/** Report ranges are business dates, inclusive (API-CONTRACT §16). */
export const reportRangeSchema = z
  .object({ from: businessDate, to: businessDate })
  .strict()
  .refine((r) => r.from <= r.to, { path: ['to'], message: 'must be on or after from' });
export type ReportRange = z.infer<typeof reportRangeSchema>;

export const topItemsQuerySchema = z
  .object({
    from: businessDate,
    to: businessDate,
    limit: z.coerce.number().int().min(1).max(50).default(10),
    metric: z.enum(['qty', 'revenue']).default('qty'),
  })
  .strict();
export type TopItemsQuery = z.infer<typeof topItemsQuerySchema>;

/** Net sales exclude tax, service, delivery and tips; those are separate lines (BR-16). */
export interface SalesSummary {
  orders: number;
  netSales: number;
  taxCollected: number;
  serviceCharge: number;
  deliveryFees: number;
  tips: number;
  aov: number;
}

export interface RevenueDay {
  businessDate: string;
  netSales: number;
  orders: number;
}

export interface TopItem {
  menuItemId: string | null;
  name: string;
  qty: number;
  revenue: number;
}

export interface PeakHour {
  hour: number;
  orders: number;
}

export interface Breakdowns {
  byType: { type: OrderType; netSales: number; orders: number }[];
  byMethod: { method: PaymentMethod; collected: number; tips: number }[];
}

export interface Cancellations {
  cancelled: {
    orderId: string;
    orderNumber: string;
    businessDate: string;
    reason: string | null;
    at: string;
  }[];
  refunded: { orderId: string; orderNumber: string; businessDate: string; amount: number }[];
}

export interface DashboardToday {
  businessDate: string;
  orders: number;
  netSales: number;
  activeTickets: number;
  tables: { free: number; seated: number; dirty: number };
  unavailableItems: { id: string; name: string }[];
}
