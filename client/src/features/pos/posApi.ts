import type { OrderDto, OrderStatus, Paginated } from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

/** Under ['orders', …], so every socket order event refreshes the till. */
export const posKey = ['orders', 'pos'] as const;

export function usePosOrders() {
  return useQuery({
    queryKey: posKey,
    queryFn: () => api<Paginated<OrderDto>>('/orders?limit=100').then((r) => r.data),
    refetchInterval: 30_000,
  });
}

export function useTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: OrderStatus; reason?: string }) =>
      api<OrderDto>(`/orders/${id}/status`, {
        method: 'PATCH',
        body: { to, ...(reason ? { reason } : {}) },
      }),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
