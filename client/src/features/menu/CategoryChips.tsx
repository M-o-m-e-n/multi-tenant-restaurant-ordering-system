import { useLayoutEffect, useRef, useState } from 'react';

interface Chip {
  id: string;
  name: string;
}

/**
 * Category tabs whose flame pill slides from the old choice to the new one
 * instead of jumping. The pill is measured from the active tab, so it follows
 * any label width and re-measures on resize. The active tab still carries
 * `aria-selected` and bold white text, so state never rests on colour alone.
 */
export function CategoryChips({
  chips,
  value,
  onChange,
}: {
  chips: Chip[];
  value: string;
  onChange: (id: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const host = list.current;
    if (!host) return;
    const measure = () => {
      const active = host.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!active) return;
      setPill({ left: active.offsetLeft, width: active.offsetWidth });
      // Centre the chosen chip on narrow screens — horizontally only, so the
      // page itself never jumps.
      host.scrollTo({
        left: active.offsetLeft - host.clientWidth / 2 + active.offsetWidth / 2,
        behavior: 'smooth',
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [value, chips.length]);

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Categories"
      className="relative mt-4 flex gap-2 overflow-x-auto pb-2"
    >
      {pill && (
        <span
          aria-hidden="true"
          className="absolute top-0 h-11 rounded-btn bg-flame shadow-glow transition-[transform,width] duration-500 ease-[cubic-bezier(.2,.8,.2,1)]"
          style={{ width: pill.width, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {chips.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(c.id)}
            className={`relative min-h-11 whitespace-nowrap rounded-btn border px-4 text-xs font-semibold transition-colors duration-300 ${
              on
                ? `border-transparent text-white ${pill ? '' : 'bg-flame'}`
                : 'border-line-strong bg-surface-raised text-ink hover:border-ink-muted'
            }`}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
