import { describe, expect, it } from 'vitest';

import { addDays, businessDateOf, localClock, withinWindow, zonedTimeToUtc } from './time';

describe('time helpers', () => {
  it('files 00:30 local in a UTC+3 zone under the local day, not the UTC one (AC-16)', () => {
    const instant = new Date('2026-09-24T21:30:00Z'); // 00:30 on the 25th in Moscow (UTC+3)
    expect(businessDateOf(instant, 'Europe/Moscow')).toBe('2026-09-25');
    expect(businessDateOf(instant, 'UTC')).toBe('2026-09-24');
  });

  it('converts a local wall-clock time to UTC', () => {
    expect(zonedTimeToUtc('2026-09-25', 19, 30, 'America/New_York').toISOString()).toBe(
      '2026-09-25T23:30:00.000Z',
    );
    expect(zonedTimeToUtc('2026-01-15', 19, 30, 'America/New_York').toISOString()).toBe(
      '2026-01-16T00:30:00.000Z',
    );
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('schedule windows', () => {
  it('reads the local wall clock in the restaurant timezone', () => {
    expect(localClock(new Date('2026-09-25T13:05:00Z'), 'America/New_York')).toBe('09:05');
  });

  it('keeps breakfast in at 09:00 and out at 15:00 (MENU-06)', () => {
    expect(withinWindow('09:00', '07:00', '11:00')).toBe(true);
    expect(withinWindow('15:00', '07:00', '11:00')).toBe(false);
    expect(withinWindow('11:00', '07:00', '11:00')).toBe(false);
  });

  it('handles a window that runs past midnight', () => {
    expect(withinWindow('23:30', '22:00', '02:00')).toBe(true);
    expect(withinWindow('01:00', '22:00', '02:00')).toBe(true);
    expect(withinWindow('12:00', '22:00', '02:00')).toBe(false);
  });

  it('treats no window as always available', () => {
    expect(withinWindow('03:00', null, null)).toBe(true);
  });
});
