import type { MenuItemDto } from '@ros/shared';
import { useMemo, useState } from 'react';

import { CartBar } from '../../features/cart/CartBar';
import { ModifierDialog } from '../../features/cart/ModifierDialog';
import { CategoryChips } from '../../features/menu/CategoryChips';
import { useMenu } from '../../features/menu/menuApi';
import { MenuRow } from '../../features/menu/MenuRow';
import { MenuSkeleton } from '../../features/menu/MenuSkeleton';
import { SignatureRail } from '../../features/menu/SignatureRail';
import { pickSignatures } from '../../features/menu/signatures';
import { TableBanner } from '../../features/table/TableBanner';

/**
 * Customer menu (MENU-01, BROWSE-01…03): signature carousel, category chips,
 * search, and the full list. Sold-out dishes stay visible, marked in text.
 */
export function MenuPage() {
  const { data, isLoading, isError, refetch } = useMenu();
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ item: MenuItemDto; category: string } | null>(null);

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    data?.categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [data]);

  const signatures = useMemo(() => pickSignatures(data), [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      data?.categories
        .filter((c) => category === 'all' || c.id === category)
        .map((c) => ({
          ...c,
          items: c.items.filter(
            (i) =>
              !q ||
              i.name.toLowerCase().includes(q) ||
              (i.description ?? '').toLowerCase().includes(q),
          ),
        }))
        .filter((c) => c.items.length > 0) ?? []
    );
  }, [data, category, query]);

  const openItem = (item: MenuItemDto) =>
    setOpen({ item, category: categoryName.get(item.categoryId) ?? '' });

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-content px-5 pb-24 pt-6 md:px-10">
        <MenuSkeleton />
      </main>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-10 text-center">
        <p>The menu did not load.</p>
        <button
          type="button"
          className="mt-3 font-semibold text-flame-text underline"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-content px-5 pb-24 md:px-10">
      <TableBanner />
      <header className="relative mb-6 overflow-hidden rounded-frame border border-line motion-safe:animate-rise">
        <img
          src="/images/spread.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg-deep via-bg-deep/80 to-transparent" />
        <div className="relative px-6 py-10 md:px-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-flame-text">
            Tonight&rsquo;s menu
          </p>
          <h1 className="mt-2 max-w-md font-display text-4xl font-bold md:text-5xl">
            Cooked over open flame.
          </h1>
          <p className="mt-3 max-w-sm text-sm text-ink-muted">
            Pick a plate, tweak it your way, and we&rsquo;ll fire it the moment you order.
          </p>
        </div>
      </header>
      <SignatureRail
        id="signatures"
        title="Chef&rsquo;s signatures"
        items={signatures}
        categoryName={(i) => categoryName.get(i.categoryId) ?? ''}
        onOpen={openItem}
      />

      <section aria-labelledby="full-menu" className="mt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h2 id="full-menu" className="font-display text-2xl font-bold">
            The full menu
          </h2>
          <label className="relative block md:w-72">
            <span className="sr-only">Search the menu</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes"
              className="min-h-11 w-full rounded-btn border border-line-strong bg-surface-raised px-4 text-sm placeholder:text-ink-muted"
            />
          </label>
        </div>
        <CategoryChips
          chips={[{ id: 'all', name: 'All' }, ...data.categories]}
          value={category}
          onChange={setCategory}
        />
        {visible.length === 0 ? (
          <p className="py-10 text-center text-ink-muted">No dishes match &ldquo;{query}&rdquo;.</p>
        ) : (
          visible.map((c) => (
            <div key={c.id} className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {c.name}
              </h3>
              <ul>
                {c.items.map((item, i) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    category={c.name}
                    onOpen={openItem}
                    index={i}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <ModifierDialog
        item={open?.item ?? null}
        category={open?.category ?? ''}
        onClose={() => setOpen(null)}
      />
      <CartBar />
    </main>
  );
}
