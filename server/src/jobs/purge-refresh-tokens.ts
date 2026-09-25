import { purgeRefreshTokens } from '../modules/auth';
import type { Job } from './index';

/**
 * Daily: delete expired refresh tokens and ones revoked over 30 days ago
 * (AUTH-14). Recently revoked rows stay, so a replay is still recognised as
 * reuse rather than as an unknown token.
 */
export const purgeRefreshTokensJob: Job = {
  name: 'purgeRefreshTokens',
  intervalMs: 24 * 60 * 60 * 1000,
  run: () => purgeRefreshTokens(30),
};
