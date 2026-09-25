import type { Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { RateLimitError } from '../lib/errors';

const passThrough: RequestHandler = (_req, _res, next) => next();

interface LimitSpec {
  windowMs: number;
  limit: number;
  /** Key by the authenticated user instead of the IP (POST /orders). */
  perUser?: boolean;
}

/** Limits from API-CONTRACT §8 / LLD §9. */
export const LIMITS = {
  credentials: { windowMs: 15 * 60_000, limit: 10 },
  refresh: { windowMs: 15 * 60_000, limit: 60 },
  qr: { windowMs: 60_000, limit: 20 },
  orders: { windowMs: 5 * 60_000, limit: 30, perUser: true },
  general: { windowMs: 5 * 60_000, limit: 300 },
} satisfies Record<string, LimitSpec>;

/**
 * Build a limiter that answers 429 RATE_LIMITED with Retry-After through the
 * normal error envelope. Each call gets its own in-memory store, so every app
 * instance (and every test file) starts fresh.
 */
export function limiter(spec: LimitSpec, enabled = true): RequestHandler {
  if (!enabled) return passThrough;
  return rateLimit({
    windowMs: spec.windowMs,
    limit: spec.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...(spec.perUser
      ? { keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'anonymous' }
      : {}),
    handler: (req, res, next, options) => {
      const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit
        ?.resetTime;
      const seconds = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(seconds));
      next(
        new RateLimitError('RATE_LIMITED', `Too many requests. Try again in ${seconds} seconds.`),
      );
    },
  });
}
