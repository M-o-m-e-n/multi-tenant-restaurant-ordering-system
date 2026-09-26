import { useEffect, useRef, useState } from 'react';

import { useL } from '../../i18n/localized';
import { formatMoney } from '../../shared/money';
import { prefersReducedMotion } from '../../shared/ui/motionUtils';
import { clamp, onScrollFrame } from '../../shared/ui/scrollFx';
import { FIRE } from './content';

const FIRE_STAGES = FIRE.stages;

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
  const l = useL();

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
            <div className="absolute inset-x-0 top-3 mx-auto h-5 w-24 rounded-full bg-bg-deep" />
            <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-bg px-4 pb-4 pt-9">
              <p className="text-[0.65rem] uppercase tracking-widest text-ink-muted">
                {l(FIRE.phoneHeader)}
              </p>
              <p
                key={active.status.en}
                className="mt-1 font-display text-2xl font-bold motion-safe:animate-rise"
              >
                {l(active.status)}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full origin-left rounded-full bg-flame rtl:origin-right shadow-glow transition-transform duration-700 ease-out"
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
                {FIRE.lines.map((line, i) =>
                  stage >= 1 || i === 0 ? (
                    <li
                      key={line.name.en}
                      className="flex items-center gap-3 motion-safe:animate-rise"
                      style={{ animationDelay: `${i * 90}ms` }}
                    >
                      <img
                        src={line.photo}
                        alt=""
                        className={`size-10 rounded-full object-cover ${stage === 2 ? 'animate-pulse' : ''}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{l(line.name)}</p>
                        <p className="truncate text-[0.65rem] text-ink-muted">{l(line.note)}</p>
                      </div>
                    </li>
                  ) : (
                    <li key={line.name.en} className="flex items-center gap-3">
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
                  {stage < 3 ? l(FIRE.readyIn) : l(FIRE.balance)}
                </p>
                <p className="font-display text-xl font-bold">
                  {stage < 3
                    ? `${Math.max(2, 18 - stage * 6)} ${l(FIRE.minutes)}`
                    : `${l(FIRE.paid)} · ${formatMoney(4210)}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            {l(FIRE.eyebrow)}
          </p>
          <h2 id="how" className="mt-3 font-display text-3xl font-bold md:text-4xl">
            {l(FIRE.title)}
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
                      className="absolute inset-y-4 start-0 w-1 rounded-full bg-flame shadow-glow"
                    />
                  )}
                  <div className="flex gap-4">
                    <span className="font-display text-3xl font-bold text-flame">{s.n}</span>
                    <div>
                      {/* Inactive steps dim by colour, not opacity, so text keeps AA contrast. */}
                      <h3
                        className={`text-lg font-semibold transition-colors duration-500 ${on ? 'text-ink' : 'text-ink-muted'}`}
                      >
                        {l(s.title)}
                      </h3>
                      <p className="mt-1 text-sm text-ink-muted">{l(s.body)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {pinned && (
            <p className="mt-6 text-xs text-ink-muted" aria-hidden="true">
              {l(FIRE.keepScrolling)}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
