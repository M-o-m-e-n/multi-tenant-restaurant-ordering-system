import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Wider panel for forms. */
  wide?: boolean;
}

/**
 * Modal on the native <dialog>, which gives focus trapping, Escape to close
 * and an inert background for free (NFR-U3 keyboard access).
 */
export function Modal({ open, onClose, title, children, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className={`w-[calc(100%-2rem)] ${wide ? 'max-w-xl' : 'max-w-md'} rounded-card border border-line bg-surface p-0 text-ink shadow-plate backdrop:bg-bg-deep/70`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-surface-raised hover:text-ink"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
