import { Prisma, type User } from '@prisma/client';
import type { AuthResponse, LoginDto, RegisterDto, UserDto } from '@ros/shared';

import { AuthError, ConflictError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { toUserDto } from './auth.dto';
import { hashPassword, verifyPassword } from './auth.password';
import * as repo from './auth.repo';
import { hashRefreshToken, signAccessToken } from './auth.tokens';

export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

/** An auth result plus the raw refresh token, which only the route puts in a cookie. */
export type SessionGrant = AuthResponse & { refreshToken: string };

async function startSession(user: User, meta: ClientMeta): Promise<SessionGrant> {
  const { raw, row } = await repo.issueRefreshToken({ userId: user.id, ...meta });
  const { token, expiresIn } = await signAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    sessionId: row.familyId,
  });
  return {
    user: toUserDto(user, { includePhone: true }),
    accessToken: token,
    expiresIn,
    refreshToken: raw,
  };
}

/**
 * Register a customer. Staff accounts are provisioned by an admin (AUTH-08),
 * so the role is never taken from the request.
 * @throws ConflictError EMAIL_TAKEN
 */
export async function register(dto: RegisterDto, meta: ClientMeta): Promise<SessionGrant> {
  try {
    const user = await repo.createUser({
      name: dto.name,
      email: dto.email,
      passwordHash: await hashPassword(dto.password),
      role: 'CUSTOMER',
    });
    return await startSession(user, meta);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError(
        'EMAIL_TAKEN',
        'An account with this email already exists. Sign in instead.',
      );
    }
    throw err;
  }
}

/**
 * The same error for an unknown email, a wrong password and a disabled
 * account, so a caller cannot probe which accounts exist (AUTH-02).
 * @throws AuthError INVALID_CREDENTIALS
 */
export async function login(dto: LoginDto, meta: ClientMeta): Promise<SessionGrant> {
  const user = await repo.findUserByEmail(dto.email);
  const ok = await verifyPassword(dto.password, user?.passwordHash ?? null);
  if (!user || !ok || !user.isActive) {
    throw new AuthError('INVALID_CREDENTIALS', 'That email and password do not match.');
  }
  return startSession(user, meta);
}

/** GET /auth/me — the caller, re-read from the database. */
export async function me(userId: string): Promise<UserDto> {
  const user = await repo.findUserById(userId);
  if (!user) throw new AuthError('UNAUTHENTICATED', 'Sign in to continue.');
  return toUserDto(user, { includePhone: true });
}

/** Thrown inside the rotation transaction when another request rotated the token first. */
class LostRotationRace extends Error {}

const invalidRefresh = () =>
  new AuthError('REFRESH_TOKEN_INVALID', 'Your session has ended. Sign in again.');

/**
 * Exchange a refresh token for a new access token, rotating the refresh token
 * (LLD §4.2 refresh algorithm, AUTH-10, AUTH-11). A token that was already
 * rotated means two parties hold it — theft — so its whole family is revoked.
 *
 * @throws AuthError REFRESH_TOKEN_INVALID | SESSION_EXPIRED | SESSION_REVOKED | ACCOUNT_DISABLED
 */
export async function refresh(
  rawToken: string | undefined,
  meta: ClientMeta,
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string }> {
  if (!rawToken) throw invalidRefresh();
  const row = await repo.findRefreshTokenByHash(hashRefreshToken(rawToken));
  if (!row) throw invalidRefresh();
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new AuthError('SESSION_EXPIRED', 'Your session expired. Sign in again.');
  }
  if (row.revokedAt) await reuseDetected(row.familyId);

  const user = await repo.findUserById(row.userId);
  if (!user?.isActive) {
    throw new AuthError('ACCOUNT_DISABLED', 'This account has been disabled. Ask an admin.');
  }

  let next;
  try {
    next = await prisma().$transaction(async (tx) => {
      const issued = await repo.issueRefreshToken(
        { userId: user.id, familyId: row.familyId, ...meta },
        tx,
      );
      // Conditional revoke: zero rows means a concurrent request already rotated it.
      if (!(await repo.revokeIfActive(row.id, issued.row.id, tx))) throw new LostRotationRace();
      return issued;
    });
  } catch (err) {
    if (err instanceof LostRotationRace) await reuseDetected(row.familyId);
    throw err;
  }

  const { token, expiresIn } = await signAccessToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    sessionId: row.familyId,
  });
  return { accessToken: token, expiresIn, refreshToken: next.raw };
}

async function reuseDetected(familyId: string): Promise<never> {
  await repo.revokeFamily(familyId);
  throw new AuthError(
    'SESSION_REVOKED',
    'For your safety this session was ended on every device. Sign in again.',
  );
}
