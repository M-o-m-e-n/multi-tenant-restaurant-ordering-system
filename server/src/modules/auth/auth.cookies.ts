import type { CookieOptions, Request, Response } from 'express';

import { getEnv } from '../../config/env';

/**
 * The refresh cookie. This file is the only code that reads or writes it
 * (CODING-STANDARDS §12): HttpOnly so scripts cannot read it, SameSite=Strict
 * and scoped to the auth path so it rides only on auth calls (AUTH-12, LLD §4.2).
 */
export const REFRESH_COOKIE = 'rt';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

function options(): CookieOptions {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshCookie(res: Response, raw: string): void {
  res.cookie(REFRESH_COOKIE, raw, {
    ...options(),
    maxAge: getEnv().REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, options());
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Device details recorded on a session (AUTH-13). */
export function clientMeta(req: Request): { userAgent: string | null; ip: string | null } {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}
