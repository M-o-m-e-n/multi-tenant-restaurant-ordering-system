import type { ModifierGroupDto, PublicSettings } from '@ros/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { useCart, cartCount } = await import('./cartStore');
const { cartTotals, tipCents, toRequestLines } = await import('./cartPricing');
const { defaultSelection, toggleOption, unmetGroups, toSnapshot } = await import('./selection');

const burger = {
  menuItemId: 'burger',
  name: 'Wagyu Burger',
  category: 'Mains',
  imageUrl: null,
  unitPrice: 1850,
  qty: 1,
  modifiers: [
    {
      groupId: 'size',
      groupName: 'Size',
      items: [{ id: 'large', name: 'Large', priceDelta: 400 }],
    },
  ],
  notes: '',
};

const settings: PublicSettings = {
  restaurantName: 'x',
  taxBps: 875,
  serviceChargeBps: 1000,
  serviceChargeTaxable: false,
  deliveryFee: 499,
  currency: 'usd',
  tipPresetsBps: [1000, 1500, 2000],
  timezone: 'America/New_York',
};

describe('cart store', () => {
  beforeEach(() => useCart.getState().clear());

  it('merges identical choices and keeps different ones apart', () => {
    useCart.getState().add(burger);
    useCart.getState().add({ ...burger, qty: 2 });
    useCart.getState().add({ ...burger, modifiers: [] });
    const { lines } = useCart.getState();
    expect(lines).toHaveLength(2);
    expect(cartCount(lines)).toBe(4);
  });

  it('removes a line when decremented to zero (M6-S2)', () => {
    useCart.getState().add(burger);
    const key = useCart.getState().lines[0]!.key;
    useCart.getState().decrement(key);
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('persists to localStorage so the cart survives a reload (CART-01)', () => {
    useCart.getState().add(burger);
    expect(store.get('ros-cart')).toContain('Wagyu Burger');
  });

  it('sends ids only to the API', () => {
    useCart.getState().add({ ...burger, notes: ' no onions ' });
    expect(toRequestLines(useCart.getState().lines)).toEqual([
      { menuItemId: 'burger', qty: 1, modifierItemIds: ['large'], notes: 'no onions' },
    ]);
  });
});

describe('cart totals', () => {
  const lines = [{ ...burger, key: 'k', qty: 2 }];

  it('prices through computeTotals: (1850 + 400) × 2 = 4500', () => {
    const t = cartTotals(lines, {
      orderType: 'TAKEAWAY',
      settings,
      discount: null,
      tip: { kind: 'none' },
    });
    expect(t.subtotal).toBe(4500);
    expect(t.total).toBe(4500 + 394);
  });

  it('adds a preset tip without touching tax or discount (M6-S7, TIP-03)', () => {
    const opts = {
      orderType: 'DINE_IN' as const,
      settings,
      discount: { type: 'PERCENT' as const, value: 1000 },
    };
    const none = cartTotals(lines, { ...opts, tip: { kind: 'none' } });
    const tipped = cartTotals(lines, { ...opts, tip: { kind: 'preset', bps: 1500 } });
    expect(tipped.tipAmount).toBe(tipCents({ kind: 'preset', bps: 1500 }, 4500, 450));
    expect(tipped.total - none.total).toBe(tipped.tipAmount);
    expect(tipped.taxAmount).toBe(none.taxAmount);
    expect(tipped.discountAmount).toBe(none.discountAmount);
  });
});

describe('modifier selection (CART-03)', () => {
  const groups: ModifierGroupDto[] = [
    {
      id: 'size',
      name: 'Size',
      translations: {},
      minSelect: 1,
      maxSelect: 1,
      items: [
        { id: 'reg', name: 'Regular', translations: {}, priceDelta: 0, isAvailable: true },
        { id: 'lg', name: 'Large', translations: {}, priceDelta: 400, isAvailable: true },
      ],
    },
    {
      id: 'extras',
      name: 'Extras',
      translations: {},
      minSelect: 0,
      maxSelect: 2,
      items: [
        { id: 'a', name: 'A', translations: {}, priceDelta: 100, isAvailable: true },
        { id: 'b', name: 'B', translations: {}, priceDelta: 100, isAvailable: true },
        { id: 'c', name: 'C', translations: {}, priceDelta: 100, isAvailable: true },
      ],
    },
  ];

  it('keeps a required group unmet until something is chosen', () => {
    expect(unmetGroups(groups, {}).map((g) => g.id)).toEqual(['size']);
    expect(unmetGroups(groups, { size: ['lg'] })).toEqual([]);
  });

  it('treats a max-1 group as a radio and caps a multi group at maxSelect', () => {
    let sel = toggleOption({}, groups[0]!, 'reg');
    sel = toggleOption(sel, groups[0]!, 'lg');
    expect(sel.size).toEqual(['lg']);
    sel = toggleOption(sel, groups[1]!, 'a');
    sel = toggleOption(sel, groups[1]!, 'b');
    sel = toggleOption(sel, groups[1]!, 'c');
    expect(sel.extras).toEqual(['a', 'b']);
  });

  it('pre-selects exactly-one groups and snapshots only chosen options', () => {
    const sel = defaultSelection(groups);
    expect(sel).toEqual({ size: ['reg'] });
    expect(toSnapshot(groups, sel)).toEqual([
      {
        groupId: 'size',
        groupName: 'Size',
        items: [{ id: 'reg', name: 'Regular', priceDelta: 0 }],
      },
    ]);
  });
});
