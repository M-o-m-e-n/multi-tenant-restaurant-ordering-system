import type { PricingBreakdown, PricingDiscount } from '@ros/shared';
import { useEffect, useState } from 'react';

import { ApiError } from '../../shared/api/client';
import { useOrderType, useServerPreview, useSettings } from './cartApi';
import { cartTotals } from './cartPricing';
import { useCart } from './cartStore';

/**
 * Client totals and the server's confirmation of them, kept in step.
 *
 * Only the server knows what a promo code is worth, so its discount feeds the
 * client calculation; the tip is a share of the discounted food, so it follows.
 * One extra round trip after a code is applied and the two agree (AC-4).
 */
export function useCartPricing() {
  const cart = useCart();
  const orderType = useOrderType();
  const { data: settings } = useSettings();
  const [discount, setDiscount] = useState<PricingDiscount | null>(null);

  // An empty cart has no totals (computeTotals refuses it with EMPTY_CART).
  const local =
    settings && cart.lines.length > 0
      ? cartTotals(cart.lines, { orderType, settings, discount, tip: cart.tip })
      : null;
  const preview = useServerPreview({
    lines: cart.lines,
    orderType,
    discountCode: cart.discountCode,
    tipAmount: local?.tipAmount ?? 0,
  });

  const applied = preview.data?.discount;
  useEffect(() => {
    setDiscount(applied ? { type: applied.type, value: applied.value } : null);
  }, [applied]);

  const server = preview.data?.totals;
  const agrees = Boolean(server && local && sameTotals(server, local) && !preview.isFetching);
  const error = preview.error instanceof ApiError ? preview.error : null;

  return {
    cart,
    orderType,
    settings,
    local,
    preview,
    server,
    agrees,
    error,
    clearDiscount: () => setDiscount(null),
  };
}

export function sameTotals(a: PricingBreakdown, b: PricingBreakdown): boolean {
  return (
    a.subtotal === b.subtotal &&
    a.discountAmount === b.discountAmount &&
    a.serviceCharge === b.serviceCharge &&
    a.taxAmount === b.taxAmount &&
    a.deliveryFee === b.deliveryFee &&
    a.tipAmount === b.tipAmount &&
    a.total === b.total
  );
}
