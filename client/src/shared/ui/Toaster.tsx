import { useToasts } from './toastStore';

/** Stacked confirmations, top-right under the nav; announced politely. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 print:hidden"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast pointer-events-auto flex items-center gap-3 overflow-hidden rounded-card border border-line bg-surface/95 p-3 pr-2 shadow-plate backdrop-blur-md"
        >
          {t.imageUrl ? (
            <img src={t.imageUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-flame text-white"
            >
              ✓
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t.title}</p>
            {t.detail && <p className="truncate text-xs text-ink-muted">{t.detail}</p>}
          </div>
          {t.action && (
            <button
              type="button"
              className="min-h-11 rounded-btn px-3 text-sm font-semibold text-flame-text hover:bg-surface-raised"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
          <span aria-hidden="true" className="toast-timer" />
        </div>
      ))}
    </div>
  );
}
