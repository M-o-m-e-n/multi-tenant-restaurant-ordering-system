/** Opening hours per weekday (0 = Sunday), in restaurant-local hours. */
export const OPENING: Record<number, { open: number; close: number }> = {
  0: { open: 11, close: 21 },
  1: { open: 12, close: 22 },
  2: { open: 12, close: 22 },
  3: { open: 12, close: 22 },
  4: { open: 12, close: 22 },
  5: { open: 12, close: 23 },
  6: { open: 12, close: 23 },
};

function hourLabel(h: number): string {
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

/** Weekday and fractional hour of `now` on the restaurant's clock. */
function localClock(now: Date, timeZone: string): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, hour: Number(get('hour')) + Number(get('minute')) / 60 };
}

export interface OpenStatus {
  open: boolean;
  /** "Open now · kitchen closes 11 pm" / "Closed · opens 12 pm tomorrow" */
  label: string;
}

/**
 * Whether the restaurant is open at `now`, read on its own clock so a guest in
 * another timezone sees the truth (the same rule as business dates, ADR-008).
 */
export function openStatus(now: Date, timeZone: string): OpenStatus {
  const { day, hour } = localClock(now, timeZone);
  const today = OPENING[day];
  if (today && hour >= today.open && hour < today.close) {
    const closingSoon = today.close - hour <= 1;
    return {
      open: true,
      label: `${closingSoon ? 'Closing soon' : 'Open now'} · kitchen closes ${hourLabel(today.close)}`,
    };
  }
  if (today && hour < today.open) {
    return { open: false, label: `Closed · opens ${hourLabel(today.open)} today` };
  }
  // Every day has hours, so after closing the next opening is tomorrow.
  const next = OPENING[(day + 1) % 7] ?? { open: 12, close: 22 };
  return { open: false, label: `Closed · opens ${hourLabel(next.open)} tomorrow` };
}
