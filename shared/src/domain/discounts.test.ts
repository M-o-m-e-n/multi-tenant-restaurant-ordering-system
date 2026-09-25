import { describe, expect, it } from 'vitest';

import { type DiscountRule, evaluateDiscount, normalizeDiscountCode } from './discounts';

const now = new Date('2026-09-25T12:00:00Z');

const rule = (overrides: Partial<DiscountRule> = {}): DiscountRule => ({
  code: 'SAVE10',
  type: 'PERCENT',
  value: 1000,
  minOrder: 0,
  startsAt: null,
  endsAt: null,
  usageLimit: null,
  usedCount: 0,
  isActive: true,
  ...overrides,
});

const codeOf = (r: DiscountRule | null, subtotal = 5000) => {
  const result = evaluateDiscount(r, subtotal, now);
  return result.ok ? 'OK' : result.code;
};

describe('evaluateDiscount', () => {
  it('accepts a valid code and returns its pricing shape', () => {
    expect(evaluateDiscount(rule(), 5000, now)).toEqual({
      ok: true,
      discount: { type: 'PERCENT', value: 1000 },
    });
  });

  it('reports DISCOUNT_NOT_FOUND for an unknown code', () => {
    expect(codeOf(null)).toBe('DISCOUNT_NOT_FOUND');
  });

  it('reports DISCOUNT_INACTIVE for a disabled code or one not yet started', () => {
    expect(codeOf(rule({ isActive: false }))).toBe('DISCOUNT_INACTIVE');
    expect(codeOf(rule({ startsAt: new Date('2026-10-01T00:00:00Z') }))).toBe('DISCOUNT_INACTIVE');
  });

  it('reports DISCOUNT_EXPIRED after the window closes', () => {
    expect(codeOf(rule({ endsAt: new Date('2026-09-01T00:00:00Z') }))).toBe('DISCOUNT_EXPIRED');
  });

  it('reports DISCOUNT_MIN_NOT_MET below the minimum order', () => {
    expect(codeOf(rule({ minOrder: 6000 }), 5999)).toBe('DISCOUNT_MIN_NOT_MET');
    expect(codeOf(rule({ minOrder: 6000 }), 6000)).toBe('OK');
  });

  it('reports DISCOUNT_LIMIT_REACHED once redemptions hit the limit', () => {
    expect(codeOf(rule({ usageLimit: 5, usedCount: 5 }))).toBe('DISCOUNT_LIMIT_REACHED');
    expect(codeOf(rule({ usageLimit: 5, usedCount: 4 }))).toBe('OK');
  });

  it('treats the window bounds as inclusive', () => {
    expect(codeOf(rule({ startsAt: now, endsAt: now }))).toBe('OK');
  });
});

describe('normalizeDiscountCode', () => {
  it('trims and upper-cases', () => {
    expect(normalizeDiscountCode('  save10 ')).toBe('SAVE10');
  });
});
