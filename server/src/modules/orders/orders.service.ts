import type { PreviewOrderDto, PreviewResponse } from '@ros/shared';

import { getSettings } from '../settings';
import { priceCart } from './orders.pricing';

/**
 * Authoritative totals without persisting anything (CART-06). Public, so a
 * guest sees real totals before signing in; the client computes the same
 * figures locally and the two must agree to the cent (AC-4).
 */
export async function previewCart(dto: PreviewOrderDto): Promise<PreviewResponse> {
  const settings = await getSettings();
  const priced = await priceCart(dto, settings);
  return {
    totals: { ...priced.totals, currency: settings.currency },
    lines: priced.lines.map((l) => ({ menuItemId: l.menuItemId, lineTotal: l.lineTotal })),
  };
}
