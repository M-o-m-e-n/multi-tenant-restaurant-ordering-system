import { lineTotal, type MenuItemDto } from '@ros/shared';
import { useEffect, useMemo, useState } from 'react';

import { useT } from '../../i18n';
import { formatDelta, formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Modal } from '../../shared/ui/Modal';
import { flyToCart } from '../../shared/ui/motionUtils';
import { toast } from '../../shared/ui/toastStore';
import { allergenList } from '../menu/allergens';
import { DishImage } from '../menu/DishImage';
import { useMenuItem } from '../menu/menuApi';
import { type CartLine, lineKey, useCart } from './cartStore';
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
  const t = useT();
  const full = detail.data;
  const groups = useMemo(() => full?.modifierGroups ?? [], [full]);
  const add = useCart((s) => s.add);
  // The selection is derived during render, so the defaults are present on the
  // very first paint after the item loads; an effect would flash "Choose size
  // and doneness" for a frame. Picks are kept only for the groups they were
  // made against.
  const defaults = useMemo(() => defaultSelection(groups), [groups]);
  const [picked, setPicked] = useState<{ for: typeof groups; sel: Selection } | null>(null);
  const sel = picked?.for === groups ? picked.sel : defaults;
  const setSel = (update: (s: Selection) => Selection) =>
    setPicked((prev) => ({
      for: groups,
      sel: update(prev?.for === groups ? prev.sel : defaults),
    }));
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setQty(1);
    setNotes('');
  }, [groups, item?.id]);

  // Closing forgets the picks, so reopening a dish starts from its defaults.
  useEffect(() => {
    if (!item) setPicked(null);
  }, [item]);

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
    const line = {
      menuItemId: full.id,
      name: full.name,
      category,
      imageUrl: full.imageUrl,
      unitPrice: full.price,
      qty,
      modifiers: snapshot,
      notes,
    };
    if (onPick) {
      onPick(line);
    } else {
      add(line);
      const added = qty;
      toast({
        title: t.dish.added(added, full.name),
        detail: t.dish.addedDetail,
        imageUrl: full.imageUrl,
        action: {
          label: t.common.undo,
          run: () => {
            const key = lineKey(line);
            for (let i = 0; i < added; i++) useCart.getState().decrement(key);
          },
        },
      });
    }
    onAdded?.(full.name);
    onClose();
  }

  return (
    <Modal open={item !== null} onClose={onClose} title={item?.name ?? ''}>
      {!full ? (
        <p role="status" className="text-sm text-ink-muted">
          {t.common.loading}
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
                <p className="mt-1 text-xs text-ink-muted">
                  {t.dish.contains(allergenList(t, full.allergens))}
                </p>
              )}
            </div>
          </div>

          {groups.map((g) => {
            const chosen = sel[g.id] ?? [];
            const single = g.maxSelect === 1;
            const rule =
              g.minSelect > 0
                ? t.dish.required(g.minSelect, g.maxSelect)
                : t.dish.optional(g.maxSelect);
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
                        {!o.isAvailable && <span className="text-xs">{t.dish.unavailable}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
              {t.dish.note}
            </span>
            <input
              value={notes}
              maxLength={300}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t.dish.notePlaceholder}
              className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2" aria-label={t.dish.quantity}>
              <button
                type="button"
                aria-label={t.dish.fewer}
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
                aria-label={t.dish.more}
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
              onClick={(e) => {
                if (!full || unmet.length > 0 || soldOut) return;
                // The flight is decorative; amending an order has no cart to fly to.
                if (!onPick) flyToCart(e.currentTarget, full.imageUrl, full.name);
                addToCart();
              }}
            >
              {soldOut ? t.menu.soldOut : t.dish.addPrice(formatMoney(price))}
            </button>
          </div>
          {unmet.length > 0 && !soldOut && (
            <p className="text-xs text-ink-muted" aria-live="polite">
              {t.dish.choose(unmet.map((g) => g.name.toLowerCase()))}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
