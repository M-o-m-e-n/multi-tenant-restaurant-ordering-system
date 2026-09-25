import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { zonedTimeToUtc } from '../src/lib/time';
import { getPublicMenu, menuChanged, resolveSelections } from '../src/modules/menu';
import { findItem } from '../src/modules/menu/menu.repo';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';

const app = createApp({ rateLimits: false });
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function tokenFor(role: 'ADMIN' | 'STAFF' | 'CUSTOMER') {
  const user = await makeUser(role);
  return (await loginAs(app, user.email)).accessToken;
}

describe('menu', () => {
  let menu: Awaited<ReturnType<typeof seedMenu>>;

  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    menu = await seedMenu();
  });
  afterAll(disconnectPrisma);

  it('serves the public menu and item detail without auth (M4-S4)', async () => {
    const res = await request(app).get('/api/v1/menu');
    expect(res.status).toBe(200);
    const names = res.body.categories.flatMap((c: { items: { name: string }[] }) =>
      c.items.map((i) => i.name),
    );
    expect(names).toEqual(expect.arrayContaining(['Wagyu Burger', 'Margherita', 'Lemonade']));

    const detail = await request(app).get(`/api/v1/menu/items/${menu.items.burger.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.modifierGroups.map((g: { name: string }) => g.name)).toEqual([
      'Size',
      'Extras',
    ]);
  });

  it('shows a breakfast item at 09:00 local and hides it at 15:00 (MENU-06)', async () => {
    const at = (h: number) => zonedTimeToUtc('2026-09-25', h, 0, 'America/New_York');
    const names = async (h: number) =>
      (await getPublicMenu(at(h))).categories.flatMap((c) => c.items.map((i) => i.name));
    expect(await names(9)).toContain('Pancakes');
    expect(await names(15)).not.toContain('Pancakes');
  });

  it('shows an 86’d item as sold out rather than hiding it (MENU-05, M4-S9)', async () => {
    const staff = await tokenFor('STAFF');
    const res = await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.pizza.id}/availability`)
      .set(bearer(staff))
      .send({ isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.isAvailable).toBe(false);

    const pub = await request(app).get('/api/v1/menu');
    const pizza = pub.body.categories
      .flatMap((c: { items: { id: string; isAvailable: boolean }[] }) => c.items)
      .find((i: { id: string }) => i.id === menu.items.pizza.id);
    expect(pizza).toMatchObject({ isAvailable: false });
  });

  it('refuses the 86 toggle to a customer', async () => {
    const customer = await tokenFor('CUSTOMER');
    const res = await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.pizza.id}/availability`)
      .set(bearer(customer))
      .send({ isAvailable: false });
    expect(res.status).toBe(403);
  });

  it('makes an admin edit visible immediately despite the cache (M4-S3)', async () => {
    await request(app).get('/api/v1/menu'); // warm the cache
    const admin = await tokenFor('ADMIN');
    await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.lemonade.id}`)
      .set(bearer(admin))
      .send({ name: 'Yuzu Lemonade', price: 500 })
      .expect(200);
    const res = await request(app).get('/api/v1/menu');
    const names = res.body.categories.flatMap((c: { items: { name: string }[] }) =>
      c.items.map((i) => i.name),
    );
    expect(names).toContain('Yuzu Lemonade');
  });

  it('soft-deletes categories and items; the rows survive (M4-S5, M4-S6, BR-11)', async () => {
    const admin = await tokenFor('ADMIN');
    await request(app)
      .delete(`/api/v1/staff/menu/items/${menu.items.lemonade.id}`)
      .set(bearer(admin))
      .expect(204);
    await request(app)
      .delete(`/api/v1/staff/menu/categories/${menu.categories.breakfast.id}`)
      .set(bearer(admin))
      .expect(204);

    expect(
      await prisma().menuItem.findUnique({ where: { id: menu.items.lemonade.id } }),
    ).toMatchObject({
      isActive: false,
    });
    expect(
      await prisma().menuCategory.findUnique({ where: { id: menu.categories.breakfast.id } }),
    ).toMatchObject({ isActive: false });

    const res = await request(app).get('/api/v1/menu');
    expect(res.body.categories.map((c: { name: string }) => c.name)).not.toContain('Breakfast');
    expect((await request(app).get(`/api/v1/menu/items/${menu.items.lemonade.id}`)).status).toBe(
      404,
    );
  });

  it('creates items and groups, and attaches two groups to one item (M4-S7)', async () => {
    const admin = await tokenFor('ADMIN');
    const item = await request(app)
      .post('/api/v1/staff/menu/items')
      .set(bearer(admin))
      .send({ categoryId: menu.categories.mains.id, name: 'Steak', price: 3200, station: 'grill' });
    expect(item.status).toBe(201);

    const group = await request(app)
      .post('/api/v1/staff/menu/modifier-groups')
      .set(bearer(admin))
      .send({ name: 'Sauce', minSelect: 0, maxSelect: 3 });
    expect(group.status).toBe(201);
    await request(app)
      .post(`/api/v1/staff/menu/modifier-groups/${group.body.id}/items`)
      .set(bearer(admin))
      .send({ name: 'Peppercorn', priceDelta: 200 })
      .expect(201);

    for (const modifierGroupId of [menu.groups.size.id, group.body.id]) {
      await request(app)
        .post(`/api/v1/staff/menu/items/${item.body.id}/modifier-groups`)
        .set(bearer(admin))
        .send({ modifierGroupId })
        .expect(201);
    }
    const detail = await request(app).get(`/api/v1/menu/items/${item.body.id}`);
    expect(detail.body.modifierGroups.map((g: { name: string }) => g.name)).toEqual([
      'Size',
      'Sauce',
    ]);
  });

  it('writes an audit row with before and after for each menu write (M4-S10)', async () => {
    const admin = await tokenFor('ADMIN');
    await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.burger.id}`)
      .set(bearer(admin))
      .send({ price: 1950 })
      .expect(200);
    const log = await prisma().auditLog.findFirst({ where: { action: 'MENU_ITEM_UPDATE' } });
    expect(log?.entityId).toBe(menu.items.burger.id);
    const diff = log?.diff as { before: { price: number }; after: { price: number } };
    expect(diff.before.price).toBe(1850);
    expect(diff.after.price).toBe(1950);
  });

  it('rejects unknown fields on admin writes', async () => {
    const admin = await tokenFor('ADMIN');
    const res = await request(app)
      .patch(`/api/v1/staff/menu/items/${menu.items.burger.id}`)
      .set(bearer(admin))
      .send({ price: 100, isActive: true });
    expect(res.status).toBe(400);
  });
});

describe('resolveSelections (M4-S8, AC-17)', () => {
  let menu: Awaited<ReturnType<typeof seedMenu>>;
  let burger: NonNullable<Awaited<ReturnType<typeof findItem>>>;

  beforeEach(async () => {
    await resetDb();
    menu = await seedMenu();
    burger = (await findItem(menu.items.burger.id))!;
  });

  const codeOf = (ids: string[]) => {
    try {
      resolveSelections(burger, ids);
      return 'OK';
    } catch (err) {
      return (err as { code: string }).code;
    }
  };

  it('returns authoritative deltas and a snapshot for a valid choice', () => {
    const r = resolveSelections(burger, [
      menu.options.large,
      menu.options.cheese,
      menu.options.noBun,
    ]);
    expect(r.modifierTotal).toBe(400 + 150 - 100);
    expect(r.modifiers.map((g) => g.groupName)).toEqual(['Size', 'Extras']);
  });

  it('rejects a modifier borrowed from another item', () => {
    expect(codeOf([menu.options.regular, menu.options.stuffedCrust])).toBe(
      'INVALID_MODIFIER_SELECTION',
    );
  });

  it('rejects skipping a required group', () => {
    expect(codeOf([menu.options.cheese])).toBe('INVALID_MODIFIER_SELECTION');
  });

  it('rejects more than maxSelect', () => {
    expect(
      codeOf([menu.options.regular, menu.options.cheese, menu.options.bacon, menu.options.noBun]),
    ).toBe('INVALID_MODIFIER_SELECTION');
    expect(codeOf([menu.options.regular, menu.options.large])).toBe('INVALID_MODIFIER_SELECTION');
  });

  it('rejects an unavailable option and a duplicate', () => {
    expect(codeOf([menu.options.regular, menu.options.truffle])).toBe('INVALID_MODIFIER_SELECTION');
    expect(codeOf([menu.options.regular, menu.options.cheese, menu.options.cheese])).toBe(
      'INVALID_MODIFIER_SELECTION',
    );
  });
});
