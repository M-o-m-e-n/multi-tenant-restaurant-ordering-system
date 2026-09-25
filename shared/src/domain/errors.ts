/**
 * Business-rule failures raised by the pure domain. The server maps each code
 * to an HTTP status in one place; the client switches on the same codes.
 */
export const DOMAIN_ERROR_CODES = [
  'EMPTY_CART',
  'ZERO_TOTAL',
  'DISCOUNT_NOT_FOUND',
  'DISCOUNT_INACTIVE',
  'DISCOUNT_EXPIRED',
  'DISCOUNT_MIN_NOT_MET',
  'DISCOUNT_LIMIT_REACHED',
] as const;
export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
