import { brand } from '../brand';
import { localeOf, useLangStore } from '../i18n';

/**
 * The one place money becomes text (CODING-STANDARDS §6). Amounts are integer
 * minor units (cents, piastres) everywhere else; the decimal point exists only
 * on screen. The currency is the tenant's (brand) and the language is the
 * reader's, so the same 9000 reads "90 ج.م" or "EGP 90".
 */
const formatters = new Map<string, Intl.NumberFormat>();

/** Currencies whose menus are priced in whole units: decimals only when needed. */
const WHOLE_UNIT = new Set(['EGP']);

/** Egyptian menus write the pound as "ج.م" after the number, without bidi marks. */
const ARABIC_SYMBOL: Record<string, string> = { EGP: 'ج.م' };

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    formatters.set(key, fmt);
  }
  return fmt;
}

export function formatMoney(cents: number, currency: string = brand.currency): string {
  const code = currency.toUpperCase();
  const lang = useLangStore.getState().lang;
  const locale = localeOf(lang);
  const digits = WHOLE_UNIT.has(code) && cents % 100 === 0 ? 0 : 2;
  // Division here is display-only; nothing computed from it feeds back into money.
  const value = cents / 100;
  const arabicSymbol = ARABIC_SYMBOL[code];
  if (lang === 'ar' && arabicSymbol) {
    const n = formatter(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${n.format(value)} ${arabicSymbol}`;
  }
  // A currency without an Arabic symbol keeps its international form ("$14.00"):
  // ar-EG would write "14.00 US$", which bidi reorders into "$US 14.00".
  return formatter(lang === 'ar' ? 'en-US' : locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** A signed delta for modifier labels: "+$4.00", "−$1.00", or "" for zero. */
export function formatDelta(cents: number, currency: string = brand.currency): string {
  if (cents === 0) return '';
  return `${cents > 0 ? '+' : '−'}${formatMoney(Math.abs(cents), currency)}`;
}

/**
 * Parse what a person typed ("12", "12.5", "$12.50", "90 ج.م", "EGP 90") into
 * integer minor units, using string arithmetic so no float ever carries the value.
 * @returns cents, or null when the text is not an amount
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text
    .trim()
    .replace(/ج\.?م\.?|جنيه|EGP|US\$|\$/gi, '')
    .replace(/[,\s‎‏]/g, '');
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}
