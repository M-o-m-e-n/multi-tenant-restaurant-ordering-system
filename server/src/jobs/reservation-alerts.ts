import { flagOverdueReservations } from '../modules/reservations';
import type { Job } from './index';

/** Every minute: flag bookings 15 minutes past their slot to the POS (TABLE-07, LLD §4.10). */
export const reservationAlertsJob: Job = {
  name: 'reservationAlerts',
  intervalMs: 60 * 1000,
  run: () => flagOverdueReservations(),
};
