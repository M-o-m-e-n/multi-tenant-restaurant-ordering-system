import type { ContactKind, Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../lib/prisma';

type Db = Tx | ReturnType<typeof prisma>;

const include = {
  branch: { select: { id: true, nameEn: true, nameAr: true } },
} as const;

export type MessageWithBranch = Prisma.ContactMessageGetPayload<{ include: typeof include }>;

export function create(data: Prisma.ContactMessageUncheckedCreateInput, db: Db = prisma()) {
  return db.contactMessage.create({ data, include });
}

export function findById(id: string, db: Db = prisma()) {
  return db.contactMessage.findUnique({ where: { id }, include });
}

export interface MessageFilter {
  unread?: boolean;
  kind?: ContactKind;
  branchId?: string;
}

function where(f: MessageFilter): Prisma.ContactMessageWhereInput {
  return {
    ...(f.unread === undefined ? {} : { readAt: f.unread ? null : { not: null } }),
    ...(f.kind ? { kind: f.kind } : {}),
    ...(f.branchId ? { branchId: f.branchId } : {}),
  };
}

/** Newest first, one page. */
export async function list(f: MessageFilter, page: number, limit: number) {
  const [rows, total] = await prisma().$transaction([
    prisma().contactMessage.findMany({
      where: where(f),
      include,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma().contactMessage.count({ where: where(f) }),
  ]);
  return { rows, total };
}

export function countUnread() {
  return prisma().contactMessage.count({ where: { readAt: null } });
}

export function setReadAt(id: string, readAt: Date | null, db: Db = prisma()) {
  return db.contactMessage.update({ where: { id }, data: { readAt }, include });
}

export function branchExists(id: string, db: Db = prisma()) {
  return db.branch.count({ where: { id, isActive: true } }).then((n) => n > 0);
}
