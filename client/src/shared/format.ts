import { localeOf, useLangStore } from '../i18n';

/**
 * Dates and times as text, in the reader's language (Latin digits in Arabic,
 * matching how Egyptian menus and receipts write numbers). Instants render in
 * the device's zone unless a restaurant `timeZone` is passed.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const locale = localeOf(useLangStore.getState().lang);
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}

/** "7:30 PM" / "7:30 م" */
export const formatTime = (iso: string | Date, timeZone?: string) =>
  fmt({ hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) }).format(
    new Date(iso),
  );

/** "Sep 25, 2026, 7:30 PM" */
export const formatDateTime = (iso: string | Date, timeZone?: string) =>
  fmt({ dateStyle: 'medium', timeStyle: 'short', ...(timeZone ? { timeZone } : {}) }).format(
    new Date(iso),
  );

/** "Friday, September 25" */
export const formatLongDate = (iso: string | Date, timeZone?: string) =>
  fmt({ weekday: 'long', month: 'long', day: 'numeric', ...(timeZone ? { timeZone } : {}) }).format(
    new Date(iso),
  );

/** A plain number with grouping: "1,200". */
export const formatNumber = (n: number, decimals = 0) =>
  n.toLocaleString(localeOf(useLangStore.getState().lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
