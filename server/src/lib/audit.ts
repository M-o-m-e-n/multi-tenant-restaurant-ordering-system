import type { Prisma } from '@prisma/client';

import type { Tx } from './prisma';

export interface AuditEntry {
  actorId: string | null;
  /** ENTITY_VERB, e.g. MENU_ITEM_UPDATE (CODING-STANDARDS §3). */
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Record an administrative action with its before/after diff (ADM-04). Called
 * inside the same transaction as the write it describes.
 */
export async function writeAudit(db: Tx, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      diff: JSON.parse(
        JSON.stringify({ before: entry.before ?? null, after: entry.after ?? null }),
      ) as Prisma.InputJsonObject,
    },
  });
}
