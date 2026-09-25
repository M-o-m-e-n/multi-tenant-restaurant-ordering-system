import {
  appendItemsSchema,
  cancelOrderSchema,
  createOrderSchema,
  idParamSchema,
  listOrdersQuerySchema,
  previewOrderSchema,
  transitionSchema,
} from '@ros/shared';
import { type RequestHandler, Router } from 'express';
import { z } from 'zod';

import { ValidationError } from '../../lib/errors';
import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './orders.service';

const idempotencyKey = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

/** /api/v1/orders */
export function ordersRouter(opts: { placeLimiter: RequestHandler }): Router {
  const router = Router();

  // Public: priced from the database, nothing persisted (CART-06).
  router.post(
    '/preview',
    validate({ body: previewOrderSchema }),
    h(async (req, res) => {
      res.json(await service.previewCart(previewOrderSchema.parse(req.body)));
    }),
  );

  router.use(authenticate);

  router.post(
    '/',
    opts.placeLimiter,
    validate({ body: createOrderSchema }),
    h(async (req, res) => {
      const header = req.get('idempotency-key');
      const key = header === undefined ? undefined : idempotencyKey.safeParse(header);
      if (key && !key.success) {
        throw new ValidationError(
          'VALIDATION_ERROR',
          'Idempotency-Key must be 8–100 letters, digits, - or _.',
        );
      }
      const result = await service.createOrder(createOrderSchema.parse(req.body), actor(req), {
        idempotencyKey: key?.data,
      });
      if (result.replayed) res.setHeader('Idempotent-Replayed', 'true');
      res.status(result.status).json(result.body);
    }),
  );

  router.get(
    '/',
    validate({ query: listOrdersQuerySchema }),
    h(async (req, res) => {
      res.json(await service.listOrders(listOrdersQuerySchema.parse(req.query), actor(req)));
    }),
  );

  router.get(
    '/:id',
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.getOrder(idParamSchema.parse(req.params).id, actor(req)));
    }),
  );

  router.get(
    '/:id/events',
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json({ data: await service.listEvents(idParamSchema.parse(req.params).id, actor(req)) });
    }),
  );

  router.get(
    '/:id/receipt',
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.getReceipt(idParamSchema.parse(req.params).id, actor(req)));
    }),
  );

  // Owner or staff; ownership is re-checked in the service (ORD-12).
  router.post(
    '/:id/items',
    validate({ params: idParamSchema, body: appendItemsSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.appendItems(id, appendItemsSchema.parse(req.body), actor(req)));
    }),
  );

  router.patch(
    '/:id/status',
    requireRole('STAFF', 'ADMIN'),
    validate({ params: idParamSchema, body: transitionSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const { to, reason } = transitionSchema.parse(req.body);
      res.json(await service.transitionStatus(id, to, actor(req), reason));
    }),
  );

  router.post(
    '/:id/cancel',
    validate({ params: idParamSchema, body: cancelOrderSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.cancelOrder(id, actor(req), cancelOrderSchema.parse(req.body).reason));
    }),
  );

  return router;
}
