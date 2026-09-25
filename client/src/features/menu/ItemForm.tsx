import type { AdminMenuDto, CreateItemDto } from '@ros/shared';
import { type FormEvent, useState } from 'react';

import { ApiError } from '../../shared/api/client';
import { parseMoneyInput } from '../../shared/money';
import { buttonClass } from '../../shared/ui/buttonClass';
import { Field } from '../../shared/ui/Field';
import { formValue } from '../../shared/ui/formValue';

type Item = AdminMenuDto['categories'][number]['items'][number];

interface Props {
  categories: AdminMenuDto['categories'];
  initial?: Item;
  onSubmit: (dto: CreateItemDto) => Promise<unknown>;
  onDone: () => void;
}

/** Create or edit a dish. Price is typed in dollars and parsed to cents without floats. */
export function ItemForm({ categories, initial, onSubmit, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const price = parseMoneyInput(formValue(form, 'price'));
    if (price === null) {
      setError('Enter a price such as 12.50.');
      return;
    }
    const allergens = formValue(form, 'allergens')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const optional = (name: string) => formValue(form, name).trim() || null;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        categoryId: formValue(form, 'categoryId'),
        name: formValue(form, 'name'),
        description: optional('description'),
        price,
        station: optional('station'),
        imageUrl: optional('imageUrl'),
        allergens,
        availableFrom: optional('availableFrom'),
        availableTo: optional('availableTo'),
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Saving failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => void submit(e)}>
      <Field
        label="Name"
        name="name"
        defaultValue={initial?.name}
        required
        className="sm:col-span-2"
      />
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="item-category"
          className="text-xs font-medium uppercase tracking-wider text-ink-muted"
        >
          Category
        </label>
        <select
          id="item-category"
          name="categoryId"
          defaultValue={initial?.categoryId ?? categories[0]?.id}
          className="min-h-11 rounded-icon border border-line-strong bg-bg px-3 text-sm"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Price ($)"
        name="price"
        inputMode="decimal"
        defaultValue={initial ? (initial.price / 100).toFixed(2) : ''}
        required
      />
      <Field
        label="Description"
        name="description"
        defaultValue={initial?.description ?? ''}
        className="sm:col-span-2"
      />
      <Field
        label="Station"
        name="station"
        defaultValue={initial?.station ?? ''}
        placeholder="grill, cold, bar…"
      />
      <Field
        label="Allergens"
        name="allergens"
        defaultValue={initial?.allergens.join(', ')}
        placeholder="dairy, gluten"
      />
      <Field
        label="Available from"
        name="availableFrom"
        type="time"
        defaultValue={initial?.availableFrom ?? ''}
      />
      <Field
        label="Available to"
        name="availableTo"
        type="time"
        defaultValue={initial?.availableTo ?? ''}
      />
      <Field
        label="Image URL"
        name="imageUrl"
        type="url"
        defaultValue={initial?.imageUrl ?? ''}
        className="sm:col-span-2"
      />
      {error && (
        <p role="alert" className="text-sm text-flame-text sm:col-span-2">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${buttonClass('primary')} sm:col-span-2`}>
        {busy ? 'Saving…' : initial ? 'Save changes' : 'Add dish'}
      </button>
    </form>
  );
}
