import { z } from 'zod';

import { businessDate, paginationShape, phoneNumber, uuid } from './common';

export const CONTACT_KINDS = ['COMPLAINT', 'SUGGESTION', 'QUESTION'] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];

/**
 * POST /contact (ADR-032): the public feedback form, mirroring the fields on
 * the restaurant's current site. Anyone may send one; it lands in the admin
 * inbox.
 */
export const createContactMessageSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: phoneNumber,
    kind: z.enum(CONTACT_KINDS),
    branchId: uuid.optional(),
    tableNumber: z.string().trim().min(1).max(10).optional(),
    visitDate: businessDate.optional(),
    message: z.string().trim().min(5).max(1000),
  })
  .strict();
export type CreateContactMessageDto = z.infer<typeof createContactMessageSchema>;

/** GET /staff/messages */
export const listContactMessagesQuerySchema = z
  .object({
    unread: z.enum(['true', 'false']).optional(),
    kind: z.enum(CONTACT_KINDS).optional(),
    branchId: uuid.optional(),
    ...paginationShape,
  })
  .strict();
export type ListContactMessagesQuery = z.infer<typeof listContactMessagesQuerySchema>;

/** PATCH /staff/messages/:id — mark read or unread. */
export const updateContactMessageSchema = z.object({ read: z.boolean() }).strict();
export type UpdateContactMessageDto = z.infer<typeof updateContactMessageSchema>;

export interface ContactMessageDto {
  id: string;
  name: string;
  phone: string;
  kind: ContactKind;
  branch: { id: string; name: { en: string; ar: string } } | null;
  tableNumber: string | null;
  visitDate: string | null;
  message: string;
  /** ISO instant. */
  createdAt: string;
  readAt: string | null;
}
