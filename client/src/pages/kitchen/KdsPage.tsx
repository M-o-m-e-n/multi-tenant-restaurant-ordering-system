import type { OrderDto } from '@ros/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { chime, enableChime } from '../../features/kds/chime';
import { useBump, useKdsBoard, useKdsSettings } from '../../features/kds/kdsApi';
import {
  bumpTarget,
  columnTitle,
  forStation,
  KDS_COLUMNS,
  stationsOf,
  stillLingering,
} from '../../features/kds/kdsLogic';
import { TicketCard } from '../../features/kds/TicketCard';
import { useT } from '../../i18n';
import { getSocket } from '../../shared/realtime/socket';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * The kitchen display (KDS-01…07): live columns by status, ageing timers,
 * one-tap bumps, a station filter, and an alert on every new ticket.
 */
export function KdsPage() {
  const board = useKdsBoard();
  const { data: settings } = useKdsSettings();
  const now = useNow(1000);
  const [station, setStation] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(() => getSocket().connected);
  const soundRef = useRef(sound);
  const t = useT();
  soundRef.current = sound;

  const bump = useBump((message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  });

  // New ticket: flash it and chime (KDS-02, KDS-06).
  useEffect(() => {
    const socket = getSocket();
    const onNew = (order: OrderDto) => {
      setFresh((s) => new Set(s).add(order.id));
      setTimeout(
        () =>
          setFresh((s) => {
            const next = new Set(s);
            next.delete(order.id);
            return next;
          }),
        6000,
      );
      if (soundRef.current) chime();
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('order:new', onNew);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('order:new', onNew);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const active = useMemo(() => board.data?.active ?? [], [board.data]);
  const lingering = useMemo(
    () =>
      settings
        ? (board.data?.completed ?? []).filter((o) =>
            stillLingering(o, now, settings.kdsCompletedGraceSec),
          )
        : [],
    [board.data, settings, now],
  );
  const stations = useMemo(() => stationsOf(active), [active]);
  const visible = forStation(active, station);

  if (board.isLoading || !settings) {
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        {t.kds.loading}
      </p>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-88px)] flex-col gap-4 px-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{t.kds.title}</h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-btn border px-3 py-1 text-xs font-semibold ${connected ? 'border-ok/50 text-ok' : 'border-flame text-flame-text'}`}
          >
            <span aria-hidden="true">{connected ? '●' : '○'}</span>
            {connected ? t.kds.live : t.kds.reconnecting}
          </span>
        </div>
        <div role="group" aria-label={t.kds.station} className="flex flex-wrap gap-2">
          {[null, ...stations].map((s) => (
            <button
              key={s ?? 'all'}
              type="button"
              aria-pressed={station === s}
              onClick={() => setStation(s)}
              className={`min-h-11 rounded-btn border px-4 text-sm font-semibold capitalize ${station === s ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised'}`}
            >
              {s ?? t.kds.allStations}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => {
              if (!sound) enableChime();
              setSound((v) => !v);
            }}
            className="min-h-11 rounded-btn border border-line-strong bg-surface-raised px-4 text-sm font-semibold"
          >
            {sound ? t.kds.soundOn : t.kds.soundOff}
          </button>
        </div>
      </div>

      {toast && (
        <p
          role="status"
          className="fixed inset-x-0 top-4 z-20 mx-auto w-fit rounded-btn bg-white px-5 py-3 text-sm font-semibold text-ink-inverse shadow-plate"
        >
          {toast}
        </p>
      )}

      {/* Focusable so the board can be scrolled from the keyboard (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="region"
        aria-label={t.kds.board}
        className="grid flex-1 grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto"
      >
        {KDS_COLUMNS.map((col) => {
          const tickets = visible.filter((o) => o.status === col);
          return (
            <section
              key={col}
              aria-labelledby={`col-${col}`}
              className="flex flex-col gap-3 rounded-card bg-bg-deep/60 p-3"
            >
              <h2
                id={`col-${col}`}
                className="flex items-center justify-between px-1 text-sm font-bold uppercase tracking-wider text-ink-muted"
              >
                {columnTitle(col)}
                <span className="tabular rounded-btn bg-surface-raised px-2 py-0.5 text-ink">
                  {tickets.length}
                </span>
              </h2>
              {tickets.map((o) => (
                <TicketCard
                  key={o.id}
                  order={o}
                  nowMs={now}
                  settings={settings}
                  station={station}
                  fresh={fresh.has(o.id)}
                  onBump={(order) => {
                    const to = bumpTarget(order.status);
                    if (to) bump.mutate({ id: order.id, to });
                  }}
                />
              ))}
            </section>
          );
        })}
        <section
          aria-labelledby="col-done"
          className="flex flex-col gap-3 rounded-card bg-bg-deep/60 p-3"
        >
          <h2
            id="col-done"
            className="px-1 text-sm font-bold uppercase tracking-wider text-ink-muted"
          >
            {t.kds.done}
          </h2>
          {lingering.map((o) => (
            <TicketCard
              key={o.id}
              order={o}
              nowMs={now}
              settings={settings}
              station={station}
              fresh={false}
              onBump={() => undefined}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
