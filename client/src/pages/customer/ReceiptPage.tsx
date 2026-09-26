import type { ReceiptDto } from '@ros/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { useT } from '../../i18n';
import { api } from '../../shared/api/client';
import { formatDateTime } from '../../shared/format';
import { formatDelta, formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';

/**
 * A printable receipt (PRINT-01): every total component on its own line, the
 * tip separate from sales (TIP-04), and the payments. Built from the order's
 * snapshots only (PRINT-02). Prints black on white (fork-flame-ui §6).
 */
export function ReceiptPage() {
  const { id = '' } = useParams();
  const t = useT();
  const { data: r, isLoading } = useQuery({
    queryKey: ['order', id, 'receipt'],
    queryFn: () => api<ReceiptDto>(`/orders/${id}/receipt`),
  });
  if (isLoading || !r)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        {t.receipt.loading}
      </p>
    );

  const row = (label: string, cents: number, strong = false) => (
    <div className={`flex justify-between ${strong ? 'text-base font-bold' : ''}`}>
      <dt>{label}</dt>
      <dd className="tabular">{cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents)}</dd>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 print:max-w-none print:p-0">
      <div className="mb-4 flex justify-between gap-3 print:hidden">
        <Link to={`/orders/${r.orderId}`} className={buttonClass('ghost', 'sm')}>
          {t.receipt.back}
        </Link>
        <button
          type="button"
          className={buttonClass('primary', 'sm')}
          onClick={() => window.print()}
        >
          {t.receipt.print}
        </button>
      </div>
      <article className="rounded-card border border-line bg-white p-6 font-sans text-sm text-ink-inverse print:border-0 print:p-0">
        <header className="text-center">
          <h1 className="font-display text-2xl font-bold">{r.restaurant.name}</h1>
          <p className="mt-1">{t.receipt.order(r.orderNumber)}</p>
          <p className="text-xs">
            {t.receipt.businessDate(
              r.table
                ? t.common.table(r.table)
                : r.type === 'DELIVERY'
                  ? t.cart.delivery
                  : t.cart.takeaway,
              r.businessDate,
            )}
          </p>
          <p className="text-xs">{t.receipt.placed(formatDateTime(r.placedAt))}</p>
        </header>
        <hr className="my-4 border-dashed border-ink-inverse/30" />
        <ul className="flex flex-col gap-2">
          {r.lines.map((l, i) => (
            <li key={i}>
              <div className="flex justify-between gap-3">
                <span>
                  {l.qty} × {l.name} <span className="text-xs">@ {formatMoney(l.unitPrice)}</span>
                </span>
                <span className="tabular">{formatMoney(l.lineTotal)}</span>
              </div>
              {l.modifiers.map((m) => (
                <p key={m.name} className="ps-4 text-xs">
                  + {m.name} {formatDelta(m.priceDelta)}
                </p>
              ))}
              {l.notes && <p className="ps-4 text-xs italic">“{l.notes}”</p>}
            </li>
          ))}
        </ul>
        <hr className="my-4 border-dashed border-ink-inverse/30" />
        <dl className="flex flex-col gap-1">
          {row(t.totals.subtotal, r.totals.subtotal)}
          {r.totals.discountAmount > 0 &&
            row(t.receipt.discount(r.discountCode), -r.totals.discountAmount)}
          {r.totals.serviceCharge > 0 && row(t.totals.serviceCharge, r.totals.serviceCharge)}
          {row(t.totals.tax, r.totals.taxAmount)}
          {r.totals.deliveryFee > 0 && row(t.receipt.deliveryFee, r.totals.deliveryFee)}
          {r.totals.tipAmount > 0 && row(t.totals.tip, r.totals.tipAmount)}
          {row(t.totals.total, r.totals.total, true)}
        </dl>
        {r.payments.length > 0 && (
          <>
            <hr className="my-4 border-dashed border-ink-inverse/30" />
            <ul className="flex flex-col gap-1 text-xs">
              {r.payments.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {p.method === 'CASH' ? t.receipt.cash : t.receipt.card} · {formatDateTime(p.at)}
                    {p.state === 'REFUNDED' && t.receipt.refunded}
                    {p.tipAmount > 0 && t.receipt.cashTip(formatMoney(p.tipAmount))}
                  </span>
                  <span className="tabular">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-center text-xs">
          {r.paymentStatus === 'PAID'
            ? t.receipt.paidInFull
            : r.paymentStatus === 'REFUNDED'
              ? t.receipt.refundedAll
              : t.receipt.balanceDue(formatMoney(r.balanceDue))}
        </p>
      </article>
    </main>
  );
}
