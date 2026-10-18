import { brand } from '../../brand';
import { useT } from '../../i18n';
import { useThemeStore } from '../theme';

/**
 * Switches between the light and dark themes (ADR-033). Shown only for a
 * tenant that offers both. The icon is the theme it switches to, and the
 * label says so in words.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  if (brand.themes.length < 2) return null;
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      aria-label={next === 'light' ? t.theme.toLight : t.theme.toDark}
      onClick={() => setTheme(next)}
      className={`grid size-11 place-items-center rounded-full text-ink transition hover:bg-surface-raised active:scale-90 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {next === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        )}
      </svg>
    </button>
  );
}
