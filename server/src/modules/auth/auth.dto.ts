import type { RefreshToken, User } from '@prisma/client';
import type { SessionDto, UserDto } from '@ros/shared';

/**
 * The only way a user leaves the server. passwordHash has no path out
 * (CODING-STANDARDS §11); phone is included only when the caller may see it (NFR-S9).
 */
export function toUserDto(user: User, opts: { includePhone?: boolean } = {}): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(opts.includePhone ? { phone: user.phone } : {}),
  };
}

/** One session (token family) for the session list (AUTH-13). */
export function toSessionDto(
  family: RefreshToken[],
  currentFamilyId: string | undefined,
): SessionDto | null {
  const first = family[0];
  const last = family[family.length - 1];
  if (!first || !last) return null;
  return {
    familyId: first.familyId,
    userAgent: last.userAgent,
    ip: last.ip,
    createdAt: first.createdAt.toISOString(),
    lastUsedAt: last.createdAt.toISOString(),
    current: first.familyId === currentFamilyId,
  };
}
