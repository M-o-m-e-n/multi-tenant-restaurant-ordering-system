import type { MenuItemDto } from '@ros/shared';

import { formatMoney } from '../../shared/money';
import { DishImage } from './DishImage';

interface Props {
  item: MenuItemDto;
  category: string;
  onOpen: (item: MenuItemDto) => void;
}

/** A menu list row: thumbnail, name and description, price, red + tile. */
export function MenuRow({ item, category, onOpen }: Props) {
  const soldOut = !item.isAvailable;
  return (
    <li className="flex items-center gap-3.5 border-b border-line py-3.5">
      <DishImage
        name={item.name}
        imageUrl={item.imageUrl}
        category={category}
        size="sm"
        soldOut={soldOut}
      />
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 text-left"
        aria-label={`${item.name} details`}
      >
        <span className="block text-[0.95rem] font-semibold">{item.name}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">
          {item.description}
          {item.allergens.length > 0 && ` · ${item.allergens.join(', ')}`}
        </span>
      </button>
      <span className="tabular text-sm font-semibold text-flame-text">
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
          className="grid size-11 shrink-0 place-items-center rounded-icon bg-flame text-lg font-semibold text-white hover:brightness-110"
        >
          +
        </button>
      )}
    </li>
  );
}
