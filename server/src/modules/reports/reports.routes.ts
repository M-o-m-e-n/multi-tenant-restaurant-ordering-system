import { reportRangeSchema, topItemsQuerySchema } from '@ros/shared';
import { Router } from 'express';

import { authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as service from './reports.service';

/** /api/v1/reports — admin only, read-only (RPT-01…06). */
export function reportsRouter(): Router {
  const router = Router();
  router.use(authenticate, requireRole('ADMIN'));
  const range = validate({ query: reportRangeSchema });
  const q = (req: { query: unknown }) => reportRangeSchema.parse(req.query);

  router.get(
    '/summary',
    range,
    h(async (req, res) => {
      const { from, to } = q(req);
      res.json(await service.salesSummary(from, to));
    }),
  );
  router.get(
    '/revenue-by-day',
    range,
    h(async (req, res) => {
      const { from, to } = q(req);
      res.json({ data: await service.revenueByDay(from, to) });
    }),
  );
  router.get(
    '/top-items',
    validate({ query: topItemsQuerySchema }),
    h(async (req, res) => {
      const { from, to, limit, metric } = topItemsQuerySchema.parse(req.query);
      res.json({ data: await service.topItems(from, to, limit, metric) });
    }),
  );
  router.get(
    '/peak-hours',
    range,
    h(async (req, res) => {
      const { from, to } = q(req);
      res.json({ data: await service.peakHours(from, to) });
    }),
  );
  router.get(
    '/breakdowns',
    range,
    h(async (req, res) => {
      const { from, to } = q(req);
      res.json(await service.breakdowns(from, to));
    }),
  );
  router.get(
    '/cancellations',
    range,
    h(async (req, res) => {
      const { from, to } = q(req);
      res.json(await service.cancellations(from, to));
    }),
  );
  return router;
}

/** /api/v1/dashboard — today's numbers for the admin home (ADM-01). */
export function dashboardRouter(): Router {
  const router = Router();
  router.get(
    '/today',
    authenticate,
    requireRole('ADMIN'),
    h(async (_req, res) => {
      res.json(await service.dashboardToday());
    }),
  );
  return router;
}
