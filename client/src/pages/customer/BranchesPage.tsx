import { useState } from 'react';

import { BranchCard } from '../../features/branches/BranchCard';
import { useBranches } from '../../features/branches/branchesApi';
import { NearestBranchButton, type NearestResult } from '../../features/branches/NearestBranch';
import { useSettings } from '../../features/cart/cartApi';
import { Footer } from '../../features/landing/Sections';
import { useT } from '../../i18n';
import { Reveal } from '../../shared/ui/motion';

/** Every branch on its own map, with a "nearest to me" finder (ADR-032). */
export function BranchesPage() {
  const t = useT();
  const { data: branches, isLoading, isError, refetch } = useBranches();
  const { data: settings } = useSettings();
  const [near, setNear] = useState<NearestResult>(null);
  const tz = settings?.timezone ?? 'Africa/Cairo';
  // The nearest branch moves to the front once found.
  const ordered = [...(branches ?? [])].sort(
    (a, b) => Number(b.slug === near?.slug) - Number(a.slug === near?.slug),
  );

  return (
    <>
      <main className="mx-auto w-full max-w-content px-5 pb-24 pt-10 md:px-10">
        <header className="text-center motion-safe:animate-rise">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            {t.branches.eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">{t.branches.title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">{t.branches.lead}</p>
        </header>
        {branches && branches.length > 1 && (
          <div className="mt-8">
            <NearestBranchButton branches={branches} onFound={setNear} />
          </div>
        )}
        {isLoading ? (
          <p role="status" className="py-16 text-center text-ink-muted">
            {t.branches.loading}
          </p>
        ) : isError ? (
          <div className="py-16 text-center">
            <p>{t.branches.failed}</p>
            <button
              type="button"
              className="mt-3 font-semibold text-flame-text underline"
              onClick={() => void refetch()}
            >
              {t.common.tryAgain}
            </button>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {ordered.map((b, i) => (
              <Reveal key={b.id} delay={i * 120}>
                <BranchCard
                  branch={b}
                  timeZone={tz}
                  nearestKm={near?.slug === b.slug ? near.km : null}
                />
              </Reveal>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
