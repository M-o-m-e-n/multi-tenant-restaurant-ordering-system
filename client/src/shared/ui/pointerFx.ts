import { type RefObject, useEffect } from 'react';

import { prefersReducedMotion } from './motionUtils';

/** A mouse or trackpad: hover effects make no sense on touch. */
export function hasFinePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches;
}

/**
 * Writes the pointer position over `ref` into CSS variables `--px`/`--py`
 * (−1…1 from the centre), eased so layers glide rather than jump. Children
 * read them in `transform` to sit at different depths. Resets to 0 when the
 * pointer leaves; does nothing on touch or under reduced motion.
 */
export function usePointerParallax(ref: RefObject<HTMLElement>, ease = 0.08): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !hasFinePointer()) return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      el.style.setProperty('--px', x.toFixed(4));
      el.style.setProperty('--py', y.toFixed(4));
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      ty = ((e.clientY - r.top) / r.height) * 2 - 1;
      kick();
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      kick();
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, ease]);
}

/**
 * Pulls an element toward the pointer while it hovers nearby — a magnetic
 * button. The pull is capped at `strength` px and springs back on leave.
 */
export function useMagnetic(ref: RefObject<HTMLElement>, strength = 10): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !hasFinePointer()) return;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.style.transform = `translate3d(${(dx * strength).toFixed(2)}px, ${(dy * strength * 0.6).toFixed(2)}px, 0)`;
    };
    const onLeave = () => {
      el.style.transform = '';
    };
    el.style.transition = 'transform .35s cubic-bezier(.2,.7,.2,1)';
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.style.transform = '';
    };
  }, [ref, strength]);
}

/**
 * One document-level listener that lights any `.spotlight` element under the
 * pointer: it writes `--mx`/`--my` (px inside the element) for the CSS glow.
 * Installed once by the app shell; cheap because it only touches the element
 * actually hovered.
 */
export function useSpotlight(): void {
  useEffect(() => {
    if (prefersReducedMotion() || !hasFinePointer()) return;
    let raf = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const target = (e.target as Element | null)?.closest?.('.spotlight');
      if (!(target instanceof HTMLElement)) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${e.clientX - r.left}px`);
      target.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
