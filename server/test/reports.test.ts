import { DEFAULT_SETTINGS } from '@ros/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type SeedFixture, seedHistory } from '../prisma/seed/history';
import { seedReference } from '../prisma/seed/reference';
import { createApp } from '../src/app';
import { disconnectPrisma, prisma } from '../src/lib/prisma';
import { clearReportCache } from '../src/modules/reports';
import { invalidateSettingsCache } from '../src/modules/settings';
import { resetDb } from './helpers/db';

const app = createApp({ rateLimits: false });

/**
 * AC-9 / I13: report output is checked against the figures the seed generator
 * itself emitted, not against a second SQL query — report SQL checking report
 * SQL would pass even when both were wrong.
 */
describe('reports against the seed fixture', () => {
  let fixture: SeedFixture;
  let admin: string;

  beforeAll(async () => {
    await resetDb();
    invalidateSettingsCache();
    clearReportCache();
    const refs = await seedReference(prisma(), 4);
    fixture = await seedHistory(prisma(), refs, DEFAULT_SETTINGS, { days: 7, seed: 424242 });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@forkandflame.test', password: 'password123' });
    admin = login.body.accessToken as string;
  }, 60_000);
  afterAll(disconnectPrisma);

  const get = (path: string) =>
    request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${admin}`);
  const range = () => `from=${fixture.from}&to=${fixture.to}`;

  it('I13: the summary equals the seed’s own totals, tax, service, delivery and tips on separate lines', async () => {
    const res = await get(`/reports/summary?${range()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      orders: fixture.totals.orders,
      netSales: fixture.totals.netSales,
      taxCollected: fixture.totals.taxCollected,
      serviceCharge: fixture.totals.serviceCharge,
      deliveryFees: fixture.totals.deliveryFees,
      tips: fixture.totals.tips,
      aov: fixture.totals.aov,
    });
  });

  it('buckets revenue by stored business date, day by day', async () => {
    const res = await get(`/reports/revenue-by-day?${range()}`);
    const expected = fixture.days
      .filter((d) => d.orders > 0)
      .map((d) => ({ businessDate: d.businessDate, netSales: d.netSales, orders: d.orders }));
    expect(res.body.data).toEqual(expected);
  });

  it('ranks items by id with the quantities and revenue the seed recorded', async () => {
    const res = await get(`/reports/top-items?${range()}&limit=50&metric=qty`);
    const byId = new Map(fixture.topItems.map((i) => [i.menuItemId, i]));
    expect(res.body.data).toHaveLength(fixture.topItems.length);
    for (const item of res.body.data as { menuItemId: string; qty: number; revenue: number }[]) {
      expect(item).toMatchObject({
        qty: byId.get(item.menuItemId)?.qty,
        revenue: byId.get(item.menuItemId)?.revenue,
      });
    }
    const qtys = (res.body.data as { qty: number }[]).map((i) => i.qty);
    expect(qtys).toEqual([...qtys].sort((a, b) => b - a));
  });

  it('keeps a renamed dish as one row (grouped by id, M11-S4)', async () => {
    const top = fixture.topItems[0]!;
    await prisma().orderItem.updateMany({
      where: { menuItemId: top.menuItemId, lineNo: 1 },
      data: { nameSnapshot: 'Renamed Dish' },
    });
    clearReportCache();
    const res = await get(`/reports/top-items?${range()}&limit=50`);
    const rows = (res.body.data as { menuItemId: string; qty: number }[]).filter(
      (i) => i.menuItemId === top.menuItemId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.qty).toBe(top.qty);
  });

  it('reports peak hours in restaurant-local time (M11-S5, AC-16)', async () => {
    const res = await get(`/reports/peak-hours?${range()}`);
    const expected = Object.entries(fixture.peakHours)
      .map(([hour, orders]) => ({ hour: Number(hour), orders }))
      .sort((a, b) => a.hour - b.hour);
    expect(res.body.data).toEqual(expected);
  });

  it('breaks net sales down by type and collected money by method from payment records', async () => {
    const res = await get(`/reports/breakdowns?${range()}`);
    const byType = Object.fromEntries(
      (res.body.byType as { type: string; netSales: number }[]).map((r) => [r.type, r.netSales]),
    );
    for (const [type, net] of Object.entries(fixture.byType)) {
      expect(byType[type] ?? 0).toBe(net);
    }
    const byMethod = Object.fromEntries(
      (res.body.byMethod as { method: string; collected: number; tips: number }[]).map((r) => [
        r.method,
        r,
      ]),
    );
    for (const [method, m] of Object.entries(fixture.byMethod)) {
      expect(byMethod[method]).toMatchObject({ collected: m.collected, tips: m.tips });
    }
  });

  it('lists cancellations with their reasons and refunds, outside the revenue scope', async () => {
    const res = await get(`/reports/cancellations?${range()}`);
    expect(res.body.cancelled).toHaveLength(fixture.totals.cancelled);
    expect(
      res.body.cancelled.every((c: { reason: string | null }) => typeof c.reason === 'string'),
    ).toBe(true);
    expect(res.body.refunded).toHaveLength(fixture.totals.refunded);
  });

  it('serves the dashboard for today and refuses reports to non-admins', async () => {
    const dash = await get('/dashboard/today');
    expect(dash.status).toBe(200);
    expect(dash.body.tables).toEqual({ free: 14, seated: 0, dirty: 0 });
    expect(dash.body).toHaveProperty('unavailableItems');

    const staff = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'staff@forkandflame.test', password: 'password123' });
    const denied = await request(app)
      .get(`/api/v1/reports/summary?${range()}`)
      .set('Authorization', `Bearer ${staff.body.accessToken as string}`);
    expect(denied.status).toBe(403);
  });

  it('validates the range', async () => {
    expect((await get('/reports/summary?from=2026-09-10&to=2026-09-01')).status).toBe(400);
    expect((await get('/reports/summary?from=bad&to=2026-09-01')).status).toBe(400);
  });
});
