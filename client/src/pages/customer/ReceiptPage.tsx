import type { ReceiptDto } from '@ros/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { api } from '../../shared/api/client';
import { formatDelta, formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * A printable receipt (PRINT-01): every total component on its own line, the
 * tip separate from sales (TIP-04), and the payments. Built from the order's
 * snapshots only (PRINT-02). Prints black on white (fork-flame-ui §6).
 */
export function ReceiptPage() {
  const { id = '' } = useParams();
  const { data: r, isLoading } = useQuery({
    queryKey: ['order', id, 'receipt'],
    queryFn: () => api<ReceiptDto>(`/orders/${id}/receipt`),
  });
  if (isLoading || !r)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Loading receipt…
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
          ← Back
        </Link>
        <button
          type="button"
          className={buttonClass('primary', 'sm')}
          onClick={() => window.print()}
        >
          Print receipt
        </button>
      </div>
      <article className="rounded-card border border-line bg-white p-6 font-sans text-sm text-ink-inverse print:border-0 print:p-0">
        <header className="text-center">
          <h1 className="font-display text-2xl font-bold">{r.restaurant.name}</h1>
          <p className="mt-1">Order {r.orderNumber}</p>
          <p className="text-xs">
            {r.table ? `Table ${r.table}` : r.type === 'DELIVERY' ? 'Delivery' : 'Takeaway'} ·
            business date {r.businessDate}
          </p>
          <p className="text-xs">Placed {when(r.placedAt)}</p>
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
                <p key={m.name} className="pl-4 text-xs">
                  + {m.name} {formatDelta(m.priceDelta)}
                </p>
              ))}
              {l.notes && <p className="pl-4 text-xs italic">“{l.notes}”</p>}
            </li>
          ))}
        </ul>
        <hr className="my-4 border-dashed border-ink-inverse/30" />
        <dl className="flex flex-col gap-1">
          {row('Subtotal', r.totals.subtotal)}
          {r.totals.discountAmount > 0 &&
            row(
              `Discount${r.discountCode ? ` (${r.discountCode})` : ''}`,
              -r.totals.discountAmount,
            )}
          {r.totals.serviceCharge > 0 && row('Service charge', r.totals.serviceCharge)}
          {row('Tax', r.totals.taxAmount)}
          {r.totals.deliveryFee > 0 && row('Delivery fee', r.totals.deliveryFee)}
          {r.totals.tipAmount > 0 && row('Tip', r.totals.tipAmount)}
          {row('Total', r.totals.total, true)}
        </dl>
        {r.payments.length > 0 && (
          <>
            <hr className="my-4 border-dashed border-ink-inverse/30" />
            <ul className="flex flex-col gap-1 text-xs">
              {r.payments.map((p, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {p.method === 'CASH' ? 'Cash' : 'Card'} · {when(p.at)}
                    {p.state === 'REFUNDED' && ' · refunded'}
                    {p.tipAmount > 0 && ` · cash tip ${formatMoney(p.tipAmount)}`}
                  </span>
                  <span className="tabular">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-4 text-center text-xs">
          {r.paymentStatus === 'PAID'
            ? 'Paid in full — thank you!'
            : r.paymentStatus === 'REFUNDED'
              ? 'Refunded'
              : `Balance due ${formatMoney(r.balanceDue)}`}
        </p>
      </article>
    </main>
  );
}
