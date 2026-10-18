# Low Level Design (LLD)
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-LLD-001 |
| **Version** | 1.4 |
| **Status** | Draft |
| **Date** | 2026-09-26 |
| **Preceded by** | ROS-SRS-001 · ROS-HLD-001 |

---

## Table of Contents
1. [Design Conventions](#1-design-conventions)
2. [Database Design](#2-database-design)
3. [Domain Logic](#3-domain-logic)
4. [Module Designs (server)](#4-module-designs-server)
5. [API Specification](#5-api-specification)
6. [Realtime Protocol](#6-realtime-protocol)
7. [Frontend Design](#7-frontend-design)
8. [Error Handling Catalog](#8-error-handling-catalog)
9. [Security Implementation Details](#9-security-implementation-details)
10. [Test Design](#10-test-design)

---

## 1. Design Conventions

- **Money**: all monetary values are `number` integers in **minor units (cents)**. Currency code from Settings (default `usd`).
- **Rates**: tax, service charge and percent discounts are integers in **basis points** (`1000` = 10.00%). No decimal fraction ever multiplies a cent amount (NFR-R2).
- **IDs**: UUID v4 strings (`uuid` generated in Prisma `@default(uuid())`).
- **Timestamps**: `DateTime @default(now())` stored UTC; client formats in local time.
- **Business date**: the restaurant's operating day, computed once at order placement as `(placedAt AT TIME ZONE settings.timezone)::date` and stored on the order. Order numbering and every report bucket key on it, never on the UTC date (BR-15).
- **Naming**: tables/models PascalCase singular (`OrderItem`); columns camelCase; enum values SCREAMING_SNAKE. Prisma's default mapping is kept, so Postgres receives quoted mixed-case identifiers — **every raw SQL statement must quote them** (`FROM "Order" WHERE "placedAt" …`). Unquoted `from orders` will not resolve.
- **Order ownership**: `userId` is the authenticated account that placed the order. Authentication is required at checkout (BROWSE-01), so a self-service order always has one. A staff-placed counter order carries `userId = NULL` with the guest recorded in `customerName`/`customerPhone`; such an order is reachable by STAFF/ADMIN only, and its payment endpoints authorise on role rather than on ownership.
- **Layer triad per module**: `*.routes.ts` (HTTP) → `*.service.ts` (use-cases) → `*.repo.ts` (Prisma). Controllers are folded into routes for compactness.
- **DTO mapping**: services return DTO shapes via explicit `toDto()` mappers — Prisma models never cross the API boundary (prevents field leaks).
- **Validation**: every request body/params/query parsed by a Zod schema from `shared/schemas`.

---

## 2. Database Design

### 2.1 Enumerations
```prisma
enum Role          { CUSTOMER  STAFF  ADMIN }
enum OrderType     { DINE_IN  TAKEAWAY  DELIVERY }
enum OrderStatus   { PLACED  CONFIRMED  PREPARING  READY  SERVED  COMPLETED  CANCELLED }
enum PaymentStatus { UNPAID  PARTIALLY_PAID  PAID  REFUNDED }   // order-level, always derived
enum PaymentState  { PENDING  SUCCEEDED  FAILED  REFUNDED }     // one Payment record
enum PaymentMethod { STRIPE  CASH }
enum TableStatus   { FREE  SEATED  DIRTY }
enum DiscountType  { PERCENT  FIXED }
enum DeliveryStatus{ PENDING  ASSIGNED  PICKED_UP  DELIVERED }
enum ReservationStatus { PENDING  SEATED  CANCELLED  COMPLETED }
enum ContactKind   { COMPLAINT  SUGGESTION  QUESTION }
```

Two deliberate points:

- **`REFUNDED` is not an order status.** A refund is a payment event; it sets `PaymentStatus.REFUNDED`
  and leaves the order `COMPLETED` or `CANCELLED` as it was. Folding it into `OrderStatus` would erase
  whether the order was ever fulfilled, break the terminal-state guarantee, and (because reports filter
  on order status) silently mis-state revenue.
- **`PaymentStatus` vs `PaymentState`.** The first is the order's aggregate position, *derived* from the
  second — never written directly. `PaymentStatus` has no `FAILED`: a declined card records a
  `PaymentState.FAILED` row and leaves the order `UNPAID`, which is what makes a retry possible.

### 2.2 Entity Definitions

#### User
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| name | varchar(120) | NOT NULL | |
| email | varchar(255) | UNIQUE NOT NULL | lower-cased on write |
| passwordHash | varchar(255) | NOT NULL | bcrypt cost 12 |
| phone | varchar(30) | NULL | customer optional |
| role | Role | NOT NULL DEFAULT `CUSTOMER` | |
| isActive | boolean | DEFAULT true | soft-disable staff |
| createdAt | timestamptz | DEFAULT now | |

Indexes: `UNIQUE(email)`.

#### Table
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| number | varchar(10) | UNIQUE NOT NULL |
| seats | int | DEFAULT 4 |
| status | TableStatus | DEFAULT `FREE` |
| qrToken | varchar(64) | UNIQUE NOT NULL (128-bit random hex) |
| isActive | boolean | DEFAULT true |

#### MenuCategory
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(80) | NOT NULL |
| description | varchar(255) | NULL |
| sortOrder | int | DEFAULT 0 |
| isActive | boolean | DEFAULT true |

#### MenuItem
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| categoryId | uuid | FK → MenuCategory, CASCADE |
| name | varchar(120) | NOT NULL |
| description | varchar(500) | NULL |
| price | integer | NOT NULL (cents) |
| imageUrl | varchar(500) | NULL |
| isAvailable | boolean | DEFAULT true (86 flag) |
| allergens | varchar[] | DEFAULT '{}' |
| availableFrom / availableTo | time | NULL — schedule window |
| station | varchar(40) | NULL — KDS station |
| isActive | boolean | DEFAULT true — soft delete (BR-11) |

Indexes: `(categoryId)`, partial `(isAvailable)`.

#### ModifierGroup
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| name | varchar(80) | NOT NULL (e.g., "Size") |
| minSelect | int | DEFAULT 0 |
| maxSelect | int | DEFAULT 1 |
| isActive | boolean | DEFAULT true |

#### MenuItemModifierGroup (join)
| Column | Type | Constraints |
|---|---|---|
| menuItemId | uuid | PK part, FK CASCADE |
| modifierGroupId | uuid | PK part, FK CASCADE |
| sortOrder | int | DEFAULT 0 |

#### ModifierItem
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| groupId | uuid | FK → ModifierGroup CASCADE |
| name | varchar(80) | NOT NULL |
| priceDelta | integer | DEFAULT 0 (cents, may be negative) |
| isAvailable | boolean | DEFAULT true |

#### Order
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| orderNumber | varchar(16) | see unique constraint below | e.g. `A-1042`; the counter resets daily |
| businessDate | date | NOT NULL | operating day in the restaurant timezone, fixed at placement (BR-15) |
| type | OrderType | NOT NULL | |
| status | OrderStatus | DEFAULT `PLACED` | derived mirror of the last `OrderEvent` |
| tableId | uuid | FK → Table, SET NULL | dine-in only; always resolved from the QR token, never from client input (AC-12) |
| userId | uuid | FK → User, SET NULL | the account that placed the order; `NULL` only for a staff-placed counter order (§1) |
| customerName | varchar(120) | NULL | required for takeaway/delivery — see CHECK below |
| customerPhone | varchar(30) | NULL | |
| subtotal | integer | NOT NULL | cents |
| discountAmount | integer | DEFAULT 0 | |
| discountCode | varchar(40) | NULL | snapshot |
| serviceCharge | integer | DEFAULT 0 | |
| taxAmount | integer | NOT NULL | |
| deliveryFee | integer | DEFAULT 0 | |
| tipAmount | integer | DEFAULT 0 | never discounted, never taxed (BR-13) |
| total | integer | NOT NULL | |
| currency | varchar(3) | DEFAULT 'usd' | |
| taxBps | int | DEFAULT 0 | pricing snapshot: the rates the order was placed under, so an amendment reprices with them (ORD-13, ADR-021) |
| serviceChargeBps | int | DEFAULT 0 | snapshot, as above |
| serviceChargeTaxable | boolean | DEFAULT false | snapshot, as above |
| discountType | DiscountType | NULL | snapshot of the applied discount's type |
| discountValue | int | NULL | snapshot of its value (bps or cents) |
| paymentStatus | PaymentStatus | DEFAULT `UNPAID` | derived from `Payment` rows; never written directly |
| notes | varchar(500) | NULL | order-level |
| placedAt | timestamptz | DEFAULT now | |
| updatedAt | timestamptz | `@updatedAt` | |
| completedAt | timestamptz | NULL | |

Constraints:
- `UNIQUE (businessDate, orderNumber)` — **not** a plain unique on `orderNumber`. The number recycles
  every day, so a global constraint would reject the first order of day two.
- `CHECK (type = 'DINE_IN' OR customerName IS NOT NULL)` — DEL-01's conditional requirement, which a
  column-level `NOT NULL` cannot express.
- `CHECK (total >= 0)` (BR-01).

Indexes: `(status)`, `(businessDate)`, `(placedAt DESC)`, `(tableId, status)`, `(userId, placedAt DESC)`, `(paymentStatus)`.

#### OrderItem
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| orderId | uuid | FK → Order CASCADE | |
| menuItemId | uuid | FK → MenuItem, SET NULL | reference only |
| nameSnapshot | varchar(120) | NOT NULL | ORD-05 |
| unitPrice | integer | NOT NULL | base price at order time |
| qty | int | NOT NULL CHECK (qty > 0) | |
| modifiersJson | jsonb | DEFAULT '[]' | `[{ groupId, groupName, items:[{id,name,priceDelta}] }]` |
| modifierTotal | integer | DEFAULT 0 | per-unit modifier sum |
| lineTotal | integer | NOT NULL | (unitPrice + modifierTotal) × qty |
| notes | varchar(300) | NULL | "no onions" |
| station | varchar(40) | NULL | copied for KDS filter |
| addedAt | timestamptz | DEFAULT now | equals `Order.placedAt` for the first round; later rounds are badged on the KDS (ORD-12, ADR-021) |
| lineNo | int | DEFAULT 0 | position on the order, so tickets and receipts keep the guest's order |

Indexes: `(orderId)`.

#### OrderSequence
| Column | Type | Constraints |
|---|---|---|
| businessDate | date | PK |
| lastValue | int | NOT NULL DEFAULT 1000 |

One row per operating day, incremented atomically inside the placement transaction. This exists as
its own table rather than as a `Setting` row because `Setting.value` is text (no atomic integer
increment), `Setting.updatedBy` has no user to name for a machine write, and a per-day key would grow
the settings table without bound.

#### RefreshToken
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| userId | uuid | FK → User **CASCADE** | deleting an account must kill its sessions, not orphan them |
| tokenHash | varchar(64) | UNIQUE NOT NULL | SHA-256 hex of the opaque token. The raw value is never stored |
| familyId | uuid | NOT NULL | every token descending from one login shares this |
| expiresAt | timestamptz | NOT NULL | 30 days from issue |
| revokedAt | timestamptz | NULL | set on rotation, logout, or family revocation |
| replacedById | uuid | NULL | the token issued in its place, for tracing a chain |
| userAgent | varchar(200) | NULL | shown in the session list (AUTH-13) |
| ip | varchar(45) | NULL | IPv6-sized |
| createdAt | timestamptz | DEFAULT now | |

Indexes: `(userId, revokedAt)`, `(familyId)`, `(expiresAt)`.

**Why opaque and not a JWT.** A refresh token must be revocable the instant a session is killed. A
JWT is valid until it expires by definition, so revoking one requires a denylist — at which point
the statelessness that justified the JWT is gone and you are storing state anyway, just in a less
useful shape. An opaque random value stored hashed gives revocation, rotation, reuse detection and
a session list for the same write.

**Why hashed.** The table is a list of live credentials. Storing SHA-256 hashes means a database
disclosure yields nothing usable, exactly as with `passwordHash`. SHA-256 rather than bcrypt is
correct here: the token is 256 bits of entropy, so there is nothing to brute-force, and the lookup
happens on every refresh.

#### IdempotencyKey
| Column | Type | Constraints | Notes |
|---|---|---|---|
| key | varchar(120) | PK | value of the `Idempotency-Key` header |
| userId | uuid | FK → User SET NULL | the caller, so keys cannot collide across accounts |
| endpoint | varchar(80) | NOT NULL | e.g. `POST /orders` |
| requestHash | varchar(64) | NOT NULL | SHA-256 of the canonical request body |
| responseStatus | int | NOT NULL | |
| responseJson | jsonb | NOT NULL | replayed verbatim on a repeat |
| createdAt | timestamptz | DEFAULT now | rows older than 24 h are purged by a job |

A repeat of the same key replays the stored response. A repeat with a *different* `requestHash`
is a client bug and returns `422 IDEMPOTENCY_KEY_REUSED` (NFR-R5).

#### OrderEvent (append-only audit)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| orderId | uuid | FK → Order CASCADE |
| fromStatus | OrderStatus | NULL — and NULL *only* on the first event, which records `(null → PLACED)` |
| toStatus | OrderStatus | NOT NULL |
| actorId | uuid | FK → User SET NULL (NULL = customer/system) |
| reason | varchar(200) | NULL (cancel reason) |
| createdAt | timestamptz | DEFAULT now |

Indexes: `(orderId, createdAt)`.

#### Discount
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| code | varchar(40) | UNIQUE NOT NULL, upper-cased |
| type | DiscountType | NOT NULL |
| value | int | NOT NULL — percent (1–100) or cents |
| minOrder | integer | DEFAULT 0 |
| startsAt | timestamptz | NULL |
| endsAt | timestamptz | NULL |
| usageLimit | int | NULL |
| usedCount | int | DEFAULT 0 |
| isActive | boolean | DEFAULT true |

#### Payment
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| orderId | uuid | FK → Order CASCADE |
| method | PaymentMethod | NOT NULL |
| amount | integer | NOT NULL — the balance this record settles, not necessarily the order total (PAY-06) |
| tipAmount | integer | DEFAULT 0 — cash tip recorded against this payment (TIP-02) |
| state | PaymentState | NOT NULL DEFAULT `PENDING` |
| stripePaymentIntentId | varchar(80) | NULL |
| stripeRefundId | varchar(80) | NULL |
| actorId | uuid | FK → User SET NULL (the cashier, for a cash payment) |
| createdAt | timestamptz | DEFAULT now |

Indexes: `(orderId, state)`.

There is deliberately **no** `stripeEventId` unique constraint here. Webhook replay protection lives in
exactly one place — the `WebhookEvent` primary key — and having two mechanisms invites the situation
where one is checked and the other is not.

#### WebhookEvent
| Column | Type | Constraints |
|---|---|---|
| id | varchar(120) | PK = Stripe event id |
| type | varchar(80) | |
| processedAt | timestamptz | |

#### Reservation
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| tableId | uuid | FK → Table SET NULL |
| guestName / guestPhone | varchar | NOT NULL |
| partySize | int | NOT NULL |
| slotAt | timestamptz | NOT NULL |
| status | ReservationStatus | DEFAULT `PENDING` |
| notes | varchar(300) | |

#### Branch (ADR-032)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| slug | varchar(40) | UNIQUE |
| nameAr / nameEn | varchar(80) | NOT NULL |
| addressAr / addressEn | varchar(200) | NOT NULL |
| phones | text[] | international form `+20…` |
| whatsapp | varchar(30) | NULL |
| lat / lng | double | NULL until the pin is placed |
| hours | jsonb | 7 entries, Sunday first: `{open, close}` in hours, `close` ≤ 30 (after midnight), or null |
| features | text[] | e.g. `ac-hall`, `grills` |
| sortOrder | int | DEFAULT 0 |
| isActive | bool | DEFAULT true |
| updatedAt | timestamptz | |

#### ContactMessage (ADR-032)
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| branchId | uuid | FK → Branch SET NULL |
| name | varchar(120) | NOT NULL |
| phone | varchar(30) | NOT NULL, normalised |
| kind | ContactKind | NOT NULL |
| tableNumber | varchar(10) | NULL |
| visitDate | date | NULL |
| message | varchar(1000) | NOT NULL |
| createdAt | timestamptz | DEFAULT now() |
| readAt | timestamptz | NULL = unread; INDEX (readAt, createdAt) |

#### Delivery
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| orderId | uuid | UNIQUE FK → Order CASCADE |
| address | varchar(300) | NOT NULL |
| addressNote | varchar(120) | |
| driverName | varchar(80) | NULL |
| status | DeliveryStatus | DEFAULT `PENDING` |

#### Setting
| Column | Type | Constraints |
|---|---|---|
| key | varchar(40) | PK |
| value | varchar(200) | |
| updatedBy | uuid | FK → User **SET NULL** — null for values written at seed time |
| updatedAt | timestamptz | DEFAULT now |

Keys: `taxBps`, `serviceChargeBps`, `serviceChargeTaxable`, `deliveryFee`, `currency`, `timezone`
(IANA, e.g. `America/New_York`), `tipPresetsBps`, `kdsGreenSec`, `kdsAmberSec`, `kdsCompletedGraceSec`
(KDS-07), `orderNumberPrefix`.

Rates are basis-point integers (`taxBps = 875` is 8.75%), not the decimal strings v1.0 specified —
multiplying cents by a float is exactly the arithmetic NFR-R2 forbids. Runtime counters do **not**
live here; the daily order sequence has its own table.

#### AuditLog
| Column | Type | Constraints |
|---|---|---|
| id | uuid | PK |
| actorId | uuid | FK SET NULL |
| action | varchar(60) | e.g. `MENU_ITEM_UPDATE` |
| entity | varchar(40), entityId | |
| diff | jsonb | before/after |
| createdAt | timestamptz | |

### 2.3 Entity-Relationship Diagram (textual)
```
User 1──* RefreshToken   (CASCADE — sessions die with the account)
User 1──* Order *──1 Table
Order 1──* OrderItem *──0..1 MenuItem *──1 MenuCategory
Order 1──* OrderEvent
Order 1──* Payment
Order 1──0..1 Delivery
MenuItem *──* ModifierGroup (join: MenuItemModifierGroup) 1──* ModifierItem
Reservation *──1 Table
Setting, Discount, WebhookEvent, AuditLog, OrderSequence, IdempotencyKey — independent
```

---

## 3. Domain Logic

### 3.1 Order State Machine (`shared/domain/order-status.ts`)

The role gate belongs to the **edge**, not to a status. Keying it by status cannot express the one
rule that matters here — from `PLACED`, a customer may cancel but must not confirm — so transitions
and their permitted actors are declared together:

```ts
export type Transition = { from: OrderStatus; to: OrderStatus; roles: Role[] };

export const ORDER_TRANSITIONS: Transition[] = [
  { from: 'PLACED',    to: 'CONFIRMED', roles: ['STAFF', 'ADMIN'] },
  { from: 'PLACED',    to: 'CANCELLED', roles: ['CUSTOMER', 'STAFF', 'ADMIN'] }, // ORD-09
  { from: 'CONFIRMED', to: 'PREPARING', roles: ['STAFF', 'ADMIN'] },
  { from: 'CONFIRMED', to: 'CANCELLED', roles: ['CUSTOMER', 'STAFF', 'ADMIN'] }, // ORD-09
  { from: 'PREPARING', to: 'READY',     roles: ['STAFF', 'ADMIN'] },
  { from: 'PREPARING', to: 'CANCELLED', roles: ['STAFF', 'ADMIN'] },
  { from: 'READY',     to: 'SERVED',    roles: ['STAFF', 'ADMIN'] },
  { from: 'READY',     to: 'CANCELLED', roles: ['STAFF', 'ADMIN'] },
  { from: 'SERVED',    to: 'COMPLETED', roles: ['STAFF', 'ADMIN'] },
  { from: 'SERVED',    to: 'CANCELLED', roles: ['STAFF', 'ADMIN'] },
];

/** The single forward step per state — what a KDS bump means. */
export const FORWARD_TRANSITION: Record<OrderStatus, OrderStatus | null> = {
  PLACED: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY',
  READY: 'SERVED', SERVED: 'COMPLETED', COMPLETED: null, CANCELLED: null,
};

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean;
export function nextStatuses(from: OrderStatus, role: Role): OrderStatus[]; // role-filtered, drives UI
```

**Why a forward map as well as the list.** The bump button needs to know *the* next status. Reading
the first element of an allowed-transitions array would make the button's meaning depend on array
ordering — and under the v1.0 table, bumping a `COMPLETED` ticket would have issued a refund.

**No skipping.** Only the single next step is legal, so the `OrderEvent` timeline has no gaps and
every ticket can be reconstructed from its events (BR-12, NFR-R3).

**Terminal states:** `COMPLETED` and `CANCELLED`. Refunds do not appear here at all — they move
`paymentStatus`, not `status` (§2.1, BR-07).

### 3.2 Pricing Engine (`shared/domain/pricing.ts`)

```ts
interface CartLine {
  menuItemId: string;
  unitPrice: number;            // cents (from DB)
  qty: number;
  modifierDeltas: number[];     // per-unit deltas, may be negative
}
interface PricingInput {
  lines: CartLine[];
  orderType: OrderType;
  discount?: { type: 'PERCENT'|'FIXED'; valueBps: number; value: number; minOrder: number } | null;
  tipAmount?: number;           // cents, client-chosen, clamped >= 0
  ctx: {
    taxBps: number;             // integer basis points: 875 = 8.75%
    serviceChargeBps: number;
    serviceChargeTaxable: boolean;
    deliveryFee: number;        // cents
  };
}
interface PricingBreakdown {
  subtotal, discountAmount, serviceCharge, taxAmount,
  deliveryFee, tipAmount, total: number;   // all cents
}

export function computeTotals(input: PricingInput): PricingBreakdown
```

**Algorithm (order matters — BR-01, BR-03, BR-04, BR-10, BR-13, DISC-04):**
```
 1. lineTotal_i   = (unitPrice_i + Σ modifierDeltas_i) × qty_i
 2. subtotal      = Σ lineTotal_i
 3. discount      = validateDiscount(subtotal, discount)
                     PERCENT: bps(subtotal, valueBps)
                     FIXED:   min(value, subtotal)          // never below zero
 4. taxable       = subtotal − discount
 5. serviceCharge = orderType == DINE_IN ? bps(taxable, serviceChargeBps) : 0
 6. taxBase       = taxable + (serviceChargeTaxable ? serviceCharge : 0)      // BR-03
 7. taxAmount     = bps(taxBase, taxBps)
 8. deliveryFee   = orderType == DELIVERY ? ctx.deliveryFee : 0   // BR-10: never discounted
 9. tipAmount     = max(0, input.tipAmount ?? 0)                  // BR-13: never discounted or taxed
10. total         = taxable + serviceCharge + taxAmount + deliveryFee + tipAmount
```

*All arithmetic is integer.* The single shared helper is:

```ts
/** amount × bps / 10000, rounded half-away-from-zero. */
export const bps = (amountCents: number, rateBps: number): number =>
  Math.sign(amountCents * rateBps) *
  Math.round(Math.abs(amountCents * rateBps) / 10000);
```

`Math.round` alone is **half-toward +∞**, not half-up: `Math.round(-0.5)` is `-0`. Because
`ModifierItem.priceDelta` may be negative, a line and therefore an intermediate amount can be
negative, so rounding has to be symmetric about zero or the client preview and the server charge can
disagree by a cent — precisely what AC-4 forbids.

**Client/server parity:** client calls `computeTotals` for live preview; server calls the same function with prices re-read from DB before creating the order/payment (CART-06, PAY-07).

### 3.3 Discount Validation (`discounts/service.ts::validate`)
```
resolve code (upper-case, isActive)
→ within [startsAt, endsAt]?
→ subtotal ≥ minOrder?
→ usedCount < usageLimit (if set)?            // DISC-06
→ else throw BusinessRuleError with specific code:
   DISCOUNT_NOT_FOUND | DISCOUNT_INACTIVE | DISCOUNT_EXPIRED |
   DISCOUNT_MIN_NOT_MET | DISCOUNT_LIMIT_REACHED
```

Validation alone never makes the limit real — **redemption must be counted at placement**. Inside the
order transaction:

```sql
UPDATE "Discount" SET "usedCount" = "usedCount" + 1
 WHERE id = :id AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
```

Zero rows affected means another order took the last redemption between validation and commit →
`422 DISCOUNT_LIMIT_REACHED`, and the transaction rolls back. A plain read-then-increment would let
two concurrent checkouts both pass the check.

### 3.4 Business Date & Order Number Generation

```
within the placement transaction:
  businessDate = (now() AT TIME ZONE settings.timezone)::date
  counter      = UPDATE "OrderSequence" SET "lastValue" = "lastValue" + 1
                   WHERE "businessDate" = :businessDate RETURNING "lastValue"
                 -- if no row: INSERT ... ON CONFLICT DO UPDATE (first order of the day)
  orderNumber  = `${settings.orderNumberPrefix}-${counter}`     -- e.g. A-1001
```

Three things this gets right that the v1.0 sketch did not:

- The counter is a real integer column, so the increment is atomic under concurrency. A text
  `Setting.value` has no such operation.
- `businessDate` comes from the restaurant timezone, so a 00:30 local order belongs to the evening
  that produced it rather than to the next UTC day.
- Uniqueness is `(businessDate, orderNumber)`. The number recycles daily by design; a global unique
  constraint would have rejected `A-1001` on the second day of service.

`businessDate` is written onto the order and never recomputed — reports and the sequence must agree
forever, even if the timezone setting is later changed.

### 3.5 Table Session Lifecycle
```
QR scan → GET  /tables/qr/:token        (read-only: resolves token → table summary)
        → POST /tables/sessions {token} (state change: opens the session)
             table.status == FREE   → set SEATED (emit table:changed)
             table.status == SEATED → attach to the existing session
             table.status == DIRTY  → 409 TABLE_DIRTY (staff must clean first)

Close (staff):  assert no open orders for the table (BR-08) → SEATED → DIRTY
Clean (staff):                                                DIRTY  → FREE
```

**Why the read and the write are separate.** Seating a table is a state change, and a `GET` that
mutates will be fired by link previews, browser prefetching and crawlers — every one of which would
seat a table nobody is sitting at. The token alone therefore reads; opening the session takes a POST.

**Why close and clean are separate.** TABLE-02 requires the `DIRTY` step. A single "free" action
either skips it or (as in v1.0) is named `freeTable` while actually setting `DIRTY`, leaving no
operation that reaches `FREE` at all.

---

## 4. Module Designs (server)

### 4.1 Module Template
```ts
// modules/orders/orders.routes.ts
router.post('/orders', requireRole('CUSTOMER','STAFF','ADMIN'), validate(createOrderSchema), handler)
// modules/orders/orders.service.ts  — use-cases, transactions, domain calls, emits events
// modules/orders/orders.repo.ts     — Prisma queries only, returns models
```

### 4.2 Auth Module
| Function | Signature | Behavior |
|---|---|---|
| `register` | `(dto) → { user, token }` | hash bcrypt(12), reject dup email `409 EMAIL_TAKEN` |
| `login` | `(dto) → { user, token }` | verify, reject `401 INVALID_CREDENTIALS` (same msg for wrong email/password) |
| `me` | `(userId) → UserDTO` | |
| `refresh` | `(rawToken, ua, ip) → { accessToken }` | hash → look up → validate → **rotate**. See the algorithm below |
| `logout` | `(rawToken) → void` | revoke that one token, clear the cookie |
| `logoutAll` | `(userId) → void` | revoke every unexpired token for the user (AUTH-13) |
| `listSessions` | `(userId) → SessionDTO[]` | active families with device and last-used (AUTH-13) |
| middleware `authenticate` | `(req) → req.user` | verify the **access token** from `Authorization`, then **re-read `isActive` and `role` from the database** (60 s in-process cache keyed by user id) → `req.user`, or `401`. An inactive account gets `401 ACCOUNT_DISABLED` |
| middleware `requireRole(...roles)` | `(req) → void` | `403 FORBIDDEN` if the caller's role is not in the list |

**Access token** — JWT, HS256, payload `{ sub: userId, role, name, sid: familyId }`, `exp 15m`.
Held in memory by the client and never persisted (AUTH-12).

**Refresh token** — 32 random bytes, base64url-encoded, returned only in a cookie:

```
Set-Cookie: rt=<opaque>; HttpOnly; Secure; SameSite=Strict;
            Path=/api/v1/auth; Max-Age=2592000
```

`Path` scopes the cookie to the auth routes, so it is not attached to ordinary API traffic and
cannot leak through an unrelated handler. `SameSite=Strict` is viable because the SPA and API are
served from one origin in production and are same-site in development (HLD §11.2).

### Refresh algorithm (`POST /auth/refresh`)

```
hash = sha256(cookie.rt)
row  = SELECT … FROM "RefreshToken" WHERE "tokenHash" = hash
  not found            → 401 REFRESH_TOKEN_INVALID
  row.expiresAt < now  → 401 SESSION_EXPIRED
  row.revokedAt != null→ REUSE DETECTED:
                           revoke every token in row.familyId
                           clear the cookie
                         → 401 SESSION_REVOKED
  user.isActive == false → 401 ACCOUNT_DISABLED

otherwise, in one transaction:
  next = issueRefreshToken(userId, familyId = row.familyId)
  UPDATE row SET revokedAt = now(), replacedById = next.id
  return { accessToken: signAccess(user, familyId) } + Set-Cookie(next)
```

**Rotation is what makes the long lifetime acceptable.** Each refresh token is usable exactly once;
a captured one is worthless the moment the legitimate client refreshes. **Reuse detection is what
makes rotation worth having**: a token presented twice means two parties hold it, which means theft,
so the entire family dies and every device on that session must re-authenticate (AUTH-11, AC-21).

**The role in the access token is a hint, not the authority.** If it were trusted outright, disabling
an account (ADM-02) or demoting a user (AUTH-08) would have no effect until the token expired. The
per-request re-read closes that window to the next request rather than up to 15 minutes; the short
cache keeps the cost to roughly one extra query per user per minute (AC-18).

**Why this exists at all.** A single 24-hour token — the v1.1 design — expires mid-service on the
always-on kitchen display SRS §8.1 assumes, and hands an XSS a full day of authenticated access.
Silent refresh means an always-on device is never prompted during a shift (AUTH-10, AC-20).

### 4.3 Menu Module
| Function | Behavior |
|---|---|
| `getPublicMenu()` | categories + items + modifier groups; filtered `isAvailable`, `isActive`, schedule window; 30 s memory cache, invalidated on write (broadcast `menu:changed`) |
| `createItem/updateItem` (ADMIN) | validate price ≥ 0; on update emit `menu:changed`; write AuditLog |
| `setItemAvailability(id, bool)` | the 86 toggle; broadcast immediately on the `menu` room, which anonymous browsers also receive (AC-7) |
| `resolveSelections(itemId, modifierItemIds)` | shared by `createOrder` and `appendItems`: loads the groups actually attached to the item, asserts every submitted id belongs to one of them and is available, enforces each group's `minSelect`/`maxSelect`, and returns the authoritative per-unit deltas. Throws `422 INVALID_MODIFIER_SELECTION` |

### 4.4 Orders Module
| Function | Behavior |
|---|---|
| `createOrder(dto, user)` | **One transaction**: (1) if an `Idempotency-Key` was supplied, claim it — a prior row with the same key replays its stored response and the transaction ends here; (2) for `DINE_IN`, resolve `dto.tableToken` → table and take `tableId` **from the token**, never from client input (AC-12); (3) re-fetch prices, `isActive` and `isAvailable` for every line → `409 ITEM_UNAVAILABLE`; (4) `resolveSelections` per line (§4.3) → authoritative modifier deltas, or `422 INVALID_MODIFIER_SELECTION`; (5) resolve + atomically redeem the discount (§3.3); (6) `computeTotals`; (7) allocate `businessDate` + `orderNumber` (§3.4); (8) insert Order + OrderItems (snapshots) + `OrderEvent(null → PLACED)`; (9) attach the table session for `DINE_IN`; (10) store the idempotent response; commit → emit `order:new` to `kitchen`/`pos`/`admin` and `order:status` to the owner; return DTO |
| `appendItems(orderId, lines, actor)` | **One transaction** (ORD-12…14). Order must be `PLACED`, `CONFIRMED` or `PREPARING`, else `409 ORDER_NOT_AMENDABLE`; actor must own the order or be STAFF/ADMIN. Same line validation as `createOrder` steps (3)–(4); insert the new `OrderItem` rows; recompute every total over the full item set — the original discount, tax and service-charge rates are re-applied from the values snapshotted on the order, not from current settings; re-derive `paymentStatus` from `paidSum` against the new total, so a `PAID` order drops to `PARTIALLY_PAID` (BR-14, AC-14); write an `AuditLog` row (`ORDER_ITEMS_APPENDED`, diff = appended lines + totals before/after); commit → emit `order:status` to kitchen/pos/admin/owner |
| `previewCart(dto)` | same pricing path without persistence; public so a guest can see authoritative totals before logging in |
| `transitionStatus(orderId, to, actor, reason?)` | **One transaction** (HLD §6.3): read current status; `canTransition(from, to, actor.role)` else `409 ILLEGAL_TRANSITION`; conditional `updateMany({ where: { id, status: from }, data: { status: to } })` — `count === 0` → `409 CONCURRENT_UPDATE` (R9); insert `OrderEvent`; set `completedAt` if `COMPLETED`; release the table session if `CANCELLED`. Emit only **after** commit. The conditional update *is* the concurrency control — there is no separate row lock to take |
| `cancelByCustomer(orderId, user)` | delegates to `transitionStatus(→ CANCELLED)`, which already enforces own-order + `PLACED`/`CONFIRMED` via the edge's role gate (ORD-09). A cancelled order that holds a successful payment remains refundable (§4.5) |
| `getReceipt(id, actor)` | PRINT-01/02/04: builds the receipt DTO purely from the order's snapshotted values — item names, unit prices, modifier deltas, every total component, tip, and the payment records — so a later menu or settings change cannot alter a historical receipt (AC-19) |
| `listOrders(filter, actor)` | CUSTOMER → `where.userId = actor`; STAFF/ADMIN → all; filters: status[], type, businessDate from/to, tableId; paginated |
| `getOrder(id, actor)` | ownership/role check (anti-IDOR) |

### 4.5 Payments Module
| Function | Behavior |
|---|---|
| `createIntent(orderId, amount?, user)` | Caller must own the order or be STAFF/ADMIN (a counter order has no owner — §1). Recompute the total from the DB and derive `balance = total − paidSum`; the charged amount is `amount ?? balance`, validated `0 < amount ≤ balance` else `422 PAYMENT_EXCEEDS_BALANCE`. Precondition is `paymentStatus != PAID` — **not** `== UNPAID`, which would make a second split-payment intent impossible (PAY-06). The client never supplies the price (PAY-07). Then `stripe.paymentIntents.create(params, { idempotencyKey })` — note the key is the SDK's **second argument**, an options object, not a field inside the params. Store `Payment(PENDING)`; return `{ clientSecret, publishableKey, amount }` |
| `handleWebhook(rawBody, sig)` | `stripe.webhooks.constructEvent` (throws → `400 WEBHOOK_INVALID_SIGNATURE`); **dedupe**: `WebhookEvent.create` fails on duplicate primary key → return 200 early, having done nothing; on `payment_intent.succeeded` → find the `Payment` by intent id, mark `SUCCEEDED`, call `syncPaymentStatus`; on `payment_intent.payment_failed` → `Payment` state `FAILED`, order stays `UNPAID` so the customer can retry; emit `payment:changed`; always respond 200 quickly |
| `markCash(orderId, amount?, tipAmount?, actor)` | `requireRole(STAFF, ADMIN)`; `amount` defaults to the outstanding balance and is validated against it; insert `Payment(SUCCEEDED, CASH, actorId, tipAmount)` (TIP-02); `syncPaymentStatus`; emit |
| `syncPaymentStatus(orderId)` | The **only** writer of `Order.paymentStatus`. `UNPAID` when `paidSum == 0`, `PARTIALLY_PAID` when `0 < paidSum < total`, `PAID` when `paidSum >= total`, `REFUNDED` when a refund has been recorded. Because it is derived, appending items to a paid order (§4.4) drops it back to `PARTIALLY_PAID` with no special case |
| `refund(orderId, reason, actor)` | ADMIN only (PAY-09, SRS App. B). Requires a `SUCCEEDED` payment; the order may be `COMPLETED` **or** `CANCELLED` — the common case is a customer who paid at checkout and then cancelled while `PLACED` (AC-13). Issue the Stripe refund (cash payments are reversed as a records-only refund), set each `Payment` to `REFUNDED`, set `paymentStatus = REFUNDED`, write an `AuditLog` row, emit `payment:changed`. **The order's status is not touched** |
| `paidSum(orderId)` | Σ `amount` over `SUCCEEDED` payments, excluding tips — tips are not payment toward the order balance |

### 4.6 Tables Module
| Function | Behavior |
|---|---|
| `createTable`, `updateTable`, `regenerateQr` | ADMIN; qrToken = `crypto.randomBytes(16).toString('hex')` |
| `resolveQr(token)` | public; rate-limited; **read-only** — returns the table summary and never mutates |
| `openSession(token)` | public; rate-limited; `FREE → SEATED` (emit `table:changed`), attaches to an existing `SEATED` session, or `409 TABLE_DIRTY`. A POST, because it changes state (§3.5) |
| `setStatus(id, status)` | STAFF; emits `table:changed` |
| `closeTable(id)` | STAFF; asserts no open orders (BR-08) else `409 TABLE_HAS_OPEN_ORDERS`; `SEATED → DIRTY` |
| `cleanTable(id)` | STAFF; `DIRTY → FREE` — the step that actually frees the table |
| `createReservation / list / seat / cancel` | seat = table SEATED + reservation SEATED |

### 4.7 Discounts Module
CRUD (ADMIN) + `validateCode(code, subtotal)` used by preview & create order.

### 4.8 Reports Module (read-only)
**One revenue definition (BR-16), stated once and reused by every query below.** Net sales are what
the restaurant sold; they exclude tax, service charge, delivery fees and tips, which are pass-through
or discretionary, and they exclude orders that were cancelled or refunded. Amounts *collected* are a
different number and come from payment records, not from order totals — which is also the only way
RPT-05's by-payment-method breakdown can exist.

```sql
-- the shared scope, referred to below as <scope>
  FROM "Order" o
 WHERE o."status" <> 'CANCELLED'
   AND o."paymentStatus" <> 'REFUNDED'
   AND o."businessDate" BETWEEN $1 AND $2
```

| Function | SQL essence |
|---|---|
| `salesSummary(from,to)` | `SELECT count(*) AS orders, sum(o."subtotal" - o."discountAmount") AS "netSales", sum(o."taxAmount") AS "taxCollected", sum(o."serviceCharge") AS "serviceCharge", sum(o."deliveryFee") AS "deliveryFees", sum(o."tipAmount") AS tips, avg(o."subtotal" - o."discountAmount") AS aov` + `<scope>` |
| `revenueByDay(from,to)` | `SELECT o."businessDate" AS d, sum(o."subtotal" - o."discountAmount") AS "netSales", count(*) AS orders` + `<scope>` + `GROUP BY o."businessDate" ORDER BY 1` — grouping on the stored business date, never on `date_trunc('day', "placedAt")`, which buckets by UTC |
| `topItems(from,to,limit,metric)` | `SELECT oi."menuItemId", max(oi."nameSnapshot") AS name, sum(oi."qty") AS qty, sum(oi."lineTotal") AS revenue FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId" WHERE <scope predicates> GROUP BY oi."menuItemId" ORDER BY … DESC LIMIT $3` — grouped by **id**, with the name carried only for display |
| `peakHours(from,to)` | `SELECT extract(hour FROM (o."placedAt" AT TIME ZONE $tz)) AS h, count(*)` + `<scope>` + `GROUP BY h ORDER BY h` — converted to the restaurant timezone, otherwise every bar is shifted by the UTC offset |
| `salesByType(from,to)` | `SELECT o."type", sum(o."subtotal" - o."discountAmount")` + `<scope>` + `GROUP BY o."type"` |
| `collectedByMethod(from,to)` | `SELECT p."method", sum(p."amount") FILTER (WHERE p."state" = 'SUCCEEDED') - sum(p."amount") FILTER (WHERE p."state" = 'REFUNDED') AS collected, sum(p."tipAmount") FILTER (WHERE p."state" = 'SUCCEEDED') AS tips FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId" WHERE o."businessDate" BETWEEN $1 AND $2 GROUP BY p."method"` |
| `cancellations(from,to)` | orders with `status = 'CANCELLED'` joined to their final `OrderEvent` for the reason, unioned with orders whose `paymentStatus = 'REFUNDED'` — both deliberately *outside* `<scope>` (RPT-06) |

Two mechanical notes. Identifiers are quoted because Prisma's default mapping gives Postgres
mixed-case names (§1) — unquoted `from orders` does not resolve. And every value is a bound
parameter; no report string is concatenated (NFR-S6).

All executed server-side; results cached 60 s per `(from, to)` key.

### 4.9 Realtime Module
```ts
// realtime/index.ts
io.use(socketAuth)   // token ABSENT -> connect as anonymous; token PRESENT but invalid -> reject
io.on('connection', socket => {
  socket.join('menu')                    // everyone, including anonymous browsers
  const user = socket.data.user          // undefined for anonymous sockets
  if (!user) return

  const { role } = user
  if (canAccessKitchen(role)) socket.join('kitchen')
  if (canAccessPos(role))     socket.join('pos')
  if (role === 'ADMIN')       socket.join('admin')
  socket.on('customer:watch', (orderId) =>
    assertOwner(orderId, user) && socket.join(`customer:${orderId}`))
})
// publish façade
events.publish('order:new', payload, { rooms: ['kitchen', 'pos', 'admin'] })
```

**Anonymous sockets are supported on purpose.** BROWSE-01 lets a guest browse without logging in and
AC-7 requires an 86'd item to vanish from that guest's menu in real time — which cannot happen if the
handshake rejects tokenless connections. Absent and invalid are treated differently: no token means
anonymous (`menu` only), a bad token is rejected outright. No client can self-join a privileged room;
every other `join` is server-side and role-checked.

Emission always happens **after** commit (HLD §8.2) — services call `events.publish` as their final
step, so no client ever sees an event for a rolled-back write.

### 4.10 Jobs Module
| Job | Interval | Purpose |
|---|---|---|
| `reconcilePayments` | 5 min | orders UNPAID but Stripe says succeeded → repair (safety net) |
| `expireStaleSessions` | 15 min | tables SEATED with no open orders for > N hours → DIRTY |
| `purgeIdempotencyKeys` | hourly | delete `IdempotencyKey` rows older than 24 h |
| `purgeRefreshTokens` | daily | delete `RefreshToken` rows past `expiresAt`, and revoked rows older than 30 days (AUTH-14) |
| `reservationAlerts` | 1 min | flag overdue reservations for staff socket room |

---

## 5. API Specification

Legend: 🔓 public · 🔒 auth any · 👤 customer · 🛎 staff · 🛠 admin

### 5.1 Auth
| Method | Path | Access | Request → Response |
|---|---|---|---|
| POST | `/api/v1/auth/register` | 🔓 | `{name,email,password}` → `201 {user, accessToken, expiresIn}` + `Set-Cookie: rt=…` |
| POST | `/api/v1/auth/login` | 🔓 | `{email,password}` → `200 {user, accessToken, expiresIn}` + `Set-Cookie: rt=…` |
| POST | `/api/v1/auth/refresh` | 🍪 cookie | → `200 {accessToken, expiresIn}` + rotated `Set-Cookie`. Errors `401` `REFRESH_TOKEN_INVALID`, `SESSION_EXPIRED`, `SESSION_REVOKED` |
| POST | `/api/v1/auth/logout` | 🍪 cookie | revokes that refresh token, clears the cookie → `204` |
| POST | `/api/v1/auth/logout-all` | 🔒 | revokes every session for the user → `204` |
| GET | `/api/v1/auth/sessions` | 🔒 | → `200 {data: SessionDTO[]}` (AUTH-13) |
| DELETE | `/api/v1/auth/sessions/:familyId` | 🔒 | revoke one session → `204` |
| GET | `/api/v1/auth/me` | 🔒 | → `200 UserDTO` |

### 5.2 Menu
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/v1/menu` | 🔓 | → `{ categories: [{ id, name, sortOrder, items: MenuItemDTO[] }] }` |
| GET | `/api/v1/menu/items/:id` | 🔓 | detail + modifier groups |
| POST | `/api/v1/staff/menu/categories` | 🛠 | create |
| PATCH | `/api/v1/staff/menu/categories/:id` | 🛠 | update/reorder |
| DELETE | `/api/v1/staff/menu/categories/:id` | 🛠 | soft (`isActive=false`) |
| POST | `/api/v1/staff/menu/items` | 🛠 | `{categoryId,name,price,...}` |
| PATCH | `/api/v1/staff/menu/items/:id` | 🛠 | |
| DELETE | `/api/v1/staff/menu/items/:id` | 🛠 | soft delete (BR-11) |
| PATCH | `/api/v1/staff/menu/items/:id/availability` | 🛎🛠 | 86 toggle `{isAvailable}` |
| POST | `/api/v1/staff/menu/items/:id/modifier-groups` | 🛠 | attach group |
| CRUD | `/api/v1/staff/menu/modifier-groups[/:id]` | 🛠 | groups + items |

### 5.3 Orders
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/v1/orders/preview` | 🔓 | cart + discountCode + tipAmount → `PricingBreakdown`; public so a guest can see authoritative totals before logging in |
| POST | `/api/v1/orders` | 🔒 | `CreateOrderDTO` → `201 OrderDTO` (see below). Honours `Idempotency-Key` |
| GET | `/api/v1/orders` | 🔒 | role-scoped; query: `status[],type,from,to,tableId,page,limit` (`from`/`to` are business dates) |
| GET | `/api/v1/orders/:id` | 🔒 | ownership/role checked |
| GET | `/api/v1/orders/:id/events` | 🔒 | audit timeline |
| GET | `/api/v1/orders/:id/receipt` | 👤 own / 🛎🛠 | `ReceiptDTO`, built entirely from snapshots (PRINT-01/02/04) |
| POST | `/api/v1/orders/:id/items` | 👤 own / 🛎🛠 | append items (ORD-12); `{ items: [...] }` → `200 OrderDTO`; `409 ORDER_NOT_AMENDABLE` past `PREPARING` |
| PATCH | `/api/v1/orders/:id/status` | 🛎🛠 | `{ to, reason? }` → `200 OrderDTO` / `409` |
| POST | `/api/v1/orders/:id/cancel` | 👤 own / 🛎 | only PLACED/CONFIRMED |
| PATCH | `/api/v1/orders/:id/delivery` | 🛎🛠 | `{ driverName?, status? }` → `200 OrderDTO`; one step at a time `PENDING → ASSIGNED → PICKED_UP → DELIVERED`, independent of order status; naming a driver on PENDING assigns it; driver changeable until pick-up (DEL-03/04, ADR-025) |

**CreateOrderDTO**
```jsonc
{
  "type": "DINE_IN",              // DINE_IN | TAKEAWAY | DELIVERY
  "tableToken": "abc123...",      // DINE_IN only (from QR)
  "customer": { "name": "Jane", "phone": "+1555..." },  // required TAKEAWAY/DELIVERY
  "delivery": { "address": "...", "note": "..." },       // DELIVERY only
  "items": [
    { "menuItemId": "uuid", "qty": 2,
      "modifierItemIds": ["uuid","uuid"], "notes": "no onions" }
  ],
  "discountCode": "SAVE10",       // optional
  "tipAmount": 300,               // optional, cents (TIP-01); never discounted or taxed
  "notes": "extra napkins"
}
```
Sent with an optional `Idempotency-Key` header; replaying the same key returns the original
`201` response rather than placing a second order (NFR-R5).
**OrderDTO** (response): id, orderNumber, businessDate, type, status, items[] (with snapshots),
totals{ subtotal, discountAmount, serviceCharge, taxAmount, deliveryFee, tipAmount, total },
paymentStatus, amountPaid, balanceDue, table?, placedAt, nextStatuses[] (role-filtered, drives the
client's action buttons), isAmendable.

**Error codes:** `400 VALIDATION_ERROR` · `401 UNAUTHENTICATED|ACCOUNT_DISABLED` · `403 FORBIDDEN` ·
`404 ORDER_NOT_FOUND` · `409 ILLEGAL_TRANSITION|CONCURRENT_UPDATE|ITEM_UNAVAILABLE|TABLE_DIRTY|ORDER_NOT_AMENDABLE|TABLE_HAS_OPEN_ORDERS|TABLE_NUMBER_TAKEN|NOT_A_DELIVERY|TABLE_OCCUPIED` ·
`422 DISCOUNT_*|EMPTY_CART|ZERO_TOTAL|INVALID_MODIFIER_SELECTION|PAYMENT_EXCEEDS_BALANCE|IDEMPOTENCY_KEY_REUSED|REFUND_NOT_AVAILABLE|DRIVER_REQUIRED|RESERVATION_IN_PAST|RESERVATION_TOO_FAR|TABLE_REQUIRED` ·
`429 RATE_LIMITED`.

### 5.4 Payments
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/api/v1/payments/intent` | 👤 own / 🛎🛠 | `{orderId, amount?}` → `{clientSecret, publishableKey, amount}`; `amount` defaults to the outstanding balance and may be less for a split payment (PAY-06). Honours `Idempotency-Key` |
| POST | `/api/v1/payments/webhook` | 🔓 (signed) | Stripe raw body (`express.raw`, not the JSON parser). A bad signature returns `400 WEBHOOK_INVALID_SIGNATURE`, which Stripe retries; every accepted event returns `200` quickly, including a duplicate that the dedupe short-circuits |
| POST | `/api/v1/payments/cash` | 🛎🛠 | `{orderId, amount?, tipAmount?}` (balance by default; `tipAmount` records a cash tip — TIP-02) |
| POST | `/api/v1/payments/refund` | 🛠 | `{orderId, reason}` — valid against a `COMPLETED` or `CANCELLED` order holding a successful payment; sets `paymentStatus` only |
| GET | `/api/v1/payments/order/:orderId` | 🔒 | payment records (role-scoped) |

### 5.5 Tables & Reservations
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/v1/tables` | 🛎🛠 | map view with status |
| POST | `/api/v1/tables` | 🛠 | `{number, seats}` |
| PATCH | `/api/v1/tables/:id` | 🛎🛠 | status/number update |
| POST | `/api/v1/tables/:id/regenerate-qr` | 🛠 | new token |
| GET | `/api/v1/tables/qr/:token` | 🔓 | **read-only** resolve of token → table summary (rate-limited) |
| POST | `/api/v1/tables/sessions` | 🔓 | `{token}` → opens the dine-in session (rate-limited). A POST because it seats the table |
| POST | `/api/v1/tables/:id/close` | 🛎🛠 | SEATED → DIRTY; asserts no open orders (BR-08) |
| POST | `/api/v1/tables/:id/clean` | 🛎🛠 | DIRTY → FREE |
| POST | `/api/v1/reservations` | 🔒 | `{guestName, guestPhone, partySize 1–20, slotAt, notes?, tableId?}`; `tableId` staff only; slot in the future and ≤ 90 days ahead |
| GET | `/api/v1/reservations?date=` | 🛎🛠 | one business date in the restaurant timezone (today by default); each row carries `overdue` |
| PATCH | `/api/v1/reservations/:id` | 🛎🛠 | `{action:'seat', tableId?}` → table `FREE → SEATED` + booking `SEATED` in one transaction (never joins an occupied table) · `{action:'cancel'}`; PENDING only (ADR-025) |

### 5.6 Discounts & Settings
| Method | Path | Access |
|---|---|---|
| CRUD | `/api/v1/staff/discounts` | 🛠 |
| POST | `/api/v1/discounts/validate` | 🔒 `{code, subtotal}` → `{valid, discount}` |
| GET | `/api/v1/settings` | 🔓 public subset: `taxBps`, `serviceChargeBps`, `serviceChargeTaxable`, `deliveryFee`, `currency`, `tipPresetsBps` — everything `computeTotals` needs for the client preview to match the server — plus `timezone`, so bookings are made in restaurant time (ADR-024) |
| PUT | `/api/v1/staff/settings` | 🛠 full set |

### 5.7 Reports
| Method | Path | Access | Query |
|---|---|---|---|
| GET | `/api/v1/reports/summary` | 🛠 | `from,to` → `{orders,revenue,aov}` |
| GET | `/api/v1/reports/revenue-by-day` | 🛠 | → `[{date, revenue, orders}]` |
| GET | `/api/v1/reports/top-items` | 🛠 | `limit,metric` |
| GET | `/api/v1/reports/peak-hours` | 🛠 | → `[{hour, count}]` |
| GET | `/api/v1/reports/breakdowns` | 🛠 | by type / by payment method |
| GET | `/api/v1/reports/cancellations` | 🛠 | |

### 5.8 Dashboard
| GET | `/api/v1/dashboard/today` | 🛠 | `{orders, netSales, activeTickets, tables{free,seated,dirty}, unavailableItems: [...]}` — scoped to the current business date. Renamed from `lowStock86`, which implied the inventory tracking SRS §1.2 puts out of scope; the field is simply the list of 86'd items |

---

### 5.9 Branches & Contact (ADR-032)
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/api/v1/branches` | 🔓 | active branches as `BranchDto` |
| GET | `/api/v1/staff/branches` | 🛠 | every branch, inactive included |
| PATCH | `/api/v1/staff/branches/:id` | 🛠 | any of names, addresses, phones, whatsapp, `lat`+`lng` together, hours, isActive; audited `BRANCH_UPDATE` · 404 `BRANCH_NOT_FOUND` |
| POST | `/api/v1/contact` | 🔓 | `{name, phone, kind, message 5–1000, branchId?, tableNumber?, visitDate?}` → `201 {id}`; 5 per 15 min per IP · 404 `BRANCH_NOT_FOUND` |
| GET | `/api/v1/staff/messages?unread=&kind=&branchId=&page=&limit=` | 🛠 | newest first; `{data, meta, unread}` |
| PATCH | `/api/v1/staff/messages/:id` | 🛠 | `{read}`; keeps the first read time; audited `CONTACT_MESSAGE_UPDATE` · 404 `MESSAGE_NOT_FOUND` |

## 6. Realtime Protocol

### 6.1 Namespaces & Auth
- Default namespace. `auth: { token }` in the handshake is **optional**: absent → an anonymous socket joined only to `menu`; present and invalid → `connect_error`. Anonymous connections exist so a guest browsing without an account still sees 86'ing in real time (BROWSE-01, AC-7).
- Rooms joined server-side per §4.9 (client cannot self-join privileged rooms).

### 6.2 Event Catalog

| Event | Rooms | Payload | Emitted when |
|---|---|---|---|
| `order:new` | kitchen, pos, admin | `OrderSummaryDTO` | order committed |
| `order:status` | kitchen, pos, admin, `customer:{id}` | `{ orderId, orderNumber, from, to, at, order? }` | any transition, and on amendment (`from === to`, with the refreshed order) |
| `order:removed` | kitchen, pos | `{ orderId, reason }` | cancelled — a refund no longer removes a ticket, because it no longer changes order status |
| `payment:changed` | pos, admin, `customer:{id}` | `{ orderId, paymentStatus, amountPaid, balanceDue }` | any payment recorded, failed, or refunded |
| `table:changed` | pos, admin | `{ tableId, number, status }` | table state change |
| `menu:changed` | menu (all) | `{ itemId?, categoryId? }` | admin menu edit / 86 |
| `metrics:update` | admin | `{ ...dashboardToday }` | every order/payment change (throttled 5 s) |
| `reservation:flag` | pos | `{ reservationId, state:'OVERDUE' }` | job |
| `message:new` | admin | `{ id, kind, unread }` | contact message committed (ADR-032) |

### 6.3 Client Responsibilities
1. On `connect` → refetch snapshot (REST) — events are hints, not source of truth.
2. On `order:status` → TanStack Query `invalidateQueries(['order', id])`.
3. On reconnect after > 60 s → full resync of visible lists.
4. KDS safety poll every 30 s regardless of socket state.

---

## 7. Frontend Design

### 7.1 Routing & Guards
```
/                       → landing (role-aware redirect)
/menu                   → customer menu (QR: /t/:token → sets table context)
/cart  /checkout        → cart & payment
/orders/:id             → live tracker (poll + socket)
/login /register

/kitchen                → KDS (roles: STAFF, ADMIN)
/pos                    → terminal (STAFF, ADMIN)
/pos/tables             → table map
/admin                  → dashboard
/admin/menu  /admin/discounts  /admin/reports  /admin/settings  /admin/staff
```
`<RequireRole roles={[...]}>` wrapper → redirect to `/login` with `returnTo`.

### 7.2 State Ownership
| State | Owner | Mechanism |
|---|---|---|
| Auth (user, token) | client | Zustand + `localStorage` (`persist` middleware) |
| Cart | client | Zustand persist; cleared on successful order |
| Table session | client | URL param + sessionStorage; the token, never a table id — the server resolves it (AC-12) |
| Tip selection | client | part of the cart store; sent with the order and re-priced server-side |
| Menu, orders, reports | server | TanStack Query (keys: `['menu']`, `['orders', filters]`, …) |
| Live status | server | socket events → query invalidation |

### 7.3 Key Components
```
customer:  MenuGrid · MenuItemCard · ModifierDialog · CartDrawer ·
           CheckoutForm · TipSelector · StripePaymentElement ·
           OrderTracker (stepper) · AddToOrderPanel · Receipt (print stylesheet)
kitchen:   TicketColumn · TicketCard (timer, colour band + text label) ·
           BumpButton · StationFilter · TicketPrintButton
pos:       OrderBuilder (left) · CartPanel (right) · TableMap · PaymentModal
admin:     Sidebar · MenuItemForm · DiscountForm · KpiCards · RevenueChart ·
           TopItemsTable · PeakHoursChart · SettingsForm
shared:    StatusBadge · Money (fmt) · DataTable · Modal · Toast · EmptyState
```

### 7.4 Customer Checkout Sequence
```
CartDrawer [Checkout]
 → POST /orders/preview (public; server totals shown before any login)
 → TipSelector → re-preview with tipAmount
 → if !user → /login (returnTo=/checkout)
 → POST /orders  (Idempotency-Key: <uuid>) → 201 {orderId, total, balanceDue}
 → POST /payments/intent {orderId} → {clientSecret, amount}
 → stripe.confirmPayment({ elements }) 
     success → navigate /orders/:id (tracker, socket live)
     failure → show card error, retry stays on page
 (server webhook flips paymentStatus → tracker shows PAID)
```

### 7.5 KDS Rendering Rules
- Columns: `PLACED | CONFIRMED | PREPARING | READY | SERVED` (configurable set). Completed tickets linger for `kdsCompletedGraceSec` then auto-hide (KDS-07).
- Ticket shows: orderNumber, table/type badge, elapsed timer (updates 1 s), item lines with modifiers highlighted, notes in red. Items added after placement are badged as a later course with their own timestamp (ORD-12).
- Aging: elapsed < `kdsGreenSec` → green; < `kdsAmberSec` → amber; else red. **Each band also carries a text label** (`On time` / `Slow` / `Late`) — colour alone would fail WCAG 1.4.1 and is unreadable to a colour-blind cook under kitchen lighting (NFR-U3).
- Bump = `PATCH /orders/:id/status` with `to = FORWARD_TRANSITION[current]`, never the first element of an allowed-transitions array; optimistic UI + rollback on 409 with toast `Ticket was updated elsewhere — refreshing…`.

---

## 8. Error Handling Catalog

```ts
abstract class AppError extends Error { code: string; status: number; details? }
class ValidationError   status 400  code VALIDATION_ERROR
class AuthError         status 401  code UNAUTHENTICATED
class ForbiddenError    status 403  code FORBIDDEN
class NotFoundError     status 404  code *_NOT_FOUND
class ConflictError     status 409  code ILLEGAL_TRANSITION | CONCURRENT_UPDATE | ...
class BusinessRuleError status 422  code DISCOUNT_MIN_NOT_MET | EMPTY_CART | ...
class RateLimitError    status 429  code RATE_LIMITED
```

| Scenario | Code | HTTP | Client behavior |
|---|---|---|---|
| Zod failure | VALIDATION_ERROR | 400 | field-level inline errors |
| Bad/expired token | UNAUTHENTICATED | 401 | clear auth → /login |
| Account disabled or demoted mid-session | ACCOUNT_DISABLED | 401 | clear auth → /login with explanation |
| Refresh cookie absent or unrecognised | REFRESH_TOKEN_INVALID | 401 | clear auth → /login |
| Refresh token past its 30-day life | SESSION_EXPIRED | 401 | clear auth → /login |
| Rotated refresh token replayed — theft | SESSION_REVOKED | 401 | clear auth → /login, warn that the session was ended for safety |
| Tampered / incomplete modifier selection | INVALID_MODIFIER_SELECTION | 422 | reopen the modifier dialog on that line |
| Append to an order past PREPARING | ORDER_NOT_AMENDABLE | 409 | disable "add to order", refetch |
| Payment above the outstanding balance | PAYMENT_EXCEEDS_BALANCE | 422 | re-read balance, re-render amount field |
| Refund requested with no successful payment | REFUND_NOT_AVAILABLE | 422 | disable the refund action, explain why |
| Table created with a number already in use | TABLE_NUMBER_TAKEN | 409 | inline error on the number field |
| Same Idempotency-Key, different body | IDEMPOTENCY_KEY_REUSED | 422 | client bug — log, do not retry |
| Customer hits admin route | FORBIDDEN | 403 | toast + redirect |
| Illegal bump | ILLEGAL_TRANSITION | 409 | refetch list, toast |
| Two staff bump same ticket | CONCURRENT_UPDATE | 409 | silent refetch |
| Item 86'd during checkout | ITEM_UNAVAILABLE | 409 | remove line, highlight |
| Bad promo | DISCOUNT_* | 422 | inline under promo field |
| Stripe webhook sig fail | WEBHOOK_INVALID_SIGNATURE | 400 | Stripe retries |
| Unhandled | INTERNAL_ERROR | 500 | toast w/ requestId for support |

Middleware maps `AppError` → JSON; unknown errors → logged with stack + `500 INTERNAL_ERROR` (stack never sent to client).

---

## 9. Security Implementation Details

| Concern | Implementation |
|---|---|
| Password | `bcrypt.hash(pw, 12)`; compare with `bcrypt.compare` (timing-safe default) |
| Access token | `jose`, HS256, payload `{sub, role, name, sid}`, **15 min** exp; verified in `authenticate` and the socket middleware; held in memory only by the client, never in `localStorage` (AUTH-12) |
| Refresh token | 32 random bytes from `crypto.randomBytes`, base64url; stored only as a SHA-256 hash; delivered as `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000`; rotated on every use with reuse detection (AUTH-11) |
| CSRF | `SameSite=Strict` keeps the refresh cookie off cross-site requests. `/auth/refresh` additionally requires the header `X-Refresh-Request: 1`, which a cross-origin form cannot set without a preflight the allow-list refuses |
| Role gate | `requireRole(...roles)` before handler; ownership re-checked inside service (defense in depth) |
| Validation | Zod `.strict()` — unknown keys rejected (SRS NFR-S5 now states the same; v1.0 said "stripped", which is the opposite behaviour) |
| Privilege freshness | `isActive` and role re-read per request, briefly cached — a disabled or demoted account loses access immediately rather than at token expiry (AC-18) |
| Modifier tampering | Every submitted modifier id re-resolved against the groups attached to that item, checked for availability and against `minSelect`/`maxSelect`, and re-priced from the DB (AC-17) |
| Unsafe-method discipline | No GET mutates. Opening a table session is a POST, so prefetchers and link previews cannot seat tables |
| Rate limit | `express-rate-limit`: `/auth/login` and `/auth/register` 10/15 min/IP; `/auth/refresh` 60/15 min/IP (an always-on device refreshes ~4×/hour, so this is generous but still caps a brute-force); `POST /orders` 30/5 min/user; general 300/5 min |
| CORS | explicit allow-list from env `CLIENT_ORIGINS`, **`credentials: true`** so the refresh cookie is sent. A wildcard origin is impossible alongside credentials and browsers reject it — the allow-list is mandatory, not advisory |
| Helmet | JSON-API profile: `default-src 'none'; frame-ancestors 'none'`, HSTS 1 year with subdomains, `nosniff`, `Referrer-Policy: no-referrer`, same-site CORP. The API serves no HTML, so it needs no SPA CSP; the client's host sets its own |
| Body parsing | JSON with size cap 256 KB; **raw body kept** for `/payments/webhook` (`express.raw`) |
| Stripe verify | `stripe.webhooks.constructEvent(body, sig, endpointSecret)` |
| Webhook dedupe | unique PK on event id; duplicate → 200 early return |
| QR tokens | 16 random bytes hex; lookup rate-limited; no user data in token |
| Logging redaction | logger redacts `authorization`, `cookie`, `password`, `token`, `accessToken`, `refreshToken` fields; one line per request with the request id, the path **without its query string**, status, duration and user id |
| E2E switch | `RATE_LIMITS_DISABLED=true` turns the limiters off for browser test runs only; the env schema refuses it when `NODE_ENV=production` |
| PII | DTO mappers expose phone/address only to owner + staff |

---

## 10. Test Design

### 10.1 Unit Tests (Vitest, no IO)

**Pricing (`shared/domain/pricing.test.ts`)**
| # | Case | Expect |
|---|---|---|
| P1 | single line, no modifiers | line = price×qty; totals chain correct |
| P2 | modifier deltas summed per unit **before** ×qty | `(1000 + 200 − 100) × 2 = 2200` |
| P3 | percent discount rounding half-up | subtotal 999, 1000 bps → 100 off |
| P4 | fixed discount > subtotal | discount capped at subtotal (total ≥ 0) |
| P5 | TAKEAWAY → serviceCharge = 0 | |
| P6 | DELIVERY → deliveryFee added, not discounted (BR-10) | |
| P7 | discount reduces tax base (BR-03) | |
| P8 | empty cart → EMPTY_CART error | `ZERO_TOTAL` is kept for a non-empty cart that prices to 0 |
| P9 | `serviceChargeTaxable = true` vs `false` on the same cart | tax differs by exactly `bps(serviceCharge, taxBps)` (BR-03) |
| P10 | tip present | raises `total` by the tip and changes neither `discountAmount` nor `taxAmount` (BR-13) |
| P11 | negative modifier delta forcing a negative intermediate | `bps()` rounds half-away-from-zero, so client and server agree to the cent |
| P12 | rates given in bps | `taxBps = 875` on 1000 → 88, with no float anywhere in the chain (NFR-R2) |

**State machine (`shared/domain/order-status.test.ts`)**
| # | Case | Expect |
|---|---|---|
| S1 | every listed transition allowed for a permitted role | true |
| S2 | backward transitions rejected (PREPARING→CONFIRMED) | false |
| S3 | COMPLETED and CANCELLED are terminal — no outgoing edge exists | `nextStatuses` empty for both |
| S4 | skip-forward rejected (PLACED→PREPARING) | false (BR-12) |
| S5 | role gates are per edge: CUSTOMER may take PLACED→CANCELLED but not PLACED→CONFIRMED | false / true respectively |
| S6 | CUSTOMER cannot transition out of PREPARING | false |
| S7 | `nextStatuses('PLACED', 'STAFF')` = [CONFIRMED, CANCELLED]; `nextStatuses('PLACED', 'CUSTOMER')` = [CANCELLED] | drives UI |
| S8 | `FORWARD_TRANSITION` is null for every terminal state | a bump can never be issued from one |

**Discounts** — expired, min not met, limit reached, stacking prevention.

### 10.2 Integration / API Tests (test DB)
| # | Case | Assert |
|---|---|---|
| I1 | register → login → me | 201/200/200, JWT works |
| I2 | duplicate email | 409 EMAIL_TAKEN |
| I3 | customer calls admin route | 403 |
| I4 | create order happy path | totals match computeTotals; snapshot fields set |
| I5 | create order with 86'd item | 409 ITEM_UNAVAILABLE |
| I6 | status transition valid/invalid | 200 / 409 |
| I7 | concurrent transition | one 200, one 409 |
| I8 | webhook (constructed fixture, valid sig) | paymentStatus→PAID once |
| I9 | same webhook replayed | second returns 200, no double write |
| I10 | cash payment by CUSTOMER | 403 |
| I11 | QR of table A → order has tableId A | |
| I12 | free table with open orders | 409 TABLE_HAS_OPEN_ORDERS |
| I13 | reports summary vs the seed's own emitted fixture | equal (not report SQL against report SQL — AC-9) |
| I14 | discount validation errors mapped | 422 with specific code |
| I15 | modifier from a different item, or a group below `minSelect` | 422 INVALID_MODIFIER_SELECTION, order not created (AC-17) |
| I16 | discount at `usageLimit`; two concurrent redemptions of the last one | one 201, one 422 DISCOUNT_LIMIT_REACHED; `usedCount` never exceeds the limit |
| I17 | append items to a PAID order | 200; total rises, `paymentStatus` becomes PARTIALLY_PAID, AuditLog row written (AC-14) |
| I18 | append items to a READY order | 409 ORDER_NOT_AMENDABLE |
| I19 | pay by card, cancel while PLACED, then refund | refund succeeds; `paymentStatus` REFUNDED, `status` still CANCELLED (AC-13) |
| I20 | split payment: card for part, cash for the rest | PARTIALLY_PAID then PAID; a third payment attempt → 422 PAYMENT_EXCEEDS_BALANCE |
| I21 | `POST /orders` twice with the same Idempotency-Key | one order; second call replays the first response |
| I22 | order placed 00:30 local in a UTC+3 deployment | `businessDate` is the local day; it appears in that day's report, not the previous one (AC-16) |
| I23 | order numbers across two business dates | `A-1001` reissued on day two without a unique violation |
| I24 | disable a staff account, then reuse its unexpired token | 401 ACCOUNT_DISABLED (AC-18) |
| I25 | anonymous socket connects, admin 86's an item | `menu:changed` received without a token (AC-7) |
| I26 | `GET /tables/qr/:token` | table status unchanged; only `POST /tables/sessions` seats it |
| I27 | receipt after the item's menu price changes | shows the price charged at order time (AC-19) |
| I28 | refresh with a valid cookie | new access token; the old refresh token is revoked and a new one set |
| I29 | replay a rotated refresh token | 401 SESSION_REVOKED, and every token in the family is revoked (AC-21) |
| I30 | refresh after the account is disabled | 401 ACCOUNT_DISABLED; no new access token issued |
| I31 | logout, then refresh with the same cookie | 401 REFRESH_TOKEN_INVALID |
| I32 | 48 h of repeated refreshes | never requires credentials; session survives (AC-20) |

### 10.3 E2E Smoke (Playwright, phase 7)
1. Customer: open menu → add item with modifier → cart shows correct total → login → pay with test card → tracker visible.
2. Staff: open KDS → new ticket appears < 500 ms → bump through all states → ticket completes.
3. Admin: 86 an item → customer menu shows sold out (realtime).
4. Admin: run report for seeded range → numbers match the seed's emitted fixture.
5. Customer: add a tip at checkout → total rises by exactly the tip, tax unchanged; receipt prints with every component itemised.
6. Dine-in: place an order, pay, then append a second round → ticket updates on the KDS with the new course badged, order returns to PARTIALLY_PAID, balance settles by cash.

### 10.4 Non-Functional Verification
- Lint/typecheck gate in CI (`npm run lint && npm run typecheck`).
- k6/autocannon smoke: 100 concurrent `GET /menu` sustained 30 s → p95 < 300 ms (NFR-P1).

---

## Appendix A — LLD ↔ HLD/SRS Traceability

| LLD section | Realizes |
|---|---|
| §2 DB | SRS §6, HLD §6 |
| §3.1 state machine | SRS ORD-02/03/04, BR-06/07/12; HLD §9.2 |
| §3.2 pricing | SRS CART-*, BR-01..04,10; HLD §9.1 |
| §4 modules | HLD §3 component inventory |
| §3.4 business date & numbering | SRS ORD-10, ORD-15, BR-15 |
| §5 API | SRS §5.5 conventions, all functional reqs |
| §4.4 `appendItems`, §5.3 | SRS ORD-12…14, BR-14 |
| §3.2 tip step, §4.5 `markCash`, §7.4 | SRS TIP-01…05, BR-13 |
| §4.4 `getReceipt`, §7.3, §7.5 | SRS PRINT-01…04 |
| §4.8 revenue definition | SRS RPT-01…07, BR-16 |
| §6 realtime | SRS ORD-06, KDS-02; HLD §8 |
| §7 frontend | SRS §5.1 UI, NFR-U1/U2 |
| §8 errors | SRS §5.5 error contract |
| §9 security | SRS NFR-S1..S10 |
| §10 tests | SRS §9 acceptance, NFR-M3 |

## Appendix B — Revision History
| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-09-25 | Dev Team | Initial release |
| 1.1 | 2026-09-25 | Dev Team | Design review. `REFUNDED` removed from `OrderStatus`; `PaymentStatus` gains `PARTIALLY_PAID`; `PaymentState` declared for payment records (§2.1). State machine re-expressed as per-edge role gates plus `FORWARD_TRANSITION` (§3.1). Pricing moved to basis points with a symmetric `bps()` helper, an explicit tax base and a tip step (§3.2). Discount redemption counted atomically (§3.3). `OrderSequence` and `businessDate` replace the `Setting`-based daily counter; `UNIQUE(businessDate, orderNumber)` fixes the day-two collision (§2.2, §3.4). `IdempotencyKey` model and contract added (§2.2, §5.3). Server-side modifier validation added (§4.3, §4.4). `appendItems` and `getReceipt` added (§4.4). `createIntent` takes a partial amount; `syncPaymentStatus` becomes the sole writer of `paymentStatus`; `refund` works on cancelled orders and no longer moves order status (§4.5). Table session split into read/open/close/clean (§3.5, §4.6). Reports rewritten around one revenue definition, business-date bucketing, `menuItemId` grouping and quoted identifiers (§4.8). Anonymous sockets admitted to `menu`; `payment:changed` added (§4.9, §6). Per-request `isActive` re-check (§4.2, §9). Tests P2 corrected and P9–P12, S1–S8, I15–I27 added (§10). |
| 1.2 | 2026-09-25 | Dev Team | Added the access/refresh token model. New `RefreshToken` model (§2.2) with rotation and reuse detection; auth module rewritten with the refresh algorithm (§4.2); new endpoints `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/sessions` (§5.1); session error codes (§8); token, CORS-credentials and CSRF rules (§9); purge job (§4.10); tests I28–I32. Supersedes the v1.1 note that no refresh tokens were needed — that reasoning did not account for always-on KDS devices (SRS §8.1). |
| 1.1.1 | 2026-09-25 | Dev Team | Admitted two error codes the API contract required and this document lacked: `REFUND_NOT_AVAILABLE` (422) and `TABLE_NUMBER_TAKEN` (409), added to §5.3 and §8. No behavioural change. |
| 1.3.2 | 2026-09-25 | Dev Team | Doc debt from the build: `Order` pricing-snapshot columns and `OrderItem.addedAt` / `lineNo` added to §2.2 (ADR-021); test P8 corrected to `EMPTY_CART`. |
| 1.4 | 2026-09-26 | Dev Team | Tenant site pages (ADR-032): `ContactKind` enum, `Branch` and `ContactMessage` entities (§2), branch and contact endpoints (§5.9), `message:new` event (§6.2), error codes `BRANCH_NOT_FOUND` and `MESSAGE_NOT_FOUND`. Additive; no existing behaviour changes. |
| 1.3.1 | 2026-09-25 | Dev Team | Built M13. §9 records what was implemented: the JSON-API helmet profile (not an SPA CSP), wider log redaction with per-request logs, and the E2E-only rate-limit switch. Behaviour elsewhere unchanged; see SECURITY.md and ACCEPTANCE.md. |
| 1.3 | 2026-09-25 | Dev Team | Built M12. Added `PATCH /orders/:id/delivery` (§5.3); specified the reservation request/response and rules (§5.5); `GET /settings` now includes `timezone` (§5.6); new error codes `NOT_A_DELIVERY`, `TABLE_OCCUPIED`, `DRIVER_REQUIRED`, `RESERVATION_IN_PAST`, `RESERVATION_TOO_FAR`, `TABLE_REQUIRED` (§5.3). See ADR-024, ADR-025. |
| 1.2.1 | 2026-09-25 | Dev Team | Money columns `bigint` → `integer` (§2.2) per ADR-004: integer cents as a Prisma `Int` / TS `number`, which agrees with §1. `SUM()` promotes to `bigint`, so aggregates are unaffected. No behavioural change. |
