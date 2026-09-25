import type { User } from '@prisma/client';
import type { UpdateUserDto } from '@ros/shared';

import { prisma } from '../../lib/prisma';

export function listUsers(): Promise<User[]> {
  return prisma().user.findMany({ orderBy: [{ role: 'desc' }, { name: 'asc' }] });
}

export function updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  return prisma().user.update({
    where: { id },
    data: {
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    },
  });
}
