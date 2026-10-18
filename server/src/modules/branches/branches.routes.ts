import { idParamSchema, updateBranchSchema } from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './branches.service';

/** GET /api/v1/branches — public: where the restaurant is, its hours and how to call. */
export function publicBranchesRouter(): Router {
  const router = Router();
  router.get(
    '/',
    h(async (_req, res) => {
      res.json({ data: await service.listBranches() });
    }),
  );
  return router;
}

/** /api/v1/staff/branches — the admin fixes details and places the map pin (ADR-032). */
export function staffBranchesRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));
  router.get(
    '/',
    h(async (_req, res) => {
      res.json({ data: await service.listBranches(true) });
    }),
  );
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateBranchSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.updateBranch(id, updateBranchSchema.parse(req.body), actor(req).id));
    }),
  );
  return router;
}
