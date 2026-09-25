import {
  createTableSchema,
  idParamSchema,
  openSessionSchema,
  qrFormatParamSchema,
  qrTokenParamSchema,
  updateTableSchema,
} from '@ros/shared';
import { type RequestHandler, Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './tables.service';

/** /api/v1/tables */
export function tablesRouter(opts: { qrLimiter: RequestHandler }): Router {
  const router = Router();
  const staff = [authenticate, requireRole('STAFF', 'ADMIN')];
  const admin = [authenticate, requireRole('ADMIN')];

  // Public, rate-limited, and read-only: a GET must never seat a table.
  router.get(
    '/qr/:token',
    opts.qrLimiter,
    validate({ params: qrTokenParamSchema }),
    h(async (req, res) => {
      res.json(await service.resolveQrSummary(qrTokenParamSchema.parse(req.params).token));
    }),
  );

  // Public, rate-limited: the state change behind a QR scan.
  router.post(
    '/sessions',
    opts.qrLimiter,
    validate({ body: openSessionSchema }),
    h(async (req, res) => {
      res.status(201).json(await service.openSession(openSessionSchema.parse(req.body).token));
    }),
  );

  router.get(
    '/',
    ...staff,
    h(async (req, res) => {
      res.json({ data: await service.listTables(actor(req)) });
    }),
  );

  router.post(
    '/',
    ...admin,
    validate({ body: createTableSchema }),
    h(async (req, res) => {
      res
        .status(201)
        .json(await service.createTable(createTableSchema.parse(req.body), actor(req)));
    }),
  );

  router.patch(
    '/:id',
    ...staff,
    validate({ params: idParamSchema, body: updateTableSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await service.updateTable(id, updateTableSchema.parse(req.body), actor(req)));
    }),
  );

  router.post(
    '/:id/regenerate-qr',
    ...admin,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.regenerateQr(idParamSchema.parse(req.params).id, actor(req)));
    }),
  );

  router.get(
    '/:id/qr.:format',
    ...admin,
    validate({ params: qrFormatParamSchema }),
    h(async (req, res) => {
      const { id, format } = qrFormatParamSchema.parse(req.params);
      const img = await service.qrImage(id, format);
      res
        .type(img.contentType)
        .setHeader('Content-Disposition', `inline; filename="table-${img.number}.${format}"`);
      res.send(img.body);
    }),
  );

  router.post(
    '/:id/close',
    ...staff,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.closeTable(idParamSchema.parse(req.params).id, actor(req)));
    }),
  );

  router.post(
    '/:id/clean',
    ...staff,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.cleanTable(idParamSchema.parse(req.params).id, actor(req)));
    }),
  );

  return router;
}
