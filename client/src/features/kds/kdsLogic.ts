import { FORWARD_TRANSITION, type KdsSettings, type OrderDto, type OrderStatus } from '@ros/shared';

export type AgeBand = 'ok' | 'warn' | 'late';

/**
 * Ticket ageing (KDS-03). The band always travels with a text label, so the
 * state is readable without colour vision or under kitchen light (NFR-U3).
 */
export function ageBand(
  elapsedSec: number,
  s: Pick<KdsSettings, 'kdsGreenSec' | 'kdsAmberSec'>,
): {
  band: AgeBand;
  label: string;
} {
  if (elapsedSec < s.kdsGreenSec) return { band: 'ok', label: 'On time' };
  if (elapsedSec < s.kdsAmberSec) return { band: 'warn', label: 'Slow' };
  return { band: 'late', label: 'Late' };
}

/** `m:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * The bump target. Read from FORWARD_TRANSITION, never from the first entry of
 * an allowed-transitions list: array order is not meaning (LLD §7.5).
 */
export function bumpTarget(status: OrderStatus): OrderStatus | null {
  return FORWARD_TRANSITION[status];
}

/** Items added more than a minute after placement are a later round (ORD-12). */
export function isLaterRound(
  item: Pick<OrderDto['items'][number], 'addedAt'>,
  placedAt: string,
): boolean {
  return new Date(item.addedAt).getTime() - new Date(placedAt).getTime() > 60_000;
}

/** Every station on the board, for the filter chips (KDS-05). */
export function stationsOf(orders: readonly OrderDto[]): string[] {
  const set = new Set<string>();
  for (const o of orders) for (const i of o.items) if (i.station) set.add(i.station);
  return [...set].sort();
}

/** Tickets with at least one line for the station; null means every station. */
export function forStation(orders: readonly OrderDto[], station: string | null): OrderDto[] {
  return station === null
    ? [...orders]
    : orders.filter((o) => o.items.some((i) => i.station === station));
}

/** Completed tickets stay on screen for the grace period, then drop off (KDS-07). */
export function stillLingering(
  order: Pick<OrderDto, 'completedAt'>,
  nowMs: number,
  graceSec: number,
): boolean {
  return (
    order.completedAt !== null && nowMs - new Date(order.completedAt).getTime() < graceSec * 1000
  );
}

/** Board columns, left to right (LLD §7.5). */
export const KDS_COLUMNS: { status: OrderStatus; title: string }[] = [
  { status: 'PLACED', title: 'New' },
  { status: 'CONFIRMED', title: 'Confirmed' },
  { status: 'PREPARING', title: 'Cooking' },
  { status: 'READY', title: 'Ready' },
  { status: 'SERVED', title: 'Served' },
];

export function bumpLabel(to: OrderStatus): string {
  switch (to) {
    case 'CONFIRMED':
      return 'Confirm';
    case 'PREPARING':
      return 'Start cooking';
    case 'READY':
      return 'Mark ready';
    case 'SERVED':
      return 'Served';
    case 'COMPLETED':
      return 'Complete';
    case 'PLACED':
    case 'CANCELLED':
      return to;
    default: {
      const exhaustive: never = to;
      return exhaustive;
    }
  }
}
