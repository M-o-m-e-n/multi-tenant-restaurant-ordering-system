/** Bookable times, every 30 minutes from 12:00 to 21:30 (last seating). */
export const SLOT_TIMES: string[] = Array.from({ length: 20 }, (_, i) => {
  const minutes = 12 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** `HH:MM` → 7:30 pm. */
export function formatSlot(clock: string): string {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** An instant's wall-clock time in the restaurant's zone, as `7:30 pm`. */
export function slotLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .toLowerCase();
}
