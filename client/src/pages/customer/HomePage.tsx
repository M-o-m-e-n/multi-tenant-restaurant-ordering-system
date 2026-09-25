import { Link } from 'react-router-dom';

import { buttonClass } from '../../shared/ui/buttonClass';

export function HomePage() {
  return (
    <main className="mx-auto grid w-full max-w-content items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.05fr_1fr] md:px-10">
      <section className="text-center md:text-left">
        <h1 className="font-display text-hero-sm font-bold md:text-hero">
          it&rsquo;s not just Food, It&rsquo;s an Experience.
        </h1>
        <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
          <Link to="/menu" className={buttonClass('primary', 'lg')}>
            View Menu
          </Link>
          <Link to="/menu" className={buttonClass('secondary', 'lg')}>
            Order Now
          </Link>
        </div>
        <div className="mt-8">
          <p className="text-xs font-medium text-ink-muted">Reviews</p>
          <p className="mt-2 text-lg tracking-widest text-star" aria-label="Rated 5 out of 5">
            ★★★★★
          </p>
        </div>
      </section>
      <div className="relative flex justify-center" aria-hidden="true">
        <div className="grid aspect-square w-[min(360px,80%)] place-items-center rounded-full bg-slate text-plate shadow-plate">
          🥗
        </div>
        <span className="absolute right-[6%] top-[6%] animate-bob text-5xl">🍅</span>
        <span className="absolute left-[2%] top-[34%] animate-bob text-4xl [animation-delay:.8s]">
          🌿
        </span>
      </div>
    </main>
  );
}
