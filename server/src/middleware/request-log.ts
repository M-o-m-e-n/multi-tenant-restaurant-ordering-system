import type { RequestHandler } from 'express';

import { logger } from '../lib/logger';

/**
 * One structured line per request once the response is sent (HLD §12.2): the
 * request id that the error body also carries, the route without its query
 * string (tokens never reach the log), status, duration and the user id.
 */
export const requestLog: RequestHandler = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/health') return;
    const entry = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - started) / 1_000_000n),
      userId: req.user?.id,
    };
    if (res.statusCode >= 500) logger().error(entry, 'request failed');
    else if (res.statusCode >= 400) logger().warn(entry, 'request refused');
    else logger().info(entry, 'request');
  });
  next();
};
