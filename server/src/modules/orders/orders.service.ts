import {
  AMENDABLE_ORDER_STATUSES,
  type AppendItemsDto,
  canAdvanceDelivery,
  canAssignDriver,
  canTransition,
  computeTotals,
  type CreateOrderDto,
  type DeliveryStatus,
  derivePaymentStatus,
  type ListOrdersQuery,
  type OrderDto,
  type OrderEventDto,
  type OrderStatus,
  type Paginated,
  paidSum,
  type PaymentStatus,
  type PreviewOrderDto,
  type PreviewResponse,
  type ReceiptDto,
  type UpdateDeliveryDto,
} from '@ros/shared';

import { writeAudit } from '../../lib/audit';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../lib/errors';
import { publish } from '../../lib/events';
import { type IdempotencyContext, requestHash, withIdempotency } from '../../lib/idempotency';
import { logger } from '../../lib/logger';
import { prisma, type Tx } from '../../lib/prisma';
import { businessDateOf, dateOnly } from '../../lib/time';
import type { AuthUser } from '../../types/express';
import { redeem } from '../discounts';
import { getSettings } from '../settings';
import { seatByToken, tableSeated } from '../tables';
import { toOrderDto } from './orders.dto';
import { priceCart, resolveLines, toCartLine } from './orders.pricing';
import type { OrderWithRelations } from './orders.repo';
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

/** How staff screens see an order: staff actions and contact details. */
const STAFF_VIEW: AuthUser = { id: 'staff-view', role: 'STAFF', name: 'staff', sessionId: '' };

/** How the owner sees it; a counter order has no owner to tell. */
function ownerView(order: OrderWithRelations): AuthUser | null {
  return order.userId ? { id: order.userId, role: 'CUSTOMER', name: '', sessionId: '' } : null;
}

/**
 * Tell every audience about a committed change, each with its own view of the
 * order (LLD §6.2): staff rooms get staff actions, the owner gets theirs.
 */
function announceStatus(order: OrderWithRelations, from: OrderStatus | null, isNew: boolean): void {
  const staff = toOrderDto(order, STAFF_VIEW);
  const base = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    from,
    to: order.status,
    at: new Date().toISOString(),
  };
  if (isNew) publish('order:new', staff, { rooms: ['kitchen', 'pos', 'admin'] });
  else publish('order:status', { ...base, order: staff }, { rooms: ['kitchen', 'pos', 'admin'] });
  const owner = ownerView(order);
  if (owner) {
    publish(
      'order:status',
      { ...base, order: toOrderDto(order, owner) },
      { rooms: [`customer:${order.id}`] },
    );
  }
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
  let committed: OrderWithRelations | null = null;

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
    committed = full;
    return { status: 201, body: toOrderDto(full, actor) };
  });

  // After commit only (HLD §8.2). A replay announces nothing: it already happened.
  if (!result.replayed) {
    if (seatedTable) tableSeated(seatedTable);
    if (committed) announceStatus(committed, null, true);
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

  announceStatus(after, from, false);
  if (to === 'CANCELLED') {
    publish(
      'order:removed',
      { orderId: id, reason: reason ?? null },
      { rooms: ['kitchen', 'pos'] },
    );
  }
  return toOrderDto(after, actor);
}

/**
 * Cancellation delegates to the state machine: the edge's own role gate
 * allows a customer only from PLACED or CONFIRMED (ORD-09, BR-06).
 */
export function cancelOrder(id: string, actor: AuthUser, reason?: string): Promise<OrderDto> {
  return transitionStatus(id, 'CANCELLED', actor, reason ?? null);
}

/**
 * Assign a driver and/or advance a delivery (DEL-03, DEL-04). The delivery
 * moves independently of the order's status: the kitchen and the driver never
 * block each other. Naming a driver on a PENDING delivery assigns it; the
 * driver can be changed until pick-up. Announced as an `order:status` refresh
 * (`from === to`), like an amendment (LLD §6.2).
 *
 * @throws ConflictError NOT_A_DELIVERY | ILLEGAL_TRANSITION | CONCURRENT_UPDATE
 * @throws BusinessRuleError DRIVER_REQUIRED
 */
export async function updateDelivery(
  id: string,
  dto: UpdateDeliveryDto,
  actor: AuthUser,
): Promise<OrderDto> {
  const after = await prisma().$transaction(async (tx) => {
    const order = await repo.findOrder(id, tx);
    if (!order) throw notFound();
    if (order.type !== 'DELIVERY' || !order.delivery) {
      throw new ConflictError('NOT_A_DELIVERY', `Order ${order.orderNumber} is not a delivery.`);
    }
    if (order.status === 'CANCELLED') {
      throw new ConflictError('ILLEGAL_TRANSITION', 'A cancelled order is not delivered.');
    }
    const from = order.delivery.status;
    let driverName = order.delivery.driverName;
    let status: DeliveryStatus = from;

    if (dto.driverName !== undefined) {
      if (!canAssignDriver(from)) {
        throw new ConflictError('ILLEGAL_TRANSITION', 'The order has already left with a driver.', {
          from,
        });
      }
      driverName = dto.driverName;
      if (from === 'PENDING') status = 'ASSIGNED';
    }
    if (dto.status !== undefined && dto.status !== status) {
      if (!canAdvanceDelivery(status, dto.status)) {
        throw new ConflictError(
          'ILLEGAL_TRANSITION',
          `A delivery cannot go from ${status} to ${dto.status}.`,
          { from: status, to: dto.status },
        );
      }
      status = dto.status;
    }
    if (status === 'ASSIGNED' && !driverName) {
      throw new BusinessRuleError('DRIVER_REQUIRED', 'Name the driver to assign the delivery.');
    }
    if (!(await repo.updateDelivery(tx, id, from, { status, driverName }))) {
      throw new ConflictError('CONCURRENT_UPDATE', 'Someone else updated this delivery first.');
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: 'DELIVERY_UPDATE',
      entity: 'Order',
      entityId: id,
      before: { status: from, driverName: order.delivery.driverName },
      after: { status, driverName },
    });
    const updated = await repo.findOrder(id, tx);
    if (!updated) throw notFound();
    return updated;
  });
  announceStatus(after, after.status, false);
  return toOrderDto(after, actor);
}

export interface PaymentSnapshot {
  orderId: string;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  balanceDue: number;
}

/**
 * Re-derive Order.paymentStatus from the payment records against the current
 * total and store it, inside the caller's transaction. **The only writer of
 * paymentStatus** (PAY-04, LLD §4.5): payments, refunds and amendments all
 * come through here, so they can never disagree.
 */
export async function syncPaymentStatus(orderId: string, tx: Tx): Promise<PaymentSnapshot> {
  const basis = await repo.paymentBasis(tx, orderId);
  if (!basis) throw notFound();
  const paymentStatus = derivePaymentStatus(basis.payments, basis.total);
  await repo.writePaymentStatus(tx, orderId, paymentStatus);
  const amountPaid = paidSum(basis.payments);
  const balanceDue = paymentStatus === 'REFUNDED' ? 0 : Math.max(0, basis.total - amountPaid);
  return { orderId, paymentStatus, amountPaid, balanceDue };
}

/** Tell the tills, admin and the owner that money moved (LLD §6.2). Call after commit. */
export function announcePayment(snapshot: PaymentSnapshot): void {
  publish('payment:changed', snapshot, {
    rooms: ['pos', 'admin', `customer:${snapshot.orderId}`],
  });
}

/** The order with its relations, for the payments module (read inside its transaction). */
export function loadOrder(id: string, db?: Tx) {
  return repo.findOrder(id, db);
}

/**
 * Append a later round to an open order (ORD-12…14): **one transaction**.
 *
 * Only while PLACED, CONFIRMED or PREPARING (BR-14). New lines are priced from
 * the menu now; the whole order is then repriced with the rates and discount
 * it was *placed* under, so a settings change mid-service never rewrites the
 * first round (ORD-13). Payment status is re-derived, so a PAID order whose
 * total rises becomes PARTIALLY_PAID (AC-14). The audit row records the lines
 * and the totals before and after.
 *
 * @throws ConflictError ORDER_NOT_AMENDABLE | ITEM_UNAVAILABLE | CONCURRENT_UPDATE
 * @throws BusinessRuleError INVALID_MODIFIER_SELECTION
 */
export async function appendItems(
  id: string,
  dto: AppendItemsDto,
  actor: AuthUser,
): Promise<OrderDto> {
  const settings = await getSettings();
  const now = new Date();
  const { after, snapshot } = await prisma().$transaction(async (tx) => {
    const order = await repo.findOrder(id, tx);
    if (!order) throw notFound();
    if (actor.role === 'CUSTOMER' && order.userId !== actor.id) throw notFound();
    if (!(AMENDABLE_ORDER_STATUSES as readonly OrderStatus[]).includes(order.status)) {
      throw new ConflictError(
        'ORDER_NOT_AMENDABLE',
        `Order ${order.orderNumber} is ${order.status.toLowerCase()}; start a new order instead.`,
      );
    }

    const added = await resolveLines(dto.items, settings, { db: tx, now });
    const discount =
      order.discountType && order.discountValue !== null
        ? { type: order.discountType, value: order.discountValue }
        : null;
    const { totals } = computeTotals({
      orderType: order.type,
      lines: [
        ...order.items.map((i) => toCartLine({ ...i, menuItemId: i.menuItemId ?? i.id })),
        ...added.map(toCartLine),
      ],
      discount,
      tipAmount: order.tipAmount,
      ctx: {
        taxBps: order.taxBps,
        serviceChargeBps: order.serviceChargeBps,
        serviceChargeTaxable: order.serviceChargeTaxable,
        deliveryFee: order.deliveryFee,
      },
    });

    if (!(await repo.updateTotalsIfUnchanged(tx, id, order, totals))) {
      throw new ConflictError(
        'CONCURRENT_UPDATE',
        'The order changed while you were adding to it. Try again.',
      );
    }
    const firstLine = await repo.nextLineNo(tx, id);
    await repo.insertItems(
      tx,
      added.map((l, i) => ({
        orderId: id,
        lineNo: firstLine + i,
        menuItemId: l.menuItemId,
        nameSnapshot: l.nameSnapshot,
        unitPrice: l.unitPrice,
        qty: l.qty,
        modifiersJson: l.modifiers.map((g) => ({
          groupId: g.groupId,
          groupName: g.groupName,
          items: g.items.map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta })),
        })),
        modifierTotal: l.modifierTotal,
        lineTotal: l.lineTotal,
        notes: l.notes,
        station: l.station,
        addedAt: now,
      })),
    );
    const before = {
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      serviceCharge: order.serviceCharge,
      taxAmount: order.taxAmount,
      deliveryFee: order.deliveryFee,
      tipAmount: order.tipAmount,
      total: order.total,
    };
    await writeAudit(tx, {
      actorId: actor.role === 'CUSTOMER' ? null : actor.id,
      action: 'ORDER_ITEMS_APPENDED',
      entity: 'Order',
      entityId: id,
      before: { totals: before },
      after: {
        totals,
        lines: added.map((l) => ({
          menuItemId: l.menuItemId,
          name: l.nameSnapshot,
          qty: l.qty,
          lineTotal: l.lineTotal,
        })),
        by: actor.id,
      },
    });
    const paymentSnapshot = await syncPaymentStatus(id, tx);
    const updated = await repo.findOrder(id, tx);
    if (!updated) throw notFound();
    return { after: updated, snapshot: paymentSnapshot };
  });

  // An amendment is announced as a status event with from === to (LLD §6.2).
  announceStatus(after, after.status, false);
  announcePayment(snapshot);
  return toOrderDto(after, actor);
}

/**
 * A receipt built **entirely from the order's own snapshots** — names, prices,
 * modifier deltas, every total component and the payment records — so a later
 * menu or settings change cannot alter it (PRINT-01, PRINT-02, AC-19).
 */
export async function getReceipt(id: string, viewer: AuthUser): Promise<ReceiptDto> {
  const order = await visibleOrder(id, viewer);
  const [payments, settings] = await Promise.all([repo.receiptPayments(id), getSettings()]);
  const dto = toOrderDto(order, viewer);
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    businessDate: dto.businessDate,
    issuedAt: new Date().toISOString(),
    placedAt: dto.placedAt,
    restaurant: { name: settings.restaurantName },
    type: order.type,
    table: order.table?.number ?? null,
    customerName: dto.customer?.name ?? null,
    lines: dto.items.map((i) => ({
      name: i.nameSnapshot,
      qty: i.qty,
      unitPrice: i.unitPrice,
      modifiers: i.modifiers.flatMap((g) => g.items),
      notes: i.notes,
      lineTotal: i.lineTotal,
    })),
    totals: dto.totals,
    discountCode: order.discountCode,
    payments: payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      tipAmount: p.tipAmount,
      state: p.state,
      at: p.createdAt.toISOString(),
    })),
    paymentStatus: dto.paymentStatus,
    amountPaid: dto.amountPaid,
    balanceDue: dto.balanceDue,
  };
}
