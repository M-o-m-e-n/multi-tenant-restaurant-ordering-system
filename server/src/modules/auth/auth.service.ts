import { Prisma, type User } from '@prisma/client';
import type { AuthResponse, LoginDto, RegisterDto } from '@ros/shared';

import { AuthError, ConflictError } from '../../lib/errors';
import { toUserDto } from './auth.dto';
import { hashPassword, verifyPassword } from './auth.password';
import * as repo from './auth.repo';
import { signAccessToken } from './auth.tokens';

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
