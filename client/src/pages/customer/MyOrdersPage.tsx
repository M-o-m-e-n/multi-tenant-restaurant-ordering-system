import { Link } from 'react-router-dom';

import { useMyOrders } from '../../features/orders/ordersApi';
import { statusLabel } from '../../features/orders/status';
import { formatMoney } from '../../shared/money';

/** Order history (ORD-07). */
export function MyOrdersPage() {
  const { data, isLoading } = useMyOrders();
  if (isLoading)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Loading your orders…
      </p>
    );
  const orders = data?.data ?? [];
  return (
    <main className="mx-auto w-full max-w-content px-5 pb-16 md:px-10">
      <h1 className="font-display text-3xl font-bold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          No orders yet.{' '}
          <Link to="/menu" className="font-semibold text-flame-text">
            Browse the menu
          </Link>
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="flex min-h-14 items-center justify-between gap-4 py-3 hover:text-flame-text"
              >
                <span>
                  <span className="font-semibold">{o.orderNumber}</span>
                  <span className="ml-3 text-sm text-ink-muted">{o.businessDate}</span>
                </span>
                <span className="text-sm">{statusLabel(o.status)}</span>
                <span className="tabular text-sm font-semibold">{formatMoney(o.totals.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
