import { randomBytes, randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, encodeSetting, type SettingKey } from '@ros/shared';
import bcrypt from 'bcrypt';

import type { SeedTenant } from './tenants/types';

/** Password for every demo account (README). */
export const DEMO_PASSWORD = 'password123';

export interface SeedUser {
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
}

export const DEMO_USERS = {
  admin: { email: 'admin@forkandflame.test', name: 'Ava Admin', role: 'ADMIN' },
  staff: { email: 'staff@forkandflame.test', name: 'Sam Staff', role: 'STAFF' },
  guest: { email: 'guest@forkandflame.test', name: 'Gia Guest', role: 'CUSTOMER' },
} as const;

export interface SeedModifier {
  id: string;
  name: string;
  priceDelta: number;
}
export interface SeedGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  items: SeedModifier[];
}
export interface SeedDish {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  station: string;
  allergens: string[];
  /** Photo served by the client from `client/public/images/dishes` (README credits). */
  imageUrl: string | null;
  groups: SeedGroup[];
  /** Relative popularity used by the history generator. */
  weight: number;
}

/** Dish name → photo path (Unsplash, credited in the README). */
const DISH_PHOTOS: Record<string, string> = {
  'Truffle Arancini': '/images/dishes/truffle-arancini.jpg',
  'Winter Caesar': '/images/dishes/winter-caesar.jpg',
  'Wagyu Burger': '/images/dishes/wagyu-burger.jpg',
  'Margherita D.O.C.': '/images/dishes/margherita.jpg',
  'Roast Halibut': '/images/dishes/roast-halibut.jpg',
  'Lava Fondant': '/images/dishes/lava-fondant.jpg',
  Tiramisu: '/images/dishes/tiramisu.jpg',
  'Iced Matcha': '/images/dishes/iced-matcha.jpg',
  'Yuzu Lemonade': '/images/dishes/yuzu-lemonade.jpg',
};

const mod = (name: string, priceDelta = 0): SeedModifier => ({
  id: randomUUID(),
  name,
  priceDelta,
});

/** Reference data built once per seed run so the history generator can reuse the ids. */
export function buildMenu() {
  const categories = [
    { id: randomUUID(), name: 'Starters', description: 'Small plates to share', sortOrder: 1 },
    { id: randomUUID(), name: 'Mains', description: 'From the grill and the oven', sortOrder: 2 },
    { id: randomUUID(), name: 'Desserts', description: 'Worth saving room for', sortOrder: 3 },
    { id: randomUUID(), name: 'Drinks', description: 'Cold, bright and house-made', sortOrder: 4 },
  ] as const;
  const [starters, mains, desserts, drinks] = categories;

  const size: SeedGroup = {
    id: randomUUID(),
    name: 'Size',
    minSelect: 1,
    maxSelect: 1,
    items: [mod('Regular'), mod('Large', 400)],
  };
  const doneness: SeedGroup = {
    id: randomUUID(),
    name: 'Doneness',
    minSelect: 1,
    maxSelect: 1,
    items: [mod('Medium rare'), mod('Medium'), mod('Well done')],
  };
  // "No bun" is a negative delta on purpose: it exercises symmetric rounding (P11).
  const extras: SeedGroup = {
    id: randomUUID(),
    name: 'Extras',
    minSelect: 0,
    maxSelect: 3,
    items: [mod('Extra cheese', 150), mod('Smoked bacon', 250), mod('No bun', -100)],
  };
  const milk: SeedGroup = {
    id: randomUUID(),
    name: 'Milk',
    minSelect: 0,
    maxSelect: 1,
    items: [mod('Oat milk'), mod('Almond milk', 50)],
  };

  const dish = (
    categoryId: string,
    name: string,
    description: string,
    price: number,
    station: string,
    allergens: string[],
    groups: SeedGroup[],
    weight: number,
  ): SeedDish => ({
    id: randomUUID(),
    categoryId,
    name,
    description,
    price,
    station,
    allergens,
    imageUrl: DISH_PHOTOS[name] ?? null,
    groups,
    weight,
  });

  // The nine dishes from the design-31 prototype.
  const dishes: SeedDish[] = [
    dish(starters.id, 'Truffle Arancini', 'With saffron', 1250, 'hot', ['dairy', 'gluten'], [], 6),
    dish(
      starters.id,
      'Winter Caesar',
      'With baby gem',
      900,
      'cold',
      ['egg', 'fish', 'dairy'],
      [],
      5,
    ),
    dish(
      mains.id,
      'Wagyu Burger',
      'With aged cheddar',
      1850,
      'grill',
      ['gluten', 'dairy'],
      [size, doneness, extras],
      10,
    ),
    dish(mains.id, 'Margherita D.O.C.', 'With basil', 1400, 'hot', ['gluten', 'dairy'], [size], 8),
    dish(mains.id, 'Roast Halibut', 'With brown butter', 2100, 'grill', ['fish', 'dairy'], [], 6),
    dish(
      desserts.id,
      'Lava Fondant',
      'With gelato',
      850,
      'pastry',
      ['egg', 'dairy', 'gluten'],
      [],
      5,
    ),
    dish(
      desserts.id,
      'Tiramisu',
      'With espresso',
      750,
      'pastry',
      ['egg', 'dairy', 'gluten'],
      [],
      4,
    ),
    dish(drinks.id, 'Iced Matcha', 'With oat milk', 550, 'bar', [], [milk], 5),
    dish(drinks.id, 'Yuzu Lemonade', 'With mint', 450, 'bar', [], [], 6),
  ];

  return { categories, groups: [size, doneness, extras, milk], dishes };
}

/** What a tenant's menu builder returns: rows ready for createMany, plus weights for the history. */
export interface SeedMenuData {
  categories: readonly {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
  }[];
  groups: SeedGroup[];
  dishes: SeedDish[];
}

export type SeedMenu = SeedMenuData;

/** Fork & Flame, the default tenant; tenants/index.ts re-exports it with the others. */
const DEFAULT_TENANT: SeedTenant = {
  id: 'forkandflame',
  settings: DEFAULT_SETTINGS,
  users: DEMO_USERS,
  buildMenu,
  branches: [],
  tableCount: 14,
};

export async function seedReference(
  prisma: PrismaClient,
  rounds: number,
  tenant: SeedTenant = DEFAULT_TENANT,
) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, rounds);
  const users = Object.fromEntries(
    await Promise.all(
      Object.entries(tenant.users).map(async ([key, u]) => [
        key,
        await prisma.user.create({ data: { ...u, passwordHash } }),
      ]),
    ),
  ) as Record<keyof SeedTenant['users'], { id: string }>;

  const menu = tenant.buildMenu();
  await prisma.menuCategory.createMany({ data: [...menu.categories] });
  await prisma.modifierGroup.createMany({
    data: menu.groups.map(({ items: _items, ...g }) => g),
  });
  await prisma.modifierItem.createMany({
    data: menu.groups.flatMap((g) => g.items.map((i) => ({ ...i, groupId: g.id }))),
  });
  await prisma.menuItem.createMany({
    data: menu.dishes.map(({ groups: _groups, weight: _weight, ...d }) => d),
  });
  await prisma.menuItemModifierGroup.createMany({
    data: menu.dishes.flatMap((d) =>
      d.groups.map((g, i) => ({ menuItemId: d.id, modifierGroupId: g.id, sortOrder: i })),
    ),
  });

  const tables = Array.from({ length: tenant.tableCount }, (_, i) => ({
    id: randomUUID(),
    number: String(i + 1),
    seats: [2, 2, 4, 4, 4, 4, 6, 6, 2, 4, 4, 6, 8, 2][i] ?? 4,
    // 128-bit random token, hex (TABLE-01).
    qrToken: randomBytes(16).toString('hex'),
  }));
  await prisma.table.createMany({ data: tables });

  await prisma.discount.createMany({
    data: [
      { code: 'SAVE10', type: 'PERCENT', value: 1000 },
      { code: 'WELCOME5', type: 'FIXED', value: 500, minOrder: 2000, usageLimit: 100 },
    ],
  });

  await prisma.setting.createMany({
    data: (Object.keys(tenant.settings) as SettingKey[]).map((key) => ({
      key,
      value: encodeSetting(tenant.settings[key]),
    })),
  });

  await prisma.branch.createMany({ data: tenant.branches.map((b) => ({ ...b })) });

  return { users, menu, tables };
}
