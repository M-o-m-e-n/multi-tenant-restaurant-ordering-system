import { randomUUID } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';
import {
  bps,
  computeTotals,
  type OrderStatus,
  type OrderType,
  type PaymentMethod,
  type PricingDiscount,
  type Settings,
} from '@ros/shared';

import { addDays, businessDateOf, dateOnly, zonedTimeToUtc } from '../../src/lib/time';
import type { SeedDish, SeedMenu } from './reference';

/** Deterministic PRNG so the same seed run produces the same history (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const chance = (p: number): boolean => next() < p;
  function pick<T>(list: readonly T[]): T {
    const item = list[Math.floor(next() * list.length)];
    if (item === undefined) throw new Error('pick from empty list');
    return item;
  }
  function weighted<T extends { weight: number }>(list: readonly T[]): T {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let r = next() * total;
    for (const x of list) {
      r -= x.weight;
      if (r <= 0) return x;
    }
    return pick(list);
  }
  return { next, int, chance, pick, weighted };
}

const GUEST_NAMES = [
  'Noah Carter',
  'Lina Haddad',
  'Mateo Rossi',
  'Priya Nair',
  'Omar Farouk',
  'Chloe Martin',
  'Kenji Sato',
  'Amara Obi',
  'Lucas Silva',
  'Sofia Novak',
];
const CANCEL_REASONS = ['Changed my mind', 'Ordered twice', 'Took too long', 'Wrong table'];

interface DayFixture {
  businessDate: string;
  orders: number;
  netSales: number;
  taxCollected: number;
  serviceCharge: number;
  deliveryFees: number;
  tips: number;
  cancelled: number;
  refunded: number;
  topItems: { menuItemId: string; name: string; qty: number; revenue: number }[];
}

/**
 * The figures the seed guarantees, computed from the generated data rather
 * than read back with SQL, so report tests are not report SQL checking
 * report SQL (AC-9). Scope follows BR-16: not cancelled, not refunded.
 */
export interface SeedFixture {
  timezone: string;
  from: string;
  to: string;
  totals: Omit<DayFixture, 'businessDate' | 'topItems'> & { aov: number };
  days: DayFixture[];
  topItems: DayFixture['topItems'];
  byType: Record<OrderType, number>;
  byMethod: Record<PaymentMethod, { collected: number; tips: number }>;
  peakHours: Record<string, number>;
}

interface Refs {
  users: { admin: { id: string }; staff: { id: string }; guest: { id: string } };
  menu: SeedMenu;
  tables: { id: string }[];
}

/** Choose modifiers that satisfy each group's minSelect/maxSelect. */
function chooseModifiers(dish: SeedDish, r: ReturnType<typeof rng>) {
  return dish.groups
    .map((g) => {
      const wanted = g.minSelect > 0 ? g.minSelect : r.chance(0.3) ? r.int(1, g.maxSelect) : 0;
      const pool = [...g.items];
      const chosen = [];
      for (let i = 0; i < wanted && pool.length > 0; i++) {
        chosen.push(...pool.splice(r.int(0, pool.length - 1), 1));
      }
      return { groupId: g.id, groupName: g.name, items: chosen };
    })
    .filter((g) => g.items.length > 0);
}

export async function seedHistory(
  prisma: PrismaClient,
  refs: Refs,
  settings: Settings,
  opts: { days: number; seed: number; now?: Date },
): Promise<SeedFixture> {
  const r = rng(opts.seed);
  const tz = settings.timezone;
  const today = businessDateOf(opts.now ?? new Date(), tz);
  const from = addDays(today, -opts.days);
  const to = addDays(today, -1);
  const ctx = {
    taxBps: settings.taxBps,
    serviceChargeBps: settings.serviceChargeBps,
    serviceChargeTaxable: settings.serviceChargeTaxable,
    deliveryFee: settings.deliveryFee,
  };
  const staffId = refs.users.staff.id;

  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const events: Prisma.OrderEventCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const deliveries: Prisma.DeliveryCreateManyInput[] = [];
  const sequences: Prisma.OrderSequenceCreateManyInput[] = [];

  const days: DayFixture[] = [];
  const itemTotals = new Map<
    string,
    { menuItemId: string; name: string; qty: number; revenue: number }
  >();
  const byType: SeedFixture['byType'] = { DINE_IN: 0, TAKEAWAY: 0, DELIVERY: 0 };
  const byMethod: SeedFixture['byMethod'] = {
    STRIPE: { collected: 0, tips: 0 },
    CASH: { collected: 0, tips: 0 },
  };
  const peakHours: Record<string, number> = {};

  for (let dayIndex = 0; dayIndex < opts.days; dayIndex++) {
    const date = addDays(from, dayIndex);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const count = r.int(18, 30) + (weekday === 5 || weekday === 6 ? 10 : 0);
    const day: DayFixture = {
      businessDate: date,
      orders: 0,
      netSales: 0,
      taxCollected: 0,
      serviceCharge: 0,
      deliveryFees: 0,
      tips: 0,
      cancelled: 0,
      refunded: 0,
      topItems: [],
    };
    const dayItems = new Map<string, DayFixture['topItems'][number]>();

    for (let n = 1; n <= count; n++) {
      const orderId = randomUUID();
      const type: OrderType = r.weighted([
        { v: 'DINE_IN' as const, weight: 60 },
        { v: 'TAKEAWAY' as const, weight: 25 },
        { v: 'DELIVERY' as const, weight: 15 },
      ]).v;
      const hour = r.chance(0.4) ? r.int(11, 14) : r.int(17, 22);
      const placedAt = zonedTimeToUtc(date, hour, r.int(0, 59), tz);

      const lines = Array.from({ length: r.int(1, 4) }, () => {
        const dish = r.weighted(refs.menu.dishes);
        const modifiers = chooseModifiers(dish, r);
        const deltas = modifiers.flatMap((g) => g.items.map((i) => i.priceDelta));
        return { dish, qty: r.chance(0.2) ? 2 : 1, modifiers, deltas };
      });

      const discount: PricingDiscount | null = r.chance(0.1)
        ? { type: 'PERCENT', value: 1000 }
        : null;
      const tipPct = type !== 'DELIVERY' && r.chance(0.4) ? r.pick(settings.tipPresetsBps) : 0;
      const preTip = computeTotals({
        orderType: type,
        lines: lines.map((l) => ({
          menuItemId: l.dish.id,
          unitPrice: l.dish.price,
          qty: l.qty,
          modifierDeltas: l.deltas,
        })),
        discount,
        ctx,
      });
      const tipAmount = bps(preTip.totals.subtotal, tipPct);
      const { totals, lines: priced } = computeTotals({
        orderType: type,
        lines: lines.map((l) => ({
          menuItemId: l.dish.id,
          unitPrice: l.dish.price,
          qty: l.qty,
          modifierDeltas: l.deltas,
        })),
        discount,
        tipAmount,
        ctx,
      });

      const cancelled = r.chance(0.05);
      const status: OrderStatus = cancelled ? 'CANCELLED' : 'COMPLETED';
      // One in three cancelled orders was paid first and refunded (AC-13); 2% of completed are refunded.
      const paid = cancelled ? r.chance(0.33) : true;
      const refunded = paid && (cancelled || r.chance(0.02));
      const method: PaymentMethod = r.chance(0.6) ? 'STRIPE' : 'CASH';
      const cashTip = method === 'CASH' && !refunded && r.chance(0.25) ? r.int(1, 5) * 100 : 0;
      const guest = type === 'DINE_IN' && r.chance(0.5) ? null : r.pick(GUEST_NAMES);
      const online = r.chance(0.6);

      // Timeline: each step a few minutes after the last, in canonical order (BR-12).
      let t = placedAt.getTime();
      const step = (min: number, max: number): Date => {
        t += r.int(min, max) * 60_000;
        return new Date(t);
      };
      events.push({
        orderId,
        fromStatus: null,
        toStatus: 'PLACED',
        actorId: null,
        createdAt: placedAt,
      });
      let completedAt: Date | null = null;
      if (cancelled) {
        const fromStatus = r.chance(0.5) ? 'PLACED' : 'CONFIRMED';
        if (fromStatus === 'CONFIRMED') {
          events.push({
            orderId,
            fromStatus: 'PLACED',
            toStatus: 'CONFIRMED',
            actorId: staffId,
            createdAt: step(1, 3),
          });
        }
        events.push({
          orderId,
          fromStatus,
          toStatus: 'CANCELLED',
          actorId: r.chance(0.5) ? staffId : null,
          reason: r.pick(CANCEL_REASONS),
          createdAt: step(1, 5),
        });
      } else {
        const chain: [OrderStatus, OrderStatus, number, number][] = [
          ['PLACED', 'CONFIRMED', 1, 3],
          ['CONFIRMED', 'PREPARING', 1, 4],
          ['PREPARING', 'READY', 6, 18],
          ['READY', 'SERVED', 1, 5],
          ['SERVED', 'COMPLETED', 15, 45],
        ];
        for (const [fromS, toS, min, max] of chain) {
          events.push({
            orderId,
            fromStatus: fromS,
            toStatus: toS,
            actorId: staffId,
            createdAt: step(min, max),
          });
        }
        completedAt = new Date(t);
      }

      orders.push({
        id: orderId,
        orderNumber: `${settings.orderNumberPrefix}-${1000 + n}`,
        businessDate: dateOnly(date),
        type,
        status,
        tableId: type === 'DINE_IN' ? r.pick(refs.tables).id : null,
        userId: online ? refs.users.guest.id : null,
        customerName: guest ?? (type === 'DINE_IN' ? null : 'Walk-in'),
        customerPhone: guest ? `+1555${String(r.int(1000000, 9999999))}` : null,
        ...totals,
        discountCode: discount ? 'SAVE10' : null,
        taxBps: ctx.taxBps,
        serviceChargeBps: ctx.serviceChargeBps,
        serviceChargeTaxable: ctx.serviceChargeTaxable,
        discountType: discount?.type ?? null,
        discountValue: discount?.value ?? null,
        paymentStatus: refunded ? 'REFUNDED' : paid ? 'PAID' : 'UNPAID',
        placedAt,
        updatedAt: new Date(t),
        completedAt,
      });

      lines.forEach((l, i) => {
        items.push({
          orderId,
          menuItemId: l.dish.id,
          nameSnapshot: l.dish.name,
          unitPrice: l.dish.price,
          qty: l.qty,
          modifiersJson: l.modifiers.map((g) => ({
            groupId: g.groupId,
            groupName: g.groupName,
            items: g.items.map((i) => ({ id: i.id, name: i.name, priceDelta: i.priceDelta })),
          })),
          modifierTotal: l.deltas.reduce((s, d) => s + d, 0),
          lineTotal: priced[i]?.lineTotal ?? 0,
          station: l.dish.station,
          addedAt: placedAt,
        });
      });

      if (type === 'DELIVERY') {
        deliveries.push({
          orderId,
          address: `${r.int(1, 240)} Harbor Street`,
          driverName: cancelled ? null : r.pick(['Dev', 'Rui', 'Ines']),
          status: cancelled ? 'PENDING' : 'DELIVERED',
        });
      }

      if (paid && totals.total > 0) {
        payments.push({
          orderId,
          method,
          amount: totals.total,
          tipAmount: cashTip,
          state: refunded ? 'REFUNDED' : 'SUCCEEDED',
          stripePaymentIntentId: method === 'STRIPE' ? `pi_seed_${orderId.slice(0, 18)}` : null,
          actorId: method === 'CASH' ? staffId : null,
          createdAt: completedAt ?? new Date(t),
        });
        // Collected by method nets refunds out (BR-16, LLD §4.8 collectedByMethod).
        if (!refunded) {
          byMethod[method].collected += totals.total;
          byMethod[method].tips += cashTip;
        }
      }

      if (cancelled) day.cancelled++;
      if (refunded) day.refunded++;
      if (cancelled || refunded) continue;

      // In scope for revenue (BR-16).
      const net = totals.subtotal - totals.discountAmount;
      day.orders++;
      day.netSales += net;
      day.taxCollected += totals.taxAmount;
      day.serviceCharge += totals.serviceCharge;
      day.deliveryFees += totals.deliveryFee;
      day.tips += totals.tipAmount;
      byType[type] += net;
      const localHour = String(hour);
      peakHours[localHour] = (peakHours[localHour] ?? 0) + 1;
      lines.forEach((l, i) => {
        const revenue = priced[i]?.lineTotal ?? 0;
        for (const map of [dayItems, itemTotals]) {
          const row = map.get(l.dish.id) ?? {
            menuItemId: l.dish.id,
            name: l.dish.name,
            qty: 0,
            revenue: 0,
          };
          row.qty += l.qty;
          row.revenue += revenue;
          map.set(l.dish.id, row);
        }
      });
    }

    day.topItems = [...dayItems.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
    days.push(day);
    sequences.push({ businessDate: dateOnly(date), lastValue: 1000 + count });
  }

  await prisma.order.createMany({ data: orders });
  for (let i = 0; i < items.length; i += 1000) {
    await prisma.orderItem.createMany({ data: items.slice(i, i + 1000) });
  }
  for (let i = 0; i < events.length; i += 1000) {
    await prisma.orderEvent.createMany({ data: events.slice(i, i + 1000) });
  }
  await prisma.payment.createMany({ data: payments });
  await prisma.delivery.createMany({ data: deliveries });
  await prisma.orderSequence.createMany({ data: sequences });

  const sum = (k: keyof Omit<DayFixture, 'businessDate' | 'topItems'>): number =>
    days.reduce((s, d) => s + d[k], 0);
  const totalOrders = sum('orders');
  const netSales = sum('netSales');
  return {
    timezone: tz,
    from,
    to,
    totals: {
      orders: totalOrders,
      netSales,
      taxCollected: sum('taxCollected'),
      serviceCharge: sum('serviceCharge'),
      deliveryFees: sum('deliveryFees'),
      tips: sum('tips'),
      cancelled: sum('cancelled'),
      refunded: sum('refunded'),
      aov: totalOrders ? Math.round(netSales / totalOrders) : 0,
    },
    days,
    topItems: [...itemTotals.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
    byType,
    byMethod,
    peakHours,
  };
}
