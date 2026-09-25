import { useEffect, useRef, useState } from 'react';

import { formatMoney } from '../../shared/money';
import { prefersReducedMotion } from '../../shared/ui/motionUtils';
import { clamp, onScrollFrame } from '../../shared/ui/scrollFx';
import { FIRE_STAGES } from './content';

const LINES = [
  { name: 'Wagyu Burger', note: 'Large · Medium rare', photo: '/images/dishes/wagyu-burger.jpg' },
  { name: 'Truffle Arancini', note: 'With saffron', photo: '/images/dishes/truffle-arancini.jpg' },
  { name: 'Yuzu Lemonade', note: 'With mint', photo: '/images/dishes/yuzu-lemonade.jpg' },
];

/**
 * Scroll-driven story (replaces the three static "how it works" cards). On
 * wide screens the section is tall and its content sticks: scrolling through
 * it walks a phone mock of the live tracker from "table scanned" to "served",
 * while the matching step lights up beside it. On phones, or under reduced
 * motion, it is a plain ordered list — the same words, nothing hidden.
 */
export function FireToTable() {
  const section = useRef<HTMLElement>(null);
  const [stage, setStage] = useState(0);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const wide = matchMedia('(min-width: 768px)');
    const update = () => setPinned(wide.matches && !prefersReducedMotion());
    update();
    wide.addEventListener('change', update);
    return () => wide.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const el = section.current;
    if (!el) return;
    return onScrollFrame((f) => {
      const r = el.getBoundingClientRect();
      // 0 when the section's top reaches the viewport top, 1 at its end.
      const p = clamp(-r.top / Math.max(1, r.height - f.viewport), 0, 0.999);
      const next = Math.floor(p * FIRE_STAGES.length);
      setStage((prev) => (prev === next ? prev : next));
      el.style.setProperty('--story', p.toFixed(4));
    });
  }, [pinned]);

  const active = FIRE_STAGES[stage] ?? FIRE_STAGES[0];

  return (
    <section
      ref={section}
      aria-labelledby="how"
      className={`relative mx-auto w-full max-w-content px-5 md:px-10 ${pinned ? 'h-[320vh]' : 'py-20'}`}
    >
      <div
        className={
          pinned
            ? 'sticky top-0 grid h-screen items-center gap-12 py-20 md:grid-cols-[1fr_1.1fr]'
            : 'grid gap-12'
        }
      >
        {/* The phone: decorative mirror of the step list. */}
        <div aria-hidden="true" className={pinned ? 'relative mx-auto' : 'hidden'}>
          <div className="absolute inset-[-12%] rounded-full bg-flame/20 blur-3xl" />
          <div className="relative h-[520px] w-[260px] rounded-[42px] border border-line-strong bg-bg-deep p-3 shadow-plate">
            <div className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-bg-deep" />
            <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-bg px-4 pb-4 pt-9">
              <p className="text-[0.65rem] uppercase tracking-widest text-ink-muted">
                Order A-1042 · Table 7
              </p>
              <p
                key={active.status}
                className="mt-1 font-display text-2xl font-bold motion-safe:animate-rise"
              >
                {active.status}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full origin-left rounded-full bg-flame shadow-glow transition-transform duration-700 ease-out"
                  style={{ transform: `scaleX(${active.progress})` }}
                />
              </div>
              <ol className="mt-4 flex justify-between text-[0.6rem] text-ink-muted">
                {FIRE_STAGES.map((s, i) => (
                  <li key={s.n} className={i <= stage ? 'font-semibold text-ink' : ''}>
                    <span
                      className={`mx-auto mb-1 block size-2.5 rounded-full transition-colors duration-500 ${
                        i < stage
                          ? 'bg-ok'
                          : i === stage
                            ? 'bg-flame shadow-glow'
                            : 'bg-line-strong'
                      }`}
                    />
                    {s.n}
                  </li>
                ))}
              </ol>
              <ul className="mt-5 flex flex-col gap-3">
                {/* Until the order is placed, lines still being chosen show as
                    shimmering placeholders (no dimmed text to fail contrast). */}
                {LINES.map((l, i) =>
                  stage >= 1 || i === 0 ? (
                    <li
                      key={l.name}
                      className="flex items-center gap-3 motion-safe:animate-rise"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <img
                        src={l.photo}
                        alt=""
                        className={`size-10 rounded-full object-cover ${stage === 2 ? 'animate-pulse' : ''}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{l.name}</p>
                        <p className="truncate text-[0.65rem] text-ink-muted">{l.note}</p>
                      </div>
                    </li>
                  ) : (
                    <li key={l.name} className="flex items-center gap-3">
                      <span className="skeleton size-10 rounded-full" />
                      <span className="flex flex-1 flex-col gap-1.5">
                        <span className="skeleton h-2.5 w-2/3 rounded-full" />
                        <span className="skeleton h-2 w-1/2 rounded-full" />
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-auto rounded-2xl bg-flame px-4 py-3 text-white shadow-glow">
                <p className="text-[0.65rem] opacity-90">
                  {stage < 3 ? 'Ready in about' : 'Balance'}
                </p>
                <p className="font-display text-xl font-bold">
                  {stage < 3 ? `${Math.max(2, 18 - stage * 6)} min` : `Paid · ${formatMoney(4210)}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            How it works
          </p>
          <h2 id="how" className="mt-3 font-display text-3xl font-bold md:text-4xl">
            From your table to our fire, and back
          </h2>
          <ol className="mt-10 flex flex-col gap-2">
            {FIRE_STAGES.map((s, i) => {
              const on = !pinned || i === stage;
              return (
                <li
                  key={s.n}
                  className={`relative rounded-card border p-5 transition-all duration-500 ${
                    pinned && on
                      ? 'border-line-strong bg-surface shadow-dish'
                      : 'border-transparent'
                  }`}
                >
                  {pinned && on && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-4 left-0 w-1 rounded-full bg-flame shadow-glow"
                    />
                  )}
                  <div className="flex gap-4">
                    <span className="font-display text-3xl font-bold text-flame">{s.n}</span>
                    <div>
                      {/* Inactive steps dim by colour, not opacity, so text keeps AA contrast. */}
                      <h3
                        className={`text-lg font-semibold transition-colors duration-500 ${on ? 'text-ink' : 'text-ink-muted'}`}
                      >
                        {s.title}
                      </h3>
                      <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {pinned && (
            <p className="mt-6 text-xs text-ink-muted" aria-hidden="true">
              Keep scrolling ↓
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
