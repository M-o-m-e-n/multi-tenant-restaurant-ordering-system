// Public surface of the discounts module (CODING-STANDARDS §5).
export { discountsRouter, staffDiscountsRouter } from './discounts.routes';
export { type AppliedDiscount, applyCode, redeem } from './discounts.service';
