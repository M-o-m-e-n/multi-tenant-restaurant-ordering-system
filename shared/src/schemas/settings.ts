import { z } from 'zod';

import { nonNegativeCents } from './common';

const bpsRate = z.number().int().min(0).max(10_000);

/** Every runtime setting, typed (LLD §2.2 Setting keys, ADM-03). Stored as strings. */
export const settingsSchema = z
  .object({
    restaurantName: z.string().trim().min(1).max(80),
    taxBps: bpsRate,
    serviceChargeBps: bpsRate,
    serviceChargeTaxable: z.boolean(),
    deliveryFee: nonNegativeCents.max(100_000),
    currency: z
      .string()
      .regex(/^[a-z]{3}$/, 'three lower-case letters, e.g. usd')
      .default('usd'),
    /** IANA zone, e.g. America/New_York. Business dates derive from it (BR-15). */
    timezone: z
      .string()
      .min(1)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'must be an IANA timezone such as America/New_York'),
    tipPresetsBps: z.array(bpsRate).max(6),
    kdsGreenSec: z.number().int().min(30).max(7200),
    kdsAmberSec: z.number().int().min(30).max(7200),
    kdsCompletedGraceSec: z.number().int().min(0).max(3600),
    orderNumberPrefix: z.string().regex(/^[A-Z]{1,3}$/, 'one to three capital letters'),
  })
  .strict()
  .refine((s) => s.kdsAmberSec > s.kdsGreenSec, {
    path: ['kdsAmberSec'],
    message: 'must be later than kdsGreenSec',
  });
export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

/** PUT /staff/settings — the full set (ADM-03). */
export const updateSettingsSchema = settingsSchema;

/** GET /settings — exactly what the client needs to reproduce server pricing (LLD §5.6). */
export type PublicSettings = Pick<
  Settings,
  | 'restaurantName'
  | 'taxBps'
  | 'serviceChargeBps'
  | 'serviceChargeTaxable'
  | 'deliveryFee'
  | 'currency'
  | 'tipPresetsBps'
  | 'timezone'
>;

export const DEFAULT_SETTINGS: Settings = {
  restaurantName: 'Fork & Flame',
  taxBps: 875,
  serviceChargeBps: 1000,
  serviceChargeTaxable: false,
  deliveryFee: 499,
  currency: 'usd',
  timezone: 'America/New_York',
  tipPresetsBps: [1000, 1500, 2000],
  kdsGreenSec: 480,
  kdsAmberSec: 900,
  kdsCompletedGraceSec: 60,
  orderNumberPrefix: 'A',
};

/** Encode one typed setting into its stored string form. */
export function encodeSetting(value: Settings[SettingKey]): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Decode the stored key/value rows into typed settings. Missing keys fall back
 * to the defaults, so a fresh database still prices correctly.
 */
export function decodeSettings(rows: readonly { key: string; value: string }[]): Settings {
  const raw: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  const stringKeys = new Set<string>([
    'restaurantName',
    'currency',
    'timezone',
    'orderNumberPrefix',
  ]);
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    raw[key] = stringKeys.has(key) ? value : (JSON.parse(value) as unknown);
  }
  return settingsSchema.parse(raw);
}

/** GET /settings/kds (staff). */
export type KdsSettings = Pick<Settings, 'kdsGreenSec' | 'kdsAmberSec' | 'kdsCompletedGraceSec'>;
