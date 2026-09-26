import { useLangStore, useT } from '../../i18n';

/**
 * Switches between Arabic and English. The label is written in the language
 * it switches to ("English" / "العربية"), so a reader who can't read the
 * current page can still find their way back; `lang` tells screen readers
 * how to pronounce it.
 */
export function LangToggle({ className = '' }: { className?: string }) {
  const t = useT();
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const next = lang === 'ar' ? 'en' : 'ar';
  return (
    <button
      type="button"
      lang={next}
      aria-label={t.lang.switchLabel}
      onClick={() => setLang(next)}
      className={`inline-flex min-h-11 items-center justify-center rounded-btn border border-line-strong px-3 text-sm font-semibold text-ink transition hover:border-ink-muted ${className}`}
    >
      {t.lang.switchTo}
    </button>
  );
}
