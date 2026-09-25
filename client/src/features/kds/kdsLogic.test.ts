import type { OrderDto } from '@ros/shared';
import { describe, expect, it } from 'vitest';

import {
  ageBand,
  bumpTarget,
  formatElapsed,
  forStation,
  isLaterRound,
  stationsOf,
  stillLingering,
} from './kdsLogic';

const settings = { kdsGreenSec: 480, kdsAmberSec: 900 };

describe('KDS logic', () => {
  it('bands ageing with a text label at 8 and 15 minutes (KDS-03, NFR-U3)', () => {
    expect(ageBand(0, settings)).toEqual({ band: 'ok', label: 'On time' });
    expect(ageBand(480, settings)).toEqual({ band: 'warn', label: 'Slow' });
    expect(ageBand(900, settings)).toEqual({ band: 'late', label: 'Late' });
  });

  it('formats elapsed time', () => {
    expect(formatElapsed(65)).toBe('1:05');
    expect(formatElapsed(3725)).toBe('1:02:05');
  });

  it('bumps along FORWARD_TRANSITION and never out of a terminal state', () => {
    expect(bumpTarget('PLACED')).toBe('CONFIRMED');
    expect(bumpTarget('SERVED')).toBe('COMPLETED');
    expect(bumpTarget('COMPLETED')).toBeNull();
    expect(bumpTarget('CANCELLED')).toBeNull();
  });

  it('marks items added after placement as a later round', () => {
    const placedAt = '2026-09-25T19:00:00Z';
    expect(isLaterRound({ addedAt: '2026-09-25T19:00:00Z' }, placedAt)).toBe(false);
    expect(isLaterRound({ addedAt: '2026-09-25T19:20:00Z' }, placedAt)).toBe(true);
    // A quick second round still counts; the first round shares placedAt exactly.
    expect(isLaterRound({ addedAt: '2026-09-25T19:00:10Z' }, placedAt)).toBe(true);
    expect(isLaterRound({ addedAt: '2026-09-25T19:00:00.400Z' }, placedAt)).toBe(false);
  });

  it('filters tickets by the station snapshotted on their items (KDS-05)', () => {
    const order = (id: string, stations: (string | null)[]) =>
      ({ id, items: stations.map((station) => ({ station })) }) as unknown as OrderDto;
    const orders = [order('a', ['grill', 'bar']), order('b', ['bar']), order('c', [null])];
    expect(stationsOf(orders)).toEqual(['bar', 'grill']);
    expect(forStation(orders, 'grill').map((o) => o.id)).toEqual(['a']);
    expect(forStation(orders, null)).toHaveLength(3);
  });

  it('keeps a completed ticket only for the grace period (KDS-07)', () => {
    const now = Date.parse('2026-09-25T19:01:00Z');
    expect(stillLingering({ completedAt: '2026-09-25T19:00:30Z' }, now, 60)).toBe(true);
    expect(stillLingering({ completedAt: '2026-09-25T18:59:00Z' }, now, 60)).toBe(false);
    expect(stillLingering({ completedAt: null }, now, 60)).toBe(false);
  });
});
