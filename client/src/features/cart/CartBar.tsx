import { Link } from 'react-router-dom';

import { useT } from '../../i18n';
import { formatMoney } from '../../shared/money';
import { useOrderType, useSettings } from './cartApi';
import { cartTotals } from './cartPricing';
import { cartCount, useCart } from './cartStore';

/** The sticky red cart bar from the prototype: total and count, then "View cart". */
export function CartBar() {
  const lines = useCart((s) => s.lines);
  const t = useT();
  const tip = useCart((s) => s.tip);
  const orderType = useOrderType();
  const { data: settings } = useSettings();
  if (lines.length === 0 || !settings) return null;

  const totals = cartTotals(lines, { orderType, settings, discount: null, tip });
  const count = cartCount(lines);

  return (
    <div className="fixed inset-x-0 bottom-4 z-10 px-4">
      <div className="mx-auto flex max-w-content items-center justify-between gap-4 rounded-2xl bg-flame px-5 py-3.5 text-white shadow-glow motion-safe:animate-rise">
        <div>
          <p className="tabular text-lg font-bold">{formatMoney(totals.subtotal)}</p>
          <p className="text-xs opacity-90">{t.cartBar.beforeTax(t.common.items(count))}</p>
        </div>
        <Link
          to="/cart"
          className="inline-flex min-h-11 items-center rounded-icon bg-paper px-5 text-sm font-bold text-flame-dark"
        >
          {t.cartBar.view}
        </Link>
      </div>
    </div>
  );
}
