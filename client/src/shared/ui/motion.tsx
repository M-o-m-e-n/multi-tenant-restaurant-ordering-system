import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';

import { formatNumber } from '../format';
import { prefersReducedMotion } from './motionUtils';

type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  className?: string;
};

/**
 * Fades content up the first time it scrolls into view. Rendered as a plain
 * `div`, so only wrap content where a `div` is valid (never directly inside
 * `ol`/`ul` — wrap the items' contents instead).
 */
export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties | undefined =
    delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;
  // Children always render (no layout shift, no hidden content for axe);
  // only the entrance transition is gated on visibility.
  const cls = `reveal${shown ? ' is-in' : ''}${className ? ` ${className}` : ''}`;
  return (
    <div ref={ref} style={style} className={cls}>
      {children}
    </div>
  );
}

type CountUpProps = {
  value: number;
  decimals?: number;
  suffix?: string;
  durationMs?: number;
  className?: string;
};

function formatCount(value: number, decimals: number, suffix: string): string {
  return `${formatNumber(value, decimals)}${suffix}`;
}

/** Animates a stat from zero to `value` the first time it scrolls into view. */
export function CountUp({ value, decimals = 0, suffix = '', durationMs = 1300 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [text, setText] = useState(() =>
    prefersReducedMotion()
      ? formatCount(value, decimals, suffix)
      : formatCount(0, decimals, suffix),
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setText(formatCount(value, decimals, suffix));
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setText(formatCount(value, decimals, suffix));
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const k = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - k, 3);
          setText(formatCount(value * eased, decimals, suffix));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, decimals, suffix, durationMs]);

  return <span ref={ref}>{text}</span>;
}
