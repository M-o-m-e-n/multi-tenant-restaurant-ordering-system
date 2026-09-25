import { z } from 'zod';

import { DISCOUNT_TYPES } from '../domain/enums';
import type { PricingBreakdown } from '../domain/pricing';
import { nonNegativeCents } from './common';

const code = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, 'letters, digits, dashes and underscores only')
  .transform((c) => c.toUpperCase());

const discountShape = {
  code,
  type: z.enum(DISCOUNT_TYPES),
  /** Basis points when PERCENT (1000 = 10%), cents when FIXED. */
  value: z.number().int().positive().max(1_000_000),
  minOrder: nonNegativeCents.max(10_000_000).optional(),
  startsAt: z.string().datetime().nullish(),
  endsAt: z.string().datetime().nullish(),
  usageLimit: z.number().int().positive().nullish(),
};

export const createDiscountSchema = z
  .object(discountShape)
  .strict()
  .refine((d) => d.type !== 'PERCENT' || d.value <= 10_000, {
    path: ['value'],
    message: 'A percent discount is at most 10000 basis points (100%).',
  });
export type CreateDiscountDto = z.infer<typeof createDiscountSchema>;

export const updateDiscountSchema = z
  .object({ ...discountShape, isActive: z.boolean() })
  .partial()
  .strict();
export type UpdateDiscountDto = z.infer<typeof updateDiscountSchema>;

/** POST /discounts/validate */
export const validateDiscountSchema = z
  .object({ code: z.string().trim().min(1).max(40), subtotal: nonNegativeCents })
  .strict();
export type ValidateDiscountDto = z.infer<typeof validateDiscountSchema>;

export interface DiscountDto {
  id: string;
  code: string;
  type: (typeof DISCOUNT_TYPES)[number];
  value: number;
  minOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export interface ValidateDiscountResponse {
  valid: true;
  discount: Pick<DiscountDto, 'code' | 'type' | 'value'>;
  discountAmount: number;
}

/** POST /orders/preview response (API-CONTRACT §12). */
export interface PreviewResponse {
  totals: PricingBreakdown & { currency: string };
  lines: { menuItemId: string; lineTotal: number }[];
  /** The applied code, so the client can price with it too (additive to API-CONTRACT §12). */
  discount: Pick<DiscountDto, 'code' | 'type' | 'value'> | null;
}
