/**
 * One typed hierarchy; exactly one place (middleware/errors.ts) turns it into
 * HTTP (CODING-STANDARDS §9, LLD §8). Every error carries a specific code the
 * client switches on; the message is for humans and may change.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;

  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
}

export class AuthError extends AppError {
  readonly status = 401;
}

export class ForbiddenError extends AppError {
  readonly status = 403;
}

export class NotFoundError extends AppError {
  readonly status = 404;
}

export class ConflictError extends AppError {
  readonly status = 409;
}

export class BusinessRuleError extends AppError {
  readonly status = 422;
}

export class RateLimitError extends AppError {
  readonly status = 429;
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
}
