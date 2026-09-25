import { z } from 'zod';

/** Every id in the system is a UUID string (LLD §1). */
export const uuid = z.string().uuid();

export const idParamSchema = z.object({ id: uuid }).strict();
export type IdParam = z.infer<typeof idParamSchema>;

/** Integer minor units. Money is never a float or a string (API-CONTRACT §1). */
export const cents = z.number().int().safe();
export const nonNegativeCents = cents.nonnegative();

/** A business date, `YYYY-MM-DD`. */
export const businessDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date in YYYY-MM-DD form')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'must be a real date');

/** `page`/`limit` from a query string (API-CONTRACT §6). */
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};

/** Accept a single query value or a repeated one as an array. */
export const repeatable = <T extends z.ZodTypeAny>(item: T) =>
  z.union([item, z.array(item)]).transform((v): z.infer<T>[] => (Array.isArray(v) ? v : [v]));

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}
