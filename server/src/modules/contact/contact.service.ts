import type {
  ContactMessageDto,
  CreateContactMessageDto,
  ListContactMessagesQuery,
  Paginated,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { NotFoundError } from '../../lib/errors';
import { publish } from '../../lib/events';
import { prisma } from '../../lib/prisma';
import * as repo from './contact.repo';

const notFound = () => new NotFoundError('MESSAGE_NOT_FOUND', 'No such message.');

export function toContactMessageDto(m: repo.MessageWithBranch): ContactMessageDto {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    kind: m.kind,
    branch: m.branch
      ? { id: m.branch.id, name: { en: m.branch.nameEn, ar: m.branch.nameAr } }
      : null,
    tableNumber: m.tableNumber,
    // A DATE column comes back as UTC midnight; the day is the date part.
    visitDate: m.visitDate ? m.visitDate.toISOString().slice(0, 10) : null,
    message: m.message,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt ? m.readAt.toISOString() : null,
  };
}

/**
 * Save a guest's complaint, suggestion or question (ADR-032) and tell the
 * admin screens after commit. The reply goes by phone, so nothing is echoed
 * back beyond the id.
 * @throws NotFoundError BRANCH_NOT_FOUND
 */
export async function createMessage(dto: CreateContactMessageDto): Promise<{ id: string }> {
  const created = await prisma().$transaction(async (tx) => {
    if (dto.branchId && !(await repo.branchExists(dto.branchId, tx))) {
      throw new NotFoundError('BRANCH_NOT_FOUND', 'No such branch.');
    }
    return repo.create(
      {
        name: dto.name,
        phone: dto.phone,
        kind: dto.kind,
        branchId: dto.branchId ?? null,
        tableNumber: dto.tableNumber ?? null,
        visitDate: dto.visitDate ? new Date(`${dto.visitDate}T00:00:00Z`) : null,
        message: dto.message,
      },
      tx,
    );
  });
  publish(
    'message:new',
    { id: created.id, kind: created.kind, unread: await repo.countUnread() },
    { rooms: ['admin'] },
  );
  return { id: created.id };
}

/** GET /staff/messages: one page, newest first, with the unread count for the nav badge. */
export async function listMessages(
  q: ListContactMessagesQuery,
): Promise<Paginated<ContactMessageDto> & { unread: number }> {
  const { rows, total } = await repo.list(
    {
      ...(q.unread ? { unread: q.unread === 'true' } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.branchId ? { branchId: q.branchId } : {}),
    },
    q.page,
    q.limit,
  );
  return {
    data: rows.map(toContactMessageDto),
    meta: { page: q.page, limit: q.limit, total },
    unread: await repo.countUnread(),
  };
}

/**
 * Mark a message read or unread, audited.
 * @throws NotFoundError MESSAGE_NOT_FOUND
 */
export async function markMessage(
  id: string,
  read: boolean,
  actorId: string,
): Promise<ContactMessageDto> {
  const updated = await prisma().$transaction(async (tx) => {
    const current = await repo.findById(id, tx);
    if (!current) throw notFound();
    // Re-reading keeps the first read time.
    const readAt = read ? (current.readAt ?? new Date()) : null;
    const row = await repo.setReadAt(id, readAt, tx);
    await writeAudit(tx, {
      actorId,
      action: 'CONTACT_MESSAGE_UPDATE',
      entity: 'ContactMessage',
      entityId: id,
      before: { readAt: current.readAt },
      after: { readAt },
    });
    return row;
  });
  return toContactMessageDto(updated);
}
