import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useLang, useT } from '../../i18n';
import { type L, useL } from '../../i18n/localized';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Parallax } from '../../shared/ui/interactive';
import { Logo } from '../../shared/ui/Logo';
import { CountUp, Reveal } from '../../shared/ui/motion';
import { prefersReducedMotion } from '../../shared/ui/motionUtils';
import { clamp, onScrollFrame, viewportProgress } from '../../shared/ui/scrollFx';
import { FOOTER, GUESTS, HOURS, MARQUEE, QUOTE, REVIEWS, STORY, VISIT } from './content';

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
export function Marquee({ items = MARQUEE }: { items?: readonly L[] }) {
  const l = useL();
  const lang = useLang();
  const words = [...items, ...items].map(l);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el || prefersReducedMotion()) return;
    // In RTL the words read right-to-left, so the ribbon runs the other way.
    const flow = document.documentElement.dir === 'rtl' ? -1 : 1;
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
      offset -= flow * direction * (0.6 + Math.min(Math.abs(velocity) * 0.35, 14));
      // The duplicated track wraps seamlessly within one half: [−half, 0] when
      // it hangs off the right (LTR), [0, half] when it hangs off the left (RTL).
      if (flow === 1) {
        if (offset <= -half) offset += half;
        if (offset > 0) offset -= half;
      } else {
        if (offset >= half) offset -= half;
        if (offset < 0) offset += half;
      }
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
  }, [lang]);

  return (
    <div
      className="relative -rotate-1 overflow-hidden bg-flame py-3 shadow-glow"
      aria-hidden="true"
    >
      <div ref={track} className="flex w-max gap-10 whitespace-nowrap ps-10 will-change-transform">
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
  const l = useL();
  return (
    <section
      id="about"
      aria-labelledby="story"
      className="mx-auto grid w-full max-w-content items-center gap-14 px-5 py-20 md:grid-cols-2 md:px-10"
    >
      <Reveal>
        <div className="relative pb-16 pe-10">
          <img
            src="/images/chef.jpg"
            alt={l(STORY.chefAlt)}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-frame object-cover shadow-plate"
          />
          <div className="absolute bottom-0 end-0 w-1/2">
            <Parallax speed={-70}>
              <img
                src="/images/interior.jpg"
                alt={l(STORY.roomAlt)}
                loading="lazy"
                className="w-full rounded-card border-4 border-bg object-cover shadow-dish"
              />
            </Parallax>
          </div>
          <div className="absolute start-4 top-4 rounded-card bg-flame px-4 py-3 text-white shadow-glow">
            <p className="font-display text-3xl font-bold leading-none">
              <CountUp value={12} />
            </p>
            <p className="text-xs font-medium">{l(STORY.years)}</p>
          </div>
        </div>
      </Reveal>
      <Reveal delay={120}>
        <Eyebrow>{l(STORY.eyebrow)}</Eyebrow>
        <h2 id="story" className="mt-3 font-display text-3xl font-bold md:text-4xl">
          {l(STORY.title)}
        </h2>
        <p className="mt-5 text-ink-muted">{l(STORY.p1)}</p>
        <p className="mt-4 text-ink-muted">{l(STORY.p2)}</p>
        <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-line pt-6">
          {STORY.stats.map((s) => (
            <div key={s.label.en}>
              <dt className="sr-only">{l(s.label)}</dt>
              <dd className="tabular font-display text-3xl font-bold text-ink">
                <CountUp value={s.value} decimals={s.decimals} suffix={l(s.suffix)} />
              </dd>
              <dd className="text-xs text-ink-muted">{l(s.label)}</dd>
            </div>
          ))}
        </dl>
        <Link to="/menu" className={`mt-8 ${buttonClass('primary', 'lg')}`}>
          {l(STORY.cta)}
        </Link>
      </Reveal>
    </section>
  );
}

/**
 * The pull quote lights up word by word as the band crosses the screen. The
 * sentence is read once, whole, from the visually hidden copy. Unlit words
 * stay at 40% so the large text never drops below 3:1 even before it is lit.
 */
function LitQuote() {
  const ref = useRef<HTMLQuoteElement>(null);
  const l = useL();
  const text = l(QUOTE.text);
  const flameWord = l(QUOTE.flameWord);
  const words = text.split(' ');
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
  }, [text]);
  return (
    <blockquote ref={ref} className="font-display text-3xl font-bold leading-snug md:text-5xl">
      <span className="sr-only">&ldquo;{text}&rdquo;</span>
      <span aria-hidden="true">
        &ldquo;
        {words.map((w, i) => (
          <span key={i}>
            <span
              data-word
              className={`transition-opacity duration-200 ${w.startsWith(flameWord) ? 'text-flame' : ''}`}
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
  const l = useL();
  return (
    <section className="relative isolate overflow-hidden py-28" aria-label={l(QUOTE.label)}>
      <Parallax speed={120} className="absolute inset-x-0 -inset-y-16 -z-10">
        <img src="/images/grill.jpg" alt="" loading="lazy" className="size-full object-cover" />
      </Parallax>
      <div className="absolute inset-0 -z-10 bg-bg-deep/75" />
      <figure className="mx-auto max-w-3xl px-5 text-center">
        <LitQuote />
        <figcaption className="mt-6 text-sm text-ink-muted">{l(QUOTE.by)}</figcaption>
      </figure>
    </section>
  );
}

export function Reviews() {
  const l = useL();
  return (
    <section aria-labelledby="reviews" className="mx-auto w-full max-w-content px-5 py-20 md:px-10">
      <div className="flex flex-col items-center text-center">
        <Eyebrow>{l(REVIEWS.eyebrow)}</Eyebrow>
        <h2 id="reviews" className="mt-3 font-display text-3xl font-bold md:text-4xl">
          {l(REVIEWS.title)}
        </h2>
      </div>
      <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {GUESTS.map((g, i) => (
          <li
            key={g.name.en}
            className="spotlight flex flex-col rounded-card border border-line bg-card p-6 shadow-dish transition duration-300 hover:-translate-y-1 hover:border-line-strong"
          >
            <Reveal delay={Math.min(i, 5) * 80} className="flex flex-1 flex-col">
              <p className="tracking-widest text-star" aria-label={l(REVIEWS.rated)}>
                ★★★★★
              </p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink">
                &ldquo;{l(g.quote)}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <img
                  src={g.photo}
                  alt=""
                  loading="lazy"
                  className="size-10 rounded-full object-cover"
                />
                <span className="text-sm font-semibold">{l(g.name)}</span>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Visit() {
  const l = useL();
  const t = useT();
  return (
    <section
      id="visit"
      aria-labelledby="visit-title"
      className="mx-auto w-full max-w-content px-5 pb-20 md:px-10"
    >
      <Reveal className="spotlight grid overflow-hidden rounded-frame border border-line bg-surface md:grid-cols-2">
        <img
          src="/images/bar.jpg"
          alt={l(VISIT.photoAlt)}
          loading="lazy"
          className="h-64 w-full object-cover md:h-full"
        />
        <div className="p-8 md:p-12">
          <Eyebrow>{l(VISIT.eyebrow)}</Eyebrow>
          <h2 id="visit-title" className="mt-3 font-display text-3xl font-bold">
            {l(VISIT.title)}
          </h2>
          <address className="mt-4 not-italic text-ink-muted">
            {l(VISIT.address)}
            <br />
            <a href={`tel:${VISIT.phone}`} dir="ltr" className="text-flame-text hover:underline">
              {VISIT.phoneLabel}
            </a>
          </address>
          <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
            {HOURS.map((h) => (
              <div key={h.days.en} className="flex justify-between py-3">
                <dt className="text-ink-muted">{l(h.days)}</dt>
                <dd className="tabular font-medium" dir="ltr">
                  {h.time}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/reserve" className={buttonClass('primary')}>
              {t.landing.bookTable}
            </Link>
            <Link to="/menu" className={buttonClass('secondary')}>
              {l(VISIT.takeaway)}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const l = useL();
  const t = useT();
  return (
    <footer className="border-t border-line bg-bg-deep">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-ink-muted">{l(FOOTER.tagline)}</p>
        </div>
        <nav aria-label={l(FOOTER.visit)} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/menu" className="text-ink-muted hover:text-ink">
            {t.nav.links.menu}
          </Link>
          <Link to="/reserve" className="text-ink-muted hover:text-ink">
            {t.landing.bookTable}
          </Link>
          <a href="#about" className="text-ink-muted hover:text-ink">
            {l(FOOTER.about)}
          </a>
          <a href="#visit" className="text-ink-muted hover:text-ink">
            {l(FOOTER.visit)}
          </a>
          <Link to="/login" className="text-ink-muted hover:text-ink">
            {l(FOOTER.staff)}
          </Link>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-content px-5 pb-8 text-xs text-ink-muted md:px-10">
        © 2026 Fork &amp; Flame · {l(FOOTER.photos)}{' '}
        <a href="https://unsplash.com" className="underline hover:text-ink">
          Unsplash
        </a>
      </p>
    </footer>
  );
}
