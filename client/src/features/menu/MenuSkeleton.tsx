/**
 * Loading placeholder that mirrors the menu layout, so the page does not
 * jump when the dishes arrive. Visual only — the status line stays readable
 * for assistive tech.
 */
export function MenuSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Setting the table…
      </p>
      <div aria-hidden="true">
        <div className="skeleton h-44 rounded-frame md:h-56" />
        <div className="mt-8 flex gap-5 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-56 w-52 shrink-0 rounded-card" />
          ))}
        </div>
        <div className="skeleton mt-8 h-7 w-44 rounded-btn" />
        <ul className="mt-2 divide-y divide-line">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3.5 py-3.5">
              <div className="skeleton size-[52px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="skeleton h-4 w-2/3 rounded" />
                <div className="skeleton mt-2 h-3 w-1/2 rounded" />
              </div>
              <div className="skeleton h-4 w-12 rounded" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
