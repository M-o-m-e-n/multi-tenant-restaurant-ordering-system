/** Holding page for staff surfaces that later milestones fill in. */
export function StaffPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto w-full max-w-content px-5 py-12">
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-ink-muted">{note}</p>
    </main>
  );
}
