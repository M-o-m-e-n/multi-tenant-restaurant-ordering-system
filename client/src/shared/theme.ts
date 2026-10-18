import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { brand, type ThemeName } from '../brand';

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

/**
 * The colour theme (ADR-033). The tenant sets the default and which themes it
 * offers; the visitor's choice is remembered on this device, like language.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: brand.themes[0],
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ros-theme',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // A stored theme the tenant no longer offers falls back to its default.
      merge: (stored, current) => {
        const theme = (stored as Partial<ThemeState> | undefined)?.theme;
        return { ...current, theme: theme && brand.themes.includes(theme) ? theme : current.theme };
      },
    },
  ),
);

/** Keep `<html data-theme data-tenant>` in step; styles/themes.css reads both. */
function applyDocumentTheme(theme: ThemeName): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.tenant = brand.id;
}

applyDocumentTheme(useThemeStore.getState().theme);
useThemeStore.subscribe((s) => applyDocumentTheme(s.theme));

export const useTheme = (): ThemeName => useThemeStore((s) => s.theme);

/** Design 31's dark values, for environments with no stylesheet (tests). */
const FALLBACK: Record<string, string> = {
  flame: '229 50 45',
  'flame-light': '240 68 62',
  'flame-dark': '185 20 20',
  star: '245 166 35',
  line: '51 51 51',
  ink: '245 242 236',
  'ink-muted': '169 164 154',
  surface: '30 30 30',
  'surface-raised': '43 43 43',
};

/** A colour token as a CSS colour, for code that cannot use class names. */
function token(name: keyof typeof FALLBACK): string {
  const value =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim();
  return `rgb(${(value || FALLBACK[name] || '0 0 0').split(/\s+/).join(', ')})`;
}

/**
 * Design tokens for chart libraries, read from the active theme when called
 * (fork-flame-ui §2). Pages remount on a theme change, so charts re-read them.
 */
export function chartTheme() {
  return {
    /** The single series colour, used as a fill (≥ 3:1 against the panel). */
    series: token('flame-light'),
    seriesHover: token('flame'),
    grid: token('line'),
    axis: token('ink-muted'),
    text: token('ink'),
    surface: token('surface'),
    surfaceRaised: token('surface-raised'),
  };
}

/** Ember colours for the hero canvas, hottest last (flame → amber). */
export function emberPalette(): string[] {
  return [token('flame-dark'), token('flame'), token('flame-light'), token('star')];
}

/** Colours for the embedded Stripe card form, which is styled by values, not classes. */
export function paymentFormTheme() {
  return { primary: token('flame'), background: token('surface') };
}
