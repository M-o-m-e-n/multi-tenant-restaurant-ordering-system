import type { KdsSettings, OrderDto } from '@ros/shared';

import { ageBand, bumpLabel, bumpTarget, formatElapsed, isLaterRound } from './kdsLogic';

interface Props {
  order: OrderDto;
  nowMs: number;
  settings: KdsSettings;
  station: string | null;
  fresh: boolean;
  onBump: (order: OrderDto) => void;
}

const BAND_STYLES = {
  ok: { edge: 'border-l-ok', chip: 'bg-ok/15 text-ok', icon: '●' },
  warn: { edge: 'border-l-warn', chip: 'bg-warn/15 text-warn', icon: '▲' },
  late: { edge: 'border-l-flame', chip: 'bg-flame text-white', icon: '■' },
} as const;

function badge(order: OrderDto): string {
  if (order.table) return `Table ${order.table.number}`;
  return order.type === 'DELIVERY' ? 'Delivery' : 'Takeaway';
}

/**
 * One kitchen ticket (LLD §7.5): number, table or type, a live timer with its
 * ageing band as colour *and* word, the lines with modifiers and notes, later
 * rounds badged, and one big bump button.
 */
export function TicketCard({ order, nowMs, settings, station, fresh, onBump }: Props) {
  const elapsed = (nowMs - new Date(order.placedAt).getTime()) / 1000;
  const age = ageBand(elapsed, settings);
  const style = BAND_STYLES[age.band];
  const next = bumpTarget(order.status);
  const done = order.status === 'COMPLETED';

  return (
    <article
      aria-label={`Order ${order.orderNumber}, ${badge(order)}, ${age.label}`}
      className={`flex flex-col gap-3 rounded-icon border border-line border-l-8 bg-surface p-4 ${done ? 'border-l-line opacity-60' : style.edge} ${fresh ? 'ring-4 ring-flame-light motion-safe:animate-pulse' : ''}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-3xl font-bold leading-none">{order.orderNumber}</p>
          <p className="mt-1 text-sm font-semibold text-ink-muted">
            {badge(order)}
            <a
              href={`/kitchen/tickets/${order.id}/print`}
              target="_blank"
              rel="noreferrer"
              className="ml-3 text-xs underline hover:text-ink"
            >
              Print
            </a>
          </p>
        </div>
        {!done && (
          <div className="text-right">
            <p className="tabular text-xl font-bold">{formatElapsed(elapsed)}</p>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-btn px-2 py-0.5 text-xs font-bold ${style.chip}`}
            >
              <span aria-hidden="true">{style.icon}</span>
              {age.label}
            </span>
          </div>
        )}
      </header>

      <ul className="flex flex-col gap-1.5">
        {order.items.map((item) => {
          const other = station !== null && item.station !== station;
          const later = isLaterRound(item, order.placedAt);
          return (
            <li key={item.id} className={other ? 'opacity-40' : ''}>
              <p className="text-lg font-semibold leading-snug">
                <span className="tabular">{item.qty}×</span> {item.nameSnapshot}
                {later && (
                  <span className="ml-2 rounded-btn bg-warn/20 px-2 py-0.5 align-middle text-xs font-bold text-warn">
                    Later round ·{' '}
                    {new Date(item.addedAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </p>
              {item.modifiers.length > 0 && (
                <p className="text-sm font-semibold text-warn">
                  {item.modifiers.flatMap((g) => g.items.map((m) => m.name)).join(' · ')}
                </p>
              )}
              {item.notes && (
                <p className="text-sm font-semibold text-flame-text">“{item.notes}”</p>
              )}
            </li>
          );
        })}
      </ul>
      {order.notes && (
        <p className="text-sm font-semibold text-flame-text">Order note: {order.notes}</p>
      )}

      {next && (
        <button
          type="button"
          onClick={() => onBump(order)}
          className="mt-auto min-h-14 rounded-icon bg-flame text-base font-bold text-white shadow-glow hover:brightness-110 active:scale-[.98]"
        >
          {bumpLabel(next)} →
        </button>
      )}
    </article>
  );
}
