import { describe, expect, it } from 'vitest';

import {
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from './auth.tokens';

const claims = {
  userId: '7b6f1f0e-3d8e-4bd2-9a57-6d4a2f0d9c11',
  role: 'STAFF' as const,
  name: 'Sam',
  sessionId: '0f2c9a4e-1b7d-4f7a-8f6c-2a9d3b5e7c10',
};

describe('access tokens', () => {
  it('round-trips the claims with a 15-minute default lifetime', async () => {
    const { token, expiresIn } = await signAccessToken(claims);
    expect(expiresIn).toBe(900);
    expect(await verifyAccessToken(token)).toEqual(claims);
  });

  it('rejects a tampered token', async () => {
    const { token } = await signAccessToken(claims);
    const [h, p, s] = token.split('.') as [string, string, string];
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as Record<string, unknown>;
    const forged = Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url');
    await expect(verifyAccessToken(`${h}.${forged}.${s}`)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects an expired token', async () => {
    const { token } = await signAccessToken(claims, -10);
    await expect(verifyAccessToken(token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects garbage', async () => {
    await expect(verifyAccessToken('not.a.jwt')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('refresh tokens', () => {
  it('are 256-bit base64url values stored only as a sha-256 hex hash', () => {
    const raw = newRefreshToken();
    expect(Buffer.from(raw, 'base64url')).toHaveLength(32);
    const hash = hashRefreshToken(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(raw);
    expect(newRefreshToken()).not.toBe(raw);
  });
});
