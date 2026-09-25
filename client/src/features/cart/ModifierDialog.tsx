import { lineTotal, type MenuItemDto } from '@ros/shared';
import { useEffect, useMemo, useState } from 'react';

import { formatDelta, formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Modal } from '../../shared/ui/Modal';
import { DishImage } from '../menu/DishImage';
import { useMenuItem } from '../menu/menuApi';
import { type CartLine, useCart } from './cartStore';
import {
  defaultSelection,
  type Selection,
  toggleOption,
  toSnapshot,
  unmetGroups,
} from './selection';

interface Props {
  item: MenuItemDto | null;
  category: string;
  onClose: () => void;
  onAdded?: (name: string) => void;
  /** Hand the chosen line back instead of adding it to the cart (used when amending an order). */
  onPick?: (line: Omit<CartLine, 'key'>) => void;
}

/**
 * Item detail and modifier choice (BROWSE-03, CART-03). "Add to cart" stays
 * disabled until every required group is satisfied; the server re-checks
 * the same rules regardless (AC-17).
 */
export function ModifierDialog({ item, category, onClose, onAdded, onPick }: Props) {
  const detail = useMenuItem(item?.id ?? null);
  const full = detail.data;
  const groups = useMemo(() => full?.modifierGroups ?? [], [full]);
  const add = useCart((s) => s.add);
  const [sel, setSel] = useState<Selection>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setSel(defaultSelection(groups));
    setQty(1);
    setNotes('');
  }, [groups, item?.id]);

  const unmet = unmetGroups(groups, sel);
  const snapshot = toSnapshot(groups, sel);
  const price = full
    ? lineTotal({
        unitPrice: full.price,
        qty,
        modifierDeltas: snapshot.flatMap((g) => g.items.map((i) => i.priceDelta)),
      })
    : 0;
  const soldOut = full ? !full.isAvailable : false;

  function addToCart() {
    if (!full || unmet.length > 0 || soldOut) return;
    (onPick ?? add)({
      menuItemId: full.id,
      name: full.name,
      category,
      imageUrl: full.imageUrl,
      unitPrice: full.price,
      qty,
      modifiers: snapshot,
      notes,
    });
    onAdded?.(full.name);
    onClose();
  }

  return (
    <Modal open={item !== null} onClose={onClose} title={item?.name ?? ''}>
      {!full ? (
        <p role="status" className="text-sm text-ink-muted">
          Loading…
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <DishImage
              name={full.name}
              imageUrl={full.imageUrl}
              category={category}
              size="sm"
              soldOut={soldOut}
            />
            <div>
              <p className="text-sm text-ink-muted">{full.description}</p>
              {full.allergens.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">Contains: {full.allergens.join(', ')}</p>
              )}
            </div>
          </div>

          {groups.map((g) => {
            const chosen = sel[g.id] ?? [];
            const single = g.maxSelect === 1;
            const rule =
              g.minSelect > 0
                ? `Required · choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}`
                : `Optional · up to ${g.maxSelect}`;
            return (
              <fieldset key={g.id}>
                <legend className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                  {g.name} <span className="normal-case tracking-normal">· {rule}</span>
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.items.map((o) => {
                    const on = chosen.includes(o.id);
                    return (
                      <label
                        key={o.id}
                        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border px-4 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-flame-light ${
                          on
                            ? 'border-flame bg-flame text-white'
                            : 'border-line-strong bg-surface-raised'
                        }`}
                      >
                        <input
                          type={single ? 'radio' : 'checkbox'}
                          name={g.id}
                          className="sr-only"
                          checked={on}
                          disabled={!o.isAvailable}
                          onChange={() => setSel((s) => toggleOption(s, g, o.id))}
                        />
                        {on && <span aria-hidden="true">✓</span>}
                        {o.name}
                        {o.priceDelta !== 0 && (
                          <span className={on ? '' : 'text-ink-muted'}>
                            {formatDelta(o.priceDelta)}
                          </span>
                        )}
                        {!o.isAvailable && <span className="text-xs">(unavailable)</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              Note for the kitchen
            </span>
            <input
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="No onions, extra crispy…"
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" aria-label="Quantity">
              <button
                type="button"
                aria-label="One fewer"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid size-11 place-items-center rounded-full border border-line-strong text-lg"
              >
                −
              </button>
              <span className="tabular w-6 text-center font-semibold" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                aria-label="One more"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="grid size-11 place-items-center rounded-full border border-line-strong text-lg"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className={buttonClass('primary', 'lg')}
              disabled={unmet.length > 0 || soldOut}
              onClick={addToCart}
            >
              {soldOut ? 'Sold out' : `Add · ${formatMoney(price)}`}
            </button>
          </div>
          {unmet.length > 0 && !soldOut && (
            <p className="text-xs text-ink-muted" aria-live="polite">
              Choose {unmet.map((g) => g.name.toLowerCase()).join(' and ')} to continue.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
