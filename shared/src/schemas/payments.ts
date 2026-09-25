import { z } from 'zod';

import { cents, nonNegativeCents, uuid } from './common';

/** POST /payments/intent — amount defaults to the balance; less enables split payment (PAY-06). */
export const createIntentSchema = z
  .object({
    orderId: uuid,
    amount: cents.positive().optional(),
  })
  .strict();
export type CreateIntentDto = z.infer<typeof createIntentSchema>;

/** POST /payments/cash — staff only; records an optional cash tip (TIP-02). */
export const cashPaymentSchema = z
  .object({
    orderId: uuid,
    amount: cents.positive().optional(),
    tipAmount: nonNegativeCents.max(1_000_000).optional(),
  })
  .strict();
export type CashPaymentDto = z.infer<typeof cashPaymentSchema>;

/** POST /payments/refund — admin only (PAY-09). */
export const refundSchema = z
  .object({
    orderId: uuid,
    reason: z.string().trim().min(1).max(200),
  })
  .strict();
export type RefundDto = z.infer<typeof refundSchema>;

export const orderIdParamSchema = z.object({ orderId: uuid }).strict();

// ---- Response shapes (API-CONTRACT §9, §13) ----

export interface PaymentDto {
  id: string;
  method: 'STRIPE' | 'CASH';
  amount: number;
  tipAmount: number;
  state: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  /** The cashier, for a cash payment. */
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface IntentResponse {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  currency: string;
  paymentId: string;
}

export interface OrderPaymentsResponse {
  data: PaymentDto[];
  amountPaid: number;
  balanceDue: number;
}

/** GET /payments/config — whether card payment is switched on (NFR-R6). */
export interface PaymentsConfig {
  cardEnabled: boolean;
  publishableKey: string | null;
}
