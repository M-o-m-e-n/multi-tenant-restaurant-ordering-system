import type { Messages } from '../../i18n';

/**
 * Allergens are stored as English codes ("dairy", "gluten"); this names them
 * in the reader's language, joined with that language's comma. An unknown
 * code is shown as stored rather than hidden — an allergen must never
 * disappear from the screen.
 */
export function allergenList(t: Messages, codes: readonly string[]): string {
  const names: Readonly<Record<string, string>> = t.menu.allergens;
  return codes.map((c) => names[c] ?? c).join(t.common.listSep);
}
