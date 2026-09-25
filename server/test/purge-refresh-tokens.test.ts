import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { purgeRefreshTokensJob } from '../src/jobs/purge-refresh-tokens';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { createUser, issueRefreshToken } from '../src/modules/auth/auth.repo';
import { resetDb } from './helpers/db';

const DAY = 86_400_000;

describe('purgeRefreshTokens job', () => {
  beforeEach(resetDb);
  afterAll(disconnectPrisma);

  it('removes expired and long-revoked tokens and keeps live and recently revoked ones', async () => {
    const user = await createUser({ name: 'U', email: 'u@x.test', passwordHash: 'x' });
    const live = (await issueRefreshToken({ userId: user.id })).row;
    const recent = (await issueRefreshToken({ userId: user.id })).row;
    const old = (await issueRefreshToken({ userId: user.id })).row;
    const expired = (await issueRefreshToken({ userId: user.id })).row;

    const now = Date.now();
    await prisma().refreshToken.update({
      where: { id: recent.id },
      data: { revokedAt: new Date(now - 2 * DAY) },
    });
    await prisma().refreshToken.update({
      where: { id: old.id },
      data: { revokedAt: new Date(now - 45 * DAY) },
    });
    await prisma().refreshToken.update({
      where: { id: expired.id },
      data: { createdAt: new Date(now - 40 * DAY), expiresAt: new Date(now - DAY) },
    });

    expect(await purgeRefreshTokensJob.run()).toBe(2);
    const left = (await prisma().refreshToken.findMany()).map((t) => t.id).sort();
    expect(left).toEqual([live.id, recent.id].sort());
  });
});
