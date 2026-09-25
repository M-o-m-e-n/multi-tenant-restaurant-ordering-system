// Public surface of the orders module (CODING-STANDARDS §5).
export { ordersRouter } from './orders.routes';
export {
  announcePayment,
  getOrder,
  loadOrder,
  type PaymentSnapshot,
  syncPaymentStatus,
} from './orders.service';
