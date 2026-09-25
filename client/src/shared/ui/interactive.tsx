import { type ReactNode, useEffect, useRef } from 'react';

import { prefersReducedMotion } from './motionUtils';
import { useMagnetic } from './pointerFx';
import { onScrollFrame, viewportProgress } from './scrollFx';

/** Wraps a CTA so it leans toward the pointer (fine pointers only). */
export function Magnetic({ children, strength = 10 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useMagnetic(ref, strength);
  return (
    <span ref={ref} className="inline-flex will-change-transform">
      {children}
    </span>
  );
}

/**
 * Moves its child vertically as the section passes through the viewport:
 * `speed` px of travel from entering to leaving (negative drifts up). The
 * child should overflow its frame a little so no edge ever shows.
 */
export function Parallax({
  children,
  speed = 60,
  className = '',
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const host = el.parentElement ?? el;
    return onScrollFrame((f) => {
      const p = viewportProgress(host.getBoundingClientRect(), f.viewport);
      el.style.transform = `translate3d(0, ${((p - 0.5) * speed).toFixed(1)}px, 0)`;
    });
  }, [speed]);
  return (
    <div ref={ref} className={`will-change-transform ${className}`}>
      {children}
    </div>
  );
}

/** A thin flame bar across the top of the page showing how far you've read. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return onScrollFrame((f) => {
      el.style.transform = `scaleX(${f.progress.toFixed(4)})`;
    });
  }, []);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] print:hidden"
    >
      <div
        ref={ref}
        className="h-full origin-left bg-flame shadow-glow"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

/**
 * A headline whose words rise in one after another. The text stays one real
 * heading for assistive tech: the visual word spans are aria-hidden and a
 * visually hidden copy carries the sentence.
 */
export function KineticText({
  text,
  highlight,
  className = '',
}: {
  text: string;
  /** A word (or trailing phrase) painted with the moving flame gradient. */
  highlight?: string;
  className?: string;
}) {
  const plain = highlight && text.endsWith(highlight) ? text.slice(0, -highlight.length) : text;
  const words = plain.split(' ').filter(Boolean);
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {/* Real spaces between the inline-block words keep the line breakable. */}
        {words.map((w, i) => (
          <span key={`${w}-${i}`}>
            <span className="kinetic-word" style={{ animationDelay: `${i * 70}ms` }}>
              {w}
            </span>{' '}
          </span>
        ))}
        {highlight && (
          <span
            className="kinetic-word flame-shimmer"
            style={{ animationDelay: `${words.length * 70}ms` }}
          >
            {highlight}
          </span>
        )}
      </span>
    </span>
  );
}
