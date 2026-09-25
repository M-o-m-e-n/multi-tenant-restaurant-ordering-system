import type { PaymentState, PaymentStatus } from './enums';

export interface PaymentRecord {
  amount: number;
  state: PaymentState;
}

/**
 * Σ successful payment amounts in cents. Tips ride on payment records but are
 * not payment toward the order balance, so callers pass `amount` only (LLD §4.5).
 */
export function paidSum(payments: readonly PaymentRecord[]): number {
  return payments.filter((p) => p.state === 'SUCCEEDED').reduce((sum, p) => sum + p.amount, 0);
}

/**
 * The order's payment status, derived — never stored by hand (PAY-04, LLD §4.5).
 *
 * Because it is recomputed from the records against the *current* total, an
 * amendment that raises the total turns a PAID order back into PARTIALLY_PAID
 * with no special case (BR-14, AC-14).
 */
export function derivePaymentStatus(
  payments: readonly PaymentRecord[],
  total: number,
): PaymentStatus {
  const paid = paidSum(payments);
  if (paid === 0) return payments.some((p) => p.state === 'REFUNDED') ? 'REFUNDED' : 'UNPAID';
  return paid < total ? 'PARTIALLY_PAID' : 'PAID';
}
