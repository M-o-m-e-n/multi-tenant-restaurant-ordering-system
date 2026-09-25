import {
  decodeSettings,
  encodeSetting,
  type PublicSettings,
  type SettingKey,
  type Settings,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';

const TTL_MS = 30_000;
let cached: { value: Settings; at: number } | undefined;

/**
 * Typed runtime settings, loaded from the Setting table and cached briefly
 * (HLD §6.4). Missing keys fall back to defaults.
 */
export async function getSettings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const rows = await prisma().setting.findMany({ select: { key: true, value: true } });
  const value = decodeSettings(rows);
  cached = { value, at: Date.now() };
  return value;
}

export function invalidateSettingsCache(): void {
  cached = undefined;
}

/** Exactly what the client needs to reproduce server pricing (LLD §5.6). */
export function toPublicSettings(s: Settings): PublicSettings {
  return {
    restaurantName: s.restaurantName,
    taxBps: s.taxBps,
    serviceChargeBps: s.serviceChargeBps,
    serviceChargeTaxable: s.serviceChargeTaxable,
    deliveryFee: s.deliveryFee,
    currency: s.currency,
    tipPresetsBps: s.tipPresetsBps,
    timezone: s.timezone,
  };
}

/** Replace the full settings set (ADM-03), audited. */
export async function updateSettings(next: Settings, actorId: string): Promise<Settings> {
  const before = await getSettings();
  await prisma().$transaction(async (tx) => {
    for (const key of Object.keys(next) as SettingKey[]) {
      const value = encodeSetting(next[key]);
      await tx.setting.upsert({
        where: { key },
        create: { key, value, updatedBy: actorId },
        update: { value, updatedBy: actorId },
      });
    }
    await writeAudit(tx, {
      actorId,
      action: 'SETTINGS_UPDATE',
      entity: 'Setting',
      entityId: 'all',
      before,
      after: next,
    });
  });
  invalidateSettingsCache();
  return getSettings();
}
