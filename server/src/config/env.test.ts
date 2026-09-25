import { describe, expect, it } from 'vitest';

import { EnvError, parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://ros:ros@localhost:5432/ros',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  CLIENT_ORIGINS: 'http://localhost:5173',
};

describe('parseEnv', () => {
  it('accepts a complete environment and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(4000);
    expect(env.BCRYPT_ROUNDS).toBe(12);
    expect(env.CLIENT_ORIGINS).toEqual(['http://localhost:5173']);
  });

  it('names a missing DATABASE_URL instead of failing later', () => {
    const { DATABASE_URL: _omit, ...rest } = valid;
    expect(() => parseEnv(rest)).toThrow(EnvError);
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL is required/);
  });

  it('treats an empty variable as missing', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: '' })).toThrow(/DATABASE_URL is required/);
  });

  it('refuses a live Stripe key (test mode only, M9-S1)', () => {
    expect(() => parseEnv({ ...valid, STRIPE_SECRET_KEY: 'sk_live_abc' })).toThrow(/TEST key/);
    expect(parseEnv({ ...valid, STRIPE_SECRET_KEY: 'sk_test_abc' }).STRIPE_SECRET_KEY).toBe(
      'sk_test_abc',
    );
  });

  it('rejects a short JWT secret', () => {
    expect(() => parseEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a wildcard CORS origin', () => {
    expect(() => parseEnv({ ...valid, CLIENT_ORIGINS: '*' })).toThrow(/wildcard/);
  });

  it('refuses a bcrypt cost below 12 outside tests', () => {
    expect(() => parseEnv({ ...valid, BCRYPT_ROUNDS: '4' })).toThrow(/BCRYPT_ROUNDS/);
    expect(parseEnv({ ...valid, NODE_ENV: 'test', BCRYPT_ROUNDS: '4' }).BCRYPT_ROUNDS).toBe(4);
  });
});
