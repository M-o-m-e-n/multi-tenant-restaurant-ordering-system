import type { MenuItemDto } from '@ros/shared';
import { type MouseEvent, type PointerEvent, type ReactNode, useRef } from 'react';

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
  // Mouse drag-to-scroll (touch keeps native scrolling). A drag suppresses the
  // click that would otherwise open the dish dialog on release.
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = rail.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = rail.current;
    const d = drag.current;
    if (!d.down || !el) return;
    const dx = e.clientX - d.startX;
    if (Math.abs(dx) > 6) d.moved = true;
    el.scrollLeft = d.startLeft - dx;
  };
  const endDrag = () => {
    drag.current.down = false;
  };
  const suppressClickAfterDrag = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={suppressClickAfterDrag}
        className="-mx-1 flex cursor-grab snap-x gap-5 overflow-x-auto px-1 pb-4 pt-14 [scrollbar-width:none] active:cursor-grabbing"
      >
        {items.map((item) => (
          <DishCard key={item.id} item={item} category={categoryName(item)} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
