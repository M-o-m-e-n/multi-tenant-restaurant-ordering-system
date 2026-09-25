import { type Logger, pino } from 'pino';

import { getEnv } from '../config/env';

let instance: Logger | undefined;

/** Structured logger; secrets are redacted by path (LLD §9). */
export function logger(): Logger {
  if (!instance) {
    const env = getEnv();
    instance = pino({
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.token',
          '*.accessToken',
        ],
        censor: '[redacted]',
      },
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    });
  }
  return instance;
}
