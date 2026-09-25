import {
  canTransition,
  type CreateOrderDto,
  type ListOrdersQuery,
  type OrderDto,
  type OrderEventDto,
  type OrderStatus,
  type Paginated,
  type PreviewOrderDto,
  type PreviewResponse,
} from '@ros/shared';

import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { publish } from '../../lib/events';
import { type IdempotencyContext, requestHash, withIdempotency } from '../../lib/idempotency';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { businessDateOf, dateOnly } from '../../lib/time';
import type { AuthUser } from '../../types/express';
import { redeem } from '../discounts';
import { getSettings } from '../settings';
import { seatByToken, tableSeated } from '../tables';
import { toOrderDto } from './orders.dto';
import { priceCart } from './orders.pricing';
import * as repo from './orders.repo';

/**
 * Authoritative totals without persisting anything (CART-06). Public, so a
 * guest sees real totals before signing in; the client computes the same
 * figures locally and the two must agree to the cent (AC-4).
 */
export async function previewCart(dto: PreviewOrderDto): Promise<PreviewResponse> {
  const settings = await getSettings();
  const priced = await priceCart(dto, settings);
  return {
    totals: { ...priced.totals, currency: settings.currency },
    lines: priced.lines.map((l) => ({ menuItemId: l.menuItemId, lineTotal: l.lineTotal })),
    discount: priced.discount ? { code: priced.discount.code, ...priced.discount.pricing } : null,
  };
}

const notFound = () => new NotFoundError('ORDER_NOT_FOUND', 'No such order.');

/** Announce a committed order to the kitchen, the tills, admin and its owner (LLD §6.2). */
function announceNew(order: OrderDto): void {
  publish('order:new', order, { rooms: ['kitchen', 'pos', 'admin'] });
  publish(
    'order:status',
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      from: null,
      to: order.status,
      at: order.placedAt,
      order,
    },
    { rooms: [`customer:${order.id}`] },
  );
}

/**
 * Place an order: **one transaction**, LLD §4.4 steps 1–10. Nothing is written
 * unless every step succeeds (NFR-R1), and events are published only after
 * commit (HLD §8.2).
 *
 * @throws ConflictError ITEM_UNAVAILABLE | TABLE_DIRTY
 * @throws BusinessRuleError EMPTY_CART | ZERO_TOTAL | INVALID_MODIFIER_SELECTION |
 *   DISCOUNT_* | IDEMPOTENCY_KEY_REUSED
 */
export async function createOrder(
  dto: CreateOrderDto,
  actor: AuthUser,
  opts: { idempotencyKey?: string | undefined; now?: Date } = {},
): Promise<{ status: number; body: OrderDto; replayed: boolean }> {
  const settings = await getSettings();
  const now = opts.now ?? new Date();
  const isStaff = actor.role !== 'CUSTOMER';
  let seatedTable: Parameters<typeof tableSeated>[0] | null = null;

  // (1) Claim the Idempotency-Key; a repeat replays the stored response (NFR-R5).
  const idem: IdempotencyContext | null = opts.idempotencyKey
    ? {
        key: opts.idempotencyKey,
        userId: actor.id,
        endpoint: 'POST /orders',
        hash: requestHash(dto),
      }
    : null;

  const result = await withIdempotency(idem, async (tx) => {
    // (2) Dine-in: the table comes from the QR token, never from the body (AC-12).
    // (9) Seating it here attaches the order to the table session.
    let tableId: string | null = null;
    if (dto.type === 'DINE_IN' && dto.tableToken) {
      const { table, seated } = await seatByToken(dto.tableToken, tx);
      tableId = table.id;
      if (seated) seatedTable = table;
    }

    // (3)(4)(6) Re-read prices and availability, re-resolve modifiers, price.
    const priced = await priceCart(dto, settings, { db: tx, now });
    if (priced.totals.total <= 0) {
      throw new BusinessRuleError(
        'ZERO_TOTAL',
        'This order comes to nothing; add an item to continue.',
      );
    }

    // (5) Count the redemption atomically; losing the race rolls everything back.
    if (priced.discount) await redeem(priced.discount.id, tx);

    // (7) Business date in the restaurant timezone, and the day's next number (BR-15).
    const businessDate = dateOnly(businessDateOf(now, settings.timezone));
    const n = await repo.allocateOrderNumber(tx, businessDate);

    // (8) Order, snapshotted lines, and the first audit event.
    const order = await repo.insertOrder(tx, {
      orderNumber: `${settings.orderNumberPrefix}-${n}`,
      businessDate,
      type: dto.type,
      tableId,
      // A staff-placed counter order has no owning account (LLD §1).
      userId: isStaff ? null : actor.id,
      customerName: dto.customer?.name ?? (isStaff ? null : actor.name),
      customerPhone: dto.customer?.phone ?? null,
      ...priced.totals,
      discountCode: priced.discount?.code ?? null,
      discountType: priced.discount?.pricing.type ?? null,
      discountValue: priced.discount?.pricing.value ?? null,
      taxBps: priced.ctx.taxBps,
      serviceChargeBps: priced.ctx.serviceChargeBps,
      serviceChargeTaxable: priced.ctx.serviceChargeTaxable,
      currency: settings.currency,
      notes: dto.notes ?? null,
      placedAt: now,
    });
    await repo.insertItems(
      tx,
      priced.lines.map((l, i) => ({
        orderId: order.id,
        lineNo: i + 1,
        menuItemId: l.menuItemId,
        nameSnapshot: l.nameSnapshot,
        unitPrice: l.unitPrice,
        qty: l.qty,
        modifiersJson: l.modifiers.map((g) => ({
          groupId: g.groupId,
          groupName: g.groupName,
          items: g.items.map((i) => ({ id: i.id, name: i.name, priceDelta: i.priceDelta })),
        })),
        modifierTotal: l.modifierTotal,
        lineTotal: l.lineTotal,
        notes: l.notes,
        station: l.station,
        addedAt: now,
      })),
    );
    await repo.insertEvent(tx, {
      orderId: order.id,
      fromStatus: null,
      toStatus: 'PLACED',
      actorId: isStaff ? actor.id : null,
      createdAt: now,
    });
    if (dto.type === 'DELIVERY' && dto.delivery) {
      await repo.insertDelivery(tx, {
        orderId: order.id,
        address: dto.delivery.address,
        addressNote: dto.delivery.note ?? null,
      });
    }

    // (10) The response the idempotency layer stores with the key.
    const full = await repo.findOrder(order.id, tx);
    if (!full) throw new Error('order vanished inside its own transaction');
    return { status: 201, body: toOrderDto(full, actor) };
  });

  // After commit only (HLD §8.2). A replay announces nothing: it already happened.
  if (!result.replayed) {
    if (seatedTable) tableSeated(seatedTable);
    announceNew(result.body);
  }
  return result;
}

/** Load an order the caller may see; a customer's view of someone else's is a 404 (NFR-S9). */
async function visibleOrder(id: string, viewer: AuthUser) {
  const order = await repo.findOrder(id);
  if (!order) throw notFound();
  if (viewer.role === 'CUSTOMER' && order.userId !== viewer.id) throw notFound();
  return order;
}

export async function getOrder(id: string, viewer: AuthUser): Promise<OrderDto> {
  return toOrderDto(await visibleOrder(id, viewer), viewer);
}

/** Customers see their own orders; staff see all, filtered (ORD-07, ORD-08). */
export async function listOrders(
  q: ListOrdersQuery,
  viewer: AuthUser,
): Promise<Paginated<OrderDto>> {
  const { rows, total } = await repo.listOrders(
    {
      ...(viewer.role === 'CUSTOMER' ? { userId: viewer.id } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.tableId ? { tableId: q.tableId } : {}),
      ...(q.from ? { from: dateOnly(q.from) } : {}),
      ...(q.to ? { to: dateOnly(q.to) } : {}),
    },
    q.page,
    q.limit,
  );
  return {
    data: rows.map((o) => toOrderDto(o, viewer)),
    meta: { page: q.page, limit: q.limit, total },
  };
}

export async function listEvents(id: string, viewer: AuthUser): Promise<OrderEventDto[]> {
  await visibleOrder(id, viewer);
  const events = await repo.listEvents(id);
  return events.map((e) => ({
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    actor: e.actor,
    reason: e.reason,
    at: e.createdAt.toISOString(),
  }));
}

/**
 * Move an order one legal step: **one transaction** holding the conditional
 * update and its OrderEvent, so the audit trail can never disagree with the
 * status (ORD-02, ORD-04, NFR-R3). The edge's role gate decides who may take
 * it (LLD §3.1); the conditional update decides races (R9).
 *
 * @throws ConflictError ILLEGAL_TRANSITION | CONCURRENT_UPDATE
 */
export async function transitionStatus(
  id: string,
  to: OrderStatus,
  actor: AuthUser,
  reason?: string | null,
): Promise<OrderDto> {
  const { from, after } = await prisma().$transaction(async (tx) => {
    const order = await repo.findOrder(id, tx);
    if (!order) throw notFound();
    if (actor.role === 'CUSTOMER' && order.userId !== actor.id) throw notFound();
    const current = order.status;

    if (!canTransition(current, to, actor.role)) {
      // AC-3: rejected with 409 and logged.
      logger().warn(
        { orderId: id, from: current, to, actorId: actor.id, role: actor.role },
        'illegal transition refused',
      );
      throw new ConflictError(
        'ILLEGAL_TRANSITION',
        `An order cannot go from ${current} to ${to}.`,
        {
          from: current,
          to,
        },
      );
    }
    if (!(await repo.moveStatus(tx, id, current, to))) {
      throw new ConflictError('CONCURRENT_UPDATE', 'Someone else updated this order first.');
    }
    await repo.insertEvent(tx, {
      orderId: id,
      fromStatus: current,
      toStatus: to,
      actorId: actor.role === 'CUSTOMER' ? null : actor.id,
      reason: reason ?? null,
    });
    const updated = await repo.findOrder(id, tx);
    if (!updated) throw notFound();
    return { from: current, after: updated };
  });

  const dto = toOrderDto(after, actor);
  publish(
    'order:status',
    {
      orderId: id,
      orderNumber: after.orderNumber,
      from,
      to,
      at: new Date().toISOString(),
      order: dto,
    },
    { rooms: ['kitchen', 'pos', 'admin', `customer:${id}`] },
  );
  if (to === 'CANCELLED') {
    publish(
      'order:removed',
      { orderId: id, reason: reason ?? null },
      { rooms: ['kitchen', 'pos'] },
    );
  }
  return dto;
}

/**
 * Cancellation delegates to the state machine: the edge's own role gate
 * allows a customer only from PLACED or CONFIRMED (ORD-09, BR-06).
 */
export function cancelOrder(id: string, actor: AuthUser, reason?: string): Promise<OrderDto> {
  return transitionStatus(id, 'CANCELLED', actor, reason ?? null);
}
