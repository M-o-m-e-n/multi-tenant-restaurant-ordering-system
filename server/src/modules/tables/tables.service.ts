import { randomBytes } from 'node:crypto';

import { Prisma, type Table } from '@prisma/client';
import type {
  AdminTableDto,
  CreateTableDto,
  StaffTableDto,
  TableSessionDto,
  TableSummaryDto,
  UpdateTableDto,
} from '@ros/shared';
import QRCode from 'qrcode';

import { getEnv } from '../../config/env';
import { writeAudit } from '../../lib/audit';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { publish } from '../../lib/events';
import { prisma, type Tx } from '../../lib/prisma';
import type { AuthUser } from '../../types/express';
import * as repo from './tables.repo';

/** 16 random bytes, hex: 128 bits nobody can guess (TABLE-01, R8). */
export const newQrToken = (): string => randomBytes(16).toString('hex');

export const qrUrl = (token: string): string => `${getEnv().PUBLIC_APP_URL}/t/${token}`;

const toSummary = (t: Table): TableSummaryDto => ({
  id: t.id,
  number: t.number,
  seats: t.seats,
  status: t.status,
});

function toStaffDto(t: repo.TableWithOpenOrders): StaffTableDto {
  return { ...toSummary(t), isActive: t.isActive, openOrders: t._count.orders };
}

const notFound = () => new NotFoundError('TABLE_NOT_FOUND', 'No such table.');
const byNumber = (a: { number: string }, b: { number: string }) =>
  a.number.localeCompare(b.number, undefined, { numeric: true });

function announce(t: Table): void {
  publish(
    'table:changed',
    { tableId: t.id, number: t.number, status: t.status },
    {
      rooms: ['pos', 'admin'],
    },
  );
}

/** The table map (TABLE-04). Admins also get each token and its QR link. */
export async function listTables(viewer: AuthUser): Promise<(StaffTableDto | AdminTableDto)[]> {
  const rows = (await repo.listTables()).sort(byNumber);
  return rows.map((t) =>
    viewer.role === 'ADMIN'
      ? { ...toStaffDto(t), qrToken: t.qrToken, qrUrl: qrUrl(t.qrToken) }
      : toStaffDto(t),
  );
}

function numberTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** @throws ConflictError TABLE_NUMBER_TAKEN */
export async function createTable(dto: CreateTableDto, actor: AuthUser): Promise<AdminTableDto> {
  try {
    const table = await prisma().$transaction(async (tx) => {
      const created = await repo.create({ ...dto, qrToken: newQrToken() }, tx);
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'TABLE_CREATE',
        entity: 'Table',
        entityId: created.id,
        after: { number: created.number, seats: created.seats },
      });
      return created;
    });
    announce(table);
    return {
      ...toSummary(table),
      isActive: true,
      openOrders: 0,
      qrToken: table.qrToken,
      qrUrl: qrUrl(table.qrToken),
    };
  } catch (err) {
    if (numberTaken(err))
      throw new ConflictError('TABLE_NUMBER_TAKEN', `Table ${dto.number} already exists.`);
    throw err;
  }
}

/**
 * Staff may mark a table's status from the map (TABLE-04); renaming, seats and
 * retiring a table are admin changes.
 */
export async function updateTable(
  id: string,
  dto: UpdateTableDto,
  actor: AuthUser,
): Promise<StaffTableDto> {
  const structural =
    dto.number !== undefined || dto.seats !== undefined || dto.isActive !== undefined;
  if (structural && actor.role !== 'ADMIN') {
    throw new ForbiddenError('FORBIDDEN', 'Only an admin can rename, resize or retire a table.');
  }
  try {
    const table = await prisma().$transaction(async (tx) => {
      const before = await repo.findById(id, tx);
      if (!before) throw notFound();
      const after = await repo.update(id, dto, tx);
      await writeAudit(tx, {
        actorId: actor.id,
        action: 'TABLE_UPDATE',
        entity: 'Table',
        entityId: id,
        before: toSummary(before),
        after: toSummary(after),
      });
      return after;
    });
    announce(table);
    const fresh = await repo.findWithOpenOrders(table.id);
    if (!fresh) throw notFound();
    return toStaffDto(fresh);
  } catch (err) {
    if (numberTaken(err))
      throw new ConflictError('TABLE_NUMBER_TAKEN', `Table ${dto.number ?? ''} already exists.`);
    throw err;
  }
}

/** Issue a new token; the old one stops resolving at once (M5-S6). */
export async function regenerateQr(
  id: string,
  actor: AuthUser,
): Promise<{ qrToken: string; qrUrl: string }> {
  const table = await prisma().$transaction(async (tx) => {
    if (!(await repo.findById(id, tx))) throw notFound();
    const updated = await repo.update(id, { qrToken: newQrToken() }, tx);
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'TABLE_QR_REGENERATE',
      entity: 'Table',
      entityId: id,
    });
    return updated;
  });
  return { qrToken: table.qrToken, qrUrl: qrUrl(table.qrToken) };
}

/**
 * Resolve a QR token to its table. **Read-only**: link previews, prefetchers
 * and crawlers fire GETs, so this must never seat a table (LLD §3.5, AC-12).
 * @throws NotFoundError TABLE_NOT_FOUND
 */
export async function resolveQr(
  token: string,
  db: Tx | ReturnType<typeof prisma> = prisma(),
): Promise<Table> {
  const table = await repo.findByToken(token, db);
  if (!table?.isActive) throw notFound();
  return table;
}

export async function resolveQrSummary(token: string): Promise<TableSummaryDto> {
  return toSummary(await resolveQr(token));
}

/**
 * Seat the table behind a token inside the caller's transaction: FREE becomes
 * SEATED, SEATED is joined as it is, DIRTY is refused. Shared by the QR
 * session and by dine-in order placement (LLD §4.4 step 9).
 * @returns the table, and whether this call seated it
 * @throws ConflictError TABLE_DIRTY
 */
export async function seatByToken(
  token: string,
  tx: Tx,
): Promise<{ table: Table; seated: boolean }> {
  const table = await resolveQr(token, tx);
  if (table.status === 'DIRTY') {
    throw new ConflictError(
      'TABLE_DIRTY',
      `Table ${table.number} is being cleared. Ask a member of staff.`,
    );
  }
  if (table.status === 'FREE' && (await repo.transition(table.id, 'FREE', 'SEATED', tx))) {
    return { table: { ...table, status: 'SEATED' }, seated: true };
  }
  // Already seated, or seated a moment ago by another guest at the same table.
  const current = await repo.findById(table.id, tx);
  if (current?.status === 'DIRTY') {
    throw new ConflictError(
      'TABLE_DIRTY',
      `Table ${table.number} is being cleared. Ask a member of staff.`,
    );
  }
  return { table: current ?? table, seated: false };
}

/** POST /tables/sessions: the state change a QR scan leads to (TABLE-03). */
export async function openSession(token: string): Promise<TableSessionDto> {
  const { table, seated } = await prisma().$transaction((tx) => seatByToken(token, tx));
  if (seated) announce(table);
  return { table: toSummary(table), sessionOpenedAt: new Date().toISOString() };
}

/** Tell listeners a table was seated by order placement (after commit). */
export function tableSeated(table: Table): void {
  announce({ ...table, status: 'SEATED' });
}

/**
 * SEATED → DIRTY, refused while any order at the table is still open (BR-08, AC-11).
 * @throws ConflictError TABLE_HAS_OPEN_ORDERS | TABLE_NOT_SEATED
 */
export async function closeTable(id: string, actor: AuthUser): Promise<TableSummaryDto> {
  const table = await prisma().$transaction(async (tx) => {
    const current = await repo.findById(id, tx);
    if (!current) throw notFound();
    if (current.status !== 'SEATED') {
      throw new ConflictError('TABLE_NOT_SEATED', `Table ${current.number} is not seated.`);
    }
    const open = await repo.openOrders(id, tx);
    if (open.length > 0) {
      throw new ConflictError(
        'TABLE_HAS_OPEN_ORDERS',
        `Table ${current.number} still has ${open.length} open order${open.length === 1 ? '' : 's'}.`,
        { orders: open },
      );
    }
    if (!(await repo.transition(id, 'SEATED', 'DIRTY', tx))) {
      throw new ConflictError('CONCURRENT_UPDATE', 'The table changed; refresh and try again.');
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'TABLE_CLOSE',
      entity: 'Table',
      entityId: id,
    });
    return { ...current, status: 'DIRTY' as const };
  });
  announce(table);
  return toSummary(table);
}

/**
 * DIRTY → FREE: the step that actually frees the table (TABLE-02).
 * @throws ConflictError TABLE_NOT_DIRTY
 */
export async function cleanTable(id: string, actor: AuthUser): Promise<TableSummaryDto> {
  const table = await prisma().$transaction(async (tx) => {
    const current = await repo.findById(id, tx);
    if (!current) throw notFound();
    if (!(await repo.transition(id, 'DIRTY', 'FREE', tx))) {
      throw new ConflictError('TABLE_NOT_DIRTY', `Table ${current.number} does not need clearing.`);
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'TABLE_CLEAN',
      entity: 'Table',
      entityId: id,
    });
    return { ...current, status: 'FREE' as const };
  });
  announce(table);
  return toSummary(table);
}

/** A printable QR code for a table, encoding PUBLIC_APP_URL/t/<token> (SRS §5.2). */
export async function qrImage(
  id: string,
  format: 'svg' | 'png',
): Promise<{ body: string | Buffer; contentType: string; number: string }> {
  const table = await repo.findById(id);
  if (!table) throw notFound();
  const url = qrUrl(table.qrToken);
  const options = { errorCorrectionLevel: 'M' as const, margin: 2, width: 512 };
  return format === 'svg'
    ? {
        body: await QRCode.toString(url, { ...options, type: 'svg' }),
        contentType: 'image/svg+xml',
        number: table.number,
      }
    : { body: await QRCode.toBuffer(url, options), contentType: 'image/png', number: table.number };
}
