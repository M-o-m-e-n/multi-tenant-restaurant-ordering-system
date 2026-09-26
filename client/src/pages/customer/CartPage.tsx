import { lineTotal } from '@ros/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { tipCents } from '../../features/cart/cartPricing';
import type { OffsiteType } from '../../features/cart/cartStore';
import { TipSelector } from '../../features/cart/TipSelector';
import { useCartPricing } from '../../features/cart/useCartPricing';
import { DishImage } from '../../features/menu/DishImage';
import { TableBanner } from '../../features/table/TableBanner';
import { useT } from '../../i18n';
import { errorMessage } from '../../shared/api/errorMessage';
import { formatDelta, formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';

/** Cart and pricing (CART-01…08, TIP-01): client totals live, confirmed by the server preview. */
export function CartPage() {
  const {
    cart,
    orderType,
    settings,
    local,
    preview,
    server,
    agrees,
    error: previewError,
    clearDiscount,
  } = useCartPricing();
  const t = useT();
  const [codeInput, setCodeInput] = useState(cart.discountCode ?? '');
  const [codeError, setCodeError] = useState<string | null>(null);

  // A rejected promo code is removed and explained inline (DISC-02).
  const { discountCode, setDiscountCode } = cart;
  useEffect(() => {
    if (previewError?.code.startsWith('DISCOUNT_') && discountCode) {
      // The friendly per-code line, in the reader's language (DISC-02).
      setCodeError(
        (t.errors as Readonly<Record<string, string>>)[previewError.code] ??
          errorMessage(previewError),
      );
      setDiscountCode(null);
    }
  }, [previewError, discountCode, setDiscountCode, t]);

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">{t.cart.emptyTitle}</h1>
        <p className="mt-2 text-ink-muted">{t.cart.emptyBody}</p>
        <Link to="/menu" className={`${buttonClass('primary')} mt-6`}>
          {t.cart.viewMenu}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-content gap-8 px-5 pb-16 md:grid-cols-[1.4fr_1fr] md:px-10">
      <section aria-labelledby="cart-title">
        <TableBanner />
        <h1 id="cart-title" className="font-display text-3xl font-bold">
          {t.cart.title}
        </h1>
        {orderType !== 'DINE_IN' && (
          <div role="radiogroup" aria-label={t.cart.howLabel} className="mt-4 flex gap-2">
            {(['TAKEAWAY', 'DELIVERY'] as OffsiteType[]).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={cart.offsiteType === type}
                onClick={() => cart.setOffsiteType(type)}
                className={`min-h-11 rounded-btn border px-5 text-sm font-semibold ${cart.offsiteType === type ? 'border-flame bg-flame text-white' : 'border-line-strong bg-surface-raised'}`}
              >
                {type === 'TAKEAWAY' ? t.cart.takeaway : t.cart.delivery}
              </button>
            ))}
          </div>
        )}
        {previewError?.code === 'ITEM_UNAVAILABLE' && (
          <p role="alert" className="mt-4 rounded-icon border border-flame p-3 text-sm">
            {errorMessage(previewError)}
          </p>
        )}
        <ul className="mt-4 divide-y divide-line">
          {cart.lines.map((l, i) => {
            const unavailable =
              previewError?.code === 'ITEM_UNAVAILABLE' &&
              ((previewError.details?.menuItemIds as string[] | undefined) ?? []).includes(
                l.menuItemId,
              );
            return (
              <li
                key={l.key}
                style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
                className={`flex gap-3 py-4 motion-safe:animate-rise ${unavailable ? 'opacity-60' : ''}`}
              >
                <DishImage
                  name={l.name}
                  imageUrl={l.imageUrl}
                  category={l.category}
                  size="sm"
                  soldOut={unavailable}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {l.name}
                    {unavailable && (
                      <span className="ms-2 text-xs font-semibold text-flame-text">
                        {t.menu.soldOut}
                      </span>
                    )}
                  </p>
                  {l.modifiers.length > 0 && (
                    <p className="text-xs text-ink-muted">
                      {l.modifiers
                        .flatMap((g) =>
                          g.items.map(
                            (i) =>
                              `${i.name}${i.priceDelta ? ` ${formatDelta(i.priceDelta)}` : ''}`,
                          ),
                        )
                        .join(' · ')}
                    </p>
                  )}
                  <label className="mt-2 block">
                    <span className="sr-only">{t.cart.noteFor(l.name)}</span>
                    <input
                      value={l.notes}
                      maxLength={300}
                      onChange={(e) => cart.setNotes(l.key, e.target.value)}
                      placeholder={t.cart.addNote}
                      className="min-h-9 w-full rounded-icon border border-line bg-bg px-3 text-xs"
                    />
                  </label>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="tabular text-sm font-semibold text-flame-text">
                    {formatMoney(
                      lineTotal({
                        unitPrice: l.unitPrice,
                        qty: l.qty,
                        modifierDeltas: l.modifiers.flatMap((g) =>
                          g.items.map((i) => i.priceDelta),
                        ),
                      }),
                    )}
                  </span>
                  <div className="flex items-center gap-1" aria-label={t.cart.quantityOf(l.name)}>
                    <button
                      type="button"
                      aria-label={t.cart.fewer(l.name)}
                      onClick={() => cart.decrement(l.key)}
                      className="grid size-11 place-items-center rounded-full border border-line-strong"
                    >
                      −
                    </button>
                    <span className="tabular w-6 text-center text-sm font-semibold">{l.qty}</span>
                    <button
                      type="button"
                      aria-label={t.cart.more(l.name)}
                      onClick={() => cart.increment(l.key)}
                      className="grid size-11 place-items-center rounded-full border border-line-strong"
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link
          to="/menu"
          className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-flame-text"
        >
          {t.cart.addMore}
        </Link>
      </section>

      <aside className="flex h-fit flex-col gap-5 rounded-card border border-line bg-surface p-6">
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            setCodeError(null);
            cart.setDiscountCode(codeInput.trim() || null);
          }}
        >
          <label
            htmlFor="promo"
            className="text-xs font-medium uppercase tracking-wider text-ink-muted"
          >
            {t.cart.promo}
          </label>
          <div className="flex gap-2">
            <input
              id="promo"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="SAVE10"
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? 'promo-error' : undefined}
              className="min-h-11 min-w-0 flex-1 rounded-icon border border-line-strong bg-bg px-3 text-sm uppercase"
            />
            <button type="submit" className={buttonClass('ghost')}>
              {t.cart.apply}
            </button>
          </div>
          {codeError && (
            <p id="promo-error" className="text-xs text-flame-text">
              {codeError}
            </p>
          )}
          {preview.data?.discount && (
            <p className="text-xs text-ok">
              {t.cart.applied(preview.data.discount.code)}{' '}
              <button
                type="button"
                className="ml-1 font-semibold text-ink-muted underline"
                onClick={() => {
                  cart.setDiscountCode(null);
                  clearDiscount();
                  setCodeInput('');
                }}
              >
                {t.cart.remove}
              </button>
            </p>
          )}
        </form>

        {settings && local && (
          <TipSelector
            presetsBps={settings.tipPresetsBps}
            value={cart.tip}
            presetAmount={(bps) =>
              tipCents({ kind: 'preset', bps }, local.subtotal, local.discountAmount)
            }
            onChange={cart.setTip}
          />
        )}

        {local && (
          <dl className="tabular flex flex-col gap-1.5 text-sm">
            <Row label={t.totals.subtotal} cents={local.subtotal} />
            {local.discountAmount > 0 && (
              <Row label={t.totals.discount} cents={-local.discountAmount} />
            )}
            {local.serviceCharge > 0 && (
              <Row label={t.totals.serviceCharge} cents={local.serviceCharge} />
            )}
            <Row label={t.totals.tax} cents={local.taxAmount} />
            {local.deliveryFee > 0 && <Row label={t.totals.delivery} cents={local.deliveryFee} />}
            {local.tipAmount > 0 && <Row label={t.totals.tip} cents={local.tipAmount} />}
            <div className="mt-2 flex justify-between border-t border-line pt-3 text-base font-bold">
              <dt>{t.totals.total}</dt>
              <dd>{formatMoney(local.total)}</dd>
            </div>
          </dl>
        )}
        <p className="text-xs text-ink-muted" aria-live="polite">
          {preview.isFetching
            ? t.cart.checking
            : agrees
              ? t.cart.confirmed
              : server
                ? t.cart.updated
                : ''}
        </p>
        <Link
          to="/checkout"
          aria-disabled={!agrees}
          className={`${buttonClass('primary', 'lg')} ${agrees ? '' : 'pointer-events-none opacity-50'}`}
        >
          {t.cart.checkout}
        </Link>
      </aside>
    </main>
  );
}

function Row({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents)}</dd>
    </div>
  );
}
