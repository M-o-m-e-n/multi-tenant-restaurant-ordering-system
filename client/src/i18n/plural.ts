/**
 * Plural forms by CLDR category. Arabic uses all six (zero, one, two, few,
 * many, other); English uses one and other. Missing forms fall back to
 * `other`, so an English dictionary only ever supplies `one` and `other`.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const rules = new Map<string, Intl.PluralRules>();

export function plural(locale: 'ar' | 'en', n: number, forms: PluralForms): string {
  let r = rules.get(locale);
  if (!r) {
    r = new Intl.PluralRules(locale);
    rules.set(locale, r);
  }
  const form = forms[r.select(n)] ?? forms.other;
  return form.replace('{n}', String(n));
}
