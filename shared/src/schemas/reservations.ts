import { z } from 'zod';

import type { ReservationStatus } from '../domain/enums';
import { businessDate, uuid } from './common';

/** Minutes past its slot after which a PENDING booking is flagged overdue (TABLE-07). */
export const RESERVATION_GRACE_MINUTES = 15;

/** POST /reservations (TABLE-06). Only staff may pin a table at booking time. */
export const createReservationSchema = z
  .object({
    guestName: z.string().trim().min(1).max(120),
    guestPhone: z.string().trim().min(5).max(30),
    partySize: z.number().int().min(1).max(20),
    slotAt: z.string().datetime({ offset: true }),
    notes: z.string().trim().max(300).optional(),
    tableId: uuid.optional(),
  })
  .strict();
export type CreateReservationDto = z.infer<typeof createReservationSchema>;

/** GET /reservations?date= — a business date in the restaurant's timezone; today by default. */
export const listReservationsQuerySchema = z.object({ date: businessDate.optional() }).strict();
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;

/** PATCH /reservations/:id — seat (onto its own or a chosen table) or cancel. */
export const updateReservationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('seat'), tableId: uuid.optional() }).strict(),
  z.object({ action: z.literal('cancel') }).strict(),
]);
export type UpdateReservationDto = z.infer<typeof updateReservationSchema>;

export interface ReservationDto {
  id: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  /** ISO instant. */
  slotAt: string;
  status: ReservationStatus;
  notes: string | null;
  table: { id: string; number: string } | null;
  /** PENDING and more than RESERVATION_GRACE_MINUTES past its slot (TABLE-07). */
  overdue: boolean;
}

/** Whether a booking is overdue at `now` (TABLE-07). */
export function isReservationOverdue(
  r: { status: ReservationStatus; slotAt: Date | string },
  now: Date,
): boolean {
  const slot = new Date(r.slotAt).getTime();
  return r.status === 'PENDING' && now.getTime() > slot + RESERVATION_GRACE_MINUTES * 60_000;
}
