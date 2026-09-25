import { updateSettingsSchema } from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './settings.service';

/** GET /api/v1/settings — public: everything the client needs to price like the server. */
export function publicSettingsRouter(): Router {
  const router = Router();
  router.get(
    '/',
    h(async (_req, res) => {
      res.json(service.toPublicSettings(await service.getSettings()));
    }),
  );
  return router;
}

/** GET /api/v1/settings/kds — the ageing thresholds and grace period the KDS needs (KDS-03, KDS-07). */
export function kdsSettingsRouter(): Router {
  const router = Router();
  router.get(
    '/',
    authenticate,
    requireRole('STAFF', 'ADMIN'),
    h(async (_req, res) => {
      const s = await service.getSettings();
      res.json({
        kdsGreenSec: s.kdsGreenSec,
        kdsAmberSec: s.kdsAmberSec,
        kdsCompletedGraceSec: s.kdsCompletedGraceSec,
      });
    }),
  );
  return router;
}

/** /api/v1/staff/settings — the full set, admin only (ADM-03). */
export function staffSettingsRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));
  router.get(
    '/',
    h(async (_req, res) => {
      res.json(await service.getSettings());
    }),
  );
  router.put(
    '/',
    validate({ body: updateSettingsSchema }),
    h(async (req, res) => {
      res.json(await service.updateSettings(updateSettingsSchema.parse(req.body), actor(req).id));
    }),
  );
  return router;
}
