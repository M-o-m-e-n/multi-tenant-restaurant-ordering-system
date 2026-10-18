import { z } from 'zod';

import { phoneNumber } from './common';

/**
 * Opening hours for one weekday, on the restaurant clock. `close` may pass
 * midnight: 26 means 02:00 the next morning, so "11:00–02:00" is
 * `{ open: 11, close: 26 }` and still belongs to the day it opened.
 */
export const dayHoursSchema = z
  .object({
    open: z.number().min(0).max(23.99),
    close: z.number().min(0.5).max(30),
  })
  .strict()
  .refine((h) => h.close > h.open, 'must close after it opens');
export type DayHours = z.infer<typeof dayHoursSchema>;

/** Seven entries, Sunday first; `null` is a closed day. */
export const weekHoursSchema = z.array(dayHoursSchema.nullable()).length(7);
export type WeekHours = z.infer<typeof weekHoursSchema>;

export const latitude = z.number().min(-90).max(90);
export const longitude = z.number().min(-180).max(180);

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * PATCH /staff/branches/:id (ADR-032): the admin corrects contact details,
 * hours and the map pin. Every field is optional; at least one is required.
 */
export const updateBranchSchema = z
  .object({
    nameAr: text(80),
    nameEn: text(80),
    addressAr: text(200),
    addressEn: text(200),
    phones: z.array(phoneNumber).min(1).max(6),
    whatsapp: phoneNumber.nullable(),
    lat: latitude,
    lng: longitude,
    hours: weekHoursSchema,
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Change at least one field.')
  .refine(
    (b) => (b.lat === undefined) === (b.lng === undefined),
    'Send latitude and longitude together.',
  );
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;

export interface BranchDto {
  id: string;
  slug: string;
  name: { en: string; ar: string };
  address: { en: string; ar: string };
  /** International form, `+20…`. */
  phones: string[];
  whatsapp: string | null;
  /** Null until someone places the pin. */
  position: { lat: number; lng: number } | null;
  hours: WeekHours;
  /** Tags such as `ac-hall`, `full-service`, `grills`. */
  features: string[];
  isActive: boolean;
}
