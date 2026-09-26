import { afterEach, describe, expect, it } from 'vitest';

import { useLangStore } from '../i18n';
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

describe('money in Arabic and EGP', () => {
  afterEach(() => useLangStore.getState().setLang('en'));

  it('shows whole pounds without decimals, in both languages', () => {
    // en-US joins the code and amount with a no-break space.
    expect(formatMoney(9000, 'egp')).toBe('EGP\u00a090');
    expect(formatMoney(9050, 'egp')).toBe('EGP\u00a090.50');
    useLangStore.getState().setLang('ar');
    expect(formatMoney(9000, 'egp')).toBe('90 ج.م');
    expect(formatMoney(145500, 'egp')).toBe('1,455 ج.م');
    expect(formatDelta(-2000, 'egp')).toBe('−20 ج.م');
  });

  it('keeps a foreign currency in its international form inside Arabic text', () => {
    useLangStore.getState().setLang('ar');
    // ar-EG would give "14.00 US$", which RTL layout scrambles into "$US 14.00".
    expect(formatMoney(1400, 'usd')).toBe('$14.00');
  });

  it('keeps Latin digits in Arabic', () => {
    useLangStore.getState().setLang('ar');
    expect(formatMoney(12345, 'egp')).toMatch(/^123\.45 ج\.م$/);
  });

  it('parses Egyptian amounts', () => {
    expect(parseMoneyInput('90 ج.م')).toBe(9000);
    expect(parseMoneyInput('EGP 145')).toBe(14500);
    expect(parseMoneyInput('20 جنيه')).toBe(2000);
  });
});
