import { z } from 'zod';

import { TABLE_STATUSES } from '../domain/enums';

/** QR tokens are 128-bit random hex (TABLE-01). */
export const qrToken = z.string().regex(/^[0-9a-f]{32}$/, 'not a table code');

export const qrTokenParamSchema = z.object({ token: qrToken }).strict();

export const createTableSchema = z
  .object({
    number: z.string().trim().min(1).max(10),
    seats: z.number().int().min(1).max(30).default(4),
  })
  .strict();
export type CreateTableDto = z.infer<typeof createTableSchema>;

export const updateTableSchema = z
  .object({
    number: z.string().trim().min(1).max(10).optional(),
    seats: z.number().int().min(1).max(30).optional(),
    status: z.enum(TABLE_STATUSES).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdateTableDto = z.infer<typeof updateTableSchema>;

/** POST /tables/sessions — the state change a QR scan leads to (LLD §3.5). */
export const openSessionSchema = z.object({ token: qrToken }).strict();
export type OpenSessionDto = z.infer<typeof openSessionSchema>;

export const qrFormatParamSchema = z
  .object({ id: z.string().uuid(), format: z.enum(['svg', 'png']) })
  .strict();

/** What a guest sees about a table: never the token or any PII. */
export interface TableSummaryDto {
  id: string;
  number: string;
  seats: number;
  status: (typeof TABLE_STATUSES)[number];
}

export interface StaffTableDto extends TableSummaryDto {
  isActive: boolean;
  /** Orders at this table not yet completed or cancelled (BR-08). */
  openOrders: number;
}

export interface AdminTableDto extends StaffTableDto {
  qrToken: string;
  qrUrl: string;
}

export interface TableSessionDto {
  table: TableSummaryDto;
  sessionOpenedAt: string;
}
