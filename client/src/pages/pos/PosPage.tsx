import type { OrderDto } from '@ros/shared';
import { useState } from 'react';

import { paymentLabel, statusLabel } from '../../features/orders/status';
import { CashDialog } from '../../features/pos/CashDialog';
import { OrderPanel } from '../../features/pos/OrderPanel';
import { usePosOrders } from '../../features/pos/posApi';
import { useT } from '../../i18n';
import { formatMoney } from '../../shared/money';

type Filter = 'unpaid' | 'open' | 'all';
const FILTERS: {
  id: Filter;
  label: 'toPay' | 'open' | 'recent';
  test: (o: OrderDto) => boolean;
}[] = [
  { id: 'unpaid', label: 'toPay', test: (o) => o.balanceDue > 0 && o.status !== 'CANCELLED' },
  { id: 'open', label: 'open', test: (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' },
  { id: 'all', label: 'recent', test: () => true },
];

/** The till (SRS §5.1 POS): recent orders on the left, the selected one on the right. */
export function PosPage() {
  const { data, isLoading } = usePosOrders();
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cashFor, setCashFor] = useState<OrderDto | null>(null);
  const t = useT();

  if (isLoading)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        {t.pos.loading}
      </p>
    );
  const orders = (data ?? []).filter(FILTERS.find((f) => f.id === filter)?.test ?? (() => true));
  const selected = data?.find((o) => o.id === selectedId) ?? null;

  return (
    <main className="mx-auto grid w-full max-w-content gap-6 px-5 pb-16 md:grid-cols-[1fr_1.1fr] md:px-8">
      <section aria-labelledby="pos-title">
        <h1 id="pos-title" className="font-display text-3xl font-bold">
          {t.pos.title}
        </h1>
        <div role="group" aria-label={t.pos.show} className="mt-3 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`min-h-11 rounded-btn border px-4 text-sm font-semibold ${filter === f.id ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised'}`}
            >
              {t.pos[f.label]}
            </button>
          ))}
        </div>
        <ul className="mt-4 flex flex-col gap-2">
          {orders.length === 0 && (
            <li className="py-8 text-center text-ink-muted">{t.pos.empty}</li>
          )}
          {orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelectedId(o.id)}
                aria-current={o.id === selectedId}
                className={`flex w-full items-center justify-between gap-3 rounded-icon border p-3 text-start ${o.id === selectedId ? 'border-flame bg-surface-raised' : 'border-line bg-surface hover:border-line-strong'}`}
              >
                <span>
                  <span className="font-display text-xl font-bold">{o.orderNumber}</span>
                  <span className="ms-2 text-xs text-ink-muted">
                    {o.table
                      ? t.common.table(o.table.number)
                      : o.type === 'DELIVERY'
                        ? t.cart.delivery
                        : t.cart.takeaway}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {statusLabel(o.status)} · {paymentLabel(o.paymentStatus)}
                  </span>
                </span>
                <span className="tabular text-sm font-semibold">
                  {o.balanceDue > 0 ? (
                    <span className="text-flame-text">{t.pos.owed(formatMoney(o.balanceDue))}</span>
                  ) : (
                    formatMoney(o.totals.total)
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <div>
        {selected ? (
          <OrderPanel order={selected} onTakeCash={setCashFor} />
        ) : (
          <p className="rounded-card border border-dashed border-line-strong p-10 text-center text-ink-muted">
            {t.pos.choose}
          </p>
        )}
      </div>
      <CashDialog order={cashFor} onClose={() => setCashFor(null)} />
    </main>
  );
}
