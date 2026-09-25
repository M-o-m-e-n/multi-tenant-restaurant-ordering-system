import { Link } from 'react-router-dom';

import { buttonClass } from '../../shared/ui/buttonClass';
import { Logo } from '../../shared/ui/Logo';
import { GUESTS, HOURS, MARQUEE, STEPS } from './content';

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">{children}</p>
  );
}

/** A slanted flame ribbon of house promises, scrolling slowly. */
export function Marquee() {
  const words = [...MARQUEE, ...MARQUEE];
  return (
    <div
      className="relative -rotate-1 overflow-hidden bg-flame py-3 shadow-glow"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap pl-10">
        {words.map((w, i) => (
          <span
            key={i}
            className="flex items-center gap-10 font-display text-xl font-bold text-white"
          >
            {w}
            <span className="text-white/60">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="mx-auto w-full max-w-content px-5 py-20 md:px-10">
      <div className="text-center">
        <Eyebrow>How it works</Eyebrow>
        <h2 id="how" className="mt-3 font-display text-3xl font-bold md:text-4xl">
          From your table to our fire in three taps
        </h2>
      </div>
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="group overflow-hidden rounded-card border border-line bg-card shadow-dish"
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={s.photo}
                alt=""
                loading="lazy"
                className="size-full object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card-bottom to-transparent" />
              <span className="absolute bottom-3 left-5 font-display text-5xl font-bold text-flame">
                {s.n}
              </span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Story() {
  return (
    <section
      id="about"
      aria-labelledby="story"
      className="mx-auto grid w-full max-w-content items-center gap-14 px-5 py-20 md:grid-cols-2 md:px-10"
    >
      <div className="relative pb-16 pr-10">
        <img
          src="/images/chef.jpg"
          alt="Our head chef plating at the pass"
          loading="lazy"
          className="aspect-[4/5] w-full rounded-frame object-cover shadow-plate"
        />
        <img
          src="/images/interior.jpg"
          alt="The dining room at night"
          loading="lazy"
          className="absolute bottom-0 right-0 w-1/2 rounded-card border-4 border-bg object-cover shadow-dish"
        />
        <div className="absolute left-4 top-4 rounded-card bg-flame px-4 py-3 text-white shadow-glow">
          <p className="font-display text-3xl font-bold leading-none">12</p>
          <p className="text-xs font-medium">years over open flame</p>
        </div>
      </div>
      <div>
        <Eyebrow>Our story</Eyebrow>
        <h2 id="story" className="mt-3 font-display text-3xl font-bold md:text-4xl">
          Fire, flour and a little patience.
        </h2>
        <p className="mt-5 text-ink-muted">
          Fork &amp; Flame started as a single wood oven and a stubborn idea: cook simple things
          very well. Our dough rests for 48 hours, our beef is dry-aged in-house, and everything
          that leaves the kitchen has met the fire first.
        </p>
        <p className="mt-4 text-ink-muted">
          The tech is there to get out of the way. Order when you are ready, not when a server
          passes by, and let the kitchen do what it does best.
        </p>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            ['48h', 'dough rest'],
            ['9', 'signature plates'],
            ['4.9★', 'guest rating'],
          ].map(([value, label]) => (
            <div key={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="font-display text-3xl font-bold text-ink">{value}</dd>
              <dd className="text-xs text-ink-muted">{label}</dd>
            </div>
          ))}
        </dl>
        <Link to="/menu" className={`mt-8 ${buttonClass('primary', 'lg')}`}>
          Explore the menu
        </Link>
      </div>
    </section>
  );
}

/** Full-bleed photo band with a pull quote. */
export function QuoteBand() {
  return (
    <section className="relative isolate overflow-hidden py-28" aria-label="From the kitchen">
      <img
        src="/images/grill.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-bg-deep/75" />
      <figure className="mx-auto max-w-3xl px-5 text-center">
        <blockquote className="font-display text-3xl font-bold leading-snug md:text-5xl">
          &ldquo;If it hasn&rsquo;t met the <span className="text-flame">fire</span>, it isn&rsquo;t
          ready for your plate.&rdquo;
        </blockquote>
        <figcaption className="mt-6 text-sm text-ink-muted">Marco Bellini · Head chef</figcaption>
      </figure>
    </section>
  );
}

export function Reviews() {
  return (
    <section aria-labelledby="reviews" className="mx-auto w-full max-w-content px-5 py-20 md:px-10">
      <div className="flex flex-col items-center text-center">
        <Eyebrow>Reviews</Eyebrow>
        <h2 id="reviews" className="mt-3 font-display text-3xl font-bold md:text-4xl">
          Guests keep coming back
        </h2>
      </div>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {GUESTS.map((g) => (
          <li
            key={g.name}
            className="flex flex-col rounded-card border border-line bg-card p-6 shadow-dish"
          >
            <p className="tracking-widest text-star" aria-label="Rated 5 out of 5">
              ★★★★★
            </p>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-ink">&ldquo;{g.quote}&rdquo;</p>
            <div className="mt-6 flex items-center gap-3">
              <img
                src={g.photo}
                alt=""
                loading="lazy"
                className="size-10 rounded-full object-cover"
              />
              <span className="text-sm font-semibold">{g.name}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Visit() {
  return (
    <section
      id="visit"
      aria-labelledby="visit-title"
      className="mx-auto w-full max-w-content px-5 pb-20 md:px-10"
    >
      <div className="grid overflow-hidden rounded-frame border border-line bg-surface md:grid-cols-2">
        <img
          src="/images/bar.jpg"
          alt="The bar at Fork & Flame"
          loading="lazy"
          className="h-64 w-full object-cover md:h-full"
        />
        <div className="p-8 md:p-12">
          <Eyebrow>Visit us</Eyebrow>
          <h2 id="visit-title" className="mt-3 font-display text-3xl font-bold">
            Pull up a chair
          </h2>
          <address className="mt-4 not-italic text-ink-muted">
            18 Ember Lane, Brooklyn, NY 11201
            <br />
            <a href="tel:+17185550142" className="text-flame-text hover:underline">
              (718) 555-0142
            </a>
          </address>
          <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
            {HOURS.map((h) => (
              <div key={h.days} className="flex justify-between py-3">
                <dt className="text-ink-muted">{h.days}</dt>
                <dd className="tabular font-medium">{h.time}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/reserve" className={buttonClass('primary')}>
              Book A Table
            </Link>
            <Link to="/menu" className={buttonClass('secondary')}>
              Order Takeaway
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg-deep">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-ink-muted">Seasonal plates, cooked over open flame.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/menu" className="text-ink-muted hover:text-ink">
            Menu
          </Link>
          <Link to="/reserve" className="text-ink-muted hover:text-ink">
            Reservations
          </Link>
          <a href="#about" className="text-ink-muted hover:text-ink">
            About
          </a>
          <a href="#visit" className="text-ink-muted hover:text-ink">
            Visit
          </a>
          <Link to="/login" className="text-ink-muted hover:text-ink">
            Staff sign-in
          </Link>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-content px-5 pb-8 text-xs text-ink-muted md:px-10">
        © 2026 Fork &amp; Flame · Photography from{' '}
        <a href="https://unsplash.com" className="underline hover:text-ink">
          Unsplash
        </a>
      </p>
    </footer>
  );
}
