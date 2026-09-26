import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { DeliveryProgress } from '../../features/delivery/DeliveryPanel';
import { AddToOrderDialog } from '../../features/orders/AddToOrderDialog';
import { useCancelOrder, useOrder, useOrderEvents } from '../../features/orders/ordersApi';
import { paymentLabel, statusLabel, TRACKER_STEPS } from '../../features/orders/status';
import { usePaymentsConfig } from '../../features/payments/paymentsApi';
import { useT } from '../../i18n';
import { ApiError } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errorMessage';
import { formatTime } from '../../shared/format';
import { formatMoney } from '../../shared/money';
import { useWatchOrder } from '../../shared/realtime/useWatchOrder';
import { buttonClass } from '../../shared/ui/buttonClass';

/**
 * Live order tracker (ORD-07): a step for every status, each labelled in text,
 * the audit timeline, and a cancel button only when the state machine allows it.
 */
export function OrderTrackerPage() {
  const { id = '' } = useParams();
  const { data: order, isLoading, error } = useOrder(id);
  useWatchOrder(order ? id : undefined);
  const { data: events } = useOrderEvents(id, order?.status);
  const cancel = useCancelOrder(id);
  const { data: payConfig } = usePaymentsConfig();
  const [adding, setAdding] = useState(false);
  const t = useT();

  if (isLoading)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        {t.tracker.loading}
      </p>
    );
  if (error || !order) {
    const missing = error instanceof ApiError && error.code === 'ORDER_NOT_FOUND';
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">
          {missing ? t.tracker.notFound : t.tracker.notLoaded}
        </h1>
        <Link to="/orders" className={`${buttonClass('ghost')} mt-6`}>
          {t.tracker.yourOrders}
        </Link>
      </main>
    );
  }

  const cancelled = order.status === 'CANCELLED';
  const currentIndex = TRACKER_STEPS.indexOf(order.status);

  return (
    <main className="mx-auto grid w-full max-w-content gap-8 px-5 pb-16 md:grid-cols-[1.3fr_1fr] md:px-10">
      <section aria-labelledby="order-title">
        <p className="text-sm text-ink-muted">
          {t.tracker.placedAt(
            order.table
              ? t.common.table(order.table.number)
              : order.type === 'DELIVERY'
                ? t.cart.delivery
                : t.cart.takeaway,
            formatTime(order.placedAt),
          )}
        </p>
        <h1 id="order-title" className="font-display text-4xl font-bold">
          {t.tracker.title(order.orderNumber)}
        </h1>
        <p className="mt-2 text-lg" aria-live="polite">
          {statusLabel(order.status)}
        </p>

        {order.delivery && !cancelled && <DeliveryProgress delivery={order.delivery} />}

        {cancelled ? (
          <p className="mt-6 rounded-icon border border-flame p-4 text-sm">
            {t.tracker.cancelled}
            {order.paymentStatus === 'PAID' && t.tracker.refundNote}
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-0" aria-label={t.tracker.progress}>
            {TRACKER_STEPS.map((step, i) => {
              const done = i < currentIndex;
              const now = i === currentIndex;
              const at = events?.find((e) => e.toStatus === step)?.at;
              return (
                <li key={step} className="flex gap-4" aria-current={now ? 'step' : undefined}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors duration-500 ${
                        now
                          ? 'border-flame bg-flame text-white motion-safe:animate-pulse'
                          : done
                            ? 'border-ok text-ok'
                            : 'border-line-strong text-ink-muted'
                      }`}
                      aria-hidden="true"
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    {i < TRACKER_STEPS.length - 1 && (
                      <span
                        className={`w-0.5 flex-1 transition-colors duration-500 ${done ? 'bg-ok' : 'bg-line'}`}
                      />
                    )}
                  </div>
                  <div className="pb-6">
                    <p
                      className={`font-semibold ${now ? 'text-ink' : done ? 'text-ink' : 'text-ink-muted'}`}
                    >
                      {statusLabel(step)}
                      <span className="sr-only">
                        {done ? t.tracker.done : now ? t.tracker.current : t.tracker.toCome}
                      </span>
                    </p>
                    {at && <p className="text-xs text-ink-muted">{formatTime(at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {order.isAmendable && (
            <button type="button" className={buttonClass('ghost')} onClick={() => setAdding(true)}>
              {t.tracker.addMore}
            </button>
          )}
          <Link to={`/orders/${order.id}/receipt`} className={buttonClass('ghost')}>
            {t.tracker.receipt}
          </Link>
        </div>
        <AddToOrderDialog order={adding ? order : null} onClose={() => setAdding(false)} />

        {order.nextStatuses.includes('CANCELLED') && (
          <button
            type="button"
            className={buttonClass('danger')}
            disabled={cancel.isPending}
            onClick={() => {
              if (window.confirm(t.tracker.cancelConfirm)) cancel.mutate(t.tracker.cancelReason);
            }}
          >
            {cancel.isPending ? t.tracker.cancelling : t.tracker.cancel}
          </button>
        )}
        {cancel.error instanceof ApiError && (
          <p role="alert" className="mt-2 text-sm text-flame-text">
            {errorMessage(cancel.error)}
          </p>
        )}
      </section>

      <aside className="flex h-fit flex-col gap-3 rounded-card border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{t.tracker.yourOrder}</h2>
          <span className="rounded-btn border border-line-strong px-3 py-1 text-xs font-semibold">
            {paymentLabel(order.paymentStatus)}
          </span>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>
                {i.qty} × {i.nameSnapshot}
                {i.modifiers.length > 0 && (
                  <span className="block text-xs text-ink-muted">
                    {i.modifiers.flatMap((g) => g.items.map((m) => m.name)).join(t.common.listSep)}
                  </span>
                )}
              </span>
              <span className="tabular">{formatMoney(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="tabular flex flex-col gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between font-bold">
            <dt>{t.totals.total}</dt>
            <dd>{formatMoney(order.totals.total)}</dd>
          </div>
          {order.balanceDue > 0 && !cancelled && (
            <div className="flex justify-between text-ink-muted">
              <dt>{t.totals.stillToPay}</dt>
              <dd>{formatMoney(order.balanceDue)}</dd>
            </div>
          )}
        </dl>
        {order.balanceDue > 0 &&
          !cancelled &&
          (payConfig?.cardEnabled ? (
            <Link to={`/orders/${order.id}/pay`} className={buttonClass('primary', 'lg')}>
              {t.tracker.payByCard(formatMoney(order.balanceDue))}
            </Link>
          ) : (
            <p className="text-xs text-ink-muted">{t.tracker.payStaff}</p>
          ))}
      </aside>
    </main>
  );
}
