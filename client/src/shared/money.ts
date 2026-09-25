/**
 * The one place money becomes text (CODING-STANDARDS §6). Amounts are integer
 * cents everywhere else; the decimal point exists only on screen.
 */
const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency = 'usd'): string {
  const key = currency.toUpperCase();
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: key });
    formatters.set(key, fmt);
  }
  // Division here is display-only; nothing computed from it feeds back into money.
  return fmt.format(cents / 100);
}

/** A signed delta for modifier labels: "+$4.00", "−$1.00", or "" for zero. */
export function formatDelta(cents: number, currency = 'usd'): string {
  if (cents === 0) return '';
  return `${cents > 0 ? '+' : '−'}${formatMoney(Math.abs(cents), currency)}`;
}

/**
 * Parse what a person typed ("12", "12.5", "$12.50") into integer cents,
 * using string arithmetic so no float ever carries the value.
 * @returns cents, or null when the text is not an amount
 */
export function parseMoneyInput(text: string): number | null {
  const cleaned = text.trim().replace(/[$,\s]/g, '');
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}
