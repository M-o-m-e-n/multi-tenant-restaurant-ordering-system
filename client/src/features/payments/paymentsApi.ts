import type {
  CashPaymentDto,
  IntentResponse,
  OrderDto,
  OrderPaymentsResponse,
  PaymentDto,
  PaymentsConfig,
  RefundDto,
} from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export function usePaymentsConfig() {
  return useQuery({
    queryKey: ['payments', 'config'],
    queryFn: () => api<PaymentsConfig>('/payments/config', { anonymous: true }),
    staleTime: 5 * 60_000,
  });
}

export function useOrderPayments(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId ?? 'none', 'payments'],
    queryFn: () => api<OrderPaymentsResponse>(`/payments/order/${orderId ?? ''}`),
    enabled: orderId !== null,
  });
}

/** Start a card payment; the Idempotency-Key is kept for this payment attempt (NFR-R5). */
export function createIntent(
  orderId: string,
  key: string,
  amount?: number,
): Promise<IntentResponse> {
  return api<IntentResponse>('/payments/intent', {
    method: 'POST',
    body: amount ? { orderId, amount } : { orderId },
    headers: { 'Idempotency-Key': key },
  });
}

function usePaymentMutation<T>(fn: (dto: T) => Promise<{ order: OrderDto; payment: PaymentDto }>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async ({ order }) => {
      qc.setQueryData(['order', order.id], order);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['order', order.id] }),
        qc.invalidateQueries({ queryKey: ['orders'] }),
        qc.invalidateQueries({ queryKey: ['pos'] }),
      ]);
    },
  });
}

export const useRecordCash = () =>
  usePaymentMutation((dto: CashPaymentDto) => api('/payments/cash', { method: 'POST', body: dto }));

export const useRefund = () =>
  usePaymentMutation((dto: RefundDto) => api('/payments/refund', { method: 'POST', body: dto }));
