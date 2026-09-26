import type { MenuItemDto } from '@ros/shared';

import { useT } from '../../i18n';
import { formatMoney } from '../../shared/money';
import { allergenList } from './allergens';
import { DishImage } from './DishImage';

interface Props {
  item: MenuItemDto;
  category: string;
  onOpen: (item: MenuItemDto) => void;
  /** Position in the visible list, for a capped entrance stagger. */
  index: number;
}

/** A menu list row: thumbnail, name and description, price, red + tile. */
export function MenuRow({ item, category, onOpen, index }: Props) {
  const t = useT();
  const soldOut = !item.isAvailable;
  return (
    <li
      className="flex items-center gap-3.5 border-b border-line py-3.5 motion-safe:animate-rise"
      style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
    >
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
        className="min-w-0 flex-1 text-start"
        aria-label={t.menu.details(item.name)}
      >
        <span dir="auto" className="block text-[0.95rem] font-semibold">
          {item.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">
          {item.description}
          {item.allergens.length > 0 && ` · ${allergenList(t, item.allergens)}`}
        </span>
      </button>
      <span className="tabular text-sm font-semibold text-flame-text">
        {formatMoney(item.price)}
      </span>
      {soldOut ? (
        <span className="rounded-btn border border-line-strong px-3 py-1.5 text-xs font-semibold text-ink-muted">
          {t.menu.soldOut}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onOpen(item)}
          aria-label={t.menu.add(item.name)}
          className="grid size-11 shrink-0 place-items-center rounded-icon bg-flame text-lg font-semibold text-white hover:brightness-110"
        >
          +
        </button>
      )}
    </li>
  );
}
