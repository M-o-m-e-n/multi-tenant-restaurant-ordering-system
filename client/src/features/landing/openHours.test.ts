import { describe, expect, it } from 'vitest';

import { openStatus } from './openHours';

const NY = 'America/New_York';
// 2026-09-25 is a Friday (open 12–23 New York time; EDT is UTC−4).
const at = (iso: string) => new Date(iso);

describe('openStatus', () => {
  it('is open during service, on the restaurant clock', () => {
    const s = openStatus(at('2026-09-25T23:00:00Z'), NY); // 19:00 local
    expect(s).toEqual({ open: true, label: 'Open now · kitchen closes 11 pm' });
  });

  it('warns in the last hour', () => {
    expect(openStatus(at('2026-09-26T02:30:00Z'), NY).label).toBe(
      'Closing soon · kitchen closes 11 pm',
    );
  });

  it('is closed before opening and says when it opens today', () => {
    expect(openStatus(at('2026-09-25T13:00:00Z'), NY)).toEqual({
      open: false,
      label: 'Closed · opens 12 pm today',
    });
  });

  it('after closing points to tomorrow (Saturday opens 12 pm)', () => {
    expect(openStatus(at('2026-09-26T03:30:00Z'), NY).label).toBe('Closed · opens 12 pm tomorrow');
  });

  it('uses the restaurant zone, not the viewer’s: 19:00 UTC is still before noon in Tokyo’s tomorrow', () => {
    // Same instant, different restaurant zone: Tokyo is already Saturday 04:00.
    expect(openStatus(at('2026-09-25T19:00:00Z'), 'Asia/Tokyo').label).toBe(
      'Closed · opens 12 pm today',
    );
  });
});
