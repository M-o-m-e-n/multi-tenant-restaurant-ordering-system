// Public surface of the reservations module (CODING-STANDARDS §5).
export { reservationsRouter } from './reservations.routes';
export { flagOverdueReservations, resetReservationFlags } from './reservations.service';
