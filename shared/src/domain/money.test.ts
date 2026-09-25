import { describe, expect, it } from 'vitest';

import { bps } from './money';

describe('bps', () => {
  it('rounds half away from zero for positive amounts', () => {
    expect(bps(5, 1000)).toBe(1);
  });

  it('rounds half away from zero for negative amounts, unlike Math.round', () => {
    expect(bps(-5, 1000)).toBe(-1);
    // The naive version this helper replaces gets it wrong:
    expect(Math.round((-5 * 1000) / 10_000)).not.toBe(-1);
  });

  it('is symmetric about zero', () => {
    for (const amount of [1, 5, 15, 25, 999, 12345]) {
      for (const rate of [1, 875, 1000, 1250, 3333]) {
        expect(bps(-amount, rate) + bps(amount, rate)).toBe(0);
      }
    }
  });

  it('returns 0, never -0', () => {
    expect(Object.is(bps(-1, 1), 0)).toBe(true);
    expect(Object.is(bps(0, 875), 0)).toBe(true);
  });

  it('applies 875 bps to 1000 cents as 88 with integer arithmetic only', () => {
    expect(bps(1000, 875)).toBe(88);
  });

  it('refuses a fractional amount or rate', () => {
    expect(() => bps(10.5, 100)).toThrow(TypeError);
    expect(() => bps(100, 8.75)).toThrow(TypeError);
  });
});
