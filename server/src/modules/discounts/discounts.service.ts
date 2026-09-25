import { type Discount, Prisma } from '@prisma/client';
import {
  bps,
  type CreateDiscountDto,
  type DiscountDto,
  type DiscountRule,
  DomainError,
  evaluateDiscount,
  normalizeDiscountCode,
  type PricingDiscount,
  type UpdateDiscountDto,
  type ValidateDiscountResponse,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { prisma, type Tx } from '../../lib/prisma';
import type { AuthUser } from '../../types/express';
import * as repo from './discounts.repo';

type Db = Tx | ReturnType<typeof prisma>;

export function toDiscountDto(d: Discount): DiscountDto {
  return {
    id: d.id,
    code: d.code,
    type: d.type,
    value: d.value,
    minOrder: d.minOrder,
    startsAt: d.startsAt?.toISOString() ?? null,
    endsAt: d.endsAt?.toISOString() ?? null,
    usageLimit: d.usageLimit,
    usedCount: d.usedCount,
    isActive: d.isActive,
  };
}

const toRule = (d: Discount): DiscountRule => ({
  code: d.code,
  type: d.type,
  value: d.value,
  minOrder: d.minOrder,
  startsAt: d.startsAt,
  endsAt: d.endsAt,
  usageLimit: d.usageLimit,
  usedCount: d.usedCount,
  isActive: d.isActive,
});

export interface AppliedDiscount {
  id: string;
  code: string;
  pricing: PricingDiscount;
}

/**
 * Resolve a promo code against a subtotal (LLD §3.3). Passing never reserves a
 * redemption; placement counts it atomically (DISC-06).
 * @throws DomainError DISCOUNT_NOT_FOUND | DISCOUNT_INACTIVE | DISCOUNT_EXPIRED |
 *   DISCOUNT_MIN_NOT_MET | DISCOUNT_LIMIT_REACHED
 */
export async function applyCode(
  rawCode: string,
  subtotal: number,
  now: Date,
  db: Db = prisma(),
): Promise<AppliedDiscount> {
  const code = normalizeDiscountCode(rawCode);
  const row = await repo.findByCode(code, db);
  const result = evaluateDiscount(row ? toRule(row) : null, subtotal, now);
  if (!result.ok || !row) {
    const failure = result.ok
      ? { code: 'DISCOUNT_NOT_FOUND' as const, message: 'Unknown code.' }
      : result;
    throw new DomainError(failure.code, failure.message, { code });
  }
  return { id: row.id, code: row.code, pricing: result.discount };
}

/**
 * Count one redemption at placement, inside the order transaction. The
 * conditional UPDATE is the whole point: zero rows means another checkout took
 * the last redemption between validation and commit (DISC-06, LLD §3.3).
 * @throws BusinessRuleError DISCOUNT_LIMIT_REACHED, which rolls the order back
 */
export async function redeem(discountId: string, tx: Tx): Promise<void> {
  if ((await repo.redeemIfAvailable(discountId, tx)) === 0) {
    throw new BusinessRuleError(
      'DISCOUNT_LIMIT_REACHED',
      'That code has just been fully redeemed.',
    );
  }
}

/** POST /discounts/validate */
export async function validate(code: string, subtotal: number): Promise<ValidateDiscountResponse> {
  const applied = await applyCode(code, subtotal, new Date());
  const discountAmount =
    applied.pricing.type === 'PERCENT'
      ? Math.min(bps(subtotal, applied.pricing.value), subtotal)
      : Math.min(applied.pricing.value, subtotal);
  return {
    valid: true,
    discount: { code: applied.code, type: applied.pricing.type, value: applied.pricing.value },
    discountAmount,
  };
}

// ---- Admin CRUD (DISC-01) ----

export async function list(): Promise<DiscountDto[]> {
  return (await repo.list()).map(toDiscountDto);
}

function dates(dto: Pick<UpdateDiscountDto, 'startsAt' | 'endsAt'>) {
  const conv = (v: string | null | undefined) =>
    v === undefined ? undefined : v === null ? null : new Date(v);
  return { startsAt: conv(dto.startsAt), endsAt: conv(dto.endsAt) };
}

function codeTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function create(dto: CreateDiscountDto, actor: AuthUser): Promise<DiscountDto> {
  try {
    return await prisma().$transaction(async (tx) => {
      const row = await repo.create(
        { ...dto, minOrder: dto.minOrder ?? 0, usageLimit: dto.usageLimit ?? null, ...dates(dto) },
        tx,
      );
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'DISCOUNT_CREATE',
        entity: 'Discount',
        entityId: row.id,
        after: toDiscountDto(row),
      });
      return toDiscountDto(row);
    });
  } catch (err) {
    if (codeTaken(err))
      throw new ConflictError('DISCOUNT_CODE_TAKEN', `${dto.code} already exists.`);
    throw err;
  }
}

export async function update(
  id: string,
  dto: UpdateDiscountDto,
  actor: AuthUser,
): Promise<DiscountDto> {
  try {
    return await prisma().$transaction(async (tx) => {
      const before = await repo.findById(id, tx);
      if (!before) throw new NotFoundError('DISCOUNT_NOT_FOUND', 'No such discount.');
      const row = await repo.update(id, { ...dto, ...dates(dto) }, tx);
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'DISCOUNT_UPDATE',
        entity: 'Discount',
        entityId: id,
        before: toDiscountDto(before),
        after: toDiscountDto(row),
      });
      return toDiscountDto(row);
    });
  } catch (err) {
    if (codeTaken(err))
      throw new ConflictError('DISCOUNT_CODE_TAKEN', `${dto.code ?? ''} already exists.`);
    throw err;
  }
}

/** Soft delete: past orders keep their own snapshot of the code. */
export async function remove(id: string, actor: AuthUser): Promise<void> {
  await update(id, { isActive: false }, actor);
}
