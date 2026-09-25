import type { MenuItemDto } from '@ros/shared';
import { type ReactNode, useRef } from 'react';

import { DishCard } from './DishCard';

interface Props {
  id: string;
  title: ReactNode;
  items: MenuItemDto[];
  categoryName: (item: MenuItemDto) => string;
  onOpen: (item: MenuItemDto) => void;
}

/**
 * The "Chef's signatures" carousel (fork-flame-ui §4): grey back arrow, flame
 * forward arrow; arrows hide on touch widths where the rail scrolls natively.
 */
export function SignatureRail({ id, title, items, categoryName, onOpen }: Props) {
  const rail = useRef<HTMLDivElement>(null);
  const scroll = (left: number) => rail.current?.scrollBy({ left, behavior: 'smooth' });
  return (
    <section aria-labelledby={id} className="relative">
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="font-display text-2xl font-bold md:text-3xl">
          {title}
        </h2>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            aria-label="Scroll back"
            onClick={() => scroll(-240)}
            className="grid size-11 place-items-center rounded-full bg-line-strong text-white"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Scroll forward"
            onClick={() => scroll(240)}
            className="grid size-11 place-items-center rounded-full bg-flame text-white shadow-glow"
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={rail}
        className="-mx-1 flex snap-x gap-5 overflow-x-auto px-1 pb-4 pt-14 [scrollbar-width:none]"
      >
        {items.map((item) => (
          <DishCard key={item.id} item={item} category={categoryName(item)} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
