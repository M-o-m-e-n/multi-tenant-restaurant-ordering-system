/**
 * Restaurant-timezone helpers. Instants are stored UTC; the business date is
 * the operating day in the restaurant's IANA zone (BR-15, CODING-STANDARDS §7).
 */

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** The business date (`YYYY-MM-DD`) that `instant` falls on in `timeZone`. */
export function businessDateOf(instant: Date, timeZone: string): string {
  let fmt = dateFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateFormatters.set(timeZone, fmt);
  }
  return fmt.format(instant);
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The UTC instant of a wall-clock time on a business date in `timeZone`. */
export function zonedTimeToUtc(date: string, hour: number, minute: number, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  // Two passes settle the offset across a DST boundary.
  let utc = wall - offsetMs(new Date(wall), timeZone);
  utc = wall - offsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/** Add whole days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

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
