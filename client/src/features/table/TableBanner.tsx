import { useT } from '../../i18n';
import { useTableSession } from './tableSession';

/** Shows which table this menu is ordering for (BROWSE-04). */
export function TableBanner() {
  const table = useTableSession((s) => s.table);
  const t = useT();
  const leave = useTableSession((s) => s.leave);
  if (!table) return null;
  return (
    <div className="mx-auto mb-2 flex w-full max-w-content items-center justify-between gap-3 px-5 md:px-10">
      <p className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-surface-raised px-4 py-2 text-sm">
        <span aria-hidden="true">🍽️</span>
        {t.menu.orderingFor}{' '}
        <strong className="font-semibold">{t.common.table(table.number)}</strong>
      </p>
      <button
        type="button"
        onClick={leave}
        className="min-h-11 text-xs font-semibold text-ink-muted hover:text-ink"
      >
        {t.menu.notThisTable}
      </button>
    </div>
  );
}
