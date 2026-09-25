import {
  attachGroupSchema,
  availabilitySchema,
  createCategorySchema,
  createItemSchema,
  groupItemParamsSchema,
  idParamSchema,
  itemGroupParamsSchema,
  modifierGroupSchema,
  modifierItemSchema,
  updateCategorySchema,
  updateItemSchema,
  updateModifierGroupSchema,
  updateModifierItemSchema,
} from '@ros/shared';
import { Router } from 'express';

import { actor, authenticate, requireRole } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import * as admin from './menu.admin.service';
import * as service from './menu.service';

/** /api/v1/menu — public, no auth (BROWSE-01). */
export function publicMenuRouter(): Router {
  const router = Router();

  router.get(
    '/',
    h(async (_req, res) => {
      res.json(await service.getPublicMenu());
    }),
  );

  router.get(
    '/items/:id',
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      res.json(await service.getItem(idParamSchema.parse(req.params).id));
    }),
  );

  return router;
}

/** /api/v1/staff/menu — admin writes; the 86 toggle is open to staff too. */
export function staffMenuRouter(): Router {
  const router = Router();
  router.use(authenticate);
  const adminOnly = requireRole('ADMIN');

  router.get(
    '/',
    adminOnly,
    h(async (_req, res) => {
      res.json(await admin.adminMenu());
    }),
  );

  // Categories
  router.post(
    '/categories',
    adminOnly,
    validate({ body: createCategorySchema }),
    h(async (req, res) => {
      res
        .status(201)
        .json(await admin.createCategory(createCategorySchema.parse(req.body), actor(req)));
    }),
  );
  router.patch(
    '/categories/:id',
    adminOnly,
    validate({ params: idParamSchema, body: updateCategorySchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await admin.updateCategory(id, updateCategorySchema.parse(req.body), actor(req)));
    }),
  );
  router.delete(
    '/categories/:id',
    adminOnly,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      await admin.deleteCategory(idParamSchema.parse(req.params).id, actor(req));
      res.status(204).end();
    }),
  );

  // Items
  router.post(
    '/items',
    adminOnly,
    validate({ body: createItemSchema }),
    h(async (req, res) => {
      res.status(201).json(await admin.createItem(createItemSchema.parse(req.body), actor(req)));
    }),
  );
  router.patch(
    '/items/:id',
    adminOnly,
    validate({ params: idParamSchema, body: updateItemSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await admin.updateItem(id, updateItemSchema.parse(req.body), actor(req)));
    }),
  );
  router.delete(
    '/items/:id',
    adminOnly,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      await admin.deleteItem(idParamSchema.parse(req.params).id, actor(req));
      res.status(204).end();
    }),
  );
  router.patch(
    '/items/:id/availability',
    requireRole('STAFF', 'ADMIN'),
    validate({ params: idParamSchema, body: availabilitySchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      const { isAvailable } = availabilitySchema.parse(req.body);
      res.json(await admin.setAvailability(id, isAvailable, actor(req)));
    }),
  );
  router.post(
    '/items/:id/modifier-groups',
    adminOnly,
    validate({ params: idParamSchema, body: attachGroupSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res
        .status(201)
        .json(await admin.attachGroup(id, attachGroupSchema.parse(req.body), actor(req)));
    }),
  );
  router.delete(
    '/items/:id/modifier-groups/:groupId',
    adminOnly,
    validate({ params: itemGroupParamsSchema }),
    h(async (req, res) => {
      const { id, groupId } = itemGroupParamsSchema.parse(req.params);
      await admin.detachGroup(id, groupId, actor(req));
      res.status(204).end();
    }),
  );

  // Modifier groups and their options
  router.post(
    '/modifier-groups',
    adminOnly,
    validate({ body: modifierGroupSchema }),
    h(async (req, res) => {
      res
        .status(201)
        .json(await admin.createGroup(modifierGroupSchema.parse(req.body), actor(req)));
    }),
  );
  router.patch(
    '/modifier-groups/:id',
    adminOnly,
    validate({ params: idParamSchema, body: updateModifierGroupSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res.json(await admin.updateGroup(id, updateModifierGroupSchema.parse(req.body), actor(req)));
    }),
  );
  router.delete(
    '/modifier-groups/:id',
    adminOnly,
    validate({ params: idParamSchema }),
    h(async (req, res) => {
      await admin.deleteGroup(idParamSchema.parse(req.params).id, actor(req));
      res.status(204).end();
    }),
  );
  router.post(
    '/modifier-groups/:id/items',
    adminOnly,
    validate({ params: idParamSchema, body: modifierItemSchema }),
    h(async (req, res) => {
      const { id } = idParamSchema.parse(req.params);
      res
        .status(201)
        .json(await admin.createOption(id, modifierItemSchema.parse(req.body), actor(req)));
    }),
  );
  router.patch(
    '/modifier-groups/:id/items/:itemId',
    adminOnly,
    validate({ params: groupItemParamsSchema, body: updateModifierItemSchema }),
    h(async (req, res) => {
      const { id, itemId } = groupItemParamsSchema.parse(req.params);
      res.json(
        await admin.updateOption(id, itemId, updateModifierItemSchema.parse(req.body), actor(req)),
      );
    }),
  );
  router.delete(
    '/modifier-groups/:id/items/:itemId',
    adminOnly,
    validate({ params: groupItemParamsSchema }),
    h(async (req, res) => {
      const { id, itemId } = groupItemParamsSchema.parse(req.params);
      await admin.deleteOption(id, itemId, actor(req));
      res.status(204).end();
    }),
  );

  return router;
}
