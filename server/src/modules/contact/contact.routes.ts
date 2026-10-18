import {
  createContactMessageSchema,
  idParamSchema,
  listContactMessagesQuerySchema,
  updateContactMessageSchema,
} from '@ros/shared';
import { type RequestHandler, Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './contact.service';

/** POST /api/v1/contact — public and rate-limited: the guest feedback form (ADR-032). */
export function contactRouter(deps: { sendLimiter: RequestHandler }): Router {
  const router = Router();
  router.post(
    '/',
    deps.sendLimiter,
    validate({ body: createContactMessageSchema }),
    h(async (req, res) => {
      res.status(201).json(await service.createMessage(createContactMessageSchema.parse(req.body)));
    }),
  );
  return router;
}

/** /api/v1/staff/messages — the admin inbox. */
export function staffMessagesRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));
  router.get(
    '/',
    validate({ query: listContactMessagesQuerySchema }),
    h(async (req, res) => {
      res.json(await service.listMessages(listContactMessagesQuerySchema.parse(req.query)));
    }),
  );
  router.patch(
    '/:id',
    validate({ params: idParamSchema, body: updateContactMessageSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const { read } = updateContactMessageSchema.parse(req.body);
      res.json(await service.markMessage(id, read, actor(req).id));
    }),
  );
  return router;
}
