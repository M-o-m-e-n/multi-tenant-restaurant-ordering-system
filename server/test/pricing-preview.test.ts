import {
  computeTotals,
  type MenuItemDto,
  ORDER_TYPES,
  type PricingDiscount,
  type PublicSettings,
} from '@ros/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { menuChanged } from '../src/modules/menu';
import { invalidateSettingsCache } from '../src/modules/settings';
import { loginAs, makeUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { seedMenu } from './helpers/menu';

const app = createApp({ rateLimits: false });

async function setSetting(key: string, value: string) {
  await prisma().setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  invalidateSettingsCache();
}

describe('settings and order preview', () => {
  let menu: Awaited<ReturnType<typeof seedMenu>>;

  beforeEach(async () => {
    await resetDb();
    invalidateSettingsCache();
    menuChanged();
    menu = await seedMenu();
    await prisma().discount.createMany({
      data: [
        { code: 'SAVE10', type: 'PERCENT', value: 1000 },
        { code: 'FIVEOFF', type: 'FIXED', value: 500, minOrder: 2000 },
        { code: 'OLD', type: 'PERCENT', value: 1000, endsAt: new Date('2020-01-01T00:00:00Z') },
        { code: 'GONE', type: 'FIXED', value: 100, usageLimit: 1, usedCount: 1 },
        { code: 'OFF', type: 'FIXED', value: 100, isActive: false },
      ],
    });
  });
  afterAll(disconnectPrisma);

  it('serves the public pricing settings (M6-S4)', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'currency',
        'deliveryFee',
        'restaurantName',
        'serviceChargeBps',
        'serviceChargeTaxable',
        'taxBps',
        'tipPresetsBps',
      ].sort(),
    );
    expect(res.body.taxBps).toBe(875);
    expect(res.body.timezone).toBeUndefined();
  });

  it('prices a cart without auth and persists nothing (M6-S6)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/preview')
      .send({
        type: 'DINE_IN',
        items: [
          {
            menuItemId: menu.items.burger.id,
            qty: 2,
            modifierItemIds: [menu.options.large, menu.options.noBun],
          },
        ],
        discountCode: 'save10',
        tipAmount: 300,
      });
    expect(res.status).toBe(200);
    // (1850 + 400 − 100) × 2 = 4300; 10% off = 430; service 10% of 3870 = 387; tax 8.75% of 3870 = 339
    expect(res.body.totals).toEqual({
      subtotal: 4300,
      discountAmount: 430,
      serviceCharge: 387,
      taxAmount: 339,
      deliveryFee: 0,
      tipAmount: 300,
      total: 3870 + 387 + 339 + 300,
      currency: 'usd',
    });
    expect(await prisma().order.count()).toBe(0);
    expect((await prisma().discount.findUnique({ where: { code: 'SAVE10' } }))?.usedCount).toBe(0);
  });

  it('refuses an 86’d item with 409 ITEM_UNAVAILABLE naming it (CART-07)', async () => {
    await prisma().menuItem.update({
      where: { id: menu.items.pizza.id },
      data: { isAvailable: false },
    });
    menuChanged();
    const res = await request(app)
      .post('/api/v1/orders/preview')
      .send({ type: 'TAKEAWAY', items: [{ menuItemId: menu.items.pizza.id, qty: 1 }] });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ITEM_UNAVAILABLE');
    expect(res.body.error.details.menuItemIds).toEqual([menu.items.pizza.id]);
  });

  it('answers an empty cart with 422 EMPTY_CART', async () => {
    const res = await request(app)
      .post('/api/v1/orders/preview')
      .send({ type: 'TAKEAWAY', items: [] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EMPTY_CART');
  });

  it('rejects a tampered modifier choice (AC-17)', async () => {
    const res = await request(app)
      .post('/api/v1/orders/preview')
      .send({
        type: 'TAKEAWAY',
        items: [
          {
            menuItemId: menu.items.burger.id,
            qty: 1,
            modifierItemIds: [menu.options.stuffedCrust],
          },
        ],
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_MODIFIER_SELECTION');
  });

  it('I14: maps each discount failure to 422 with its own code', async () => {
    const cart = { type: 'TAKEAWAY', items: [{ menuItemId: menu.items.lemonade.id, qty: 2 }] };
    const codes: Record<string, string> = {
      NOPE: 'DISCOUNT_NOT_FOUND',
      OFF: 'DISCOUNT_INACTIVE',
      OLD: 'DISCOUNT_EXPIRED',
      FIVEOFF: 'DISCOUNT_MIN_NOT_MET',
      GONE: 'DISCOUNT_LIMIT_REACHED',
    };
    for (const [discountCode, expected] of Object.entries(codes)) {
      const res = await request(app)
        .post('/api/v1/orders/preview')
        .send({ ...cart, discountCode });
      expect(res.status, discountCode).toBe(422);
      expect(res.body.error.code, discountCode).toBe(expected);
    }
  });

  it('validates a code for a signed-in user (POST /discounts/validate)', async () => {
    const user = await makeUser();
    const { accessToken } = await loginAs(app, user.email);
    const res = await request(app)
      .post('/api/v1/discounts/validate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'save10', subtotal: 3750 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      valid: true,
      discount: { code: 'SAVE10', type: 'PERCENT', value: 1000 },
      discountAmount: 375,
    });
  });

  it('M6-S9: client preview and server preview agree to the cent across the matrix (AC-4)', async () => {
    const lines = [
      {
        menuItemId: menu.items.burger.id,
        qty: 2,
        modifierItemIds: [menu.options.large, menu.options.cheese, menu.options.noBun],
      },
      { menuItemId: menu.items.pizza.id, qty: 1, modifierItemIds: [menu.options.stuffedCrust] },
      { menuItemId: menu.items.lemonade.id, qty: 3, modifierItemIds: [] },
    ];
    // What the client holds: item details from GET /menu/items/:id.
    const details = new Map<string, MenuItemDto>();
    for (const l of lines) {
      const res = await request(app).get(`/api/v1/menu/items/${l.menuItemId}`);
      details.set(l.menuItemId, res.body as MenuItemDto);
    }
    const discounts: [string | undefined, PricingDiscount | null][] = [
      [undefined, null],
      ['SAVE10', { type: 'PERCENT', value: 1000 }],
      ['FIVEOFF', { type: 'FIXED', value: 500 }],
    ];

    let cases = 0;
    for (const taxable of [false, true]) {
      await setSetting('serviceChargeTaxable', String(taxable));
      const settings = (await request(app).get('/api/v1/settings')).body as PublicSettings;
      for (const type of ORDER_TYPES) {
        for (const [code, discount] of discounts) {
          for (const tip of [0, 437]) {
            const client = computeTotals({
              orderType: type,
              lines: lines.map((l) => {
                const item = details.get(l.menuItemId)!;
                const options = item.modifierGroups!.flatMap((g) => g.items);
                return {
                  menuItemId: l.menuItemId,
                  unitPrice: item.price,
                  qty: l.qty,
                  modifierDeltas: l.modifierItemIds.map(
                    (id) => options.find((o) => o.id === id)!.priceDelta,
                  ),
                };
              }),
              discount,
              tipAmount: tip,
              ctx: settings,
            }).totals;
            const server = await request(app)
              .post('/api/v1/orders/preview')
              .send({ type, items: lines, discountCode: code, tipAmount: tip });
            expect(server.status).toBe(200);
            const { currency: _c, ...serverTotals } = server.body.totals;
            expect(serverTotals, `${type} ${code ?? 'none'} tip=${tip} taxable=${taxable}`).toEqual(
              client,
            );
            cases++;
          }
        }
      }
    }
    expect(cases).toBe(36);
  });
});
