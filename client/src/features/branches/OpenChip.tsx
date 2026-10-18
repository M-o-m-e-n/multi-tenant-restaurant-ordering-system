import type { WeekHours } from '@ros/shared';

import { useOpenLabel } from './useOpenLabel';

/** A pill with a pulsing dot while open; the label says it in words (never colour alone). */
export function OpenChip({ week, className = '' }: { week?: WeekHours; className?: string }) {
  const { open, label } = useOpenLabel(week);
  return (
    <p
      className={`inline-flex items-center gap-2 rounded-btn border border-line-strong bg-surface/80 px-4 py-1.5 text-xs font-medium text-ink-muted backdrop-blur ${className}`}
    >
      <span className="relative flex size-2" aria-hidden="true">
        {open && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${open ? 'bg-ok' : 'bg-ink-muted'}`}
        />
      </span>
      {label}
    </p>
  );
}
