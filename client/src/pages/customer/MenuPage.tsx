import type { MenuItemDto } from '@ros/shared';
import { useMemo, useRef, useState } from 'react';

import { DishCard } from '../../features/menu/DishCard';
import { ItemDetail } from '../../features/menu/ItemDetail';
import { useMenu } from '../../features/menu/menuApi';
import { MenuRow } from '../../features/menu/MenuRow';

/**
 * Customer menu (MENU-01, BROWSE-01…03): signature carousel, category chips,
 * search, and the full list. Sold-out dishes stay visible, marked in text.
 */
export function MenuPage() {
  const { data, isLoading, isError, refetch } = useMenu();
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ item: MenuItemDto; category: string } | null>(null);
  const rail = useRef<HTMLDivElement>(null);

  const categoryName = useMemo(() => {
    const map = new Map<string, string>();
    data?.categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [data]);

  const signatures = useMemo(
    () =>
      data?.categories
        .flatMap((c) => c.items)
        .filter((i) => i.modifierGroupCount > 0 || i.price >= 1400)
        .slice(0, 8) ?? [],
    [data],
  );

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
      <p role="status" className="p-10 text-center text-ink-muted">
        Setting the table…
      </p>
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
      <section aria-labelledby="signatures" className="relative">
        <div className="flex items-end justify-between">
          <h2 id="signatures" className="font-display text-2xl font-bold">
            Chef&rsquo;s signatures
          </h2>
          <div className="hidden gap-2 md:flex">
            <button
              type="button"
              aria-label="Scroll back"
              onClick={() => rail.current?.scrollBy({ left: -240, behavior: 'smooth' })}
              className="grid size-11 place-items-center rounded-full bg-line-strong text-white"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Scroll forward"
              onClick={() => rail.current?.scrollBy({ left: 240, behavior: 'smooth' })}
              className="grid size-11 place-items-center rounded-full bg-flame text-white shadow-glow"
            >
              →
            </button>
          </div>
        </div>
        <div
          ref={rail}
          className="-mx-1 flex snap-x gap-5 overflow-x-auto px-1 pb-4 pt-14 [scrollbar-width:none]"
        >
          {signatures.map((item) => (
            <DishCard
              key={item.id}
              item={item}
              category={categoryName.get(item.categoryId) ?? ''}
              onOpen={openItem}
            />
          ))}
        </div>
      </section>

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
        <div
          role="tablist"
          aria-label="Categories"
          className="mt-4 flex gap-2 overflow-x-auto pb-2"
        >
          {[{ id: 'all', name: 'All' }, ...data.categories].map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`min-h-11 whitespace-nowrap rounded-btn border px-4 text-xs font-semibold ${
                category === c.id
                  ? 'border-flame bg-flame text-white'
                  : 'border-line-strong bg-surface-raised text-ink'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="py-10 text-center text-ink-muted">No dishes match &ldquo;{query}&rdquo;.</p>
        ) : (
          visible.map((c) => (
            <div key={c.id} className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-muted">
                {c.name}
              </h3>
              <ul>
                {c.items.map((item) => (
                  <MenuRow key={item.id} item={item} category={c.name} onOpen={openItem} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <ItemDetail
        item={open?.item ?? null}
        category={open?.category ?? ''}
        onClose={() => setOpen(null)}
      />
    </main>
  );
}
