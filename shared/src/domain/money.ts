/**
 * Multiply an amount by a rate in basis points, rounding half away from zero.
 *
 * Symmetric rounding matters: `ModifierItem.priceDelta` may be negative, and
 * `Math.round` is half-toward-+∞ (`Math.round(-0.5)` is `-0`), which would put
 * the client preview and the server charge a cent apart (AC-4, LLD §3.2).
 *
 * @param amountCents integer minor units, may be negative
 * @param rateBps integer basis points (875 = 8.75%)
 * @returns integer minor units
 */
export function bps(amountCents: number, rateBps: number): number {
  assertInteger(amountCents, 'amountCents');
  assertInteger(rateBps, 'rateBps');
  const product = amountCents * rateBps;
  const magnitude = Math.round(Math.abs(product) / 10_000);
  // `|| 0` normalises -0 so callers never see a signed zero.
  return Math.sign(product) * magnitude || 0;
}

/**
 * Guard for the totals chain: money is integer cents and rates are integer
 * basis points, so a fraction here is a programming error (NFR-R2).
 * @throws TypeError when `value` is not a safe integer
 */
export function assertInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${name} must be an integer, got ${value}`);
  }
}
