import {
  createReservationSchema,
  idParamSchema,
  listReservationsQuerySchema,
  updateReservationSchema,
} from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './reservations.service';

/** /api/v1/reservations (LLD §5.5) */
export function reservationsRouter(): Router {
  const router = Router();
  router.use(authenticate);
  const staff = requireRole('STAFF', 'ADMIN');

  router.post(
    '/',
    validate({ body: createReservationSchema }),
    h(async (req, res) => {
      const dto = createReservationSchema.parse(req.body);
      res.status(201).json(await service.createReservation(dto, actor(req)));
    }),
  );

  router.get(
    '/',
    staff,
    validate({ query: listReservationsQuerySchema }),
    h(async (req, res) => {
      const { date } = listReservationsQuerySchema.parse(req.query);
      res.json({ data: await service.listReservations(date) });
    }),
  );

  router.patch(
    '/:id',
    staff,
    validate({ params: idParamSchema, body: updateReservationSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const body = updateReservationSchema.parse(req.body);
      res.json(
        body.action === 'seat'
          ? await service.seatReservation(id, body.tableId, actor(req))
          : await service.cancelReservation(id, actor(req)),
      );
    }),
  );

  return router;
}
