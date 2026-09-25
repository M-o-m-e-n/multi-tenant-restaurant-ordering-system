import type { OrderDto, UpdateDeliveryDto } from '@ros/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../shared/api/client';

/** PATCH /orders/:id/delivery — assign a driver or advance the delivery (DEL-04). */
export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, body }: { orderId: string; body: UpdateDeliveryDto }) =>
      api<OrderDto>(`/orders/${orderId}/delivery`, { method: 'PATCH', body }),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
