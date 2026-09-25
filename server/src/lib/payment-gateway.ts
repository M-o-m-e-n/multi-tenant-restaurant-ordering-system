import Stripe from 'stripe';

import { getEnv } from '../config/env';
import { ServiceUnavailableError, ValidationError } from './errors';

/** The subset of a Stripe event the webhook handler reads. */
export interface GatewayEvent {
  id: string;
  type: string;
  intentId: string | null;
}

export interface IntentStatus {
  id: string;
  status: string;
  amount: number;
}

/**
 * Everything the payments module needs from a card processor. Stripe in
 * development and production; a fake in tests, so the suite never touches the
 * network (NFR-M3).
 */
export interface PaymentGateway {
  readonly cardEnabled: boolean;
  readonly publishableKey: string | null;
  createIntent(p: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<{ id: string; clientSecret: string }>;
  retrieveIntent(id: string): Promise<IntentStatus>;
  refund(p: {
    paymentIntentId: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ id: string }>;
  /** @throws ValidationError WEBHOOK_INVALID_SIGNATURE */
  constructEvent(rawBody: Buffer, signature: string | undefined): GatewayEvent;
}

const unavailable = () =>
  new ServiceUnavailableError(
    'PAYMENTS_UNAVAILABLE',
    'Card payment is not available right now. Pay by cash with our staff.',
  );

const badSignature = () =>
  new ValidationError('WEBHOOK_INVALID_SIGNATURE', 'The Stripe signature did not verify.');

function eventFrom(event: Stripe.Event): GatewayEvent {
  const object = event.data.object as { object?: string; id?: string };
  return {
    id: event.id,
    type: event.type,
    intentId: object.object === 'payment_intent' && object.id ? object.id : null,
  };
}

/** Stripe, test mode only — env parsing refuses live keys (M9-S1). */
export class StripeGateway implements PaymentGateway {
  private readonly stripe: Stripe | null;
  readonly cardEnabled: boolean;
  readonly publishableKey: string | null;
  private readonly webhookSecret: string | null;

  constructor(opts: { secretKey?: string; publishableKey?: string; webhookSecret?: string }) {
    this.stripe = opts.secretKey ? new Stripe(opts.secretKey, { maxNetworkRetries: 2 }) : null;
    this.publishableKey = opts.publishableKey ?? null;
    this.webhookSecret = opts.webhookSecret ?? null;
    this.cardEnabled = this.stripe !== null && this.publishableKey !== null;
  }

  private client(): Stripe {
    if (!this.stripe) throw unavailable();
    return this.stripe;
  }

  async createIntent(p: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }) {
    // The idempotency key is the SDK's second, options argument — not a field
    // inside the params object (M9-S3, LLD §4.5).
    const intent = await this.client().paymentIntents.create(
      {
        amount: p.amount,
        currency: p.currency,
        metadata: p.metadata,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: p.idempotencyKey },
    );
    if (!intent.client_secret) throw new Error('Stripe returned an intent without a client secret');
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  async retrieveIntent(id: string): Promise<IntentStatus> {
    const intent = await this.client().paymentIntents.retrieve(id);
    return { id: intent.id, status: intent.status, amount: intent.amount };
  }

  async refund(p: { paymentIntentId: string; amount: number; idempotencyKey: string }) {
    const refund = await this.client().refunds.create(
      { payment_intent: p.paymentIntentId, amount: p.amount },
      { idempotencyKey: p.idempotencyKey },
    );
    return { id: refund.id };
  }

  constructEvent(rawBody: Buffer, signature: string | undefined): GatewayEvent {
    if (!this.stripe || !this.webhookSecret || !signature) throw badSignature();
    try {
      return eventFrom(this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret));
    } catch {
      throw badSignature();
    }
  }
}

let gateway: PaymentGateway | undefined;

export function paymentGateway(): PaymentGateway {
  if (!gateway) {
    const env = getEnv();
    gateway = new StripeGateway({
      ...(env.STRIPE_SECRET_KEY ? { secretKey: env.STRIPE_SECRET_KEY } : {}),
      ...(env.STRIPE_PUBLISHABLE_KEY ? { publishableKey: env.STRIPE_PUBLISHABLE_KEY } : {}),
      ...(env.STRIPE_WEBHOOK_SECRET ? { webhookSecret: env.STRIPE_WEBHOOK_SECRET } : {}),
    });
  }
  return gateway;
}

/** Tests swap in a fake processor. */
export function setPaymentGateway(next: PaymentGateway | undefined): void {
  gateway = next;
}
