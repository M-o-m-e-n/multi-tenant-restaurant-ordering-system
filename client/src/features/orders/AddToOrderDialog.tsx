import type { MenuItemDto, OrderDto } from '@ros/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useT } from '../../i18n';
import { api } from '../../shared/api/client';
import { errorMessage } from '../../shared/api/errorMessage';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Modal } from '../../shared/ui/Modal';
import { toRequestLines } from '../cart/cartPricing';
import type { CartLine } from '../cart/cartStore';
import { ModifierDialog } from '../cart/ModifierDialog';
import { useMenu } from '../menu/menuApi';

type Pending = Omit<CartLine, 'key'> & { key: string };

/**
 * "Add to order" for a second round (ORD-12), on the tracker and at the till.
 * Reuses the modifier dialog, so the same min/max rules apply; the server
 * reprices with the rates the order was placed under.
 */
export function AddToOrderDialog({
  order,
  onClose,
}: {
  order: OrderDto | null;
  onClose: () => void;
}) {
  const { data: menu } = useMenu();
  const qc = useQueryClient();
  const [picking, setPicking] = useState<{ item: MenuItemDto; category: string } | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (menu?.categories ?? []).flatMap((c) =>
      c.items
        .filter((i) => !q || i.name.toLowerCase().includes(q))
        .map((i) => ({ item: i, category: c.name })),
    );
  }, [menu, query]);

  function close() {
    setPending([]);
    setError(null);
    setQuery('');
    onClose();
  }

  async function submit() {
    if (!order || pending.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<OrderDto>(`/orders/${order.id}/items`, {
        method: 'POST',
        body: { items: toRequestLines(pending) },
      });
      qc.setQueryData(['order', order.id], updated);
      await qc.invalidateQueries({ queryKey: ['orders'] });
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={order !== null && picking === null}
        onClose={close}
        title={t.addToOrder.title(order?.orderNumber ?? '')}
        wide
      >
        <div className="flex flex-col gap-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.addToOrder.search}
            aria-label={t.addToOrder.search}
            className="min-h-11 rounded-btn border border-line-strong bg-bg px-4 text-sm"
          />
          <ul className="flex max-h-64 flex-col divide-y divide-line overflow-y-auto">
            {items.map(({ item, category }) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!item.isAvailable}
                  onClick={() => setPicking({ item, category })}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-1 text-start text-sm disabled:opacity-50"
                >
                  <span>
                    {item.name}
                    {!item.isAvailable && (
                      <span className="ms-2 text-xs text-ink-muted">{t.menu.soldOut}</span>
                    )}
                  </span>
                  <span className="tabular text-flame-text">{formatMoney(item.price)}</span>
                </button>
              </li>
            ))}
          </ul>
          {pending.length > 0 && (
            <div className="rounded-icon border border-line-strong p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {t.addToOrder.adding}
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {pending.map((l) => (
                  <li key={l.key} className="flex justify-between gap-2">
                    <span>
                      {l.qty} × {l.name}
                      {l.modifiers.length > 0 && (
                        <span className="text-xs text-ink-muted">
                          {' '}
                          ·{' '}
                          {l.modifiers
                            .flatMap((g) => g.items.map((i) => i.name))
                            .join(t.common.listSep)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-ink-muted hover:text-flame-text"
                      onClick={() => setPending((p) => p.filter((x) => x.key !== l.key))}
                    >
                      {t.addToOrder.remove}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-flame-text">
              {error}
            </p>
          )}
          <button
            type="button"
            className={buttonClass('primary', 'lg')}
            disabled={pending.length === 0 || busy}
            onClick={() => void submit()}
          >
            {busy ? t.addToOrder.busy : t.addToOrder.add(pending.length)}
          </button>
        </div>
      </Modal>
      <ModifierDialog
        item={picking?.item ?? null}
        category={picking?.category ?? ''}
        onClose={() => setPicking(null)}
        onPick={(line) => setPending((p) => [...p, { ...line, key: crypto.randomUUID() }])}
      />
    </>
  );
}
