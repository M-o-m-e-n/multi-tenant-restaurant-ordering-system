import { DomainError } from '@ros/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';

interface ErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown>; requestId: string };
}

/** Field-level errors in the shape API-CONTRACT §5 documents. */
export function zodDetails(err: ZodError): Record<string, unknown> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.') || '(root)';
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return { fieldErrors };
}

/** 404 for any route nothing else handled. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError('ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}.`));
};

/**
 * The single mapping from thrown errors to HTTP. Everything leaves as
 * `{ error: { code, message, details?, requestId } }`; stacks, SQL and Prisma
 * text are logged, never sent (CODING-STANDARDS §9).
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const requestId = req.id;
  let status = 500;
  let body: ErrorBody['error'] = {
    code: 'INTERNAL_ERROR',
    message: 'Something failed on our side. Quote this request id if you contact support.',
    requestId,
  };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, details: err.details, requestId };
  } else if (err instanceof DomainError) {
    // Every domain rejection is a well-formed request refused by a business rule.
    status = 422;
    body = { code: err.code, message: err.message, details: err.details, requestId };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      code: 'VALIDATION_ERROR',
      message: 'Some fields are missing or invalid.',
      details: zodDetails(err),
      requestId,
    };
  } else if (isBodyParserError(err)) {
    status = err.status === 413 ? 413 : 400;
    body = {
      code: err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR',
      message:
        err.status === 413 ? 'The request body is too large.' : 'The body is not valid JSON.',
      requestId,
    };
  }

  if (status >= 500) {
    logger().error({ err, requestId, method: req.method, path: req.path }, 'unhandled error');
  }
  if (!body.details) delete body.details;
  res.status(status).json({ error: body } satisfies ErrorBody);
};

function isBodyParserError(err: unknown): err is { status: number; type: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number' &&
    String((err as { type: unknown }).type).startsWith('entity.')
  );
}
