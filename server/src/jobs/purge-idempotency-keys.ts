import { purgeIdempotencyKeys } from '../lib/idempotency';
import type { Job } from './index';

/** Hourly: stored Idempotency-Key responses are kept 24 h (API-CONTRACT §7, LLD §4.10). */
export const purgeIdempotencyKeysJob: Job = {
  name: 'purgeIdempotencyKeys',
  intervalMs: 60 * 60 * 1000,
  run: purgeIdempotencyKeys,
};
