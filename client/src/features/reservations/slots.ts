import { useLangStore } from '../../i18n';
import { formatTime } from '../../shared/format';

/** Bookable times, every 30 minutes from 12:00 to 21:30 (last seating). */
export const SLOT_TIMES: string[] = Array.from({ length: 20 }, (_, i) => {
  const minutes = 12 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** `HH:MM` → "7:30 pm" / "7:30 م", in the reader's language. */
export function formatSlot(clock: string): string {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  const pm = h >= 12;
  const hour = h % 12 === 0 ? 12 : h % 12;
  const suffix = useLangStore.getState().lang === 'ar' ? (pm ? 'م' : 'ص') : pm ? 'pm' : 'am';
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** An instant's wall-clock time in the restaurant's zone, in the reader's language. */
export function slotLabel(iso: string, timeZone: string): string {
  return formatTime(iso, timeZone);
}
