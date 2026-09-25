import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { BusinessRuleError } from './errors';
import { prisma, type Tx } from './prisma';

export interface StoredResponse {
  status: number;
  body: unknown;
}

/** Canonical JSON: keys sorted, so the same body always hashes the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function requestHash(body: unknown): string {
  return createHash('sha256').update(canonical(body)).digest('hex');
}

/** Keys are scoped per user and endpoint, so two accounts can never collide (API-CONTRACT §7). */
function scopedKey(key: string, userId: string, endpoint: string): string {
  return createHash('sha256').update(`${userId}\n${endpoint}\n${key}`).digest('hex');
}

export interface IdempotencyContext {
  key: string;
  userId: string;
  endpoint: string;
  hash: string;
}

/**
 * Run `work` at most once per Idempotency-Key (NFR-R5, LLD §2.2).
 *
 * The key row is inserted first, inside the same transaction as the work, so a
 * concurrent duplicate blocks on the primary key until the first commits and
 * then fails; it then reads and replays the stored response. A repeat with a
 * different body is a client bug: 422 IDEMPOTENCY_KEY_REUSED.
 */
export async function withIdempotency<T>(
  ctx: IdempotencyContext | null,
  work: (tx: Tx) => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  if (!ctx) {
    const r = await prisma().$transaction(work);
    return { ...r, replayed: false };
  }
  const id = scopedKey(ctx.key, ctx.userId, ctx.endpoint);

  const existing = await replay<T>(id, ctx.hash);
  if (existing) return existing;

  try {
    const r = await prisma().$transaction(async (tx) => {
      await tx.idempotencyKey.create({
        data: {
          key: id,
          userId: ctx.userId,
          endpoint: ctx.endpoint,
          requestHash: ctx.hash,
          responseStatus: 0,
          responseJson: {},
        },
      });
      const result = await work(tx);
      await tx.idempotencyKey.update({
        where: { key: id },
        data: {
          responseStatus: result.status,
          responseJson: JSON.parse(JSON.stringify(result.body)) as Prisma.InputJsonValue,
        },
      });
      return result;
    });
    return { ...r, replayed: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const again = await replay<T>(id, ctx.hash);
      if (again) return again;
    }
    throw err;
  }
}

async function replay<T>(
  id: string,
  hash: string,
): Promise<{ status: number; body: T; replayed: true } | null> {
  const row = await prisma().idempotencyKey.findUnique({ where: { key: id } });
  if (!row || row.responseStatus === 0) return null;
  if (row.requestHash !== hash) {
    throw new BusinessRuleError(
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a different request. Generate a new key.',
    );
  }
  return { status: row.responseStatus, body: row.responseJson as T, replayed: true };
}

/** Hourly job body: drop keys older than 24 h (LLD §4.10). */
export async function purgeIdempotencyKeys(): Promise<number> {
  const { count } = await prisma().idempotencyKey.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return count;
}
