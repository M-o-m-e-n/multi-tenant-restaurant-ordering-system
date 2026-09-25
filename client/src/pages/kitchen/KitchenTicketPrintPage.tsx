import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { isLaterRound } from '../../features/kds/kdsLogic';
import { useOrder } from '../../features/orders/ordersApi';

/**
 * A kitchen ticket for printing or re-printing (PRINT-03): big type, no
 * prices, modifiers and notes spelled out. Opening it changes nothing about
 * the order; it prints itself once loaded.
 */
export function KitchenTicketPrintPage() {
  const { id = '' } = useParams();
  const { data: order } = useOrder(id, 0);

  useEffect(() => {
    if (order) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [order]);

  if (!order)
    return (
      <p role="status" className="p-10 text-center">
        Loading ticket…
      </p>
    );
  return (
    <main className="mx-auto max-w-sm bg-white p-6 font-sans text-ink-inverse print:max-w-none print:p-0">
      <h1 className="font-display text-5xl font-bold">{order.orderNumber}</h1>
      <p className="mt-1 text-xl font-bold">
        {order.table
          ? `TABLE ${order.table.number}`
          : order.type === 'DELIVERY'
            ? 'DELIVERY'
            : 'TAKEAWAY'}
      </p>
      <p className="text-sm">
        {new Date(order.placedAt).toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <hr className="my-3 border-ink-inverse" />
      <ul className="flex flex-col gap-3">
        {order.items.map((i) => (
          <li key={i.id}>
            <p className="text-2xl font-bold">
              {i.qty} × {i.nameSnapshot}
              {isLaterRound(i, order.placedAt) && (
                <span className="ml-2 text-sm">[LATER ROUND]</span>
              )}
            </p>
            {i.modifiers
              .flatMap((g) => g.items)
              .map((m) => (
                <p key={m.name} className="pl-4 text-lg">
                  + {m.name}
                </p>
              ))}
            {i.notes && <p className="pl-4 text-lg font-bold">!! {i.notes}</p>}
          </li>
        ))}
      </ul>
      {order.notes && (
        <p className="mt-3 border-t border-ink-inverse pt-2 text-lg font-bold">
          NOTE: {order.notes}
        </p>
      )}
    </main>
  );
}
