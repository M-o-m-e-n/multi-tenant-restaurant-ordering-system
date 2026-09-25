import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { createUser, issueRefreshToken } from '../src/modules/auth/auth.repo';
import { hashRefreshToken } from '../src/modules/auth/auth.tokens';
import { resetDb } from './helpers/db';

describe('refresh token storage', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('stores only the hash; the raw token appears nowhere in the table', async () => {
    const user = await createUser({ name: 'A', email: 'a@x.test', passwordHash: 'x' });
    const { raw, row } = await issueRefreshToken({ userId: user.id, userAgent: 'vitest' });

    expect(row.tokenHash).toBe(hashRefreshToken(raw));
    const rows = await prisma().refreshToken.findMany();
    expect(JSON.stringify(rows)).not.toContain(raw);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(29 * 86_400_000);
  });

  it('deletes a user’s sessions with the user (CASCADE)', async () => {
    const user = await createUser({ name: 'B', email: 'b@x.test', passwordHash: 'x' });
    await issueRefreshToken({ userId: user.id });
    await prisma().user.delete({ where: { id: user.id } });
    expect(await prisma().refreshToken.count()).toBe(0);
  });
});
