/**
 * Restaurant-timezone helpers. Instants are stored UTC; the business date is
 * the operating day in the restaurant's IANA zone (BR-15, CODING-STANDARDS §7).
 * The pure date arithmetic lives in @ros/shared so the client books slots the
 * same way; the Prisma-facing conversions stay here.
 */
export { addDays, businessDateOf, zonedTimeToUtc } from '@ros/shared';

/** A `YYYY-MM-DD` business date as the Date Prisma expects for a `@db.Date` column. */
export function dateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Wall-clock `HH:MM` of `instant` in `timeZone`. */
export function localClock(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

/**
 * Whether `clock` falls inside `[from, to)`. A window whose end is earlier than
 * its start runs overnight (22:00–02:00). No window means always.
 */
export function withinWindow(clock: string, from: string | null, to: string | null): boolean {
  if (!from || !to) return true;
  return from <= to ? clock >= from && clock < to : clock >= from || clock < to;
}

/** A Postgres `time` column value as `HH:MM`. */
export function timeToClock(value: Date | null): string | null {
  return value ? value.toISOString().slice(11, 16) : null;
}

/** `HH:MM` as the Date Prisma writes to a `time` column. */
export function clockToTime(clock: string | null | undefined): Date | null | undefined {
  if (clock === undefined) return undefined;
  return clock === null ? null : new Date(`1970-01-01T${clock}:00.000Z`);
}
