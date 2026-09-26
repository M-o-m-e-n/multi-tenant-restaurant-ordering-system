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
import { useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

const FALLBACK_TZ = 'America/New_York';

/**
 * The day's bookings for the host stand (TABLE-06, TABLE-07): seat a party on
 * a free table, cancel a no-show, and see overdue bookings flagged in text.
 */
export function ReservationsPage() {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? FALLBACK_TZ;
  const [date, setDate] = useState(() => businessDateOf(new Date(), tz));
  const [adding, setAdding] = useState(false);
  const t = useT();
  const { data, isLoading, isError } = useReservations(date);
  const tables = useTables();
  const free = (tables.data ?? []).filter((table) => table.status === 'FREE' && table.isActive);
  const list = data ?? [];
  const expected = list.filter((r) => r.status === 'PENDING');
  const covers = expected.reduce((n, r) => n + r.partySize, 0);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 pb-16 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.bookings.title}</h1>
          <p className="text-sm text-ink-muted">
            {t.bookings.summary(expected.length, covers, free.length)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={t.bookings.previous}
            className={buttonClass('ghost')}
            onClick={() => setDate((d) => addDays(d, -1))}
          >
            <span className="inline-block rtl:-scale-x-100">←</span>
          </button>
          <label>
            <span className="sr-only">{t.bookings.date}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="min-h-11 rounded-btn border border-line-strong bg-surface-raised px-4 text-sm"
            />
          </label>
          <button
            type="button"
            aria-label={t.bookings.next}
            className={buttonClass('ghost')}
            onClick={() => setDate((d) => addDays(d, 1))}
          >
            <span className="inline-block rtl:-scale-x-100">→</span>
          </button>
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => setAdding(!adding)}
          >
            {adding ? t.bookings.close : t.bookings.newBooking}
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
          {t.bookings.loading}
        </p>
      ) : isError ? (
        <p role="alert" className="text-flame-text">
          {t.bookings.failed}
        </p>
      ) : list.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-ink-muted">
          {t.bookings.none}
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
  const t = useT();
  // Suggest the booked table, else the smallest free table that fits the party.
  const fits = [...free].sort((a, b) => a.seats - b.seats);
  const suggested =
    r.table?.id ?? fits.find((table) => table.seats >= r.partySize)?.id ?? fits[0]?.id ?? '';
  const [picked, setTableId] = useState<string | null>(null);
  const tableId = picked ?? suggested;
  const onError = (err: unknown) => setMessage(errorMessage(err));
  const pending = r.status === 'PENDING';
  // The booked table stays choosable even while it is not free.
  const choices: { id: string; number: string; seats?: number }[] = [
    ...(r.table && !free.some((table) => table.id === r.table?.id) ? [r.table] : []),
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
            {r.guestName} · {t.reserve.guestCount(r.partySize)}
          </p>
          <p className="text-xs text-ink-muted">
            {r.guestPhone}
            {r.table && ` · ${t.common.table(r.table.number)}`}
            {r.notes && ` · ${r.notes}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {r.overdue ? (
          <span className="rounded-btn bg-flame px-3 py-1 text-xs font-bold text-white">
            {t.bookings.overdue}
          </span>
        ) : (
          <span className="rounded-btn border border-line-strong px-3 py-1 text-xs font-semibold">
            {t.bookings.status[r.status]}
          </span>
        )}
        {pending && (
          <>
            <label>
              <span className="sr-only">{t.bookings.tableFor(r.guestName)}</span>
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="min-h-11 rounded-btn border border-line-strong bg-bg px-3 text-sm"
              >
                <option value="">{t.bookings.chooseTable}</option>
                {choices.map((table) => (
                  <option key={table.id} value={table.id}>
                    {t.common.table(table.number)}
                    {table.seats !== undefined ? ` · ${t.tables.seats(table.seats)}` : ''}
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
              {t.bookings.seat}
            </button>
            <button
              type="button"
              className={buttonClass('danger')}
              disabled={update.isPending}
              onClick={() => {
                if (!window.confirm(t.bookings.cancelConfirm(r.guestName))) return;
                setMessage(null);
                update.mutate({ id: r.id, body: { action: 'cancel' } }, { onError });
              }}
            >
              {t.bookings.cancel}
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
  const t = useT();

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
      setError(t.bookings.checkDetails);
      return;
    }
    setError(null);
    try {
      await create.mutateAsync(check.data);
      onDone();
    } catch (err) {
      setError(errorMessage(err, t.bookings.saveFailed));
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="grid gap-4 rounded-card border border-line bg-surface p-5 sm:grid-cols-3"
    >
      <Field label={t.bookings.guestName} name="name" required />
      <Field label={t.bookings.phone} name="phone" type="tel" minLength={5} required />
      <Field
        label={t.bookings.guests}
        name="party"
        type="number"
        min={1}
        max={20}
        defaultValue={2}
        required
      />
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        {t.bookings.timeOn(date)}
        <select
          name="time"
          defaultValue="19:30"
          className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm normal-case tracking-normal text-ink"
        >
          {SLOT_TIMES.map((slot) => (
            <option key={slot} value={slot}>
              {formatSlot(slot)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-ink-muted">
        {t.bookings.tableOptional}
        <select
          name="tableId"
          defaultValue=""
          className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm normal-case tracking-normal text-ink"
        >
          <option value="">{t.bookings.onArrival}</option>
          {tables
            .filter((table) => table.isActive)
            .map((table) => (
              <option key={table.id} value={table.id}>
                {t.common.table(table.number)} · {t.tables.seats(table.seats)}
              </option>
            ))}
        </select>
      </label>
      <Field label={t.bookings.note} name="notes" maxLength={300} />
      {error && (
        <p role="alert" className="text-sm text-flame-text sm:col-span-3">
          {error}
        </p>
      )}
      <div className="sm:col-span-3">
        <button type="submit" className={buttonClass('primary')} disabled={create.isPending}>
          {create.isPending ? t.bookings.saving : t.bookings.save}
        </button>
      </div>
    </form>
  );
}
