import type { AdminMenuDto } from '@ros/shared';
import { useState } from 'react';

import { AdminNav } from '../../features/admin/AdminNav';
import {
  useAdminMenu,
  useCreateCategory,
  useCreateItem,
  useDeleteCategory,
  useDeleteItem,
  useSetAvailability,
  useUpdateItem,
} from '../../features/menu/adminMenuApi';
import { AvailabilityToggle } from '../../features/menu/AvailabilityToggle';
import { ItemForm } from '../../features/menu/ItemForm';
import { formatMoney } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Modal } from '../../shared/ui/Modal';

type Item = AdminMenuDto['categories'][number]['items'][number];

/**
 * Admin menu manager (MENU-02, MENU-03, ADM-01). The 86 switch sits on every
 * row, so an item goes sold out in two taps: open this page, flip the switch.
 */
export function AdminMenuPage() {
  const { data, isLoading } = useAdminMenu();
  const setAvailability = useSetAvailability();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [newCategory, setNewCategory] = useState('');

  if (isLoading || !data) {
    return (
      <p role="status" className="p-10 text-center text-ink-muted">
        Loading the menu…
      </p>
    );
  }
  const active = data.categories.filter((c) => c.isActive);

  return (
    <main className="mx-auto w-full max-w-content px-5 pb-20 md:px-10">
      <div className="mb-4">
        <AdminNav />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Menu</h1>
          <p className="text-sm text-ink-muted">
            Flip a dish to 86 and guests see it sold out at once.
          </p>
        </div>
        <button type="button" className={buttonClass('primary')} onClick={() => setEditing('new')}>
          Add dish
        </button>
      </div>

      {active.map((c) => (
        <section key={c.id} className="mt-8 rounded-card border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">{c.name}</h2>
            <button
              type="button"
              className="text-xs font-semibold text-ink-muted hover:text-flame-text"
              onClick={() => {
                if (window.confirm(`Hide the ${c.name} category and all its dishes?`))
                  deleteCategory.mutate(c.id);
              }}
            >
              Remove category
            </button>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {c.items
              .filter((i) => i.isActive)
              .map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {item.station ?? 'no station'}
                      {item.modifierGroups &&
                        item.modifierGroups.length > 0 &&
                        ` · ${item.modifierGroups.map((g) => g.name).join(', ')}`}
                      {item.availableFrom && ` · ${item.availableFrom}–${item.availableTo}`}
                    </p>
                  </div>
                  <span className="tabular w-20 text-right text-sm font-semibold text-flame-text">
                    {formatMoney(item.price)}
                  </span>
                  <AvailabilityToggle
                    name={item.name}
                    isAvailable={item.isAvailable}
                    onChange={(isAvailable) => setAvailability.mutate({ id: item.id, isAvailable })}
                  />
                  <button
                    type="button"
                    className={buttonClass('ghost', 'sm')}
                    onClick={() => setEditing(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="min-h-11 px-2 text-xs font-semibold text-ink-muted hover:text-flame-text"
                    onClick={() => {
                      if (window.confirm(`Remove ${item.name} from the menu?`))
                        deleteItem.mutate(item.id);
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <form
        className="mt-8 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCategory.trim()) return;
          createCategory.mutate(
            { name: newCategory.trim() },
            { onSuccess: () => setNewCategory('') },
          );
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            New category
          </span>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm"
          />
        </label>
        <button type="submit" className={buttonClass('ghost')}>
          Add category
        </button>
      </form>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a dish' : `Edit ${editing?.name ?? ''}`}
        wide
      >
        {editing !== null && (
          <ItemForm
            categories={active}
            initial={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
            onSubmit={(dto) =>
              editing === 'new'
                ? createItem.mutateAsync(dto)
                : updateItem.mutateAsync({ id: editing.id, dto })
            }
          />
        )}
      </Modal>
    </main>
  );
}
