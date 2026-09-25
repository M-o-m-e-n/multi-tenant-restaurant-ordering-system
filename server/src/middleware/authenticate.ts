import type { Role } from '@ros/shared';
import type { RequestHandler } from 'express';

import { AuthError, ForbiddenError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../modules/auth/auth.tokens';
import type { AuthUser } from '../types/express';

interface CachedUser {
  role: Role;
  name: string;
  isActive: boolean;
  at: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CachedUser>();

/**
 * Drop a user's cached role and status. Every write that changes either
 * (disable, demote) calls this, so the next request sees it at once (AC-18).
 */
export function invalidateAuthCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function currentUser(userId: string): Promise<CachedUser | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  const user = await prisma().user.findUnique({
    where: { id: userId },
    select: { role: true, name: true, isActive: true },
  });
  if (!user) {
    cache.delete(userId);
    return null;
  }
  const entry = { ...user, at: Date.now() };
  cache.set(userId, entry);
  return entry;
}

/**
 * Resolve the caller from a bearer access token. The token's role is only a
 * hint: role and isActive are re-read from the database (60 s cache,
 * invalidated on change), so disabling or demoting an account takes effect on
 * the next request rather than at token expiry (ADM-02, AUTH-08, AC-18).
 */
export async function resolveUser(token: string): Promise<AuthUser> {
  const claims = await verifyAccessToken(token);
  const user = await currentUser(claims.userId);
  if (!user) throw new AuthError('UNAUTHENTICATED', 'Sign in to continue.');
  if (!user.isActive) {
    throw new AuthError('ACCOUNT_DISABLED', 'This account has been disabled. Ask an admin.');
  }
  return { id: claims.userId, role: user.role, name: user.name, sessionId: claims.sessionId };
}

function bearer(header: string | undefined): string | undefined {
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1];
}

/** Require a valid access token; sets req.user or answers 401. */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = bearer(req.get('authorization'));
  if (!token) {
    next(new AuthError('UNAUTHENTICATED', 'Sign in to continue.'));
    return;
  }
  resolveUser(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
};

/**
 * Attach req.user when a valid token is present; carry on anonymously when
 * none is sent. A token that is present but invalid is still rejected.
 */
export const optionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.get('authorization')) {
    next();
    return;
  }
  authenticate(req, res, next);
};

/**
 * Route-level role gate (NFR-S4). Ownership is re-checked in the service;
 * this alone cannot stop one customer reading another's order.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new AuthError('UNAUTHENTICATED', 'Sign in to continue.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('FORBIDDEN', 'Your role cannot do this.'));
      return;
    }
    next();
  };
}

/** The caller, for handlers behind `authenticate`. */
export function actor(req: Express.Request): AuthUser {
  if (!req.user) throw new AuthError('UNAUTHENTICATED', 'Sign in to continue.');
  return req.user;
}
