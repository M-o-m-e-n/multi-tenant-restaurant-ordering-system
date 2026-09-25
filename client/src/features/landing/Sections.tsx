import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { buttonClass } from '../../shared/ui/buttonClass';
import { Parallax } from '../../shared/ui/interactive';
import { Logo } from '../../shared/ui/Logo';
import { CountUp, Reveal } from '../../shared/ui/motion';
import { prefersReducedMotion } from '../../shared/ui/motionUtils';
import { clamp, onScrollFrame, viewportProgress } from '../../shared/ui/scrollFx';
import { GUESTS, HOURS, MARQUEE } from './content';

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">{children}</p>
  );
}

/**
 * A slanted flame ribbon of house promises. It drifts on its own, speeds up
 * with the scroll, runs backwards when you scroll up, and leans into the
 * motion — the page answering the guest's hand. Static under reduced motion.
 */
export function Marquee() {
  const words = [...MARQUEE, ...MARQUEE];
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || prefersReducedMotion()) return;
    let offset = 0;
    let velocity = 0;
    let direction = 1;
    let raf = 0;
    let visible = true;
    const unsubscribe = onScrollFrame((f) => {
      velocity = f.velocity;
      if (Math.abs(f.velocity) > 0.5) direction = f.velocity > 0 ? 1 : -1;
    });
    const tick = () => {
      const half = el.scrollWidth / 2;
      offset -= direction * (0.6 + Math.min(Math.abs(velocity) * 0.35, 14));
      if (offset <= -half) offset += half;
      if (offset > 0) offset -= half;
      const skew = clamp(-velocity * 0.25, -8, 8);
      el.style.transform = `translate3d(${offset.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      if (visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      unsubscribe();
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="relative -rotate-1 overflow-hidden bg-flame py-3 shadow-glow"
      aria-hidden="true"
    >
      <div ref={track} className="flex w-max gap-10 whitespace-nowrap pl-10 will-change-transform">
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

export function Story() {
  return (
    <section
      id="about"
      aria-labelledby="story"
      className="mx-auto grid w-full max-w-content items-center gap-14 px-5 py-20 md:grid-cols-2 md:px-10"
    >
      <Reveal>
        <div className="relative pb-16 pr-10">
          <img
            src="/images/chef.jpg"
            alt="Our head chef plating at the pass"
            loading="lazy"
            className="aspect-[4/5] w-full rounded-frame object-cover shadow-plate"
          />
          <div className="absolute bottom-0 right-0 w-1/2">
            <Parallax speed={-70}>
              <img
                src="/images/interior.jpg"
                alt="The dining room at night"
                loading="lazy"
                className="w-full rounded-card border-4 border-bg object-cover shadow-dish"
              />
            </Parallax>
          </div>
          <div className="absolute left-4 top-4 rounded-card bg-flame px-4 py-3 text-white shadow-glow">
            <p className="font-display text-3xl font-bold leading-none">
              <CountUp value={12} />
            </p>
            <p className="text-xs font-medium">years over open flame</p>
          </div>
        </div>
      </Reveal>
      <Reveal delay={120}>
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
          {(
            [
              { value: 48, decimals: 0, suffix: 'h', label: 'dough rest' },
              { value: 9, decimals: 0, suffix: '', label: 'signature plates' },
              { value: 4.9, decimals: 1, suffix: '★', label: 'guest rating' },
            ] as Array<{ value: number; decimals: number; suffix: string; label: string }>
          ).map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="tabular font-display text-3xl font-bold text-ink">
                <CountUp value={s.value} decimals={s.decimals} suffix={s.suffix} />
              </dd>
              <dd className="text-xs text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
        <Link to="/menu" className={`mt-8 ${buttonClass('primary', 'lg')}`}>
          Explore the menu
        </Link>
      </Reveal>
    </section>
  );
}

const QUOTE = 'If it hasn’t met the fire, it isn’t ready for your plate.';

/**
 * The pull quote lights up word by word as the band crosses the screen. The
 * sentence is read once, whole, from the visually hidden copy. Unlit words
 * stay at 40% so the large text never drops below 3:1 even before it is lit.
 */
function LitQuote() {
  const ref = useRef<HTMLQuoteElement>(null);
  const words = QUOTE.split(' ');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'));
    if (prefersReducedMotion()) {
      spans.forEach((w) => (w.style.opacity = '1'));
      return;
    }
    return onScrollFrame((f) => {
      // Fully lit by the time the quote reaches the upper-middle of the screen.
      const p = clamp(viewportProgress(el.getBoundingClientRect(), f.viewport) * 2.2 - 0.35, 0, 1);
      const lit = p * spans.length;
      spans.forEach((w, i) => {
        w.style.opacity = String(0.4 + 0.6 * clamp(lit - i, 0, 1));
      });
    });
  }, []);
  return (
    <blockquote ref={ref} className="font-display text-3xl font-bold leading-snug md:text-5xl">
      <span className="sr-only">&ldquo;{QUOTE}&rdquo;</span>
      <span aria-hidden="true">
        &ldquo;
        {words.map((w, i) => (
          <span key={i}>
            <span
              data-word
              className={`transition-opacity duration-200 ${w.startsWith('fire') ? 'text-flame' : ''}`}
              style={{ opacity: 0.4 }}
            >
              {w}
            </span>{' '}
          </span>
        ))}
        &rdquo;
      </span>
    </blockquote>
  );
}

/** Full-bleed photo band with a pull quote; the photo drifts slower than the page. */
export function QuoteBand() {
  return (
    <section className="relative isolate overflow-hidden py-28" aria-label="From the kitchen">
      <Parallax speed={120} className="absolute inset-x-0 -inset-y-16 -z-10">
        <img src="/images/grill.jpg" alt="" loading="lazy" className="size-full object-cover" />
      </Parallax>
      <div className="absolute inset-0 -z-10 bg-bg-deep/75" />
      <figure className="mx-auto max-w-3xl px-5 text-center">
        <LitQuote />
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
        {GUESTS.map((g, i) => (
          <li
            key={g.name}
            className="spotlight flex flex-col rounded-card border border-line bg-card p-6 shadow-dish transition duration-300 hover:-translate-y-1 hover:border-line-strong"
          >
            <Reveal delay={Math.min(i, 5) * 80} className="flex flex-1 flex-col">
              <p className="tracking-widest text-star" aria-label="Rated 5 out of 5">
                ★★★★★
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink">
                &ldquo;{g.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={g.photo}
                  alt=""
                  loading="lazy"
                  className="size-10 rounded-full object-cover"
                />
                <span className="text-sm font-semibold">{g.name}</span>
              </div>
            </Reveal>
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
      <Reveal className="spotlight grid overflow-hidden rounded-frame border border-line bg-surface md:grid-cols-2">
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
      </Reveal>
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
