import type { OrderDto, OrderStatus } from '@ros/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ApiError } from '../../shared/api/client';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { useAuth } from '../auth/authStore';
import { DeliveryPanel } from '../delivery/DeliveryPanel';
import { AddToOrderDialog } from '../orders/AddToOrderDialog';
import { paymentLabel, statusLabel } from '../orders/status';
import { useOrderPayments, useRefund } from '../payments/paymentsApi';
import { useTransition } from './posApi';

const ACTION: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirm',
  PREPARING: 'Start cooking',
  READY: 'Mark ready',
  SERVED: 'Mark served',
  COMPLETED: 'Complete',
  CANCELLED: 'Cancel order',
};

/** One order at the till: its lines, money, payments and the actions allowed now. */
export function OrderPanel({
  order,
  onTakeCash,
}: {
  order: OrderDto;
  onTakeCash: (o: OrderDto) => void;
}) {
  const isAdmin = useAuth((s) => s.user?.role === 'ADMIN');
  const payments = useOrderPayments(order.id);
  const transition = useTransition();
  const refund = useRefund();
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const report = (err: unknown) =>
    setMessage(err instanceof ApiError ? err.message : 'That did not work.');
  const refundable =
    isAdmin &&
    (order.status === 'COMPLETED' || order.status === 'CANCELLED') &&
    order.amountPaid > 0;

  return (
    <section
      aria-label={`Order ${order.orderNumber}`}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-bold">{order.orderNumber}</h2>
          <p className="text-sm text-ink-muted">
            {order.table
              ? `Table ${order.table.number}`
              : order.type === 'DELIVERY'
                ? 'Delivery'
                : 'Takeaway'}
            {order.customer?.name && ` · ${order.customer.name}`}
            {order.customer?.phone && ` · ${order.customer.phone}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <span className="font-semibold">{statusLabel(order.status)}</span>
          <span className="text-ink-muted">{paymentLabel(order.paymentStatus)}</span>
        </div>
      </header>

      <ul className="flex flex-col gap-1.5 text-sm">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.qty} × {i.nameSnapshot}
              {i.modifiers.length > 0 && (
                <span className="block text-xs text-ink-muted">
                  {i.modifiers.flatMap((g) => g.items.map((m) => m.name)).join(', ')}
                </span>
              )}
            </span>
            <span className="tabular">{formatMoney(i.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="tabular grid grid-cols-2 gap-1 border-t border-line pt-3 text-sm">
        <dt className="text-ink-muted">Total</dt>
        <dd className="text-right font-bold">{formatMoney(order.totals.total)}</dd>
        <dt className="text-ink-muted">Paid</dt>
        <dd className="text-right">{formatMoney(order.amountPaid)}</dd>
        <dt className="text-ink-muted">Still owed</dt>
        <dd className="text-right font-semibold text-flame-text">
          {formatMoney(order.balanceDue)}
        </dd>
      </dl>

      {order.delivery && <DeliveryPanel orderId={order.id} delivery={order.delivery} />}

      {payments.data && payments.data.data.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-ink-muted">
          {payments.data.data.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>
                {p.method === 'CASH' ? 'Cash' : 'Card'} · {p.state.toLowerCase()}
                {p.actor && ` · ${p.actor.name}`}
                {p.tipAmount > 0 && ` · tip ${formatMoney(p.tipAmount)}`}
              </span>
              <span className="tabular">{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="alert" className="text-sm text-flame-text">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {order.balanceDue > 0 && order.status !== 'CANCELLED' && (
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => onTakeCash(order)}
          >
            Take cash
          </button>
        )}
        {order.nextStatuses.map((to) => (
          <button
            key={to}
            type="button"
            className={buttonClass(to === 'CANCELLED' ? 'danger' : 'ghost')}
            disabled={transition.isPending}
            onClick={() => {
              if (to === 'CANCELLED' && !window.confirm(`Cancel ${order.orderNumber}?`)) return;
              setMessage(null);
              transition.mutate({ id: order.id, to }, { onError: report });
            }}
          >
            {ACTION[to] ?? to}
          </button>
        ))}
        {order.isAmendable && (
          <button type="button" className={buttonClass('ghost')} onClick={() => setAdding(true)}>
            Add items
          </button>
        )}
        <Link to={`/orders/${order.id}/receipt`} className={buttonClass('ghost')}>
          Receipt
        </Link>
        {refundable && (
          <button
            type="button"
            className={buttonClass('danger')}
            disabled={refund.isPending}
            onClick={() => {
              const reason = window.prompt('Reason for the refund');
              if (reason) refund.mutate({ orderId: order.id, reason }, { onError: report });
            }}
          >
            Refund
          </button>
        )}
      </div>
      <AddToOrderDialog order={adding ? order : null} onClose={() => setAdding(false)} />
    </section>
  );
}
