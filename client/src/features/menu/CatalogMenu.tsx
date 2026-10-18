import type { MenuCategoryDto, MenuDto, MenuItemDto } from '@ros/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '../../i18n';
import { formatMoney } from '../../shared/money';

interface Props {
  menu: MenuDto;
  /** A category id from the URL (`?c=`); the first category otherwise. */
  initialCategory: string | null;
  onOpen: (item: MenuItemDto) => void;
}

/** The photo that stands for a category: its first dish that has one. */
const thumbOf = (c: MenuCategoryDto) => c.items.find((i) => i.imageUrl)?.imageUrl ?? null;

function Thumb({ src, className }: { src: string | null; className: string }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} object-cover`} />
  ) : (
    <span className={`${className} bg-surface-raised`} aria-hidden="true" />
  );
}

/** One dish in the grid: photo, name, price. The whole tile opens the dish. */
function DishTile({ item, onOpen }: { item: MenuItemDto; onOpen: (item: MenuItemDto) => void }) {
  const t = useT();
  const soldOut = !item.isAvailable;
  // A dish with choices (a size, say) is priced from its smallest.
  const price = formatMoney(item.price);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-label={t.menu.choose(item.name)}
        className="group flex h-full w-full flex-col items-center gap-3 rounded-[14px] p-2 text-center transition hover:bg-surface"
      >
        <span className="block aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-surface-raised">
          <Thumb
            src={item.imageUrl}
            className={`block size-full transition-transform duration-500 group-hover:scale-105 ${soldOut ? 'opacity-60 grayscale' : ''}`}
          />
        </span>
        <span dir="auto" className="text-[0.95rem] font-semibold leading-snug text-ink">
          {item.name}
        </span>
        {item.description && (
          <span className="-mt-2 line-clamp-2 text-xs text-ink-muted">{item.description}</span>
        )}
        <span className="mt-auto flex flex-wrap items-center justify-center gap-2">
          <span className="tabular text-sm font-bold text-flame-text">
            {item.modifierGroupCount > 0 ? t.menu.from(price) : price}
          </span>
          {soldOut && (
            <span className="rounded-btn border border-line-strong px-2.5 py-0.5 text-xs font-semibold text-ink-muted">
              {t.menu.soldOut}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * A long menu as a catalogue (ADR-035): the categories down the side, each
 * with a photo, and the chosen category as a grid of dishes. On a phone the
 * categories become a strip that scrolls sideways and stays under the header.
 * Searching looks across every category at once.
 */
export function CatalogMenu({ menu, initialCategory, onOpen }: Props) {
  const t = useT();
  const categories = menu.categories;
  const [selected, setSelected] = useState<string>(
    () => categories.find((c) => c.id === initialCategory)?.id ?? categories[0]?.id ?? '',
  );
  const [query, setQuery] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const current = categories.find((c) => c.id === selected) ?? categories[0];

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q
        ? categories.flatMap((c) =>
            c.items.filter(
              (i) =>
                i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
            ),
          )
        : [],
    [categories, q],
  );

  // Keep the chosen category's chip in view in the phone strip.
  useEffect(() => {
    strip.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [selected]);

  const choose = (id: string) => {
    setSelected(id);
    setQuery('');
    // Start the new category from its title, as a new page would.
    const top = heading.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.6) {
      heading.current?.scrollIntoView({ block: 'start' });
    }
  };

  const items = q ? results : (current?.items ?? []);

  return (
    <div className="grid gap-x-10 gap-y-4 pt-4 lg:grid-cols-[17rem_1fr] lg:pt-8">
      <nav aria-label={t.menu.categories} className="min-w-0 lg:row-span-2">
        {/* Phones and tablets: a strip under the header. */}
        <div
          ref={strip}
          className="sticky top-16 z-30 -mx-4 flex gap-2 overflow-x-auto bg-bg/95 px-4 py-2 backdrop-blur lg:hidden"
        >
          {categories.map((c) => {
            const active = !q && c.id === current?.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => choose(c.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-btn border py-1 pe-4 ps-1 text-sm font-semibold transition ${active ? 'border-flame bg-flame text-white' : 'border-line bg-surface text-ink'}`}
              >
                <Thumb src={thumbOf(c)} className="size-9 rounded-full" />
                <span dir="auto" className="whitespace-nowrap">
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
        {/* Desktop: the list down the side, staying in view while the grid scrolls. */}
        <ul className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-[14px] border border-line bg-surface py-2 lg:block">
          {categories.map((c) => {
            const active = !q && c.id === current?.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => choose(c.id)}
                  className={`flex w-full items-center gap-3 border-s-4 px-3 py-2 text-start text-sm transition hover:bg-surface-raised ${active ? 'border-flame font-bold text-ink' : 'border-transparent text-ink-muted'}`}
                >
                  <Thumb src={thumbOf(c)} className="size-12 shrink-0 rounded-[10px]" />
                  <span dir="auto">{c.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <header className="flex flex-col items-center gap-4 text-center">
        <h1
          ref={heading}
          dir="auto"
          className="scroll-mt-32 font-display text-[clamp(2rem,5vw,3.25rem)] font-black leading-tight"
        >
          {q ? t.menu.results : current?.name}
        </h1>
        {!q && current?.description && (
          <p className="-mt-2 text-sm text-ink-muted">{current.description}</p>
        )}
        <label className="relative block w-full max-w-sm">
          <span className="sr-only">{t.menu.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.menu.searchPlaceholder}
            className="min-h-11 w-full rounded-btn border border-line-strong bg-surface px-5 text-sm placeholder:text-ink-muted"
          />
        </label>
      </header>

      <section aria-label={q ? t.menu.results : current?.name} className="min-w-0">
        {items.length === 0 ? (
          <p className="py-16 text-center text-ink-muted">{t.menu.noMatch(query)}</p>
        ) : (
          <ul
            key={q ? 'results' : current?.id}
            className="grid grid-cols-2 gap-x-2 gap-y-6 motion-safe:animate-rise sm:grid-cols-3 xl:grid-cols-4"
          >
            {items.map((item) => (
              <DishTile key={item.id} item={item} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
