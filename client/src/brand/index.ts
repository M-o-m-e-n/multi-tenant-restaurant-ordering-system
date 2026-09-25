import type { Lang } from '../i18n/types';

/**
 * The tenant's brand (ADR-029): what the restaurant is called and which
 * language a first-time visitor sees. One deployment serves one restaurant;
 * the El Demeshki pack arrives in M17.
 */
export interface Brand {
  id: string;
  name: { en: string; ar: string };
  defaultLang: Lang;
}

export const brand: Brand = {
  id: 'forkandflame',
  name: { en: 'Fork & Flame', ar: 'فورك آند فليم' },
  defaultLang: 'en',
};
