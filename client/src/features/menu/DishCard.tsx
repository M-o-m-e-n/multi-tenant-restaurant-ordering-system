import type { MenuItemDto } from '@ros/shared';

import { formatMoney } from '../../shared/money';
import { DishImage } from './DishImage';

interface Props {
  item: MenuItemDto;
  category: string;
  onOpen: (item: MenuItemDto) => void;
}

/**
 * Carousel card from the reference screenshot: the plate overlaps the card's
 * top edge; price bottom-left, red cart tile bottom-right (fork-flame-ui §4).
 */
export function DishCard({ item, category, onOpen }: Props) {
  const soldOut = !item.isAvailable;
  return (
    <article className="group relative flex w-52 shrink-0 snap-start flex-col items-center rounded-card border border-line bg-card px-4 pb-4 text-center shadow-dish transition duration-300 hover:-translate-y-1.5 hover:border-line-strong">
      <div className="-mt-10 transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105">
        <DishImage
          name={item.name}
          imageUrl={item.imageUrl}
          category={category}
          size="md"
          soldOut={soldOut}
        />
      </div>
      <h3 className="mt-3 text-base font-medium">{item.name}</h3>
      <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{item.description}</p>
      <div className="mt-4 flex w-full items-center justify-between">
        <span className="tabular text-[0.95rem] font-semibold text-flame-text">
          {formatMoney(item.price)}
        </span>
        {soldOut ? (
          <span className="rounded-btn border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-muted">
            Sold out
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(item)}
            aria-label={`Add ${item.name}`}
            className="grid size-11 place-items-center rounded-icon bg-flame text-white shadow-glow hover:brightness-110"
          >
            <CartIcon />
          </button>
        )}
      </div>
    </article>
  );
}

export function CartIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="17" cy="20" r="1.3" />
    </svg>
  );
}
