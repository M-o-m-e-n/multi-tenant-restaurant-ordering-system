import type { ReactNode } from 'react';

/** A headline number: when the job is one figure, it is a tile, not a chart. */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="tabular mt-2 font-display text-3xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
