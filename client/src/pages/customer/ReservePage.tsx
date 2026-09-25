import {
  addDays,
  businessDateOf,
  createReservationSchema,
  type ReservationDto,
  zonedTimeToUtc,
} from '@ros/shared';
import { type FormEvent, type ReactNode, type SelectHTMLAttributes, useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../features/auth/authStore';
import { useSettings } from '../../features/cart/cartApi';
import { useCreateReservation } from '../../features/reservations/reservationsApi';
import { formatSlot, SLOT_TIMES, slotLabel } from '../../features/reservations/slots';
import { ApiError } from '../../shared/api/client';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

const FALLBACK_TZ = 'America/New_York';

/**
 * Book a table (TABLE-06). The slot is chosen as a wall-clock time in the
 * restaurant's own timezone and converted with the same helper the server
 * uses, so a guest booking from another zone still gets 7:30 pm local.
 */
export function ReservePage() {
  const user = useAuth((s) => s.user);
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? FALLBACK_TZ;
  const today = businessDateOf(new Date(), tz);
  const create = useCreateReservation();
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<ReservationDto | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const [hour = 0, minute = 0] = formValue(form, 'time').split(':').map(Number);
    const notes = formValue(form, 'notes').trim();
    const dto = {
      guestName: formValue(form, 'name'),
      guestPhone: formValue(form, 'phone'),
      partySize: Number(formValue(form, 'party')),
      slotAt: zonedTimeToUtc(formValue(form, 'date'), hour, minute, tz).toISOString(),
      ...(notes ? { notes } : {}),
    };
    const check = createReservationSchema.safeParse(dto);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }
    if (new Date(dto.slotAt).getTime() <= Date.now()) {
      setError('That time has already passed. Pick a later slot.');
      return;
    }
    setError(null);
    try {
      setBooked(await create.mutateAsync(check.data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not book that. Try again.');
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-content gap-8 px-5 pb-16 md:grid-cols-2 md:px-10">
      <div className="relative hidden overflow-hidden rounded-frame border border-line md:block">
        <img src="/images/dining.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-bg-deep/40 to-transparent" />
        <div className="absolute bottom-0 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            Reservations
          </p>
          <p className="mt-2 font-display text-3xl font-bold">Your table, by the fire.</p>
          <p className="mt-2 text-sm text-ink-muted">
            We hold every booking for 15 minutes. Running late? Give us a call.
          </p>
        </div>
      </div>

      {booked ? (
        <section className="flex flex-col justify-center gap-4 rounded-card border border-line bg-surface p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ok">Confirmed</p>
          <h1 className="font-display text-3xl font-bold">See you soon, {booked.guestName}.</h1>
          <p className="text-ink-muted">
            A table for {booked.partySize} on{' '}
            <strong className="text-ink">
              {new Date(booked.slotAt).toLocaleDateString('en-US', {
                timeZone: tz,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </strong>{' '}
            at <strong className="text-ink">{slotLabel(booked.slotAt, tz)}</strong>.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/menu" className={buttonClass('primary')}>
              Browse the menu
            </Link>
            <button type="button" className={buttonClass('ghost')} onClick={() => setBooked(null)}>
              Book another
            </button>
          </div>
        </section>
      ) : (
        <form
          className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 md:p-8"
          onSubmit={(e) => void submit(e)}
        >
          <div>
            <h1 className="font-display text-3xl font-bold">Book a table</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Times are local to the restaurant. Parties over 12, please call us.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              name="name"
              autoComplete="name"
              defaultValue={user?.name}
              required
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              minLength={5}
              maxLength={30}
              required
            />
            <Field
              label="Date"
              name="date"
              type="date"
              min={today}
              max={addDays(today, 90)}
              defaultValue={addDays(today, 1)}
              required
            />
            <Select label="Time" name="time" defaultValue="19:30">
              {SLOT_TIMES.map((t) => (
                <option key={t} value={t}>
                  {formatSlot(t)}
                </option>
              ))}
            </Select>
            <Select label="Guests" name="party" defaultValue="2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'guest' : 'guests'}
                </option>
              ))}
            </Select>
            <Field label="Occasion or note" name="notes" maxLength={300} placeholder="Birthday…" />
          </div>
          {error && (
            <p role="alert" className="rounded-icon border border-flame p-3 text-sm">
              {error}
            </p>
          )}
          <button
            type="submit"
            className={buttonClass('primary', 'lg')}
            disabled={create.isPending}
          >
            {create.isPending ? 'Booking…' : 'Book table'}
          </button>
        </form>
      )}
    </main>
  );
}

function Select({
  label,
  children,
  ...select
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </label>
      <select
        id={id}
        className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm text-ink"
        {...select}
      >
        {children}
      </select>
    </div>
  );
}
