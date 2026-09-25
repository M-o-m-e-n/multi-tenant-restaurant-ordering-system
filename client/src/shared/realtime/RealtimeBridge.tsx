import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSocket } from './socket';

interface OrderEvent {
  orderId?: string;
}

/**
 * Turns socket events into query invalidations (LLD §6.3). Events are hints:
 * nothing is patched from a payload, the affected queries simply refetch, and
 * every (re)connect refetches the whole visible snapshot.
 */
export function RealtimeBridge() {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    const invalidate = (...keys: readonly (readonly unknown[])[]) => {
      for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
    };

    const onConnect = () => void qc.invalidateQueries();
    const onMenu = () => invalidate(['menu'], ['admin', 'menu']);
    const onOrder = (e: OrderEvent) =>
      invalidate(['kds'], ['orders'], ['tables'], ...(e.orderId ? [['order', e.orderId]] : []));
    const onTable = () => invalidate(['tables']);
    const onReservation = () => invalidate(['reservations']);
    const onPayment = (e: OrderEvent) =>
      invalidate(['kds'], ...(e.orderId ? [['order', e.orderId]] : []));

    socket.on('connect', onConnect);
    socket.on('menu:changed', onMenu);
    socket.on('order:new', onOrder);
    socket.on('order:status', onOrder);
    socket.on('order:removed', onOrder);
    socket.on('table:changed', onTable);
    socket.on('payment:changed', onPayment);
    socket.on('reservation:flag', onReservation);
    return () => {
      socket.off('connect', onConnect);
      socket.off('menu:changed', onMenu);
      socket.off('order:new', onOrder);
      socket.off('order:status', onOrder);
      socket.off('order:removed', onOrder);
      socket.off('table:changed', onTable);
      socket.off('payment:changed', onPayment);
      socket.off('reservation:flag', onReservation);
    };
  }, [qc]);

  return null;
}
