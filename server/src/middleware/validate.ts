import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { ValidationError } from '../lib/errors';
import { zodDetails } from './errors';

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/**
 * Parse params, query and body with the route's shared Zod schemas and replace
 * them with the parsed values. Schemas are `.strict()`, so an unknown field is
 * a 400, not silently dropped (NFR-S5, CODING-STANDARDS §8).
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const part of ['params', 'query', 'body'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const input: unknown = part === 'body' ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(input);
      if (!result.success) {
        next(
          new ValidationError('VALIDATION_ERROR', 'Some fields are missing or invalid.', {
            ...zodDetails(result.error),
            location: part,
          }),
        );
        return;
      }
      // Express 4 exposes these as plain writable properties.
      (req as unknown as Record<string, unknown>)[part] = result.data;
    }
    next();
  };
}

/** Wrap an async handler so a rejection reaches the error middleware (Express 4). */
export function h(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
