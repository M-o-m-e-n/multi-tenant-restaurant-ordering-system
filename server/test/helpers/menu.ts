import { prisma } from '../../src/lib/prisma';
import { clockToTime } from '../../src/lib/time';

/**
 * A small menu: a burger with Size (exactly one) and Extras (up to two, one
 * negative), a pizza with its own Crust group, a breakfast item scheduled
 * 07:00–11:00, and a drink with no modifiers.
 */
export async function seedMenu() {
  const db = prisma();
  const mains = await db.menuCategory.create({ data: { name: 'Mains', sortOrder: 1 } });
  const breakfast = await db.menuCategory.create({ data: { name: 'Breakfast', sortOrder: 2 } });

  const size = await db.modifierGroup.create({
    data: {
      name: 'Size',
      minSelect: 1,
      maxSelect: 1,
      items: {
        create: [
          { name: 'Regular', priceDelta: 0 },
          { name: 'Large', priceDelta: 400 },
        ],
      },
    },
    include: { items: { orderBy: { priceDelta: 'asc' } } },
  });
  const extras = await db.modifierGroup.create({
    data: {
      name: 'Extras',
      minSelect: 0,
      maxSelect: 2,
      items: {
        create: [
          { name: 'Cheese', priceDelta: 150 },
          { name: 'Bacon', priceDelta: 250 },
          { name: 'No bun', priceDelta: -100 },
          { name: 'Truffle', priceDelta: 900, isAvailable: false },
        ],
      },
    },
    include: { items: { orderBy: { priceDelta: 'asc' } } },
  });
  const crust = await db.modifierGroup.create({
    data: {
      name: 'Crust',
      minSelect: 0,
      maxSelect: 1,
      items: { create: [{ name: 'Stuffed crust', priceDelta: 300 }] },
    },
    include: { items: true },
  });

  const burger = await db.menuItem.create({
    data: { categoryId: mains.id, name: 'Wagyu Burger', price: 1850, station: 'grill' },
  });
  const pizza = await db.menuItem.create({
    data: { categoryId: mains.id, name: 'Margherita', price: 1400, station: 'hot' },
  });
  const pancakes = await db.menuItem.create({
    data: {
      categoryId: breakfast.id,
      name: 'Pancakes',
      price: 900,
      availableFrom: clockToTime('07:00'),
      availableTo: clockToTime('11:00'),
    },
  });
  const lemonade = await db.menuItem.create({
    data: { categoryId: mains.id, name: 'Lemonade', price: 450, station: 'bar' },
  });

  await db.menuItemModifierGroup.createMany({
    data: [
      { menuItemId: burger.id, modifierGroupId: size.id, sortOrder: 0 },
      { menuItemId: burger.id, modifierGroupId: extras.id, sortOrder: 1 },
      { menuItemId: pizza.id, modifierGroupId: crust.id, sortOrder: 0 },
    ],
  });

  const opt = (group: { items: { id: string; name: string }[] }, name: string) => {
    const found = group.items.find((i) => i.name === name);
    if (!found) throw new Error(`no option ${name}`);
    return found.id;
  };

  return {
    categories: { mains, breakfast },
    items: { burger, pizza, pancakes, lemonade },
    groups: { size, extras, crust },
    options: {
      regular: opt(size, 'Regular'),
      large: opt(size, 'Large'),
      cheese: opt(extras, 'Cheese'),
      bacon: opt(extras, 'Bacon'),
      noBun: opt(extras, 'No bun'),
      truffle: opt(extras, 'Truffle'),
      stuffedCrust: opt(crust, 'Stuffed crust'),
    },
  };
}
