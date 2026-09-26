import { type CreateOrderDto, createOrderSchema } from '@ros/shared';
import { type FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/authStore';
import { toRequestLines } from '../../features/cart/cartPricing';
import { fieldMessage } from '../../features/cart/fieldMessage';
import { useCartPricing } from '../../features/cart/useCartPricing';
import { usePlaceOrder } from '../../features/orders/ordersApi';
import { useTableSession } from '../../features/table/tableSession';
import { useT } from '../../i18n';
import { ApiError } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errorMessage';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

/**
 * Checkout (LLD §7.4): confirm details, place the order with an
 * Idempotency-Key kept for this attempt, then go to the live tracker.
 */
export function CheckoutPage() {
  const { cart, orderType, preview, server: totals, agrees } = useCartPricing();
  const user = useAuth((s) => s.user);
  const tableToken = useTableSession((s) => s.token);
  const table = useTableSession((s) => s.table);
  const place = usePlaceOrder();
  const navigate = useNavigate();
  // One key per checkout attempt, reused by any retry of this same submission.
  const key = useRef(crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  if (cart.lines.length === 0 && !place.isPending) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">{t.checkout.nothing}</h1>
        <Link to="/menu" className={`${buttonClass('primary')} mt-6`}>
          {t.cart.viewMenu}
        </Link>
      </main>
    );
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!totals || !agrees) return;
    const form = new FormData(e.currentTarget);
    const notes = formValue(form, 'notes').trim();
    const dto: CreateOrderDto = {
      type: orderType,
      items: toRequestLines(cart.lines),
      ...(orderType === 'DINE_IN' && tableToken ? { tableToken } : {}),
      ...(orderType !== 'DINE_IN'
        ? { customer: { name: formValue(form, 'name'), phone: formValue(form, 'phone') } }
        : {}),
      ...(orderType === 'DELIVERY'
        ? {
            delivery: {
              address: formValue(form, 'address'),
              ...(formValue(form, 'addressNote').trim()
                ? { note: formValue(form, 'addressNote') }
                : {}),
            },
          }
        : {}),
      ...(cart.discountCode ? { discountCode: cart.discountCode } : {}),
      tipAmount: totals.tipAmount,
      ...(notes ? { notes } : {}),
    };
    // Same schema the server enforces: bad contact or address details stop here,
    // before an order (and later a payment intent) is ever created (M12-S7).
    const check = createOrderSchema.safeParse(dto);
    if (!check.success) {
      setError(fieldMessage(t, check.error.issues[0]?.path) ?? t.checkout.checkDetails);
      return;
    }
    setError(null);
    try {
      const order = await place.mutateAsync({ dto, key: key.current });
      cart.clear();
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setError(t.errors.VALIDATION_ERROR);
      } else {
        setError(errorMessage(err, t.checkout.failed));
      }
      // A business rejection means this attempt is over: the next try is a new intent.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        key.current = crypto.randomUUID();
      }
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-content gap-8 px-5 pb-16 md:grid-cols-[1.4fr_1fr] md:px-10">
      <form id="checkout" className="flex flex-col gap-5" onSubmit={(e) => void submit(e)}>
        <h1 className="font-display text-3xl font-bold">{t.checkout.title}</h1>
        {orderType === 'DINE_IN' ? (
          <p className="rounded-icon border border-line-strong bg-surface p-4 text-sm">
            {t.checkout.dineInAt(table?.number ?? '')}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t.checkout.name}
              name="name"
              autoComplete="name"
              defaultValue={user?.name}
              required
            />
            <Field
              label={t.checkout.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              minLength={5}
              required
            />
            {orderType === 'DELIVERY' && (
              <>
                <Field
                  label={t.checkout.address}
                  name="address"
                  autoComplete="street-address"
                  minLength={5}
                  maxLength={300}
                  required
                  className="sm:col-span-2"
                />
                <Field
                  label={t.checkout.addressNote}
                  name="addressNote"
                  maxLength={120}
                  className="sm:col-span-2"
                />
              </>
            )}
          </div>
        )}
        <Field
          label={t.checkout.note}
          name="notes"
          maxLength={500}
          placeholder={t.checkout.notePlaceholder}
        />
        <p className="text-sm text-ink-muted">{t.checkout.payInfo}</p>
        {error && (
          <p role="alert" className="rounded-icon border border-flame p-3 text-sm">
            {error}{' '}
            <Link to="/cart" className="font-semibold text-flame-text underline">
              {t.checkout.backToCart}
            </Link>
          </p>
        )}
      </form>

      <aside className="flex h-fit flex-col gap-3 rounded-card border border-line bg-surface p-6">
        <h2 className="font-display text-xl font-bold">{t.checkout.summary}</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {cart.lines.map((l) => (
            <li key={l.key} className="flex justify-between gap-3">
              <span>
                {l.qty} × {l.name}
              </span>
            </li>
          ))}
        </ul>
        {totals ? (
          <dl className="tabular mt-2 flex flex-col gap-1 border-t border-line pt-3 text-sm">
            <Line label={t.totals.subtotal} cents={totals.subtotal} />
            {totals.discountAmount > 0 && (
              <Line label={t.totals.discount} cents={-totals.discountAmount} />
            )}
            {totals.serviceCharge > 0 && (
              <Line label={t.totals.serviceCharge} cents={totals.serviceCharge} />
            )}
            <Line label={t.totals.tax} cents={totals.taxAmount} />
            {totals.deliveryFee > 0 && (
              <Line label={t.totals.delivery} cents={totals.deliveryFee} />
            )}
            {totals.tipAmount > 0 && <Line label={t.totals.tip} cents={totals.tipAmount} />}
            <div className="mt-2 flex justify-between text-base font-bold">
              <dt>{t.totals.total}</dt>
              <dd>{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">
            {preview.isError ? t.checkout.notConfirmed : t.checkout.confirming}
          </p>
        )}
        <button
          type="submit"
          form="checkout"
          className={buttonClass('primary', 'lg')}
          disabled={!totals || !agrees || place.isPending}
        >
          {place.isPending
            ? t.checkout.placing
            : t.checkout.place(totals ? formatMoney(totals.total) : null)}
        </button>
      </aside>
    </main>
  );
}

function Line({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{cents < 0 ? `−${formatMoney(-cents)}` : formatMoney(cents)}</dd>
    </div>
  );
}
