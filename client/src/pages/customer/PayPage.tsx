import type { IntentResponse } from '@ros/shared';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useOrder } from '../../features/orders/ordersApi';
import { createIntent, usePaymentsConfig } from '../../features/payments/paymentsApi';
import { ApiError } from '../../shared/api/client';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';

const stripeCache = new Map<string, Promise<Stripe | null>>();
function stripeFor(key: string): Promise<Stripe | null> {
  let p = stripeCache.get(key);
  if (!p) {
    p = loadStripe(key);
    stripeCache.set(key, p);
  }
  return p;
}

/**
 * Card payment with Stripe Elements (PAY-01, PAY-02). The amount comes from
 * the server; card details go straight to Stripe and never touch our API. The
 * webhook — not this page — marks the order paid, so closing the tab right
 * after paying is safe (AC-5).
 */
export function PayPage() {
  const { id = '' } = useParams();
  const { data: order } = useOrder(id);
  const { data: config } = usePaymentsConfig();
  const key = useRef(crypto.randomUUID());
  const [intent, setIntent] = useState<IntentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owed = order?.balanceDue ?? 0;
  useEffect(() => {
    if (!config?.cardEnabled || !order || owed <= 0 || intent) return;
    createIntent(order.id, key.current)
      .then(setIntent)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Payment could not start.'),
      );
  }, [config?.cardEnabled, order, owed, intent]);

  if (!order || !config)
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Loading…
      </p>
    );

  if (!config.cardEnabled) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">Pay with our staff</h1>
        <p className="mt-3 text-ink-muted">
          Card payment online is switched off right now. Staff can take cash or card at the counter.
        </p>
        <Link to={`/orders/${order.id}`} className={`${buttonClass('ghost')} mt-6`}>
          Back to your order
        </Link>
      </main>
    );
  }
  if (owed <= 0) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">All paid — thank you</h1>
        <Link to={`/orders/${order.id}`} className={`${buttonClass('primary')} mt-6`}>
          Back to your order
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-5 pb-16">
      <p className="text-sm text-ink-muted">Order {order.orderNumber}</p>
      <h1 className="font-display text-3xl font-bold">Pay {formatMoney(intent?.amount ?? owed)}</h1>
      <p className="mt-1 text-xs text-ink-muted">
        Test mode: use card 4242 4242 4242 4242, any future date, any CVC.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-icon border border-flame p-3 text-sm">
          {error}
        </p>
      )}
      {intent ? (
        <Elements
          stripe={stripeFor(intent.publishableKey)}
          options={{
            clientSecret: intent.clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#e5322d',
                colorBackground: '#1e1e1e',
                borderRadius: '12px',
                fontFamily: 'Poppins, system-ui, sans-serif',
              },
            },
          }}
        >
          <CardForm orderId={order.id} amount={intent.amount} />
        </Elements>
      ) : (
        !error && (
          <p role="status" className="mt-6 text-ink-muted">
            Preparing a secure payment…
          </p>
        )
      )}
    </main>
  );
}

function CardForm({ orderId, amount }: { orderId: string; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}` },
      redirect: 'if_required',
    });
    setBusy(false);
    if (result.error) {
      // A declined card leaves the order unpaid; the guest can simply try again (PAY-04).
      setError(result.error.message ?? 'The card was declined.');
      return;
    }
    navigate(`/orders/${orderId}`, { replace: true });
  }

  return (
    <form
      className="mt-6 flex flex-col gap-5 rounded-card border border-line bg-surface p-6"
      onSubmit={(e) => void submit(e)}
    >
      <PaymentElement />
      {error && (
        <p role="alert" className="text-sm text-flame-text">
          {error}
        </p>
      )}
      <button type="submit" disabled={!stripe || busy} className={buttonClass('primary', 'lg')}>
        {busy ? 'Paying…' : `Pay ${formatMoney(amount)}`}
      </button>
    </form>
  );
}
