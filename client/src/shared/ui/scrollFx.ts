import { prefersReducedMotion } from './motionUtils';

/**
 * One shared scroll/pointer loop for every scroll-linked effect (parallax,
 * progress bar, marquee velocity). Listeners are passive and all reads happen
 * once per animation frame, so N effects cost one layout read, not N.
 */
export interface ScrollFrame {
  /** window.scrollY */
  y: number;
  /** Pixels scrolled since the previous frame, smoothed; sign gives direction. */
  velocity: number;
  /** 0…1 through the whole document. */
  progress: number;
  viewport: number;
}

type Subscriber = (f: ScrollFrame) => void;

const subscribers = new Set<Subscriber>();
let raf = 0;
let lastY = 0;
let velocity = 0;
let running = false;

function snapshot(v: number): ScrollFrame {
  const y = window.scrollY;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return {
    y,
    velocity: v,
    progress: Math.min(1, Math.max(0, y / max)),
    viewport: window.innerHeight,
  };
}

function frame() {
  const y = window.scrollY;
  const delta = y - lastY;
  lastY = y;
  // Exponential smoothing keeps velocity from jittering between wheel ticks.
  velocity = velocity * 0.85 + delta * 0.15;
  const f = snapshot(velocity);
  for (const s of subscribers) s(f);
  // Keep ticking only while something is still settling.
  if (Math.abs(velocity) > 0.05) raf = requestAnimationFrame(frame);
  else running = false;
}

function wake() {
  if (running) return;
  running = true;
  raf = requestAnimationFrame(frame);
}

/**
 * Subscribe to scroll frames. Returns an unsubscribe. Frames keep arriving
 * under reduced motion (a progress bar is a readout, not an animation), so a
 * decorative effect checks `prefersReducedMotion()` itself and stays still.
 */
export function onScrollFrame(fn: Subscriber): () => void {
  if (typeof window === 'undefined') return () => undefined;
  subscribers.add(fn);
  if (subscribers.size === 1) {
    lastY = window.scrollY;
    window.addEventListener('scroll', wake, { passive: true });
    window.addEventListener('resize', wake, { passive: true });
  }
  // Paint the initial state once.
  requestAnimationFrame(() => fn(snapshot(0)));
  if (!prefersReducedMotion()) wake();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) {
      window.removeEventListener('scroll', wake);
      window.removeEventListener('resize', wake);
      cancelAnimationFrame(raf);
      running = false;
    }
  };
}

/** Clamp to [min, max]. */
export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * How far an element has travelled through the viewport: 0 when its top meets
 * the bottom of the screen, 1 when its bottom leaves the top.
 */
export function viewportProgress(rect: DOMRect, viewport: number): number {
  return clamp((viewport - rect.top) / (viewport + rect.height), 0, 1);
}
