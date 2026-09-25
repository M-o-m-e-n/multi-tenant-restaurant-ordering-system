import Stripe from 'stripe';

import { ValidationError } from '../../src/lib/errors';
import type { GatewayEvent, IntentStatus, PaymentGateway } from '../../src/lib/payment-gateway';

export const WEBHOOK_SECRET = 'whsec_test_secret';

// Only the offline webhook helpers are used; no request ever leaves the process.
const stripe = new Stripe('sk_test_offline');

/** A card processor that never touches the network, with real Stripe signatures. */
export class FakeGateway implements PaymentGateway {
  readonly cardEnabled = true;
  readonly publishableKey = 'pk_test_fake';
  intents = new Map<string, IntentStatus>();
  createCalls: { amount: number; idempotencyKey: string }[] = [];
  refunds: { paymentIntentId: string; amount: number; idempotencyKey: string }[] = [];
  private n = 0;

  createIntent(p: { amount: number; idempotencyKey: string }) {
    this.createCalls.push({ amount: p.amount, idempotencyKey: p.idempotencyKey });
    const id = `pi_test_${++this.n}`;
    this.intents.set(id, { id, status: 'requires_payment_method', amount: p.amount });
    return Promise.resolve({ id, clientSecret: `${id}_secret_x` });
  }

  retrieveIntent(id: string) {
    const intent = this.intents.get(id);
    if (!intent) return Promise.reject(new Error(`no intent ${id}`));
    return Promise.resolve(intent);
  }

  refund(p: { paymentIntentId: string; amount: number; idempotencyKey: string }) {
    this.refunds.push(p);
    return Promise.resolve({ id: `re_test_${this.refunds.length}` });
  }

  constructEvent(rawBody: Buffer, signature: string | undefined): GatewayEvent {
    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature ?? '', WEBHOOK_SECRET);
      const object = event.data.object as { object?: string; id?: string };
      return {
        id: event.id,
        type: event.type,
        intentId: object.object === 'payment_intent' ? (object.id ?? null) : null,
      };
    } catch {
      throw new ValidationError(
        'WEBHOOK_INVALID_SIGNATURE',
        'The Stripe signature did not verify.',
      );
    }
  }
}

/** A signed webhook body for a payment-intent event, as Stripe would send it. */
export function signedEvent(
  type: 'payment_intent.succeeded' | 'payment_intent.payment_failed',
  intentId: string,
  eventId = `evt_${Math.random().toString(36).slice(2)}`,
): { body: string; signature: string } {
  const body = JSON.stringify({
    id: eventId,
    object: 'event',
    type,
    data: { object: { id: intentId, object: 'payment_intent' } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return { body, signature };
}
