import bcrypt from 'bcrypt';

import { getEnv } from '../../config/env';

/** bcrypt at the configured cost, at least 12 outside tests (AUTH-07, NFR-S2). */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, getEnv().BCRYPT_ROUNDS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Compare a password with a stored hash. With no hash (unknown email) it still
 * burns one bcrypt comparison, so response time does not reveal whether an
 * account exists (AUTH-02: identical failure for wrong email and password).
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash) return bcrypt.compare(password, hash);
  dummyHash ??= bcrypt.hash('not-a-real-password', getEnv().BCRYPT_ROUNDS);
  await bcrypt.compare(password, await dummyHash);
  return false;
}
