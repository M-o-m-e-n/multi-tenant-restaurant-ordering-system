import {
  createDiscountSchema,
  idParamSchema,
  updateDiscountSchema,
  validateDiscountSchema,
} from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './discounts.service';

/** /api/v1/discounts */
export function discountsRouter(): Router {
  const router = Router();
  router.post(
    '/validate',
    authenticate,
    validate({ body: validateDiscountSchema }),
    h(async (req, res) => {
      const { code, subtotal } = validateDiscountSchema.parse(req.body);
      res.json(await service.validate(code, subtotal));
    }),
  );
  return router;
}

/** /api/v1/staff/discounts — admin CRUD (DISC-01). */
export function staffDiscountsRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));

  router.get(
    '/',
    h(async (_req, res) => {
      const data = await service.list();
      res.json({ data, meta: { page: 1, limit: data.length, total: data.length } });
    }),
  );
  router.post(
    '/',
    validate({ body: createDiscountSchema }),
    h(async (req, res) => {
      res.status(201).json(await service.create(createDiscountSchema.parse(req.body), actor(req)));
    }),
  );
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateDiscountSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.update(id, updateDiscountSchema.parse(req.body), actor(req)));
    }),
  );
  router.delete(
    '/:id',
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      await service.remove(idParamSchema.parse(req.params).id, actor(req));
      res.status(204).end();
    }),
  );
  return router;
}
