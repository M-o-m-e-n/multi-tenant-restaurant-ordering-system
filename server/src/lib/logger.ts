import { type Logger, pino } from 'pino';

import { getEnv } from '../config/env';

let instance: Logger | undefined;

/** Paths censored in every log record (HLD §12.2, LLD §9). */
export const LOG_REDACT = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    '*.password',
    '*.token',
    '*.accessToken',
    '*.refreshToken',
    '*.authorization',
  ],
  censor: '[redacted]',
};

/** Structured logger; secrets are redacted by path (LLD §9). */
export function logger(): Logger {
  if (!instance) {
    const env = getEnv();
    instance = pino({
      level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
      redact: LOG_REDACT,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    });
  }
  return instance;
}
