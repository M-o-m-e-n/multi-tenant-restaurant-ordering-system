import {
  type CreateReservationDto,
  isReservationOverdue,
  RESERVATION_GRACE_MINUTES,
  type ReservationDto,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import { publish } from '../../lib/events';
import { prisma } from '../../lib/prisma';
import { addDays, businessDateOf, zonedTimeToUtc } from '../../lib/time';
import type { AuthUser } from '../../types/express';
import { getSettings } from '../settings';
import { seatById, tableSeated } from '../tables';
import * as repo from './reservations.repo';

/** How far ahead a booking may be made. */
const MAX_DAYS_AHEAD = 90;

const notFound = () => new NotFoundError('RESERVATION_NOT_FOUND', 'No such reservation.');

export function toReservationDto(
  r: repo.ReservationWithTable,
  now: Date = new Date(),
): ReservationDto {
  return {
    id: r.id,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    partySize: r.partySize,
    slotAt: r.slotAt.toISOString(),
    status: r.status,
    notes: r.notes,
    table: r.table,
    overdue: isReservationOverdue(r, now),
  };
}

/**
 * Book a table (TABLE-06). Anyone signed in may book; only staff may pin a
 * specific table at booking time.
 * @throws ForbiddenError FORBIDDEN
 * @throws BusinessRuleError RESERVATION_IN_PAST | RESERVATION_TOO_FAR
 * @throws NotFoundError TABLE_NOT_FOUND
 */
export async function createReservation(
  dto: CreateReservationDto,
  actor: AuthUser,
  now: Date = new Date(),
): Promise<ReservationDto> {
  if (dto.tableId && actor.role === 'CUSTOMER') {
    throw new ForbiddenError('FORBIDDEN', 'Only staff can choose the table for a booking.');
  }
  const slotAt = new Date(dto.slotAt);
  if (slotAt.getTime() <= now.getTime()) {
    throw new BusinessRuleError('RESERVATION_IN_PAST', 'Pick a time that has not passed yet.');
  }
  if (slotAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * 86_400_000) {
    throw new BusinessRuleError(
      'RESERVATION_TOO_FAR',
      `Bookings open ${MAX_DAYS_AHEAD} days ahead.`,
    );
  }
  const created = await prisma().$transaction(async (tx) => {
    if (dto.tableId) {
      const table = await repo.findTable(dto.tableId, tx);
      if (!table?.isActive) throw new NotFoundError('TABLE_NOT_FOUND', 'No such table.');
    }
    const row = await repo.create(
      {
        guestName: dto.guestName,
        guestPhone: dto.guestPhone,
        partySize: dto.partySize,
        slotAt,
        notes: dto.notes ?? null,
        tableId: dto.tableId ?? null,
      },
      tx,
    );
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'RESERVATION_CREATE',
      entity: 'Reservation',
      entityId: row.id,
      after: { slotAt: row.slotAt, partySize: row.partySize, tableId: row.tableId },
    });
    return row;
  });
  return toReservationDto(created, now);
}

/** The bookings on one business date in the restaurant's timezone; today by default. */
export async function listReservations(date?: string): Promise<ReservationDto[]> {
  const { timezone } = await getSettings();
  const now = new Date();
  const day = date ?? businessDateOf(now, timezone);
  const rows = await repo.listBetween(
    zonedTimeToUtc(day, 0, 0, timezone),
    zonedTimeToUtc(addDays(day, 1), 0, 0, timezone),
  );
  return rows.map((r) => toReservationDto(r, now));
}

/**
 * Seat a booking (TABLE-06): the table goes SEATED and the booking SEATED in
 * one transaction, using the table module's conditional FREE → SEATED move.
 * @throws BusinessRuleError TABLE_REQUIRED
 * @throws ConflictError ILLEGAL_TRANSITION | TABLE_DIRTY | TABLE_OCCUPIED | CONCURRENT_UPDATE
 */
export async function seatReservation(
  id: string,
  tableId: string | undefined,
  actor: AuthUser,
): Promise<ReservationDto> {
  const { reservation, table } = await prisma().$transaction(async (tx) => {
    const current = await repo.findById(id, tx);
    if (!current) throw notFound();
    if (current.status !== 'PENDING') {
      throw new ConflictError('ILLEGAL_TRANSITION', `This booking is already ${current.status}.`, {
        from: current.status,
        to: 'SEATED',
      });
    }
    const target = tableId ?? current.tableId;
    if (!target) throw new BusinessRuleError('TABLE_REQUIRED', 'Choose a table to seat them at.');
    const seated = await seatById(target, tx);
    if (!(await repo.transition(tx, id, 'PENDING', { status: 'SEATED', tableId: target }))) {
      throw new ConflictError('CONCURRENT_UPDATE', 'Someone else updated this booking first.');
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'RESERVATION_SEAT',
      entity: 'Reservation',
      entityId: id,
      before: { status: 'PENDING', tableId: current.tableId },
      after: { status: 'SEATED', tableId: target },
    });
    const updated = await repo.findById(id, tx);
    if (!updated) throw notFound();
    return { reservation: updated, table: seated };
  });
  tableSeated(table);
  return toReservationDto(reservation);
}

/** @throws ConflictError ILLEGAL_TRANSITION | CONCURRENT_UPDATE */
export async function cancelReservation(id: string, actor: AuthUser): Promise<ReservationDto> {
  const reservation = await prisma().$transaction(async (tx) => {
    const current = await repo.findById(id, tx);
    if (!current) throw notFound();
    if (current.status !== 'PENDING') {
      throw new ConflictError('ILLEGAL_TRANSITION', `This booking is already ${current.status}.`, {
        from: current.status,
        to: 'CANCELLED',
      });
    }
    if (!(await repo.transition(tx, id, 'PENDING', { status: 'CANCELLED' }))) {
      throw new ConflictError('CONCURRENT_UPDATE', 'Someone else updated this booking first.');
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'RESERVATION_CANCEL',
      entity: 'Reservation',
      entityId: id,
    });
    const updated = await repo.findById(id, tx);
    if (!updated) throw notFound();
    return updated;
  });
  return toReservationDto(reservation);
}

/** Bookings already announced as overdue, so each is flagged once per process. */
const flagged = new Set<string>();

/**
 * The `reservationAlerts` job (TABLE-07, LLD §4.10): every PENDING booking more
 * than the grace period past its slot raises `reservation:flag` to the `pos`
 * room once. Only the last 12 hours are scanned; the list endpoint computes
 * `overdue` itself, so a restart that re-flags is harmless.
 * @returns how many bookings were newly flagged
 */
export async function flagOverdueReservations(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - RESERVATION_GRACE_MINUTES * 60_000);
  const since = new Date(now.getTime() - 12 * 3_600_000);
  const overdue = await repo.pendingBetween(since, cutoff);
  const live = new Set(overdue.map((r) => r.id));
  for (const id of flagged) if (!live.has(id)) flagged.delete(id);
  let count = 0;
  for (const r of overdue) {
    if (flagged.has(r.id)) continue;
    flagged.add(r.id);
    publish('reservation:flag', { reservationId: r.id, state: 'OVERDUE' }, { rooms: ['pos'] });
    count += 1;
  }
  return count;
}

/** Forget what was flagged (tests). */
export function resetReservationFlags(): void {
  flagged.clear();
}
