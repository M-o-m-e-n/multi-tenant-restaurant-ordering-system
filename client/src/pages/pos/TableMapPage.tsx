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
import { API_BASE, ApiError, getAccessToken } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';

/** Each status carries an icon and a word as well as a colour (NFR-U3, WCAG 1.4.1). */
const STATUS: Record<TableStatus, { label: string; icon: string; tile: string; chip: string }> = {
  FREE: { label: 'Free', icon: '○', tile: 'border-ok/50', chip: 'text-ok' },
  SEATED: { label: 'Seated', icon: '●', tile: 'border-warn/60', chip: 'text-warn' },
  DIRTY: { label: 'Needs clearing', icon: '⊘', tile: 'border-flame', chip: 'text-flame-text' },
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
  const isAdmin = user?.role === 'ADMIN';

  const report = (err: unknown) =>
    setMessage(err instanceof ApiError ? err.message : 'That did not work. Try again.');

  if (isLoading || !data) {
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Loading tables…
      </p>
    );
  }

  const counts = data.reduce<Record<TableStatus, number>>(
    (acc, t) => ({ ...acc, [t.status]: acc[t.status] + 1 }),
    { FREE: 0, SEATED: 0, DIRTY: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-content px-5 pb-16 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Tables</h1>
          <p className="text-sm text-ink-muted">
            {counts.FREE} free · {counts.SEATED} seated · {counts.DIRTY} need clearing
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className={buttonClass('ghost')}
            onClick={() => {
              const number = window.prompt('New table number');
              if (number) create.mutate({ number, seats: 4 }, { onError: report });
            }}
          >
            Add table
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
            Dismiss
          </button>
        </p>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data
          .filter((t) => t.isActive)
          .map((t: MapTable) => {
            const s = STATUS[t.status];
            return (
              <li
                key={t.id}
                className={`flex flex-col gap-3 rounded-card border-2 bg-card p-4 ${s.tile}`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-display text-3xl font-bold">{t.number}</p>
                  <span className={`text-xs font-semibold ${s.chip}`}>
                    <span aria-hidden="true">{s.icon} </span>
                    {s.label}
                  </span>
                </div>
                <p className="text-xs text-ink-muted">
                  {t.seats} seats · {t.openOrders} open order{t.openOrders === 1 ? '' : 's'}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {t.status === 'FREE' && (
                    <button
                      type="button"
                      className={buttonClass('ghost', 'sm')}
                      onClick={() =>
                        setStatus.mutate({ id: t.id, status: 'SEATED' }, { onError: report })
                      }
                    >
                      Seat
                    </button>
                  )}
                  {t.status === 'SEATED' && (
                    <button
                      type="button"
                      className={buttonClass('ghost', 'sm')}
                      onClick={() => close.mutate(t.id, { onError: report })}
                    >
                      Close
                    </button>
                  )}
                  {t.status === 'DIRTY' && (
                    <button
                      type="button"
                      className={buttonClass('primary', 'sm')}
                      onClick={() => clean.mutate(t.id, { onError: report })}
                    >
                      Mark clean
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-ink-muted hover:text-ink"
                      onClick={() => void openQr(t.id)}
                    >
                      QR code
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
