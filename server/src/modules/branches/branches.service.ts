import type { Prisma } from '@prisma/client';
import { type BranchDto, type UpdateBranchDto, weekHoursSchema } from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { NotFoundError } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as repo from './branches.repo';

const notFound = () => new NotFoundError('BRANCH_NOT_FOUND', 'No such branch.');

/** Seven closed days: what a row with unreadable hours shows rather than a 500. */
const CLOSED_WEEK = Array.from({ length: 7 }, () => null);

export function toBranchDto(b: repo.BranchRow): BranchDto {
  const hours = weekHoursSchema.safeParse(b.hours);
  return {
    id: b.id,
    slug: b.slug,
    name: { en: b.nameEn, ar: b.nameAr },
    address: { en: b.addressEn, ar: b.addressAr },
    phones: b.phones,
    whatsapp: b.whatsapp,
    position: b.lat !== null && b.lng !== null ? { lat: b.lat, lng: b.lng } : null,
    hours: hours.success ? hours.data : CLOSED_WEEK,
    features: b.features,
    isActive: b.isActive,
  };
}

/** GET /branches (public) and GET /staff/branches (admin, with inactive ones). */
export async function listBranches(includeInactive = false): Promise<BranchDto[]> {
  return (await repo.list(includeInactive)).map(toBranchDto);
}

/**
 * Correct a branch's details or move its map pin (ADR-032), audited.
 * @throws NotFoundError BRANCH_NOT_FOUND
 */
export async function updateBranch(
  id: string,
  dto: UpdateBranchDto,
  actorId: string,
): Promise<BranchDto> {
  const updated = await prisma().$transaction(async (tx) => {
    const before = await repo.findById(id, tx);
    if (!before) throw notFound();
    const { hours, ...rest } = dto;
    const data: Prisma.BranchUpdateInput = { ...rest };
    if (hours) data.hours = hours;
    const after = await repo.update(id, data, tx);
    await writeAudit(tx, {
      actorId,
      action: 'BRANCH_UPDATE',
      entity: 'Branch',
      entityId: id,
      before: pick(toBranchDto(before), dto),
      after: pick(toBranchDto(after), dto),
    });
    return after;
  });
  return toBranchDto(updated);
}

/** Only the fields that changed, so the audit diff stays readable. */
function pick(b: BranchDto, dto: UpdateBranchDto): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(dto)) {
    if (key === 'lat' || key === 'lng') out.position = b.position;
    else if (key === 'nameAr' || key === 'nameEn') out.name = b.name;
    else if (key === 'addressAr' || key === 'addressEn') out.address = b.address;
    else out[key] = b[key as keyof BranchDto];
  }
  return out;
}
