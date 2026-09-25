import { useEffect } from 'react';

import { getSocket } from './socket';

/**
 * Ask to follow one order's room. The server joins it only for the owner
 * (or staff); the request is repeated on every reconnect, since rooms do not
 * survive a dropped connection.
 */
export function useWatchOrder(orderId: string | undefined): void {
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    const watch = () => socket.emit('customer:watch', orderId);
    if (socket.connected) watch();
    socket.on('connect', watch);
    return () => {
      socket.off('connect', watch);
    };
  }, [orderId]);
}
