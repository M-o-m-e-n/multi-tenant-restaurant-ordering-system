import type { ComponentType } from 'react';

import type { LatLng } from '../features/branches/maps';
import type { L } from '../i18n/localized';
import type { Lang } from '../i18n/types';

export type ThemeName = 'dark' | 'light';

/**
 * The tenant's brand (ADR-029, ADR-032): what the restaurant is called, which
 * language a first-time visitor sees, and which site pages it has.
 */
export interface Brand {
  id: string;
  name: { en: string; ar: string };
  defaultLang: Lang;
  /** ISO 4217, lower case, matching the server's `currency` setting. */
  currency: string;
  /** An image logo; without one the Fork & Flame wordmark is drawn in type. */
  logo: string | null;
  social: { facebook?: string; instagram?: string };
  /** Site pages beyond ordering (ADR-032): branches with maps, about, contact inbox. */
  pages: { branches: boolean; about: boolean; contact: boolean };
  /** Colour themes offered (ADR-033); the first is the default. One entry means no toggle. */
  themes: readonly [ThemeName, ...ThemeName[]];
  /**
   * How the menu page is laid out: `list` is design 31's chips and rows;
   * `catalog` is a category sidebar beside a photo grid, for a long menu (ADR-035).
   */
  menu: 'list' | 'catalog';
  /** Where the admin's pin map opens for a branch that has no pin yet. */
  mapCentre: LatLng;
}

/** Tenant copy used outside the landing page (ADR-029/030). */
export interface BrandCopy {
  /** The photo behind the menu page's banner. */
  menuPhoto: string;
  menuBanner: { eyebrow: L; title: L; body: L };
  reservePanel: { title: L; body: L };
}

/**
 * Loads one of a tenant's pages on first visit. A loader rather than a
 * component, so a tenant module imports nothing from the app at run time.
 */
export type PageLoader = () => Promise<ComponentType>;

/**
 * One restaurant (ADR-032). The build resolves `@tenant` to the module of the
 * tenant named by VITE_TENANT, so a site only ever contains its own tenant.
 * Fork & Flame lives in src/tenants/forkandflame; a private tenant lives in
 * its own repository, checked out under tenants/<id>/client (tenants/README.md).
 */
export interface Tenant {
  brand: Brand;
  copy: BrandCopy;
  /** Replaces the design-31 landing page. */
  home?: PageLoader;
  /** Site pages the tenant draws itself. Without one, the generic page is used; about has none. */
  pages?: { about?: PageLoader; branches?: PageLoader; contact?: PageLoader };
}
