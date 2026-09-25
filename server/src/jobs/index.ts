import { logger } from '../lib/logger';
import { purgeIdempotencyKeysJob } from './purge-idempotency-keys';
import { purgeRefreshTokensJob } from './purge-refresh-tokens';
import { reconcilePaymentsJob } from './reconcile-payments';
import { reservationAlertsJob } from './reservation-alerts';

export interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
}

/** Interval jobs (LLD §4.10). Later milestones register theirs here. */
export const JOBS: Job[] = [
  purgeRefreshTokensJob,
  purgeIdempotencyKeysJob,
  reconcilePaymentsJob,
  reservationAlertsJob,
];

/**
 * Start every job on its interval. A failing run is logged and retried on the
 * next tick; timers are unref'd so they never hold the process open.
 * @returns a function that stops them all
 */
export function startJobs(jobs: Job[] = JOBS): () => void {
  const timers = jobs.map((job) => {
    let running = false;
    const tick = async (): Promise<void> => {
      if (running) return;
      running = true;
      try {
        const result = await job.run();
        logger().debug({ job: job.name, result }, 'job ran');
      } catch (err) {
        logger().error({ err, job: job.name }, 'job failed');
      } finally {
        running = false;
      }
    };
    const timer = setInterval(() => void tick(), job.intervalMs);
    timer.unref();
    return timer;
  });
  return () => timers.forEach(clearInterval);
}
