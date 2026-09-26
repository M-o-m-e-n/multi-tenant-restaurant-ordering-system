import type { TableStatus } from '@ros/shared';
import { useState } from 'react';

import { useAuth } from '../../features/auth/authStore';
import {
  type MapTable,
  useCleanTable,
  useCloseTable,
  useCreateTable,
  useSetTableStatus,
  useTables,
} from '../../features/table/tablesApi';
import { useT } from '../../i18n';
import { API_BASE, getAccessToken } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errorMessage';
import { buttonClass } from '../../shared/ui/buttonClass';

/** Each status carries an icon and a word as well as a colour (NFR-U3, WCAG 1.4.1). */
// The status word comes from the dictionary; icon and colour travel with it (NFR-U3).
const STATUS: Record<TableStatus, { icon: string; tile: string; chip: string }> = {
  FREE: { icon: '○', tile: 'border-ok/50', chip: 'text-ok' },
  SEATED: { icon: '●', tile: 'border-warn/60', chip: 'text-warn' },
  DIRTY: { icon: '⊘', tile: 'border-flame', chip: 'text-flame-text' },
};

/** Staff table map (TABLE-04): status at a glance, with close and clean actions. */
export function TableMapPage() {
  const { data, isLoading } = useTables();
  const user = useAuth((s) => s.user);
  const close = useCloseTable();
  const clean = useCleanTable();
  const setStatus = useSetTableStatus();
  const create = useCreateTable();
  const [message, setMessage] = useState<string | null>(null);
  const t = useT();
  const isAdmin = user?.role === 'ADMIN';

  const report = (err: unknown) => setMessage(errorMessage(err));

  if (isLoading || !data) {
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        {t.tables.loading}
      </p>
    );
  }

  const counts = data.reduce<Record<TableStatus, number>>(
    (acc, table) => ({ ...acc, [table.status]: acc[table.status] + 1 }),
    { FREE: 0, SEATED: 0, DIRTY: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-content px-5 pb-16 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.tables.title}</h1>
          <p className="text-sm text-ink-muted">
            {t.tables.summary(counts.FREE, counts.SEATED, counts.DIRTY)}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className={buttonClass('ghost')}
            onClick={() => {
              const number = window.prompt(t.tables.newNumber);
              if (number) create.mutate({ number, seats: 4 }, { onError: report });
            }}
          >
            {t.tables.add}
          </button>
        )}
      </div>

      {message && (
        <p
          role="alert"
          className="mt-4 rounded-icon border border-line-strong bg-surface p-3 text-sm"
        >
          {message}{' '}
          <button
            type="button"
            className="font-semibold text-flame-text"
            onClick={() => setMessage(null)}
          >
            {t.common.dismiss}
          </button>
        </p>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data
          .filter((table) => table.isActive)
          .map((table: MapTable, i: number) => {
            const s = STATUS[table.status];
            return (
              <li
                key={table.id}
                style={{ animationDelay: `${Math.min(i, 7) * 45}ms` }}
                className={`flex flex-col gap-3 rounded-card border-2 bg-card p-4 motion-safe:animate-rise ${s.tile}`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-display text-3xl font-bold">{table.number}</p>
                  <span className={`text-xs font-semibold ${s.chip}`}>
                    <span aria-hidden="true">{s.icon} </span>
                    {t.tables.status[table.status]}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">
                  {t.tables.seats(table.seats)} · {t.tables.openOrders(table.openOrders)}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {table.status === 'FREE' && (
                    <button
                      type="button"
                      className={buttonClass('ghost', 'sm')}
                      onClick={() =>
                        setStatus.mutate({ id: table.id, status: 'SEATED' }, { onError: report })
                      }
                    >
                      {t.tables.seat}
                    </button>
                  )}
                  {table.status === 'SEATED' && (
                    <button
                      type="button"
                      className={buttonClass('ghost', 'sm')}
                      onClick={() => close.mutate(table.id, { onError: report })}
                    >
                      {t.tables.close}
                    </button>
                  )}
                  {table.status === 'DIRTY' && (
                    <button
                      type="button"
                      className={buttonClass('primary', 'sm')}
                      onClick={() => clean.mutate(table.id, { onError: report })}
                    >
                      {t.tables.clean}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-ink-muted hover:text-ink"
                      onClick={() => void openQr(table.id)}
                    >
                      {t.tables.qr}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </main>
  );
}

/** The QR route needs the bearer token, so fetch the image rather than follow a link. */
async function openQr(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tables/${id}/qr.svg`, {
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    credentials: 'include',
  });
  if (!res.ok) return;
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank', 'noopener');
}
