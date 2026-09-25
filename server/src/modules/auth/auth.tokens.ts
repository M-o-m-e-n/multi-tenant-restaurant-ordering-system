import { createHash, randomBytes } from 'node:crypto';

import { type Role, ROLES } from '@ros/shared';
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import { getEnv } from '../../config/env';
import { AuthError } from '../../lib/errors';

const ISSUER = 'ros';
const AUDIENCE = 'ros-api';

export interface AccessClaims {
  userId: string;
  role: Role;
  name: string;
  /** Refresh-token family id: the session this token belongs to. */
  sessionId: string;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_ACCESS_SECRET);
}

/**
 * Sign a short-lived HS256 access token (AUTH-02, NFR-S3). The role inside is
 * a hint for the client; the server always re-reads it (AC-18).
 * @param ttlSec lifetime override, used by tests to mint expired tokens
 */
export async function signAccessToken(
  claims: AccessClaims,
  ttlSec: number = getEnv().ACCESS_TOKEN_TTL_SEC,
): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ role: claims.role, name: claims.name, sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(secret());
  return { token, expiresIn: ttlSec };
}

/**
 * Verify signature, issuer, audience and expiry.
 * @throws AuthError UNAUTHENTICATED for anything tampered, expired or malformed
 */
export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    const role = payload.role;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.name !== 'string' ||
      !ROLES.includes(role as Role)
    ) {
      throw new AuthError('UNAUTHENTICATED', 'Sign in to continue.');
    }
    return {
      userId: payload.sub,
      role: role as Role,
      name: payload.name,
      sessionId: payload.sid,
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof joseErrors.JOSEError) {
      throw new AuthError('UNAUTHENTICATED', 'Your session token is invalid or expired.');
    }
    throw err;
  }
}

/** A new opaque refresh token: 256 random bits, base64url (AUTH-12, NFR-S3). */
export function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 hex of a refresh token — the only form ever stored (LLD §2.2). SHA-256
 * rather than bcrypt is right here: the token has 256 bits of entropy.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
