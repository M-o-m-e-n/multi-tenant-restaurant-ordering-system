import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './auth.password';

describe('password hashing', () => {
  it('produces a bcrypt hash that verifies and never equals the password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('fails without a stored hash', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
  });
});
