import { previewOrderSchema } from '@ros/shared';
import { Router } from 'express';

import { h, validate } from '../../middleware/validate';
import * as service from './orders.service';

/** /api/v1/orders */
export function ordersRouter(): Router {
  const router = Router();

  // Public: priced from the database, nothing persisted (CART-06).
  router.post(
    '/preview',
    validate({ body: previewOrderSchema }),
    h(async (req, res) => {
      res.json(await service.previewCart(previewOrderSchema.parse(req.body)));
    }),
  );

  return router;
}
