import { reconcilePayments } from '../modules/payments';
import type { Job } from './index';

/** Every 5 minutes: settle card payments whose webhook never arrived (NFR-R4, LLD §4.10). */
export const reconcilePaymentsJob: Job = {
  name: 'reconcilePayments',
  intervalMs: 5 * 60 * 1000,
  run: () => reconcilePayments(),
};
