import { useLang } from './index';

/**
 * A piece of tenant content in both languages (landing copy, hours, quotes).
 * UI chrome lives in the dictionaries; restaurant-specific words live with the
 * tenant, so swapping the tenant pack swaps them in one place (ADR-029/030).
 */
export interface L {
  en: string;
  ar: string;
}

/** Pick the active language from tenant content: `const l = useL(); l(copy.title)`. */
export function useL(): (text: L) => string {
  const lang = useLang();
  return (text) => text[lang];
}
