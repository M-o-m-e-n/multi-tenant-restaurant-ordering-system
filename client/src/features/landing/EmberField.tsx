import { useEffect, useRef } from 'react';

import { emberPalette } from '../../shared/theme';
import { prefersReducedMotion } from '../../shared/ui/motionUtils';

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  hue: string;
  wobble: number;
}

const COUNT = 46;
const REPEL_RADIUS = 110;

/**
 * Embers rising off the grill behind the hero plate. A canvas, not DOM nodes:
 * one draw call per ember per frame, transform-free, and it stops entirely
 * when the hero is off-screen or the tab is hidden. The pointer pushes
 * nearby embers aside, so the scene answers to the guest.
 *
 * Decorative only (aria-hidden); under reduced motion it renders nothing.
 */
export function EmberField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: -9999, y: -9999 };
    let raf = 0;
    let visible = true;
    const palette = emberPalette();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (e: Partial<Ember> = {}): Ember => {
      const max = 140 + Math.random() * 160;
      return {
        // Rise from a band around the plate's lower half.
        x: width * (0.25 + Math.random() * 0.5),
        y: height * (0.65 + Math.random() * 0.3),
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.35 + Math.random() * 0.9),
        r: 0.8 + Math.random() * 2.2,
        life: 0,
        max,
        hue: palette[Math.floor(Math.random() * palette.length)] ?? 'transparent',
        wobble: Math.random() * Math.PI * 2,
        ...e,
      };
    };

    resize();
    // Stagger the first generation so the field is full at once, not a wave.
    const embers: Ember[] = Array.from({ length: COUNT }, () => {
      const e = spawn();
      e.life = Math.random() * e.max;
      e.y -= (e.life / e.max) * height * 0.6;
      return e;
    });

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        if (!e) continue;
        e.life += 1;
        e.wobble += 0.04;
        // Pointer repulsion, falling off with distance.
        const dx = e.x - pointer.x;
        const dy = e.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REPEL_RADIUS * REPEL_RADIUS) {
          const d = Math.sqrt(d2) || 1;
          const force = (1 - d / REPEL_RADIUS) * 0.9;
          e.vx += (dx / d) * force;
          e.vy += (dy / d) * force * 0.5;
        }
        e.vx = e.vx * 0.96 + Math.sin(e.wobble) * 0.02;
        e.vy = Math.min(e.vy * 0.99, -0.25);
        e.x += e.vx;
        e.y += e.vy;

        const t = e.life / e.max;
        if (t >= 1 || e.y < -10) {
          embers[i] = spawn();
          continue;
        }
        // Fade in fast, glow, fade out slowly.
        const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        const glow = e.r * 4;
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glow);
        g.addColorStop(0, e.hue);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.max(0, alpha) * 0.9;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, glow, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    };

    const onPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ev.clientX - rect.left;
      pointer.y = ev.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      start();
    });
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.addEventListener('visibilitychange', start);
    // Listen on the hero, not the canvas: the canvas sits under the content.
    const host = canvas.parentElement ?? window;
    host.addEventListener('pointermove', onPointer as EventListener, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    start();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', start);
      host.removeEventListener('pointermove', onPointer as EventListener);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    />
  );
}
