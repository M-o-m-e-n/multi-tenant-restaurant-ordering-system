import {
  addDays,
  businessDateOf,
  createReservationSchema,
  type ReservationDto,
  zonedTimeToUtc,
} from '@ros/shared';
import { type FormEvent, useState } from 'react';

import { useSettings } from '../../features/cart/cartApi';
import {
  useCreateReservation,
  useReservations,
  useUpdateReservation,
} from '../../features/reservations/reservationsApi';
import { formatSlot, SLOT_TIMES, slotLabel } from '../../features/reservations/slots';
import { type MapTable, useTables } from '../../features/table/tablesApi';
import { ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

const FALLBACK_TZ = 'America/New_York';

const STATUS_LABEL: Record<ReservationDto['status'], string> = {
  PENDING: 'Expected',
  SEATED: 'Seated',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

/**
 * The day's bookings for the host stand (TABLE-06, TABLE-07): seat a party on
 * a free table, cancel a no-show, and see overdue bookings flagged in text.
 */
export function ReservationsPage() {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? FALLBACK_TZ;
  const [date, setDate] = useState(() => businessDateOf(new Date(), tz));
  const [adding, setAdding] = useState(false);
  const { data, isLoading, isError } = useReservations(date);
  const tables = useTables();
  const free = (tables.data ?? []).filter((t) => t.status === 'FREE' && t.isActive);
  const list = data ?? [];
  const expected = list.filter((r) => r.status === 'PENDING');
  const covers = expected.reduce((n, r) => n + r.partySize, 0);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 pb-16 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Bookings</h1>
          <p className="text-sm text-ink-muted">
            {expected.length} expected · {covers} covers · {free.length} tables free now
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label="Previous day"
            className={buttonClass('ghost')}
            onClick={() => setDate((d) => addDays(d, -1))}
          >
            ←
          </button>
          <label>
            <span className="sr-only">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="min-h-11 rounded-btn border border-line-strong bg-surface-raised px-4 text-sm"
            />
          </label>
          <button
            type="button"
            aria-label="Next day"
            className={buttonClass('ghost')}
            onClick={() => setDate((d) => addDays(d, 1))}
          >
            →
          </button>
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => setAdding(!adding)}
          >
            {adding ? 'Close' : 'New booking'}
          </button>
        </div>
      </header>

      {adding && (
        <NewBooking
          date={date}
          tz={tz}
          tables={tables.data ?? []}
          onDone={() => setAdding(false)}
        />
      )}

      {isLoading ? (
        <p role="status" className="text-ink-muted">
          Loading bookings…
        </p>
      ) : isError ? (
        <p role="alert" className="text-flame-text">
          Bookings did not load.
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-ink-muted">
          No bookings for this day.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <BookingRow key={r.id} r={r} tz={tz} free={free} />
          ))}
        </ul>
      )}
    </main>
  );
}

function BookingRow({ r, tz, free }: { r: ReservationDto; tz: string; free: MapTable[] }) {
  const update = useUpdateReservation();
  const [message, setMessage] = useState<string | null>(null);
  // Suggest the booked table, else the smallest free table that fits the party.
  const fits = [...free].sort((a, b) => a.seats - b.seats);
  const suggested =
    r.table?.id ?? fits.find((t) => t.seats >= r.partySize)?.id ?? fits[0]?.id ?? '';
  const [picked, setTableId] = useState<string | null>(null);
  const tableId = picked ?? suggested;
  const onError = (err: unknown) =>
    setMessage(err instanceof ApiError ? err.message : 'That did not work.');
  const pending = r.status === 'PENDING';
  // The booked table stays choosable even while it is not free.
  const choices: { id: string; number: string; seats?: number }[] = [
    ...(r.table && !free.some((t) => t.id === r.table?.id) ? [r.table] : []),
    ...fits,
  ];

  return (
    <li
      className={`flex flex-col gap-3 rounded-card border bg-surface p-4 md:flex-row md:items-center md:justify-between ${
        r.overdue ? 'border-flame' : 'border-line'
      } ${pending ? '' : 'opacity-70'}`}
    >
      <div className="flex items-center gap-4">
        <span className="tabular w-20 font-display text-xl font-bold">
          {slotLabel(r.slotAt, tz)}
        </span>
        <div>
          <p className="font-semibold">
            {r.guestName} · {r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}
          </p>
          <p className="text-xs text-ink-muted">
            {r.guestPhone}
            {r.table && ` · Table ${r.table.number}`}
            {r.notes && ` · ${r.notes}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {r.overdue ? (
          <span className="rounded-btn bg-flame px-3 py-1 text-xs font-bold text-white">
            Overdue
          </span>
        ) : (
          <span className="rounded-btn border border-line-strong px-3 py-1 text-xs font-semibold">
            {STATUS_LABEL[r.status]}
          </span>
        )}
        {pending && (
          <>
            <label>
              <span className="sr-only">Table for {r.guestName}</span>
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="min-h-11 rounded-btn border border-line-strong bg-bg px-3 text-sm"
              >
                <option value="">Choose table</option>
                {choices.map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.number}
                    {t.seats !== undefined ? ` · ${t.seats} seats` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={!tableId || update.isPending}
              onClick={() => {
                setMessage(null);
                update.mutate({ id: r.id, body: { action: 'seat', tableId } }, { onError });
              }}
            >
              Seat
            </button>
            <button
              type="button"
              className={buttonClass('danger')}
              disabled={update.isPending}
              onClick={() => {
                if (!window.confirm(`Cancel the booking for ${r.guestName}?`)) return;
                setMessage(null);
                update.mutate({ id: r.id, body: { action: 'cancel' } }, { onError });
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      {message && (
        <p role="alert" className="text-sm text-flame-text md:basis-full">
          {message}
        </p>
      )}
    </li>
  );
}

function NewBooking({
  date,
  tz,
  tables,
  onDone,
}: {
  date: string;
  tz: string;
  tables: MapTable[];
  onDone: () => void;
}) {
  const create = useCreateReservation();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const [hour = 0, minute = 0] = formValue(form, 'time').split(':').map(Number);
    const tableId = formValue(form, 'tableId');
    const notes = formValue(form, 'notes').trim();
    const check = createReservationSchema.safeParse({
      guestName: formValue(form, 'name'),
      guestPhone: formValue(form, 'phone'),
      partySize: Number(formValue(form, 'party')),
      slotAt: zonedTimeToUtc(date, hour, minute, tz).toISOString(),
      ...(notes ? { notes } : {}),
      ...(tableId ? { tableId } : {}),
    });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? 'Check the details.');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync(check.data);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the booking.');
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-3"
    >
      <Field label="Guest name" name="name" required />
      <Field label="Phone" name="phone" type="tel" minLength={5} required />
      <Field label="Guests" name="party" type="number" min={1} max={20} defaultValue={2} required />
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        Time on {date}
        <select
          name="time"
          defaultValue="19:30"
          className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm normal-case tracking-normal text-ink"
        >
          {SLOT_TIMES.map((t) => (
            <option key={t} value={t}>
              {formatSlot(t)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        Table (optional)
        <select
          name="tableId"
          defaultValue=""
          className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm normal-case tracking-normal text-ink"
        >
          <option value="">Assign on arrival</option>
          {tables
            .filter((t) => t.isActive)
            .map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number} · {t.seats} seats
              </option>
            ))}
        </select>
      </label>
      <Field label="Note" name="notes" maxLength={300} />
      {error && (
        <p role="alert" className="text-sm text-flame-text sm:col-span-3">
          {error}
        </p>
      )}
      <div className="sm:col-span-3">
        <button type="submit" className={buttonClass('primary')} disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save booking'}
        </button>
      </div>
    </form>
  );
}
