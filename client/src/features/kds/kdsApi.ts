import {
  type KdsSettings,
  OPEN_ORDER_STATUSES,
  type OrderDto,
  type OrderStatus,
  type Paginated,
} from '@ros/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tNow } from '../../i18n';
import { api } from '../../shared/api/client';

export const kdsKey = ['kds'] as const;

export interface KdsBoard {
  active: OrderDto[];
  completed: OrderDto[];
}

async function loadBoard(): Promise<KdsBoard> {
  const open = OPEN_ORDER_STATUSES.map((s) => `status=${s}`).join('&');
  const [active, completed] = await Promise.all([
    api<Paginated<OrderDto>>(`/orders?${open}&limit=100`),
    api<Paginated<OrderDto>>('/orders?status=COMPLETED&limit=20'),
  ]);
  return {
    // Oldest first, so the ticket that has waited longest leads each column.
    active: [...active.data].sort((a, b) => a.placedAt.localeCompare(b.placedAt)),
    completed: completed.data,
  };
}

/**
 * The board. Socket events invalidate it within milliseconds; the 30 s poll
 * runs regardless, so a dead socket still reconciles (HLD §8.4, R3).
 */
export function useKdsBoard() {
  return useQuery({ queryKey: kdsKey, queryFn: loadBoard, refetchInterval: 30_000 });
}

export function useKdsSettings() {
  return useQuery({
    queryKey: ['settings', 'kds'],
    queryFn: () => api<KdsSettings>('/settings/kds'),
    staleTime: 60_000,
  });
}

/**
 * One-tap bump, optimistic: the ticket moves at once and moves back if the
 * server refuses — two cooks bumping the same ticket is a 409 for one of them
 * (R9, LLD §7.5).
 */
export function useBump(onConflict: (message: string) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: OrderStatus }) =>
      api<OrderDto>(`/orders/${id}/status`, { method: 'PATCH', body: { to } }),
    onMutate: async ({ id, to }) => {
      await qc.cancelQueries({ queryKey: kdsKey });
      const previous = qc.getQueryData<KdsBoard>(kdsKey);
      if (previous) {
        const moved = previous.active.map((o) => (o.id === id ? { ...o, status: to } : o));
        qc.setQueryData<KdsBoard>(kdsKey, {
          active: moved.filter((o) => o.status !== 'COMPLETED'),
          completed: [
            ...moved
              .filter((o) => o.status === 'COMPLETED')
              .map((o) => ({ ...o, completedAt: new Date().toISOString() })),
            ...previous.completed,
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(kdsKey, ctx.previous);
      onConflict(tNow().kds.updatedElsewhere);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: kdsKey }),
  });
}
