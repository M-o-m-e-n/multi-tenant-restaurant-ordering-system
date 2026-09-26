import { z } from 'zod';

/** Every id in the system is a UUID string (LLD §1). */
export const uuid = z.string().uuid();

export const idParamSchema = z.object({ id: uuid }).strict();
export type IdParam = z.infer<typeof idParamSchema>;

/**
 * A phone number as people type it, stored in one international form
 * (M14-S9). Spaces, dashes, dots and brackets are dropped; a `00` prefix
 * becomes `+`; an Egyptian mobile written locally (`010 1362 2622`) becomes
 * `+201013622622`. Anything else must already be E.164-like (`+` and 8–15
 * digits), so any tenant's customers can still be reached.
 */
export function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '');
  if (/^01[0125]\d{8}$/.test(s)) return `+2${s}`;
  if (/^00\d+$/.test(s)) return `+${s.slice(2)}`;
  return s;
}

export const phoneNumber = z
  .string()
  .trim()
  .max(30)
  .transform(normalizePhone)
  .refine((s) => /^\+\d{8,15}$/.test(s), 'Enter a phone number we can reach you on.');

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
