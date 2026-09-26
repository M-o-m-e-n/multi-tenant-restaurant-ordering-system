import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useLang, useT } from '../../i18n';
import { useL } from '../../i18n/localized';
import { buttonClass } from '../../shared/ui/buttonClass';
import { KineticText, Magnetic } from '../../shared/ui/interactive';
import { usePointerParallax } from '../../shared/ui/pointerFx';
import { useSettings } from '../cart/cartApi';
import { GUESTS, HERO } from './content';
import { EmberField } from './EmberField';
import { hourLabel, openStatus } from './openHours';

/** A layer that drifts `px` pixels with the pointer (negative = against it). */
const depth = (px: number): CSSProperties => ({
  transform: `translate3d(calc(var(--px, 0) * ${px}px), calc(var(--py, 0) * ${px}px), 0)`,
});

/** The live "open now" chip, on the restaurant's clock; re-checked every minute. */
function OpenChip() {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? 'America/New_York';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const status = openStatus(now, tz);
  const t = useT();
  const lang = useLang();
  const label = status.open
    ? (status.closingSoon ? t.landing.closingSoon : t.landing.openNow)(
        hourLabel(status.closesAt, lang),
      )
    : (status.opens === 'today' ? t.landing.opensToday : t.landing.opensTomorrow)(
        hourLabel(status.opensAt, lang),
      );
  return (
    <p className="inline-flex items-center gap-2 rounded-btn border border-line-strong bg-surface/80 px-4 py-1.5 text-xs font-medium text-ink-muted backdrop-blur">
      <span className="relative flex size-2" aria-hidden="true">
        {status.open && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-75" />
        )}
        <span
          className={`relative inline-flex size-2 rounded-full ${status.open ? 'bg-ok' : 'bg-ink-muted'}`}
        />
      </span>
      {label}
    </p>
  );
}

/**
 * Landing hero (fork-flame-ui §4), made reactive: embers rise off the plate
 * and scatter from the pointer; the plate tilts and the garnish and chips
 * float at different depths as the pointer moves; the headline assembles
 * word by word and the CTAs lean toward the cursor. All of it is decoration
 * layered over the same content, and all of it stands still under reduced
 * motion or on touch.
 */
export function Hero() {
  const stage = useRef<HTMLElement>(null);
  usePointerParallax(stage);
  const t = useT();
  const l = useL();

  return (
    <section
      ref={stage}
      className="relative isolate mx-auto grid w-full max-w-content items-center gap-12 overflow-x-clip px-5 pb-20 pt-6 md:grid-cols-[1.05fr_1fr] md:px-10 md:pt-10"
    >
      <EmberField className="-z-10 opacity-80" />

      <div className="text-center md:text-start">
        <div className="motion-safe:animate-rise">
          <OpenChip />
        </div>
        <h1 className="mt-6 font-display text-hero-sm font-bold md:text-hero">
          <KineticText text={l(HERO.headline)} highlight={l(HERO.highlight)} />
        </h1>
        <p className="mx-auto mt-5 max-w-md text-ink-muted motion-safe:animate-rise motion-safe:[animation-delay:.5s] md:mx-0">
          {l(HERO.body)}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 motion-safe:animate-rise motion-safe:[animation-delay:.65s] md:justify-start">
          <Magnetic>
            <Link to="/menu" className={`${buttonClass('primary', 'lg')} group`}>
              {t.landing.viewMenu}
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              >
                →
              </span>
            </Link>
          </Magnetic>
          <Magnetic strength={6}>
            <Link to="/reserve" className={buttonClass('secondary', 'lg')}>
              {t.landing.bookTable}
            </Link>
          </Magnetic>
        </div>
        <div className="mt-10 flex items-center justify-center gap-4 motion-safe:animate-rise motion-safe:[animation-delay:.8s] md:justify-start">
          <div className="flex -space-x-3 rtl:space-x-reverse">
            {GUESTS.slice(0, 3).map((g) => (
              <img
                key={g.photo}
                src={g.photo}
                alt=""
                className="size-10 rounded-full border-2 border-bg object-cover transition-transform duration-300 hover:z-10 hover:-translate-y-1 hover:scale-110"
              />
            ))}
            <span className="grid size-10 place-items-center rounded-full border-2 border-bg bg-flame text-[0.7rem] font-bold text-white">
              1.2k+
            </span>
          </div>
          <div className="text-start">
            <p className="text-sm tracking-widest text-star" aria-hidden="true">
              ★★★★★
            </p>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">4.9</span> {l(HERO.reviews)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[480px] [perspective:900px] motion-safe:animate-rise motion-safe:[animation-delay:150ms]">
        <div
          className="absolute inset-[8%] animate-pulse rounded-full bg-flame/25 blur-3xl [animation-duration:4s]"
          aria-hidden="true"
          style={depth(-10)}
        />
        <div aria-hidden="true" className="absolute inset-0" style={depth(-6)}>
          <div className="absolute inset-[-3%] animate-spin-slow rounded-full border border-dashed border-flame/40" />
        </div>
        {/* The plate tilts toward the pointer like a dish turned to the light. */}
        <div
          className="absolute inset-0 transition-transform duration-100 [transform-style:preserve-3d]"
          style={{
            transform: 'rotateX(calc(var(--py, 0) * -9deg)) rotateY(calc(var(--px, 0) * 11deg))',
          }}
        >
          <div
            className="absolute inset-[4%] rounded-full bg-slate shadow-plate"
            aria-hidden="true"
          />
          <img
            src="/images/hero-plate.jpg"
            alt={l(HERO.plateAlt)}
            loading="eager"
            className="absolute inset-[9%] size-[82%] animate-spin-slow rounded-full object-cover shadow-plate"
          />
          {/* A soft specular highlight that slides across the plate. */}
          <div aria-hidden="true" className="plate-sheen absolute inset-[9%] rounded-full" />
        </div>

        <div className="absolute -end-1 top-[4%]" style={depth(28)} aria-hidden="true">
          <img
            src="/images/tomatoes.jpg"
            alt=""
            className="size-20 animate-bob rounded-full border-4 border-card-top object-cover shadow-dish md:size-24"
          />
        </div>
        <span aria-hidden="true" className="absolute start-[2%] top-[30%]" style={depth(36)}>
          <span className="inline-block animate-bob text-4xl [animation-delay:.8s]">🌿</span>
        </span>
        <span aria-hidden="true" className="absolute bottom-[12%] end-[4%]" style={depth(22)}>
          <span className="inline-block animate-bob text-3xl [animation-delay:1.6s]">🌶️</span>
        </span>

        <div className="absolute -start-2 bottom-[8%] md:-start-6" style={depth(18)}>
          <div className="animate-float rounded-card border border-line bg-surface/90 px-4 py-3 shadow-dish backdrop-blur">
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-ink-muted">
              {l(HERO.pickLabel)}
            </p>
            <p className="font-display text-lg font-bold">{l(HERO.pickName)}</p>
            <p className="text-xs text-star">
              ★ 4.9 <span className="text-ink-muted">· {l(HERO.pickOrders)}</span>
            </p>
          </div>
        </div>
        <div className="absolute end-0 top-[48%] hidden sm:block" style={depth(12)}>
          <div className="flex animate-float items-center gap-3 rounded-card border border-line bg-surface/90 px-4 py-3 shadow-dish backdrop-blur [animation-delay:1.2s]">
            <span className="grid size-9 place-items-center rounded-icon bg-flame text-white shadow-glow">
              ⏱
            </span>
            <div>
              <p className="text-sm font-semibold">{l(HERO.eta)}</p>
              <p className="text-xs text-ink-muted">{l(HERO.etaLabel)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
