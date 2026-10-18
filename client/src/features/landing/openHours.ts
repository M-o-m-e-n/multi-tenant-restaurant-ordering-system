import type { WeekHours } from '@ros/shared';

import type { Lang } from '../../i18n/types';

/** Fork & Flame's opening hours, Sunday first, in restaurant-local hours. */
export const OPENING: WeekHours = [
  { open: 11, close: 21 },
  { open: 12, close: 22 },
  { open: 12, close: 22 },
  { open: 12, close: 22 },
  { open: 12, close: 22 },
  { open: 12, close: 23 },
  { open: 12, close: 23 },
];

/**
 * "11 pm" / "11 م" — an hour on the restaurant clock, in the reader's
 * language. Hours past midnight (26 = 2 am) and half hours (11.5) read as
 * a guest would say them.
 */
export function hourLabel(h: number, lang: Lang): string {
  const day = ((h % 24) + 24) % 24;
  const whole = Math.floor(day);
  const minutes = Math.round((day - whole) * 60);
  const pm = whole >= 12;
  const hour = whole % 12 === 0 ? 12 : whole % 12;
  const time = minutes ? `${hour}:${String(minutes).padStart(2, '0')}` : String(hour);
  return lang === 'ar' ? `${time} ${pm ? 'م' : 'ص'}` : `${time} ${pm ? 'pm' : 'am'}`;
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

export type OpenStatus =
  | { open: true; closingSoon: boolean; closesAt: number }
  | { open: false; opens: 'today' | 'tomorrow'; opensAt: number }
  | { open: false; opens: null };

/**
 * Whether a branch is open at `now`, read on its own clock so a guest in
 * another timezone sees the truth (the same rule as business dates, ADR-008).
 * A day may close after midnight (`close: 26` is 2 am), and that late tail
 * still counts as the night before. Structured, not a sentence: the UI
 * phrases it in the reader's language.
 */
export function openStatus(now: Date, timeZone: string, week: WeekHours = OPENING): OpenStatus {
  const { day, hour } = localClock(now, timeZone);
  const soon = (left: number) => left <= 1;

  // Still inside last night's service?
  const last = week[(day + 6) % 7];
  if (last && last.close > 24 && hour < last.close - 24) {
    return { open: true, closingSoon: soon(last.close - 24 - hour), closesAt: last.close };
  }
  const today = week[day];
  if (today && hour >= today.open && hour < today.close) {
    return { open: true, closingSoon: soon(today.close - hour), closesAt: today.close };
  }
  if (today && hour < today.open) return { open: false, opens: 'today', opensAt: today.open };
  const next = week[(day + 1) % 7];
  if (next) return { open: false, opens: 'tomorrow', opensAt: next.open };
  return { open: false, opens: null };
}

/** "11 am – 2 am" for a day's hours, or null for a closed day. */
export function hoursRange(h: WeekHours[number], lang: Lang): string | null {
  return h ? `${hourLabel(h.open, lang)} – ${hourLabel(h.close, lang)}` : null;
}
