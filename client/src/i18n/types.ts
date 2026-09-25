export type Lang = 'en' | 'ar';

export const LANGS: readonly Lang[] = ['en', 'ar'];

/** Text direction for a language. */
export const dirOf = (lang: Lang): 'ltr' | 'rtl' => (lang === 'ar' ? 'rtl' : 'ltr');

/**
 * The shape every dictionary must match: the English dictionary's keys, with
 * each string widened to `string` and each function kept as its signature.
 * A key missing (or misspelt) in another language fails typecheck.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { readonly [K in keyof T]: Widen<T[K]> };
