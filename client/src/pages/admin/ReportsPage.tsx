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
import { useT } from '../../i18n';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { formValue } from '../../shared/ui/formValue';

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
  const t = useT();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 pb-16 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.reports.title}</h1>
          <p className="text-sm text-ink-muted">
            {range ? t.reports.rangeLabel(range.from, range.to) : '…'}
          </p>
        </div>
        <AdminNav />
      </div>

      <div role="group" aria-label={t.reports.range} className="flex flex-wrap items-end gap-2">
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
            {t.reports.lastDays(d)}
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
            {t.reports.from}
            <input
              name="from"
              type="date"
              defaultValue={range?.from}
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink"
            />
          </label>
          <label className="flex flex-col text-xs text-ink-muted">
            {t.reports.to}
            <input
              name="to"
              type="date"
              defaultValue={range?.to}
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink"
            />
          </label>
          <button type="submit" className={buttonClass('ghost')}>
            {t.reports.apply}
          </button>
        </form>
        {r && range && (
          <button
            type="button"
            className={`${buttonClass('ghost')} ms-auto`}
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
            {t.reports.exportCsv}
          </button>
        )}
      </div>

      {isError && (
        <p role="alert" className="text-flame-text">
          {t.reports.failed}
        </p>
      )}
      {isLoading || !r ? (
        <p role="status" className="text-ink-muted">
          {t.reports.loading}
        </p>
      ) : (
        <>
          <section aria-label={t.reports.summary} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label={t.reports.netSales}
              value={formatMoney(r.summary.netSales)}
              note={t.reports.netSalesNote}
            />
            <StatTile label={t.reports.orders} value={r.summary.orders} />
            <StatTile label={t.reports.aov} value={formatMoney(r.summary.aov)} />
            <StatTile
              label={t.reports.tips}
              value={formatMoney(r.summary.tips)}
              note={t.reports.tipsNote}
            />
            <StatTile label={t.reports.tax} value={formatMoney(r.summary.taxCollected)} />
            <StatTile label={t.reports.service} value={formatMoney(r.summary.serviceCharge)} />
            <StatTile label={t.reports.deliveryFees} value={formatMoney(r.summary.deliveryFees)} />
            <StatTile
              label={t.reports.collected}
              value={formatMoney(r.breakdowns.byMethod.reduce((s, m) => s + m.collected, 0))}
              note={t.reports.collectedNote}
            />
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-bold">{t.reports.perDay}</h2>
            <BarChartCard
              title={t.reports.perDayCaption}
              kind="money"
              height={280}
              data={r.byDay.map((d) => ({ label: d.businessDate.slice(5), value: d.netSales }))}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">{t.reports.byHour}</h2>
              <p className="text-xs text-ink-muted">{t.reports.localTime}</p>
              <BarChartCard
                title={t.reports.byHourCaption}
                kind="count"
                data={hourSeries(r.peak)}
              />
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">{t.reports.topDishes}</h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-wider text-ink-muted">
                    <th className="pb-2 text-start font-medium">{t.reports.dish}</th>
                    <th className="pb-2 text-end font-medium">{t.reports.sold}</th>
                    <th className="pb-2 text-end font-medium">{t.reports.revenue}</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {r.top.map((dish) => {
                    const max = r.top[0]?.qty ?? 1;
                    return (
                      <tr key={dish.menuItemId ?? dish.name} className="border-t border-line">
                        <td className="py-2">
                          {dish.name}
                          <span
                            aria-hidden="true"
                            className="mt-1 block h-1.5 rounded-full bg-flame-light"
                            style={{ width: `${Math.max(6, (dish.qty / max) * 100)}%` }}
                          />
                        </td>
                        <td className="py-2 text-end">{dish.qty}</td>
                        <td className="py-2 text-end">{formatMoney(dish.revenue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">{t.reports.byType}</h2>
              <table className="mt-3 w-full text-sm tabular">
                <tbody>
                  {r.breakdowns.byType.map((row) => (
                    <tr key={row.type} className="border-t border-line first:border-0">
                      <td className="py-2">{t.reports.type[row.type]}</td>
                      <td className="py-2 text-end text-ink-muted">
                        {t.reports.ordersCount(row.orders)}
                      </td>
                      <td className="py-2 text-end">{formatMoney(row.netSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">{t.reports.byMethod}</h2>
              <table className="mt-3 w-full text-sm tabular">
                <tbody>
                  {r.breakdowns.byMethod.map((m) => (
                    <tr key={m.method} className="border-t border-line first:border-0">
                      <td className="py-2">{t.reports.method[m.method]}</td>
                      <td className="py-2 text-end">{formatMoney(m.collected)}</td>
                      <td className="py-2 text-end text-ink-muted">
                        {t.reports.tipsAmount(formatMoney(m.tips))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">{t.reports.cancellations}</h2>
              <p className="mt-2 text-sm">
                {t.reports.cancelledCount(
                  r.cancellations.cancelled.length,
                  r.cancellations.refunded.length,
                )}
              </p>
              <ul
                tabIndex={0}
                aria-label={t.reports.cancelledList}
                className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto text-xs text-ink-muted"
              >
                {r.cancellations.cancelled.slice(0, 20).map((c) => (
                  <li key={c.orderId}>
                    {c.businessDate} · {c.orderNumber} · {c.reason ?? t.reports.noReason}
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
