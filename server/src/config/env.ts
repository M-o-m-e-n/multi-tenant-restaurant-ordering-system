import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.string().url(),

    // NFR-S3: HS256 secret of at least 256 bits, from the environment only.
    JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters (256 bits)'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().max(900).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    COOKIE_SECURE: bool.optional(),

    // AUTH-07: bcrypt cost >= 12. Tests may lower it for speed only.
    BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),

    // NFR-S8: explicit allow-list, never a wildcard.
    // Stripe runs in test mode only (SRS §2.5). All three are optional: without them card
    // payment is switched off and staff take cash (NFR-R6).
    STRIPE_SECRET_KEY: z
      .string()
      .refine(
        (k) => k.startsWith('sk_test_') || k.startsWith('rk_test_'),
        'must be a TEST key (sk_test_…); live keys are refused',
      )
      .optional(),
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .refine((k) => k.startsWith('pk_test_'), 'must be a TEST key (pk_test_…)')
      .optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

    // Where the SPA is served; QR codes encode ${PUBLIC_APP_URL}/t/<token>.
    PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),

    CLIENT_ORIGINS: z
      .string()
      .min(1)
      .transform((s) =>
        s
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      )
      .refine((list) => list.every((o) => o !== '*'), 'a wildcard origin is not allowed'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'test' && env.BCRYPT_ROUNDS < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BCRYPT_ROUNDS'],
        message: 'must be at least 12 outside tests (AUTH-07)',
      });
    }
  });

export type Env = Omit<z.infer<typeof envSchema>, 'COOKIE_SECURE'> & { COOKIE_SECURE: boolean };

/** Thrown when the environment is incomplete; carries one line per problem. */
export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/**
 * Parse and validate the process environment. Fails fast with a named list of
 * problems rather than letting a half-configured server boot (HLD §11.4).
 * @throws EnvError when any variable is missing or malformed
 */
export function parseEnv(source: NodeJS.ProcessEnv): Env {
  // An empty variable is as unset as a missing one; report it as required.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => {
      const name = i.path.join('.') || '(root)';
      const missing = i.code === 'invalid_type' && i.received === 'undefined';
      return missing ? `${name} is required` : `${name} ${i.message}`;
    });
    throw new EnvError(problems);
  }
  const parsed = result.data;
  return {
    ...parsed,
    COOKIE_SECURE: parsed.COOKIE_SECURE ?? parsed.NODE_ENV === 'production',
  };
}

let cached: Env | undefined;

/** The validated environment for this process, parsed once. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
