import { describe, expect, it } from 'vitest';

import { hourLabel, openStatus } from './openHours';

const NY = 'America/New_York';
// 2026-09-25 is a Friday (open 12–23 New York time; EDT is UTC−4).
const at = (iso: string) => new Date(iso);

describe('openStatus', () => {
  it('is open during service, on the restaurant clock', () => {
    expect(openStatus(at('2026-09-25T23:00:00Z'), NY)).toEqual({
      open: true,
      closingSoon: false,
      closesAt: 23,
    });
  });

  it('warns in the last hour', () => {
    expect(openStatus(at('2026-09-26T02:30:00Z'), NY)).toMatchObject({ closingSoon: true });
  });

  it('is closed before opening and says it opens today', () => {
    expect(openStatus(at('2026-09-25T13:00:00Z'), NY)).toEqual({
      open: false,
      opens: 'today',
      opensAt: 12,
    });
  });

  it('after closing points to tomorrow (Saturday opens 12 pm)', () => {
    expect(openStatus(at('2026-09-26T03:30:00Z'), NY)).toEqual({
      open: false,
      opens: 'tomorrow',
      opensAt: 12,
    });
  });

  it('uses the restaurant zone, not the viewer’s', () => {
    // Same instant, a Cairo restaurant: 21:00 local on a Friday — open until 23.
    expect(openStatus(at('2026-09-25T18:00:00Z'), 'Africa/Cairo')).toMatchObject({ open: true });
  });

  it('labels hours in both languages', () => {
    expect(hourLabel(23, 'en')).toBe('11 pm');
    expect(hourLabel(12, 'en')).toBe('12 pm');
    expect(hourLabel(11, 'ar')).toBe('11 ص');
    expect(hourLabel(23, 'ar')).toBe('11 م');
  });
});
