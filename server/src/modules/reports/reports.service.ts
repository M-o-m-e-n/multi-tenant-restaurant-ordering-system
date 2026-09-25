import type {
  Breakdowns,
  Cancellations,
  DashboardToday,
  PeakHour,
  RevenueDay,
  SalesSummary,
  TopItem,
} from '@ros/shared';

import { businessDateOf } from '../../lib/time';
import { unavailableItems } from '../menu';
import { getSettings } from '../settings';
import * as repo from './reports.repo';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();

/** 60 s cache per (report, from, to, …) key (M11-S10, LLD §4.8). */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearReportCache(): void {
  cache.clear();
}

export function salesSummary(from: string, to: string): Promise<SalesSummary> {
  return cached(`summary|${from}|${to}`, async () => {
    const s = await repo.summary(from, to);
    // Average order value in whole cents, rounded half up (net sales / orders).
    const aov = s.orders === 0 ? 0 : Math.floor((s.netSales * 2 + s.orders) / (2 * s.orders));
    return { ...s, aov };
  });
}

export function revenueByDay(from: string, to: string): Promise<RevenueDay[]> {
  return cached(`byDay|${from}|${to}`, () => repo.revenueByDay(from, to));
}

export function topItems(
  from: string,
  to: string,
  limit: number,
  metric: 'qty' | 'revenue',
): Promise<TopItem[]> {
  return cached(`top|${from}|${to}|${limit}|${metric}`, () =>
    repo.topItems(from, to, limit, metric),
  );
}

export async function peakHours(from: string, to: string): Promise<PeakHour[]> {
  const { timezone } = await getSettings();
  return cached(`peak|${from}|${to}|${timezone}`, () => repo.peakHours(from, to, timezone));
}

export function breakdowns(from: string, to: string): Promise<Breakdowns> {
  return cached(`breakdowns|${from}|${to}`, async () => ({
    byType: await repo.salesByType(from, to),
    byMethod: await repo.collectedByMethod(from, to),
  }));
}

export function cancellations(from: string, to: string): Promise<Cancellations> {
  return cached(`cancellations|${from}|${to}`, () => repo.cancellations(from, to));
}

/** Today's numbers, scoped to the current business date (ADM-01, M11-S11). Not cached: it is the live view. */
export async function dashboardToday(now = new Date()): Promise<DashboardToday> {
  const { timezone } = await getSettings();
  const today = businessDateOf(now, timezone);
  const [summary, activeTickets, tables, unavailable] = await Promise.all([
    repo.summary(today, today),
    repo.activeTickets(today),
    repo.tableCounts(),
    unavailableItems(),
  ]);
  return {
    businessDate: today,
    orders: summary.orders,
    netSales: summary.netSales,
    activeTickets,
    tables,
    unavailableItems: unavailable,
  };
}
