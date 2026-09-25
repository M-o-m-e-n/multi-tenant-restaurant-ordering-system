import { useState } from 'react';

import {
  addDays,
  type Range,
  toCsv,
  useDashboard,
  useReports,
} from '../../features/admin/adminApi';
import { AdminNav } from '../../features/admin/AdminNav';
import { BarChartCard } from '../../features/admin/charts';
import { StatTile } from '../../features/admin/StatTile';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { formValue } from '../../shared/ui/formValue';

const TYPE_LABEL = { DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' } as const;
const METHOD_LABEL = { STRIPE: 'Card', CASH: 'Cash' } as const;

/** Every hour from the first to the last with orders, zeros included, so gaps read as gaps. */
function hourSeries(peak: { hour: number; orders: number }[]) {
  if (peak.length === 0) return [];
  const first = Math.min(...peak.map((p) => p.hour));
  const last = Math.max(...peak.map((p) => p.hour));
  return Array.from({ length: last - first + 1 }, (_, i) => ({
    label: `${String(first + i).padStart(2, '0')}:00`,
    value: peak.find((p) => p.hour === first + i)?.orders ?? 0,
  }));
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reports (RPT-01…07) over business dates, on one revenue definition (BR-16):
 * net sales exclude tax, service charge, delivery fees and tips, which appear as
 * their own figures. Every chart has a table beside or below it.
 */
export function ReportsPage() {
  const { data: today } = useDashboard();
  const [preset, setPreset] = useState<7 | 30 | 90>(30);
  const [custom, setCustom] = useState<Range | null>(null);
  const range: Range | null =
    custom ??
    (today ? { from: addDays(today.businessDate, -(preset - 1)), to: today.businessDate } : null);
  const { data: r, isLoading, isError } = useReports(range);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 pb-16 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Reports</h1>
          <p className="text-sm text-ink-muted">
            {range ? `${range.from} to ${range.to} · business dates` : '…'}
          </p>
        </div>
        <AdminNav />
      </div>

      <div role="group" aria-label="Date range" className="flex flex-wrap items-end gap-2">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={!custom && preset === d}
            onClick={() => {
              setCustom(null);
              setPreset(d);
            }}
            className={`min-h-11 rounded-btn border px-4 text-sm font-semibold ${!custom && preset === d ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised'}`}
          >
            Last {d} days
          </button>
        ))}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const from = formValue(f, 'from');
            const to = formValue(f, 'to');
            if (from && to && from <= to) setCustom({ from, to });
          }}
        >
          <label className="flex flex-col text-xs text-ink-muted">
            From
            <input
              name="from"
              type="date"
              defaultValue={range?.from}
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col text-xs text-ink-muted">
            To
            <input
              name="to"
              type="date"
              defaultValue={range?.to}
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink"
            />
          </label>
          <button type="submit" className={buttonClass('ghost')}>
            Apply
          </button>
        </form>
        {r && range && (
          <button
            type="button"
            className={`${buttonClass('ghost')} ml-auto`}
            onClick={() =>
              download(
                `revenue-${range.from}-to-${range.to}.csv`,
                toCsv(
                  r.byDay.map((d) => ({
                    business_date: d.businessDate,
                    orders: d.orders,
                    net_sales_cents: d.netSales,
                  })),
                ),
              )
            }
          >
            Export CSV
          </button>
        )}
      </div>

      {isError && (
        <p role="alert" className="text-flame-text">
          The reports did not load.
        </p>
      )}
      {isLoading || !r ? (
        <p role="status" className="text-ink-muted">
          Crunching the numbers…
        </p>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Net sales"
              value={formatMoney(r.summary.netSales)}
              note="Excludes tax, service, delivery and tips"
            />
            <StatTile label="Orders" value={r.summary.orders} />
            <StatTile label="Average order" value={formatMoney(r.summary.aov)} />
            <StatTile
              label="Tips"
              value={formatMoney(r.summary.tips)}
              note="Reported separately from sales"
            />
            <StatTile label="Tax collected" value={formatMoney(r.summary.taxCollected)} />
            <StatTile label="Service charge" value={formatMoney(r.summary.serviceCharge)} />
            <StatTile label="Delivery fees" value={formatMoney(r.summary.deliveryFees)} />
            <StatTile
              label="Collected"
              value={formatMoney(r.breakdowns.byMethod.reduce((s, m) => s + m.collected, 0))}
              note="From payment records, net of refunds"
            />
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-bold">Net sales per day</h2>
            <BarChartCard
              title="Net sales per business day"
              kind="money"
              height={280}
              data={r.byDay.map((d) => ({ label: d.businessDate.slice(5), value: d.netSales }))}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">Orders by hour</h2>
              <p className="text-xs text-ink-muted">Restaurant local time</p>
              <BarChartCard
                title="Orders by hour of day, local time"
                kind="count"
                data={hourSeries(r.peak)}
              />
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">Top dishes</h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-ink-muted">
                    <th className="pb-2 font-medium">Dish</th>
                    <th className="pb-2 text-right font-medium">Sold</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {r.top.map((t) => {
                    const max = r.top[0]?.qty ?? 1;
                    return (
                      <tr key={t.menuItemId ?? t.name} className="border-t border-line">
                        <td className="py-2">
                          {t.name}
                          <span
                            aria-hidden="true"
                            className="mt-1 block h-1.5 rounded-full bg-flame-light"
                            style={{ width: `${Math.max(6, (t.qty / max) * 100)}%` }}
                          />
                        </td>
                        <td className="py-2 text-right">{t.qty}</td>
                        <td className="py-2 text-right">{formatMoney(t.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">By order type</h2>
              <table className="mt-3 w-full text-sm tabular">
                <tbody>
                  {r.breakdowns.byType.map((t) => (
                    <tr key={t.type} className="border-t border-line first:border-0">
                      <td className="py-2">{TYPE_LABEL[t.type]}</td>
                      <td className="py-2 text-right text-ink-muted">{t.orders} orders</td>
                      <td className="py-2 text-right">{formatMoney(t.netSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">Collected by method</h2>
              <table className="mt-3 w-full text-sm tabular">
                <tbody>
                  {r.breakdowns.byMethod.map((m) => (
                    <tr key={m.method} className="border-t border-line first:border-0">
                      <td className="py-2">{METHOD_LABEL[m.method]}</td>
                      <td className="py-2 text-right">{formatMoney(m.collected)}</td>
                      <td className="py-2 text-right text-ink-muted">
                        +{formatMoney(m.tips)} tips
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">Cancellations & refunds</h2>
              <p className="mt-2 text-sm">
                {r.cancellations.cancelled.length} cancelled · {r.cancellations.refunded.length}{' '}
                refunded
              </p>
              <ul
                tabIndex={0}
                aria-label="Cancelled orders"
                className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-ink-muted"
              >
                {r.cancellations.cancelled.slice(0, 20).map((c) => (
                  <li key={c.orderId}>
                    {c.businessDate} · {c.orderNumber} · {c.reason ?? 'no reason given'}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
