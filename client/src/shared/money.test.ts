import { describe, expect, it } from 'vitest';

import { formatDelta, formatMoney, parseMoneyInput } from './money';

describe('money', () => {
  it('formats cents as currency', () => {
    expect(formatMoney(1234)).toBe('$12.34');
    expect(formatMoney(0)).toBe('$0.00');
  });

  it('formats signed deltas', () => {
    expect(formatDelta(400)).toBe('+$4.00');
    expect(formatDelta(-100)).toBe('−$1.00');
    expect(formatDelta(0)).toBe('');
  });

  it('parses typed amounts into cents without floats', () => {
    expect(parseMoneyInput('12')).toBe(1200);
    expect(parseMoneyInput('12.5')).toBe(1250);
    expect(parseMoneyInput('$1,234.07')).toBe(123407);
    expect(parseMoneyInput('0.29')).toBe(29);
    expect(parseMoneyInput('12.345')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('-3')).toBeNull();
  });
});
