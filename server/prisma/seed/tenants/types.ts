import type { Settings, WeekHours } from '@ros/shared';

import type { SeedMenuData, SeedUser } from '../reference';

export interface SeedBranch {
  slug: string;
  nameAr: string;
  nameEn: string;
  addressAr: string;
  addressEn: string;
  phones: string[];
  whatsapp: string | null;
  lat: number | null;
  lng: number | null;
  hours: WeekHours;
  features: string[];
  sortOrder: number;
}

/**
 * Everything the seed needs to stand up one restaurant (ADR-032). One
 * deployment serves one tenant; `npm run db:seed -- --tenant=<id>` picks it.
 */
export interface SeedTenant {
  id: string;
  settings: Settings;
  users: Record<'admin' | 'staff' | 'guest', SeedUser>;
  buildMenu(): SeedMenuData;
  branches: SeedBranch[];
  tableCount: number;
  history?: { guestNames?: string[]; cardShare?: number };
}
