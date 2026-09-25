import { createStaffUserSchema, idParamSchema, updateUserSchema } from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './users.service';

/** /api/v1/staff/users — admin only (ADM-02, AUTH-08). */
export function usersRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));

  router.get(
    '/',
    h(async (_req, res) => {
      res.json({ data: await service.listUsers() });
    }),
  );

  router.post(
    '/',
    validate({ body: createStaffUserSchema }),
    h(async (req, res) => {
      res.status(201).json(await service.createUser(createStaffUserSchema.parse(req.body)));
    }),
  );

  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateUserSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.updateUser(id, updateUserSchema.parse(req.body), actor(req)));
    }),
  );

  return router;
}
