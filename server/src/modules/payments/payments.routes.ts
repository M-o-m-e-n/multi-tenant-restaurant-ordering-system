import {
  cashPaymentSchema,
  createIntentSchema,
  orderIdParamSchema,
  refundSchema,
} from '@ros/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';

import { ValidationError } from '../../lib/errors';
import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './payments.service';

const idempotencyKey = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * POST /api/v1/payments/webhook. Mounted by the app *before* the JSON parser
 * with express.raw, because the signature is computed over the unparsed bytes
 * (M9-S4, LLD §9). Public, signed, and exempt from rate limiting.
 */
export const webhookHandler: RequestHandler = h(async (req, res) => {
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  await service.handleWebhook(body, req.get('stripe-signature'));
  res.json({ received: true });
});

/** /api/v1/payments */
export function paymentsRouter(): Router {
  const router = Router();

  router.get(
    '/config',
    h(async (_req, res) => {
      await Promise.resolve();
      res.json(service.config());
    }),
  );

  router.use(authenticate);

  router.post(
    '/intent',
    validate({ body: createIntentSchema }),
    h(async (req, res) => {
      const header = req.get('idempotency-key');
      const key = header === undefined ? undefined : idempotencyKey.safeParse(header);
      if (key && !key.success) {
        throw new ValidationError(
          'VALIDATION_ERROR',
          'Idempotency-Key must be 8–100 letters, digits, - or _.',
        );
      }
      const result = await service.createIntent(
        createIntentSchema.parse(req.body),
        actor(req),
        key?.data,
      );
      if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
      res.status(result.status).json(result.body);
    }),
  );

  router.post(
    '/cash',
    requireRole('STAFF', 'ADMIN'),
    validate({ body: cashPaymentSchema }),
    h(async (req, res) => {
      res.json(await service.markCash(cashPaymentSchema.parse(req.body), actor(req)));
    }),
  );

  router.post(
    '/refund',
    requireRole('ADMIN'),
    validate({ body: refundSchema }),
    h(async (req, res) => {
      res.json(await service.refund(refundSchema.parse(req.body), actor(req)));
    }),
  );

  router.get(
    '/order/:orderId',
    validate({ params: orderIdParamSchema }),
    h(async (req, res) => {
      res.json(
        await service.listForOrder(orderIdParamSchema.parse(req.params).orderId, actor(req)),
      );
    }),
  );

  return router;
}
