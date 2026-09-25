import type { CreateOrderDto, OrderDto, OrderEventDto, Paginated } from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

export const orderKeys = {
  mine: ['orders', 'mine'] as const,
  one: (id: string) => ['order', id] as const,
  events: (id: string, status?: string) => ['order', id, 'events', status ?? ''] as const,
};

/** One order. Socket events invalidate it; a slow poll is the safety net (HLD §8.4). */
export function useOrder(id: string, pollMs = 30_000) {
  return useQuery({
    queryKey: orderKeys.one(id),
    queryFn: () => api<OrderDto>(`/orders/${id}`),
    refetchInterval: (q) =>
      q.state.data && ['COMPLETED', 'CANCELLED'].includes(q.state.data.status) ? false : pollMs,
  });
}

/** The audit timeline; keyed on the status so every move refetches it. */
export function useOrderEvents(id: string, status?: string) {
  return useQuery({
    queryKey: orderKeys.events(id, status),
    queryFn: () => api<{ data: OrderEventDto[] }>(`/orders/${id}/events`).then((r) => r.data),
  });
}

export function useMyOrders() {
  return useQuery({
    queryKey: orderKeys.mine,
    queryFn: () => api<Paginated<OrderDto>>('/orders?limit=50'),
  });
}

/**
 * Place an order with an Idempotency-Key the caller keeps for this checkout
 * attempt, so a retried click or a flaky network cannot place it twice (NFR-R5).
 */
export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dto, key }: { dto: CreateOrderDto; key: string }) =>
      api<OrderDto>('/orders', { method: 'POST', body: dto, headers: { 'Idempotency-Key': key } }),
    onSuccess: async (order) => {
      qc.setQueryData(orderKeys.one(order.id), order);
      await qc.invalidateQueries({ queryKey: orderKeys.mine });
    },
  });
}

export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      api<OrderDto>(`/orders/${id}/cancel`, { method: 'POST', body: reason ? { reason } : {} }),
    onSuccess: async (order) => {
      qc.setQueryData(orderKeys.one(id), order);
      await qc.invalidateQueries({ queryKey: ['order', id, 'events'] });
    },
  });
}
