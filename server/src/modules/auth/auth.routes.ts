import { loginSchema, registerSchema } from '@ros/shared';
import { type RequestHandler, Router } from 'express';

import { actor, authenticate } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import { clientMeta, setRefreshCookie } from './auth.cookies';
import * as service from './auth.service';

export interface AuthRouterOptions {
  /** Applied to register and login (AUTH-09). */
  credentialLimiter: RequestHandler;
}

/** /api/v1/auth — HTTP only: path, schema, one service call (CODING-STANDARDS §4). */
export function authRouter(opts: AuthRouterOptions): Router {
  const router = Router();

  router.post(
    '/register',
    opts.credentialLimiter,
    validate({ body: registerSchema }),
    h(async (req, res) => {
      const { refreshToken, ...body } = await service.register(
        registerSchema.parse(req.body),
        clientMeta(req),
      );
      setRefreshCookie(res, refreshToken);
      res.status(201).json(body);
    }),
  );

  router.post(
    '/login',
    opts.credentialLimiter,
    validate({ body: loginSchema }),
    h(async (req, res) => {
      const { refreshToken, ...body } = await service.login(
        loginSchema.parse(req.body),
        clientMeta(req),
      );
      setRefreshCookie(res, refreshToken);
      res.json(body);
    }),
  );

  router.get(
    '/me',
    authenticate,
    h(async (req, res) => {
      res.json(await service.me(actor(req).id));
    }),
  );

  return router;
}
