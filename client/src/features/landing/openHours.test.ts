import { describe, expect, it } from 'vitest';

import { hourLabel, hoursRange, openStatus } from './openHours';

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

  it('labels hours past midnight and half hours', () => {
    expect(hourLabel(26, 'en')).toBe('2 am');
    expect(hourLabel(24, 'ar')).toBe('12 ص');
    expect(hourLabel(11.5, 'en')).toBe('11:30 am');
    expect(hoursRange({ open: 11, close: 26 }, 'ar')).toBe('11 ص – 2 ص');
    expect(hoursRange(null, 'en')).toBeNull();
  });
});

describe('openStatus for a branch open 11:00 to 02:00 (Cairo, UTC+3 in September)', () => {
  const LATE = Array.from({ length: 7 }, () => ({ open: 11, close: 26 }));
  const CAIRO = 'Africa/Cairo';

  it('is open at 1 am, counting the night before', () => {
    // Saturday 01:00 in Cairo is Friday 22:00 UTC.
    expect(openStatus(at('2026-09-25T22:00:00Z'), CAIRO, LATE)).toEqual({
      open: true,
      closingSoon: true,
      closesAt: 26,
    });
  });

  it('is open at 11 pm and not yet closing', () => {
    expect(openStatus(at('2026-09-25T20:00:00Z'), CAIRO, LATE)).toMatchObject({
      open: true,
      closingSoon: false,
    });
  });

  it('is closed at 3 am and opens at 11 today', () => {
    expect(openStatus(at('2026-09-26T00:00:00Z'), CAIRO, LATE)).toEqual({
      open: false,
      opens: 'today',
      opensAt: 11,
    });
  });

  it('says nothing about reopening when the whole week is closed', () => {
    const closed = Array.from({ length: 7 }, () => null);
    expect(openStatus(at('2026-09-26T00:00:00Z'), CAIRO, closed)).toEqual({
      open: false,
      opens: null,
    });
  });
});
