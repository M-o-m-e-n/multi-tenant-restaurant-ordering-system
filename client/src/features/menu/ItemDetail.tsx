import type { MenuItemDto } from '@ros/shared';

import { formatDelta, formatMoney } from '../../shared/money';
import { Modal } from '../../shared/ui/Modal';
import { DishImage } from './DishImage';
import { useMenuItem } from './menuApi';

interface Props {
  item: MenuItemDto | null;
  category: string;
  onClose: () => void;
}

/** Item detail: description, allergens and the modifier choices with their prices (BROWSE-03). */
export function ItemDetail({ item, category, onClose }: Props) {
  const detail = useMenuItem(item?.id ?? null);
  const full = detail.data ?? item;

  return (
    <Modal open={item !== null} onClose={onClose} title={item?.name ?? ''}>
      {full && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <DishImage
              name={full.name}
              imageUrl={full.imageUrl}
              category={category}
              size="sm"
              soldOut={!full.isAvailable}
            />
            <div>
              <p className="text-sm text-ink-muted">{full.description}</p>
              <p className="tabular mt-1 text-lg font-semibold text-flame-text">
                {formatMoney(full.price)}
              </p>
            </div>
          </div>
          {full.allergens.length > 0 && (
            <p className="text-xs text-ink-muted">Contains: {full.allergens.join(', ')}</p>
          )}
          {detail.isLoading && <p className="text-sm text-ink-muted">Loading options…</p>}
          {full.modifierGroups?.map((g) => (
            <section key={g.id}>
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {g.name} ·{' '}
                {g.minSelect > 0
                  ? `choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}`
                  : `up to ${g.maxSelect}`}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {g.items.map((o) => (
                  <li
                    key={o.id}
                    className={`rounded-btn border border-line-strong px-3 py-1.5 text-sm ${o.isAvailable ? '' : 'text-ink-muted line-through'}`}
                  >
                    {o.name} <span className="text-ink-muted">{formatDelta(o.priceDelta)}</span>
                    {!o.isAvailable && <span className="sr-only"> (unavailable)</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!full.isAvailable && (
            <p className="rounded-icon border border-line-strong p-3 text-sm">
              Sold out for now — back soon.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
