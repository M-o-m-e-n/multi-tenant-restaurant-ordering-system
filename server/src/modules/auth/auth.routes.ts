import { loginSchema, registerSchema } from '@ros/shared';
import { type RequestHandler, Router } from 'express';

import { AuthError, ForbiddenError } from '../../lib/errors';
import { actor, authenticate } from '../../middleware/authenticate';
import { h, validate } from '../../middleware/validate';
import {
  clearRefreshCookie,
  clientMeta,
  readRefreshCookie,
  setRefreshCookie,
} from './auth.cookies';
import * as service from './auth.service';

export interface AuthRouterOptions {
  /** Applied to register and login (AUTH-09). */
  credentialLimiter: RequestHandler;
  /** Applied to refresh (LLD §9: 60 per 15 min per IP). */
  refreshLimiter: RequestHandler;
}

/**
 * CSRF barrier for the cookie-authenticated endpoint: a cross-origin form
 * cannot set a custom header without a preflight the allow-list refuses
 * (LLD §9). SameSite=Strict is the primary control; this is the second.
 */
const requireRefreshHeader: RequestHandler = (req, _res, next) => {
  if (req.get('x-refresh-request') !== '1') {
    next(new ForbiddenError('FORBIDDEN', 'Refresh requests must send X-Refresh-Request: 1.'));
    return;
  }
  next();
};

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

  router.post(
    '/refresh',
    opts.refreshLimiter,
    requireRefreshHeader,
    h(async (req, res) => {
      try {
        const { refreshToken, ...body } = await service.refresh(
          readRefreshCookie(req),
          clientMeta(req),
        );
        setRefreshCookie(res, refreshToken);
        res.json(body);
      } catch (err) {
        // A dead session must not leave its cookie behind.
        if (err instanceof AuthError) clearRefreshCookie(res);
        throw err;
      }
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
