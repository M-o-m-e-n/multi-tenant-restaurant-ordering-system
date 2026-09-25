import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { brand } from '../brand';
import { ar } from './ar';
import { en } from './en';
import { dirOf, type Lang, type Widen } from './types';

export type Messages = Widen<typeof en>;

const DICTIONARIES: Record<Lang, Messages> = { en, ar };

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

/** The visitor's language, remembered on this device (a convenience, ADR-030). */
export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: brand.defaultLang,
      setLang: (lang) => set({ lang }),
    }),
    { name: 'ros-lang', storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

/** Keep `<html lang dir>` in step with the chosen language. */
export function applyDocumentLang(lang: Lang): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = dirOf(lang);
}

applyDocumentLang(useLangStore.getState().lang);
useLangStore.subscribe((s) => applyDocumentLang(s.lang));

export const useLang = (): Lang => useLangStore((s) => s.lang);

/** The UI strings for the active language: `t.nav.menu`, `t.nav.cart(3)`. */
export function useT(): Messages {
  return DICTIONARIES[useLangStore((s) => s.lang)];
}

/** Outside React (toasts fired from handlers, formatters). */
export const tNow = (): Messages => DICTIONARIES[useLangStore.getState().lang];

/** The BCP 47 locale for formatting in the active language (Latin digits in Arabic). */
export const localeOf = (lang: Lang): string => (lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US');
