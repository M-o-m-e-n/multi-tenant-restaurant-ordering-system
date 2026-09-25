import type { OrderType, PreviewResponse, PublicSettings } from '@ros/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '../../shared/api/client';
import { useTableSession } from '../table/tableSession';
import { toRequestLines } from './cartPricing';
import { type CartLine, useCart } from './cartStore';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api<PublicSettings>('/settings', { anonymous: true }),
    staleTime: 60_000,
  });
}

/** Dine-in only through a table session; otherwise the guest's takeaway/delivery choice. */
export function useOrderType(): OrderType {
  const tableToken = useTableSession((s) => s.token);
  const offsite = useCart((s) => s.offsiteType);
  return tableToken ? 'DINE_IN' : offsite;
}

/**
 * The server's authoritative totals for the current cart (CART-06). The client
 * shows its own live figures and this confirms them.
 */
export function useServerPreview(args: {
  lines: readonly CartLine[];
  orderType: OrderType;
  discountCode: string | null;
  tipAmount: number;
}) {
  const body = {
    type: args.orderType,
    items: toRequestLines(args.lines),
    ...(args.discountCode ? { discountCode: args.discountCode } : {}),
    tipAmount: args.tipAmount,
  };
  return useQuery({
    queryKey: ['preview', body],
    queryFn: () =>
      api<PreviewResponse>('/orders/preview', { method: 'POST', body, anonymous: true }),
    enabled: args.lines.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
