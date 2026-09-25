import { Link } from 'react-router-dom';

import { buttonClass } from '../../shared/ui/buttonClass';
import { GUESTS } from './content';

/**
 * Landing hero (fork-flame-ui §4): headline and CTAs on the left, a plated
 * dish on a slate disc on the right with floating garnish and info chips.
 */
export function Hero() {
  return (
    <section className="relative mx-auto grid w-full max-w-content items-center gap-12 px-5 pb-20 pt-6 md:grid-cols-[1.05fr_1fr] md:px-10 md:pt-10">
      <div className="animate-rise text-center md:text-left">
        <p className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-surface/80 px-4 py-1.5 text-xs font-medium text-ink-muted">
          <span className="size-2 animate-pulse rounded-full bg-ok" aria-hidden="true" />
          Open tonight · 12 pm – 11 pm
        </p>
        <h1 className="mt-6 font-display text-hero-sm font-bold md:text-hero">
          it&rsquo;s not just Food, It&rsquo;s an <span className="text-flame">Experience.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-ink-muted md:mx-0">
          Seasonal plates cooked over open flame. Order from your table, watch it move through the
          kitchen live, and pay in a tap.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
          <Link to="/menu" className={buttonClass('primary', 'lg')}>
            View Menu
          </Link>
          <Link to="/reserve" className={buttonClass('secondary', 'lg')}>
            Book A Table
          </Link>
        </div>
        <div className="mt-10 flex items-center justify-center gap-4 md:justify-start">
          <div className="flex -space-x-3">
            {GUESTS.slice(0, 3).map((g) => (
              <img
                key={g.photo}
                src={g.photo}
                alt=""
                className="size-10 rounded-full border-2 border-bg object-cover"
              />
            ))}
            <span className="grid size-10 place-items-center rounded-full border-2 border-bg bg-flame text-[0.7rem] font-bold text-white">
              1.2k+
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm tracking-widest text-star" aria-hidden="true">
              ★★★★★
            </p>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">4.9</span> from 1,200+ guest reviews
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[480px]">
        <div className="absolute inset-[8%] rounded-full bg-flame/25 blur-3xl" aria-hidden="true" />
        <div
          className="absolute inset-[4%] rounded-full bg-slate shadow-plate"
          aria-hidden="true"
        />
        <img
          src="/images/hero-plate.jpg"
          alt="A harvest bowl of greens, feta and pickled onion on a dark plate"
          loading="eager"
          className="absolute inset-[9%] size-[82%] animate-spin-slow rounded-full object-cover shadow-plate"
        />
        <img
          src="/images/tomatoes.jpg"
          alt=""
          aria-hidden="true"
          className="absolute -right-1 top-[4%] size-20 animate-bob rounded-full border-4 border-card-top object-cover shadow-dish md:size-24"
        />
        <span
          aria-hidden="true"
          className="absolute left-[2%] top-[30%] animate-bob text-4xl [animation-delay:.8s]"
        >
          🌿
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-[12%] right-[4%] animate-bob text-3xl [animation-delay:1.6s]"
        >
          🌶️
        </span>
        <div className="absolute -left-2 bottom-[8%] animate-float rounded-card border border-line bg-surface/90 px-4 py-3 shadow-dish backdrop-blur md:-left-6">
          <p className="text-[0.7rem] font-medium uppercase tracking-wider text-ink-muted">
            Chef&rsquo;s pick
          </p>
          <p className="font-display text-lg font-bold">Harvest Bowl</p>
          <p className="text-xs text-star">
            ★ 4.9 <span className="text-ink-muted">· 320 orders</span>
          </p>
        </div>
        <div className="absolute right-0 top-[48%] hidden animate-float items-center gap-3 rounded-card border border-line bg-surface/90 px-4 py-3 shadow-dish backdrop-blur [animation-delay:1.2s] sm:flex">
          <span className="grid size-9 place-items-center rounded-icon bg-flame text-white shadow-glow">
            ⏱
          </span>
          <div>
            <p className="text-sm font-semibold">~18 min</p>
            <p className="text-xs text-ink-muted">avg. to your table</p>
          </div>
        </div>
      </div>
    </section>
  );
}
