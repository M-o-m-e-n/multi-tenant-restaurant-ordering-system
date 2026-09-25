import { randomUUID } from 'node:crypto';

import type { Prisma, RefreshToken, User } from '@prisma/client';

import { getEnv } from '../../config/env';
import { prisma, type Tx } from '../../lib/prisma';
import { hashRefreshToken, newRefreshToken } from './auth.tokens';

type Db = Tx | ReturnType<typeof prisma>;

const DAY_MS = 24 * 60 * 60 * 1000;

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma().user.findUnique({ where: { email } });
}

export function findUserById(id: string, db: Db = prisma()): Promise<User | null> {
  return db.user.findUnique({ where: { id } });
}

export function createUser(data: Prisma.UserCreateInput): Promise<User> {
  return prisma().user.create({ data });
}

export function setUserActive(id: string, isActive: boolean): Promise<User> {
  return prisma().user.update({ where: { id }, data: { isActive } });
}

export function setUserRole(id: string, role: User['role']): Promise<User> {
  return prisma().user.update({ where: { id }, data: { role } });
}

export interface IssueInput {
  userId: string;
  /** Omit to start a new session family (a login); pass it when rotating. */
  familyId?: string;
  userAgent?: string | null;
  ip?: string | null;
}

/**
 * Create a refresh token row and return the raw value exactly once. Only the
 * SHA-256 hash is persisted, so a database disclosure yields nothing usable.
 */
export async function issueRefreshToken(
  input: IssueInput,
  db: Db = prisma(),
): Promise<{ raw: string; row: RefreshToken }> {
  const raw = newRefreshToken();
  const row = await db.refreshToken.create({
    data: {
      userId: input.userId,
      familyId: input.familyId ?? randomUUID(),
      tokenHash: hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + getEnv().REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      userAgent: input.userAgent?.slice(0, 200) ?? null,
      ip: input.ip?.slice(0, 45) ?? null,
    },
  });
  return { raw, row };
}

export function findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
  return prisma().refreshToken.findUnique({ where: { tokenHash } });
}

/**
 * Revoke one token conditionally: zero rows means another request rotated it
 * first, which the caller treats as a replay (CODING-STANDARDS §10).
 */
export async function revokeIfActive(
  id: string,
  replacedById: string | null,
  db: Db,
): Promise<boolean> {
  const { count } = await db.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), replacedById },
  });
  return count === 1;
}

export async function revokeFamily(familyId: string, db: Db = prisma()): Promise<number> {
  const { count } = await db.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

export async function revokeFamilyForUser(familyId: string, userId: string): Promise<number> {
  const { count } = await prisma().refreshToken.updateMany({
    where: { familyId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

export async function revokeAllForUser(userId: string): Promise<number> {
  const { count } = await prisma().refreshToken.updateMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { revokedAt: new Date() },
  });
  return count;
}

/** Every token of the user's live sessions: families with an unrevoked, unexpired token. */
export async function listActiveSessionTokens(userId: string): Promise<RefreshToken[]> {
  const live = await prisma().refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { familyId: true },
  });
  const families = [...new Set(live.map((t) => t.familyId))];
  if (families.length === 0) return [];
  return prisma().refreshToken.findMany({
    where: { familyId: { in: families } },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Delete expired tokens and tokens revoked more than `revokedOlderThanDays`
 * ago (AUTH-14). Recently revoked rows are kept so reuse detection still works.
 */
export async function purgeRefreshTokens(revokedOlderThanDays = 30): Promise<number> {
  const now = new Date();
  const { count } = await prisma().refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - revokedOlderThanDays * DAY_MS) } },
      ],
    },
  });
  return count;
}
