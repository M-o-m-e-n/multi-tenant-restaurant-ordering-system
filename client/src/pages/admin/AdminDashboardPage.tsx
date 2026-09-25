import { Link } from 'react-router-dom';

import { addDays, useDashboard, useReports } from '../../features/admin/adminApi';
import { AdminNav } from '../../features/admin/AdminNav';
import { BarChartCard } from '../../features/admin/charts';
import { StatTile } from '../../features/admin/StatTile';
import { formatMoney } from '../../shared/money';

/** Today at a glance (ADM-01): live numbers, tables, the 86 list, and the last seven days. */
export function AdminDashboardPage() {
  const { data: today, isLoading } = useDashboard();
  const week = today ? { from: addDays(today.businessDate, -6), to: today.businessDate } : null;
  const { data: reports } = useReports(week);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 pb-16 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Today</h1>
          <p className="text-sm text-ink-muted">Business date {today?.businessDate ?? '…'}</p>
        </div>
        <AdminNav />
      </div>

      {isLoading || !today ? (
        <p role="status" className="text-ink-muted">
          Loading today’s numbers…
        </p>
      ) : (
        <>
          <section aria-label="Today" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Net sales"
              value={formatMoney(today.netSales)}
              note="Before tax, service and tips"
            />
            <StatTile label="Orders" value={today.orders} />
            <StatTile
              label="Active tickets"
              value={today.activeTickets}
              note="In the kitchen or waiting to be served"
            />
            <StatTile
              label="Tables"
              value={`${today.tables.seated} seated`}
              note={`${today.tables.free} free · ${today.tables.dirty} need clearing`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <div className="rounded-card border border-line bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-bold">Net sales, last 7 days</h2>
                <Link
                  to="/admin/reports"
                  className="text-sm font-semibold text-flame-text hover:underline"
                >
                  Full reports →
                </Link>
              </div>
              {reports ? (
                <BarChartCard
                  title="Net sales per business day, last 7 days"
                  kind="money"
                  data={reports.byDay.map((d) => ({
                    label: d.businessDate.slice(5),
                    value: d.netSales,
                  }))}
                />
              ) : (
                <p className="py-16 text-center text-sm text-ink-muted">Loading…</p>
              )}
            </div>
            <div className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-xl font-bold">86’d right now</h2>
              {today.unavailableItems.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">Everything is on the menu.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2 text-sm">
                  {today.unavailableItems.map((i) => (
                    <li key={i.id} className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-flame-text">
                        ⊘
                      </span>{' '}
                      {i.name}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                to="/admin/menu"
                className="mt-4 inline-block text-sm font-semibold text-flame-text hover:underline"
              >
                Manage the menu →
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
