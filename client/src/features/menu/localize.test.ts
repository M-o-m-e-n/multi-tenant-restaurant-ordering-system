import type { MenuDto, MenuItemDto } from '@ros/shared';
import { describe, expect, it } from 'vitest';

import { localizeItem, localizeMenu } from './localize';

const burger: MenuItemDto = {
  id: 'burger',
  categoryId: 'mains',
  name: 'Wagyu Burger',
  description: 'With aged cheddar',
  translations: { ar: { name: 'برجر واجيو', description: 'بالشيدر المعتّق' } },
  price: 1850,
  imageUrl: null,
  isAvailable: true,
  allergens: [],
  station: 'grill',
  availableFrom: null,
  availableTo: null,
  modifierGroupCount: 1,
  modifierGroups: [
    {
      id: 'size',
      name: 'Size',
      translations: { ar: { name: 'الحجم' } },
      minSelect: 1,
      maxSelect: 1,
      items: [
        {
          id: 'lg',
          name: 'Large',
          translations: { ar: { name: 'كبير' } },
          priceDelta: 400,
          isAvailable: true,
        },
        { id: 'reg', name: 'Regular', translations: {}, priceDelta: 0, isAvailable: true },
      ],
    },
  ],
};

describe('localizeItem (ADR-037)', () => {
  it('shows the translation for the active language', () => {
    const ar = localizeItem(burger, 'ar');
    expect(ar.name).toBe('برجر واجيو');
    expect(ar.description).toBe('بالشيدر المعتّق');
    expect(ar.modifierGroups?.[0]?.name).toBe('الحجم');
    expect(ar.modifierGroups?.[0]?.items.map((o) => o.name)).toEqual(['كبير', 'Regular']);
  });

  it("falls back to the restaurant's own wording, and keeps ids and prices", () => {
    const en = localizeItem(burger, 'en');
    expect(en.name).toBe('Wagyu Burger');
    expect(en.description).toBe('With aged cheddar');
    expect(en.price).toBe(1850);
    expect(en.modifierGroups?.[0]?.items[0]).toMatchObject({ id: 'lg', priceDelta: 400 });
  });

  it('keeps the own description when a translation names the dish only', () => {
    const item = { ...burger, translations: { ar: { name: 'برجر' } } };
    expect(localizeItem(item, 'ar').description).toBe('With aged cheddar');
  });
});

describe('localizeMenu', () => {
  it('translates categories and their items', () => {
    // The list endpoint sends no groups, only their count.
    const { modifierGroups: _groups, ...listed } = burger;
    const menu: MenuDto = {
      categories: [
        {
          id: 'mains',
          name: 'Mains',
          description: null,
          translations: { ar: { name: 'أطباق رئيسية' } },
          sortOrder: 1,
          items: [listed],
        },
      ],
    };
    const ar = localizeMenu(menu, 'ar');
    expect(ar.categories[0]?.name).toBe('أطباق رئيسية');
    expect(ar.categories[0]?.items[0]?.name).toBe('برجر واجيو');
    expect(ar.categories[0]?.items[0]).not.toHaveProperty('modifierGroups');
  });
});
