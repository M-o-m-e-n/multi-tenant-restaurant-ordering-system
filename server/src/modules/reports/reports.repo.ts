import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { dateOnly } from '../../lib/time';

/**
 * Raw SQL for the report aggregates (LLD §4.8). Every identifier is quoted,
 * because Prisma keeps mixed-case names (\`FROM "Order"\`, never \`from orders\`),
 * and every value is a bound parameter (NFR-S6, M11-S9).
 */

/**
 * The one revenue definition (BR-16), written once and used by every revenue
 * query: not cancelled, not refunded, within the business-date range. Never
 * inline a variant of this (M11-S1).
 */
export function scope(from: string, to: string): Prisma.Sql {
  return Prisma.sql`o."status" <> 'CANCELLED'
    AND o."paymentStatus" <> 'REFUNDED'
    AND o."businessDate" BETWEEN ${dateOnly(from)}::date AND ${dateOnly(to)}::date`;
}

/** Postgres returns SUM and COUNT as bigint; money here fits a JS number comfortably. */
const n = (v: bigint | number | null | undefined): number =>
  v === null || v === undefined ? 0 : Number(v);

export async function summary(from: string, to: string) {
  const [row] = await prisma().$queryRaw<
    {
      orders: bigint;
      netSales: bigint | null;
      tax: bigint | null;
      service: bigint | null;
      delivery: bigint | null;
      tips: bigint | null;
    }[]
  >`
    SELECT count(*) AS "orders",
           sum(o."subtotal" - o."discountAmount") AS "netSales",
           sum(o."taxAmount") AS "tax",
           sum(o."serviceCharge") AS "service",
           sum(o."deliveryFee") AS "delivery",
           sum(o."tipAmount") AS "tips"
      FROM "Order" o
     WHERE ${scope(from, to)}`;
  return {
    orders: n(row?.orders),
    netSales: n(row?.netSales),
    taxCollected: n(row?.tax),
    serviceCharge: n(row?.service),
    deliveryFees: n(row?.delivery),
    tips: n(row?.tips),
  };
}

/** Grouped on the stored business date — never date_trunc on a timestamp, which buckets by UTC (M11-S3). */
export async function revenueByDay(from: string, to: string) {
  const rows = await prisma().$queryRaw<{ d: Date; netSales: bigint; orders: bigint }[]>`
    SELECT o."businessDate" AS "d",
           sum(o."subtotal" - o."discountAmount") AS "netSales",
           count(*) AS "orders"
      FROM "Order" o
     WHERE ${scope(from, to)}
     GROUP BY o."businessDate"
     ORDER BY o."businessDate"`;
  return rows.map((r) => ({
    businessDate: r.d.toISOString().slice(0, 10),
    netSales: n(r.netSales),
    orders: n(r.orders),
  }));
}

/** Grouped by menu item id, the name carried for display only, so a rename never splits history (M11-S4). */
export async function topItems(from: string, to: string, limit: number, metric: 'qty' | 'revenue') {
  const order =
    metric === 'qty'
      ? Prisma.sql`"qty" DESC, "revenue" DESC`
      : Prisma.sql`"revenue" DESC, "qty" DESC`;
  const rows = await prisma().$queryRaw<
    { id: string | null; name: string; qty: bigint; revenue: bigint }[]
  >`
    SELECT oi."menuItemId" AS "id",
           max(oi."nameSnapshot") AS "name",
           sum(oi."qty") AS "qty",
           sum(oi."lineTotal") AS "revenue"
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
     WHERE ${scope(from, to)}
     GROUP BY oi."menuItemId"
     ORDER BY ${order}
     LIMIT ${limit}`;
  return rows.map((r) => ({
    menuItemId: r.id,
    name: r.name,
    qty: n(r.qty),
    revenue: n(r.revenue),
  }));
}

/** Hour of day in the restaurant's timezone, or every bar shifts by the UTC offset (M11-S5, AC-16). */
export async function peakHours(from: string, to: string, timezone: string) {
  const rows = await prisma().$queryRaw<{ h: number; orders: bigint }[]>`
    SELECT extract(hour FROM (o."placedAt" AT TIME ZONE ${timezone}))::int AS "h",
           count(*) AS "orders"
      FROM "Order" o
     WHERE ${scope(from, to)}
     GROUP BY 1
     ORDER BY 1`;
  return rows.map((r) => ({ hour: r.h, orders: n(r.orders) }));
}

export async function salesByType(from: string, to: string) {
  const rows = await prisma().$queryRaw<
    { type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'; netSales: bigint; orders: bigint }[]
  >`
    SELECT o."type" AS "type",
           sum(o."subtotal" - o."discountAmount") AS "netSales",
           count(*) AS "orders"
      FROM "Order" o
     WHERE ${scope(from, to)}
     GROUP BY o."type"
     ORDER BY 2 DESC`;
  return rows.map((r) => ({ type: r.type, netSales: n(r.netSales), orders: n(r.orders) }));
}

/**
 * Money actually collected, by method, from payment records rather than order
 * totals (BR-16, M11-S7). A refund moves a payment from SUCCEEDED to REFUNDED,
 * so counting only SUCCEEDED records is already net of refunds.
 */
export async function collectedByMethod(from: string, to: string) {
  const rows = await prisma().$queryRaw<
    { method: 'STRIPE' | 'CASH'; collected: bigint; tips: bigint }[]
  >`
    SELECT p."method" AS "method",
           coalesce(sum(p."amount"), 0) AS "collected",
           coalesce(sum(p."tipAmount"), 0) AS "tips"
      FROM "Payment" p
      JOIN "Order" o ON o."id" = p."orderId"
     WHERE p."state" = 'SUCCEEDED'
       AND o."businessDate" BETWEEN ${dateOnly(from)}::date AND ${dateOnly(to)}::date
     GROUP BY p."method"
     ORDER BY 1`;
  return rows.map((r) => ({ method: r.method, collected: n(r.collected), tips: n(r.tips) }));
}

/** Cancellations and refunds, deliberately outside the revenue scope (RPT-06, M11-S8). */
export async function cancellations(from: string, to: string) {
  const range = Prisma.sql`o."businessDate" BETWEEN ${dateOnly(from)}::date AND ${dateOnly(to)}::date`;
  const cancelled = await prisma().$queryRaw<
    { id: string; num: string; d: Date; reason: string | null; at: Date }[]
  >`
    SELECT o."id", o."orderNumber" AS "num", o."businessDate" AS "d", e."reason", e."createdAt" AS "at"
      FROM "Order" o
      JOIN LATERAL (
        SELECT ev."reason", ev."createdAt" FROM "OrderEvent" ev
         WHERE ev."orderId" = o."id" ORDER BY ev."createdAt" DESC LIMIT 1
      ) e ON true
     WHERE o."status" = 'CANCELLED' AND ${range}
     ORDER BY e."createdAt" DESC`;
  const refunded = await prisma().$queryRaw<{ id: string; num: string; d: Date; amount: bigint }[]>`
    SELECT o."id", o."orderNumber" AS "num", o."businessDate" AS "d",
           coalesce((SELECT sum(p."amount") FROM "Payment" p WHERE p."orderId" = o."id" AND p."state" = 'REFUNDED'), 0) AS "amount"
      FROM "Order" o
     WHERE o."paymentStatus" = 'REFUNDED' AND ${range}
     ORDER BY o."businessDate" DESC, o."orderNumber"`;
  return {
    cancelled: cancelled.map((r) => ({
      orderId: r.id,
      orderNumber: r.num,
      businessDate: r.d.toISOString().slice(0, 10),
      reason: r.reason,
      at: r.at.toISOString(),
    })),
    refunded: refunded.map((r) => ({
      orderId: r.id,
      orderNumber: r.num,
      businessDate: r.d.toISOString().slice(0, 10),
      amount: n(r.amount),
    })),
  };
}

export async function activeTickets(businessDate: string): Promise<number> {
  return prisma().order.count({
    where: {
      businessDate: dateOnly(businessDate),
      status: { in: ['PLACED', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED'] },
    },
  });
}

export async function tableCounts() {
  const rows = await prisma().table.groupBy({
    by: ['status'],
    where: { isActive: true },
    _count: true,
  });
  const get = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  return { free: get('FREE'), seated: get('SEATED'), dirty: get('DIRTY') };
}
