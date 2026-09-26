import {
  addDays,
  businessDateOf,
  createReservationSchema,
  type ReservationDto,
  zonedTimeToUtc,
} from '@ros/shared';
import { type FormEvent, type ReactNode, type SelectHTMLAttributes, useId, useState } from 'react';
import { Link } from 'react-router-dom';

import { RESERVE_PANEL } from '../../brand/copy';
import { useAuth } from '../../features/auth/authStore';
import { useSettings } from '../../features/cart/cartApi';
import { useCreateReservation } from '../../features/reservations/reservationsApi';
import { formatSlot, SLOT_TIMES, slotLabel } from '../../features/reservations/slots';
import { useT } from '../../i18n';
import { useL } from '../../i18n/localized';
import { errorMessage } from '../../shared/api/errorMessage';
import { formatLongDate } from '../../shared/format';
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
  const t = useT();
  const l = useL();

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
      setError(t.reserve.checkDetails);
      return;
    }
    if (new Date(dto.slotAt).getTime() <= Date.now()) {
      setError(t.reserve.passed);
      return;
    }
    setError(null);
    try {
      setBooked(await create.mutateAsync(check.data));
    } catch (err) {
      setError(errorMessage(err, t.reserve.failed));
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-content gap-8 px-5 pb-16 md:grid-cols-2 md:px-10">
      <div className="relative hidden overflow-hidden rounded-frame border border-line md:block">
        <img src="/images/dining.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-bg-deep/40 to-transparent" />
        <div className="absolute bottom-0 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            {t.reserve.eyebrow}
          </p>
          <p className="mt-2 font-display text-3xl font-bold">{l(RESERVE_PANEL.title)}</p>
          <p className="mt-2 text-sm text-ink-muted">{l(RESERVE_PANEL.body)}</p>
        </div>
      </div>

      {booked ? (
        <section className="flex flex-col justify-center gap-4 rounded-card border border-line bg-surface p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ok">
            {t.reserve.confirmed}
          </p>
          <h1 className="font-display text-3xl font-bold">{t.reserve.seeYou(booked.guestName)}</h1>
          <p className="text-ink-muted">
            {t.reserve.summary(
              booked.partySize,
              formatLongDate(booked.slotAt, tz),
              slotLabel(booked.slotAt, tz),
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/menu" className={buttonClass('primary')}>
              {t.reserve.browse}
            </Link>
            <button type="button" className={buttonClass('ghost')} onClick={() => setBooked(null)}>
              {t.reserve.another}
            </button>
          </div>
        </section>
      ) : (
        <form
          className="flex flex-col gap-5 rounded-card border border-line bg-surface p-6 md:p-8"
          onSubmit={(e) => void submit(e)}
        >
          <div>
            <h1 className="font-display text-3xl font-bold">{t.reserve.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">{t.reserve.hint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.reserve.name}
              name="name"
              autoComplete="name"
              defaultValue={user?.name}
              required
            />
            <Field
              label={t.reserve.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              minLength={5}
              maxLength={30}
              required
            />
            <Field
              label={t.reserve.date}
              name="date"
              type="date"
              min={today}
              max={addDays(today, 90)}
              defaultValue={addDays(today, 1)}
              required
            />
            <Select label={t.reserve.time} name="time" defaultValue="19:30">
              {SLOT_TIMES.map((slot) => (
                <option key={slot} value={slot}>
                  {formatSlot(slot)}
                </option>
              ))}
            </Select>
            <Select label={t.reserve.guests} name="party" defaultValue="2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t.reserve.guestCount(n)}
                </option>
              ))}
            </Select>
            <Field
              label={t.reserve.note}
              name="notes"
              maxLength={300}
              placeholder={t.reserve.notePlaceholder}
            />
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
            {create.isPending ? t.reserve.booking : t.reserve.book}
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
