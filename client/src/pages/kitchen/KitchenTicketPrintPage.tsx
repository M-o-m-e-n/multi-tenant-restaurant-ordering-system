import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

import { isLaterRound } from '../../features/kds/kdsLogic';
import { useOrder } from '../../features/orders/ordersApi';
import { useT } from '../../i18n';
import { formatTime } from '../../shared/format';

/**
 * A kitchen ticket for printing or re-printing (PRINT-03): big type, no
 * prices, modifiers and notes spelled out. Opening it changes nothing about
 * the order; it prints itself once loaded.
 */
export function KitchenTicketPrintPage() {
  const { id = '' } = useParams();
  const { data: order } = useOrder(id, 0);
  const t = useT();

  useEffect(() => {
    if (order) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [order]);

  if (!order)
    return (
      <p role="status" className="p-10 text-center">
        {t.kds.printLoading}
      </p>
    );
  return (
    <main className="mx-auto max-w-sm bg-white p-6 font-sans text-ink-inverse print:max-w-none print:p-0">
      <h1 className="font-display text-5xl font-bold">{order.orderNumber}</h1>
      <p className="mt-1 text-xl font-bold">
        {order.table
          ? t.kds.printTable(order.table.number)
          : order.type === 'DELIVERY'
            ? t.kds.printDelivery
            : t.kds.printTakeaway}
      </p>
      <p className="text-sm">{formatTime(order.placedAt)}</p>
      <hr className="my-3 border-ink-inverse" />
      <ul className="flex flex-col gap-3">
        {order.items.map((i) => (
          <li key={i.id}>
            <p className="text-2xl font-bold">
              {i.qty} × {i.nameSnapshot}
              {isLaterRound(i, order.placedAt) && (
                <span className="ms-2 text-sm">{t.kds.printLater}</span>
              )}
            </p>
            {i.modifiers
              .flatMap((g) => g.items)
              .map((m) => (
                <p key={m.name} className="ps-4 text-lg">
                  + {m.name}
                </p>
              ))}
            {i.notes && <p className="ps-4 text-lg font-bold">!! {i.notes}</p>}
          </li>
        ))}
      </ul>
      {order.notes && (
        <p className="mt-3 border-t border-ink-inverse pt-2 text-lg font-bold">
          {t.kds.printNote} {order.notes}
        </p>
      )}
    </main>
  );
}
