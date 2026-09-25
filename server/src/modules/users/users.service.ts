import { Prisma, type User } from '@prisma/client';
import type { AdminUserDto, CreateStaffUserDto, UpdateUserDto } from '@ros/shared';

import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { invalidateAuthCache } from '../../middleware/authenticate';
import type { AuthUser } from '../../types/express';
import * as authRepo from '../auth';
import * as repo from './users.repo';

function toAdminUserDto(u: User): AdminUserDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers(): Promise<AdminUserDto[]> {
  return (await repo.listUsers()).map(toAdminUserDto);
}

/** An admin provisions a staff or admin account (AUTH-08). */
export async function createUser(dto: CreateStaffUserDto): Promise<AdminUserDto> {
  try {
    const user = await authRepo.createUser({
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? null,
      role: dto.role,
      passwordHash: await authRepo.hashPassword(dto.password),
    });
    return toAdminUserDto(user);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    throw err;
  }
}

/**
 * Change a user's role or status (ADM-02). Invalidates the auth cache so the
 * change applies to their very next request (AC-18); disabling also revokes
 * every session so no refresh can renew access.
 */
export async function updateUser(
  id: string,
  dto: UpdateUserDto,
  admin: AuthUser,
): Promise<AdminUserDto> {
  if (id === admin.id && (dto.isActive === false || (dto.role && dto.role !== 'ADMIN'))) {
    throw new ForbiddenError('FORBIDDEN', 'You cannot disable or demote your own account.');
  }
  const existing = await authRepo.findUserById(id);
  if (!existing) throw new NotFoundError('USER_NOT_FOUND', 'No such user.');

  const user = await repo.updateUser(id, dto);
  invalidateAuthCache(id);
  if (dto.isActive === false) await authRepo.revokeAllForUser(id);
  return toAdminUserDto(user);
}
