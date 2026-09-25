# High Level Design (HLD)
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-HLD-001 |
| **Version** | 1.2.1 |
| **Status** | Draft |
| **Date** | 2026-09-25 |
| **Preceded by** | ROS-SRS-001 (SRS) |
| **Followed by** | ROS-LLD-001 (LLD) |

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Architecture Overview](#2-architecture-overview)
3. [System Components](#3-system-components)
4. [Monorepo & Workspace Layout](#4-monorepo--workspace-layout)
5. [Technology Stack & Justification](#5-technology-stack--justification)
6. [Data Architecture](#6-data-architecture)
7. [API Architecture](#7-api-architecture)
8. [Realtime Architecture](#8-realtime-architecture)
9. [Key Design Subsystems](#9-key-design-subsystems)
10. [Security Architecture](#10-security-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Cross-Cutting Concerns](#12-cross-cutting-concerns)
13. [Scalability & Evolution Path](#13-scalability--evolution-path)
14. [Risk Register](#14-risk-register)

---

## 1. Introduction

### 1.1 Purpose
This High Level Design document translates the SRS into an architecture: the major components, their responsibilities, the protocols between them, and the justifications for each major technology and pattern choice. It is intentionally technology-decision focused rather than class/method focused (that is the LLD's job).

### 1.2 Scope
Covers the complete ROS system: customer web app, kitchen display, POS, admin console, REST API, realtime gateway, relational persistence, payment integration, and deployment topology.

### 1.3 Design Goals
| Goal | How the design serves it |
|---|---|
| **Correctness first** | Single shared domain core (pricing + state machine) used by both client and server |
| **Demonstrate real patterns** | Layered modular monolith, event-driven realtime, webhook idempotency, RBAC |
| **Always runnable** | Phased vertical slices; no big-bang integration |
| **Testability** | Pure domain functions isolated from IO |
| **Honest portfolio quality** | TypeScript strict, error taxonomy, audit trail, observability hooks |

### 1.4 Architectural Style
**Modular monolith** with an **event-driven realtime edge**.

- A single Express process hosts domain modules (menu, orders, payments, tables, reports) with explicit boundaries.
- Reads/writes go through REST; state changes fan out over Socket.IO.
- Rationale: at restaurant scale (single venue, hundreds of orders/day) microservices would add distribution cost with zero benefit. Module boundaries preserve the option to extract later (e.g., KDS service).

---

## 2. Architecture Overview

### 2.1 System Context Diagram
```
                         ┌────────────────────────────┐
                         │        Stripe (test)       │
                         │  PaymentIntents / Refunds  │
                         └───────▲──────────┬─────────┘
                                 │ webhook  │ API (HTTPS)
                                 │ (HTTPS)  ▼
┌──────────┐  HTTPS/WSS  ┌───────┴──────────────────────┐      ┌──────────────┐
│ Customer │────────────►│                              │      │  PostgreSQL  │
│  Device  │◄────────────│      ROS Application        │◄────►│   (Prisma)   │
└──────────┘             │  ┌────────────────────────┐  │      └──────────────┘
                         │  │  REST API  /api/v1     │  │
┌──────────┐  HTTPS/WSS  │  ├────────────────────────┤  │      ┌──────────────┐
│  KDS /   │────────────►│  │  Socket.IO  Realtime   │  │      │ Docker Vol   │
│  POS /   │◄────────────│  ├────────────────────────┤  │      │  (persist)   │
│  Admin   │             │  │  Domain Modules        │  │      └──────────────┘
└──────────┘             │  └────────────────────────┘  │
                         └──────────────────────────────┘
                                    ▲
                                    │ SMTP (optional)
                         ┌──────────┴─────────┐
                         │  Email Provider    │
                         └────────────────────┘
```

### 2.2 Layered View (single process)
```
┌─────────────────────────────────────────────────────────────┐
│  Client Applications (React SPA)                           │
│  customer · kitchen · pos · admin  — role-gated routes      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (JSON) + WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│  Presentation Layer     routes/ · middleware/               │
│  (Express routers, Zod validation, auth, error mapping)     │
├─────────────────────────────────────────────────────────────┤
│  Application Layer      modules/*/…service.ts               │
│  (use-cases, transactions, orchestration, authorization)    │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer           shared/ (pure)                      │
│  (state machine, pricing engine, types, business rules)     │
├─────────────────────────────────────────────────────────────┤
│  Persistence Layer      modules/*/…repo.ts · Prisma         │
│  (queries, transactions, migrations)                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    └─────────────┘
```

**Rule of dependency:** outer layers depend inward; `shared/` domain code imports nothing from infrastructure.

### 2.3 Deployment Diagram
```
                      ┌──────────────────────────────────────┐
                      │           Docker Compose            │
                      │  ┌────────────┐    ┌──────────────┐  │
   Browser ──HTTPS──► │  │  node app  │───►│  postgres 15 │  │
   (KDS/POS/Client)   │  │ :3000 API  │    │  :5432       │  │
                      │  │ :5173 SPA* │    │  volume pg   │  │
                      │  └─────┬──────┘    └──────────────┘  │
                      └────────┼─────────────────────────────┘
                               │ webhook
                        ┌──────▼──────┐
                        │   Stripe    │
                        └─────────────┘
 * in dev; in prod the SPA is served as static files by the node app or a CDN
```

---

## 3. System Components

### 3.1 Component Inventory

| # | Component | Responsibility | Key SRS refs |
|---|---|---|---|
| C1 | **Customer Web** | Menu browsing, cart, checkout (incl. tip), live order tracking, QR landing, receipt view/print | BROWSE, CART, ORD, TIP, PRINT |
| C2 | **Kitchen Display (KDS)** | Real-time tickets, aging timers, bump actions, appended-course badges, ticket printing | KDS-01…07, ORD-12, PRINT-03 |
| C3 | **POS / Staff Terminal** | Counter order entry, table map, cash payment, 86'ing | TABLE, PAY-05 |
| C4 | **Admin Console** | Menu CRUD, discounts, settings, staff, reports | MENU, DISC, RPT, ADM |
| C5 | **API Gateway (Express)** | REST endpoints, auth, validation, rate limits, error taxonomy | AUTH, API conventions |
| C6 | **Order Domain Module** | Placement, lifecycle transitions, amendment, snapshotting, business-date and order-number allocation, audit events | ORD-01…15, BR-05…15 |
| C7 | **Menu Domain Module** | Categories, items, modifiers, availability | MENU-01…08 |
| C8 | **Pricing Domain (shared)** | Totals computation including tips (pure, shared client+server) | CART-04…06, TIP-03, BR-01…04, BR-13 |
| C9 | **Payments Module** | Partial/full PaymentIntent creation, webhook handling, cash/split, tips, refunds | PAY-01…09, TIP-02 |
| C10 | **Tables Module** | QR tokens, table state, reservations, dine-in sessions | TABLE-01…07 |
| C11 | **Discounts Module** | Promo codes, validation, application | DISC-01…05 |
| C12 | **Reports Module** | Business-date aggregation queries, chart DTOs, single revenue definition (BR-16) | RPT-01…07 |
| C13 | **Realtime Gateway (Socket.IO)** | Channels, auth of sockets, event fan-out | ORD-06, KDS-02 |
| C14 | **Auth Module** | Register/login, JWT issue/verify, RBAC middleware | AUTH-01…09 |
| C15 | **Settings Module** | Runtime config (tax %, fees, thresholds) | ADM-03 |
| C16 | **Job/Worker** | Webhook retries, ticket auto-hide, stale-session cleanup | KDS-07, PAY-08 |

### 3.2 Component Interaction — Order Placement (happy path)
```
Customer      API           Order Svc      Pricing      DB         Realtime     KDS
   │           │               │            (shared)    │            │           │
   │ POST /orders ────────────►│             │           │            │           │
   │           │   validate+auth            │           │            │           │
   │           │──────────────►│ computeTotals()────────►│            │           │
   │           │               │◄──────── total ────────│            │           │
   │           │               │ BEGIN TX ──────────────►│           │           │
   │           │               │  insert Order+Items+Event           │           │
   │           │               │ COMMIT ────────────────►│           │           │
   │           │               │ emit('order:new') ──────┼──────────►│──────────►│
   │ 201 {order} ◄─────────────│            │           │            │  render   │
```

### 3.3 Component Interaction — Stripe Payment
```
Customer     API/Payments Svc      Stripe        Webhook Route     DB
   │  POST /payments/intent ──────►│ create PI      │              │
   │◄────── {clientSecret} ────────│                │              │
   │  confirm(card 4242) ─────────►│                │              │
   │                               │  POST /webhook ┼─────────────►│
   │                               │  (signed body) │ verify sig   │
   │                               │                │ dedupe event │
   │                               │                │ set PAID ───►│
   │                               │                │ emit status ─┼─► KDS/POS/Customer
```

---

## 4. Monorepo & Workspace Layout

> **Note.** The checked-out directory is currently `resturnat-ordering-system` (a misspelling).
> Rename it to `restaurant-ordering-system` before scaffolding — the layout below, the npm
> workspace root and the `@ros/*` package scope all assume the corrected name, and nothing
> depends on the old one yet (no VCS history, no installed dependencies).

```
restaurant-ordering-system/
├─ package.json                # npm workspaces: shared, server, client
├─ tsconfig.base.json          # strict compiler options (single source)
├─ docker-compose.yml          # postgres 15 + volume
├─ .env.example
├─ README.md
├─ docs/                       # SRS.md, HLD.md, LLD.md
├─ shared/                     # @ros/shared — pure domain
│  └─ src/
│     ├─ domain/
│     │  ├─ order-status.ts    # state machine definition + guards
│     │  ├─ pricing.ts         # computeTotals() pure function
│     │  └─ enums.ts           # roles, order type, payment status…
│     ├─ schemas/              # Zod DTOs shared by client & server
│     └─ index.ts
├─ server/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.ts
│  └─ src/
│     ├─ app.ts                # express app factory (no listen)
│     ├─ server.ts             # bootstrap: env, db, http, socket, jobs
│     ├─ config/               # env parsing (zod), constants
│     ├─ middleware/           # auth, rbac, validate, rateLimit, errors
│     ├─ modules/
│     │  ├─ auth/              # routes · service · repo
│     │  ├─ menu/
│     │  ├─ orders/
│     │  ├─ payments/
│     │  ├─ tables/
│     │  ├─ discounts/
│     │  ├─ reports/
│     │  └─ settings/
│     ├─ realtime/             # socket server, channels, handlers
│     ├─ jobs/                 # interval jobs (cleanup, retry)
│     └─ lib/                  # prisma client, logger, errors, stripe
└─ client/
   └─ src/
      ├─ main.tsx · router.tsx
      ├─ shared/               # api client, socket client, ui kit
      ├─ features/
      │  ├─ auth/  cart/  menu/  orders/
      ├─ pages/
      │  ├─ customer/  kitchen/  pos/  admin/
      └─ styles/
```

**Workspace rules**
1. `client` and `server` both depend on `shared` (path or workspace ref).
2. `shared` has **zero runtime dependencies** (only `zod`).
3. No cross-imports between `server` modules except via `index.ts` public surface.
4. Each module owns its routes/service/repo triad; adding a feature = new module folder.

---

## 5. Technology Stack & Justification

| Concern | Choice | Alternatives considered | Why |
|---|---|---|---|
| Language | **TypeScript (strict)** | JavaScript | Domain correctness (money, states); portfolio signal |
| Monorepo | **npm workspaces** | pnpm, turborepo, nx | Zero extra tooling; adequate for 3 packages |
| Frontend | **React 18 + Vite** | Next.js, Vue | Vite speed; SPA fits realtime dashboards better than SSR |
| Routing | **React Router v6** | TanStack Router | Mature, simple role-gated route guards |
| Server state | **TanStack Query** | Redux, SWR | Caching, refetch, invalidation for menu/orders |
| Client state | **Zustand** | Redux Toolkit | Cart needs persistence middleware; minimal boilerplate |
| Backend | **Express 4** | Fastify, NestJS | Ubiquitous, easy middleware mental model; Nest overkill for scope |
| Validation | **Zod** | Joi, class-validator | Same schemas shared client/server via `shared/` |
| ORM | **Prisma** | Drizzle, TypeORM | Type-safe queries, migrations, excellent DX |
| DB | **PostgreSQL 15** | MongoDB, SQLite | Relational data (orders↔items↔payments); aggregations for reports |
| Realtime | **Socket.IO** | ws, SSE, Phoenix | Rooms/channels, auto-reconnect, fallback transports |
| Fan-out / shared cache | **Redis** — *required only at N>1 app instances* | In-process only | Socket.IO adapter for cross-instance rooms, and cross-instance menu-cache invalidation. Single-instance deployments (local, staging) run without it; NFR-A1 cannot be met without it. |
| Auth | **Access JWT (jose) + opaque refresh token + bcrypt** | Sessions, Passport, long-lived JWT | Short-lived access tokens keep the API stateless on the hot path; the refresh token is opaque and stored server-side because it must be revocable — a JWT cannot be. RBAC in middleware |
| Payments | **Stripe (test mode)** | PayPal, manual | PaymentIntents + signed webhooks = textbook integration demo |
| Styling | **Tailwind CSS** | CSS modules, MUI | Fast iteration, consistent design tokens |
| Charts | **Recharts** | Chart.js | React-native API for reports |
| Testing | **Vitest** | Jest | Native ESM/Vite speed |
| Lint | **ESLint + Prettier** | — | CI-gated consistency |
| Process mgmt | Docker Compose (dev) | — | One-command bootstrap (NFR-B1) |

---

## 6. Data Architecture

### 6.1 Entity-Relationship Overview
```
User ─┬─< Order >─┬─ Table
      │            ├─< OrderItem >── MenuItem ── MenuCategory
      │            │       └─ (modifiersJson snapshot)
      │            ├─< OrderEvent
      │            ├─< Payment
      │            └─< Delivery
      ├─< Reservation >─ Table
      └─< AuditLog

MenuCategory ─< MenuItem >─< ModifierGroup ─< ModifierItem
Discount (independent, referenced by code on Order)
Setting (key/value)
WebhookEvent (Stripe event IDs, dedupe)
```

### 6.2 Persistence Decisions
| Decision | Rationale |
|---|---|
| **Relational DB** | Orders are highly relational + heavily aggregated for reports (SQL shines) |
| **Snapshot columns on OrderItem** | Menu mutations never alter historical orders (SRS ORD-05, BR-11) |
| **`OrderEvent` append-only** | Full audit trail; current status = last event (NFR-R3) |
| **Money as `INTEGER` cents** | Eliminates float rounding errors (NFR-R2). Integer cents is fixed-point decimal (the BigDecimal equivalent): exact, JSON-safe, and matches Stripe's integer amounts. `SUM()` promotes to `bigint`, so aggregates can't overflow (ADR-004) |
| **Prisma migrations in VCS** | Reproducible schema evolution |
| **JSON column `modifiersJson`** | Modifier selections are semi-structured & only ever read back, never queried |
| **`businessDate` column on `Order`** | The operating day in the restaurant's timezone, fixed at placement. Every daily sequence and every report bucket keys on it, so a 00:30 local order is not filed under the previous UTC day (BR-15, SRS ORD-15) |
| **Dedicated `OrderSequence` table** | A per-business-date counter with an atomic integer increment. The `Setting` key/value table cannot serve this — its `value` is text, it has no room for a machine-written row without an `updatedBy` user, and it would accrue one config row per day forever |
| **`WebhookEvent` is the sole dedupe authority** | The Stripe event id is that table's primary key. `Payment` deliberately carries no competing unique constraint, so there is exactly one place that decides whether an event has been seen (PAY-08) |
| **Rates as integer basis points** | Tax, service charge and percent discounts are stored in bps, keeping the whole totals chain in integer arithmetic (NFR-R2) |

### 6.3 Data Flow Classification
- **Transactional writes**: order placement, status change, payment — always in a Prisma `$transaction`.
- **Read-heavy**: menu (cacheable, invalidated on admin edit via realtime broadcast).
- **Analytical reads**: reports — isolated to the `reports` module using read-only SQL over indexed ranges; acceptable to move to materialized views if slow.

### 6.4 Caching Strategy
| Data | Strategy |
|---|---|
| Menu | In-memory TTL cache (30 s) + invalidation event on admin edit. **Single-instance only** — the cache lives in one process, so at N>1 instances invalidation must move to Redis pub/sub or the cache must be dropped; otherwise an 86'd item stays visible on other instances for up to 30 s, breaking AC-7 |
| Settings | Loaded at boot, refreshed on change event |
| Sessions/JWT | Stateless — no server cache |
| Reports | No cache in v1; add 60 s TTL per date-range key if needed |

---

## 7. API Architecture

### 7.1 Conventions
- Base: `/api/v1`, JSON only, UTF-8.
- Auth: `Authorization: Bearer <jwt>`.
- Validation: Zod schema per endpoint → `400` with field details.
- Errors: single error-mapping middleware → `{ error: { code, message, details? } }`.
- Pagination/filtering standardized (SRS §5.5).
- `Idempotency-Key` header supported on `POST /orders` and payment-intent creation: the key, the caller, and a hash of the request body are stored with the response, and a repeat of the same key replays that response rather than creating a second order or charge (NFR-R5). Contract and storage model in **LLD §2.2 (`IdempotencyKey`) and §5.3**.

### 7.2 Resource Map (summary)
| Group | Prefix | Notes |
|---|---|---|
| Auth | `/auth` | register, login, me |
| Menu (public) | `/menu` | read-only, cacheable |
| Menu (admin) | `/staff/menu` | ADMIN only |
| Orders | `/orders` | scoped by role |
| Kitchen | `/orders/:id/status` | transition endpoint |
| Preview | `/orders/preview` | server-priced cart totals |
| Payments | `/payments` | intent, webhook, cash, refund |
| Tables | `/tables` | CRUD + `qr/:token` session |
| Reservations | `/reservations` | S-mode |
| Discounts | `/discounts` | admin CRUD; `/discounts/validate` open to any authenticated caller |
| Reports | `/reports/*` | ADMIN only |
| Settings | `/settings` | ADMIN only; public subset for tax display |

Full endpoint-by-endpoint contracts live in the **LLD §6 (API Specification)**.

### 7.3 Authorization Model
```
request → rateLimit → authenticate (parse JWT → req.user)
        → authorize(ROUTES.requiredRole) → validate(zodSchema)
        → controller → service → repo → respond
```
Role requirements declared as route metadata (`requireRole('ADMIN')`), never inside business logic.

---

## 8. Realtime Architecture

### 8.1 Channels
| Channel (room) | Members | Events published |
|---|---|---|
| `kitchen` | KDS clients (STAFF/ADMIN) | `order:new`, `order:status`, `order:removed` |
| `pos` | Staff terminals (STAFF/ADMIN) | `order:new`, `order:status`, `order:removed`, `payment:changed`, `table:changed`, `reservation:flag`, `menu:changed` |
| `admin` | Admin dashboards (ADMIN) | `order:status`, `payment:changed`, `metrics:update` |
| `customer:{orderId}` | The owning customer's sockets | `order:status`, `payment:changed` |
| `menu` | **Every** connected socket, authenticated or not | `menu:changed` (86'ing broadcast) |

The `menu` room is the one channel open to anonymous sockets. BROWSE-01 lets a guest browse
without logging in, and AC-7 requires an 86'd item to disappear from that guest's menu in real
time — so socket authentication is optional rather than mandatory (§8.3).

### 8.2 Event Flow
```
service (state change, after COMMIT)
   └─► domainEvent: { type, payload, at }
        └─► realtime.publish(channel, event)   ← single façade
             ├─► io.to('kitchen').emit(...)
             ├─► io.to(`customer:${orderId}`).emit(...)
             └─► (future) outbox → other consumers
```
**Rule:** services emit domain events *after* the DB transaction commits — clients never see events for rolled-back writes.

### 8.3 Socket Authentication & Security
- Authentication is **optional**. A client may pass a JWT in the Socket.IO `auth` handshake payload, verified with the same secret as HTTP; a socket with no token still connects, but is joined only to `menu`. A token that is present and *invalid* is rejected outright — absent and bogus are treated differently.
- Rooms joined server-side only after verifying role (only kitchen-role clients may join `kitchen`); a client can never self-join a privileged room.
- Only the order owner may join `customer:{orderId}`.
- Reconnection: Socket.IO auto-reconnect + client re-fetches snapshot on `connect` (events are hints; REST is source of truth).

### 8.4 Delivery Guarantees
- **At-most-once** over the socket, acceptable because: every event is followed by client REST refetch of authoritative state on reconnect, and periodic reconciliation (KDS polls every 30 s as a safety net).
- Ordering preserved per room (Socket.IO guarantees in-order emission per connection).

---

## 9. Key Design Subsystems

### 9.1 Pricing Engine (Domain)
- Pure function in `shared/domain/pricing.ts`: `(cart, pricingCtx) → PricingBreakdown`.
- `pricingCtx` = `{ taxBps, serviceChargeBps, serviceChargeTaxable, deliveryFee, currency }` from Settings. Rates are **integer basis points**, never decimal fractions, so no float enters the chain (NFR-R2).
- Order of operations is fixed and significant: discount → service charge → tax → delivery fee → tip. The tip is added last and is excluded from both the discount base and the tax base (BR-13).
- Whether the service charge is itself taxable is a setting, not an assumption — jurisdictions differ, and AC-4 demands the preview and the charge agree to the cent (BR-03).
- Identical code executes client-side (instant preview) and server-side (authoritative charge) → guarantees parity (CART-05/06, AC-4).
- Unit-tested exhaustively (LLD §10.1).

### 9.2 Order Lifecycle State Machine (Domain)
- Declarative list in `shared/domain/order-status.ts`. Each entry is a `(from, to, roles)` triple: the role gate belongs to the **edge**, not to a status, because the same status admits different actors depending on where it is going — a customer may take `PLACED → CANCELLED` but not `PLACED → CONFIRMED`.
- Strictly one step forward at a time; skipping ahead and moving backwards are both rejected, which keeps the `OrderEvent` timeline gap-free (BR-12).
- A separate `FORWARD_TRANSITION` map names the single "next" status per state. The KDS bump button reads *that*, never the first element of the allowed-transitions list — otherwise the meaning of the button would depend on array ordering.
- Server is the only mutator; within one transaction it validates, applies a conditional update, writes `OrderEvent`, commits — and only then emits.
- Client uses the same list to render legal action buttons (prevents the UI from offering invalid moves).

### 9.3 Payment Subsystem
- **Create intent**: the server recomputes the order total from the database and charges the **outstanding balance** (total − Σ successful payments), not necessarily the whole total — this is what makes split payment (PAY-06) work. The client never supplies an amount (PAY-07). The Stripe idempotency key is passed as the SDK's second *options* argument, not inside the params object.
- **Confirm**: client Stripe.js confirm card payment.
- **Webhook**: signature verification → `WebhookEvent` dedupe insert (event id as primary key) inside a transaction → update the payment record and re-derive order payment status → emit realtime event.
- **Cash/split**: staff action records `Payment` rows, optionally with a cash tip. `paymentStatus` is always *derived*: `UNPAID` at zero, `PARTIALLY_PAID` while the successful total falls short, `PAID` once it covers the order. A failed card attempt records a `FAILED` payment row and leaves the order `UNPAID`, so the customer can retry.
- **Refund**: admin-only. It requires a successful payment and is valid against a `COMPLETED` **or** a `CANCELLED` order — the ordinary case being a customer who paid at checkout and then cancelled. It sets `paymentStatus = REFUNDED` and **does not move the order**, because a refund is a payment-lifecycle event; modelling it as an order status would erase whether the order was fulfilled or cancelled (BR-07, AC-13).

### 9.4 Table & Dine-In Sessions
- QR encodes `https://host/t/{qrToken}`.
- The landing page *reads* the table via the token; opening the session is a separate **POST**, because seating a table is a state change and must not ride on a GET that a link preview, prefetcher or crawler can trigger.
- Orders in a session carry a `tableId` resolved server-side **from the token** — never from a client-supplied table id, which is what makes AC-12 hold.
- Two distinct staff actions close the loop: **close** (SEATED → DIRTY, refused while open orders remain — BR-08) and **clean** (DIRTY → FREE). Collapsing them into a single "free" action loses the DIRTY step TABLE-02 requires.

### 9.5 Reporting Subsystem
- Read-only module; queries over `Order`, `OrderItem`, `Payment` filtered by **business date**, never by raw UTC timestamp. Bucketing on UTC would split a late service across two days and shift RPT-04's peak hours by the restaurant's UTC offset.
- **One revenue definition, used everywhere** (BR-16): net sales are `Σ (subtotal − discount)` over orders that are neither cancelled nor refunded; tax, service charge, delivery fees and tips are each reported on their own line and never folded in; amounts *collected* come from payment records (`Σ succeeded − Σ refunded`), which is also what makes RPT-05's by-payment-method breakdown possible. Summing `Order.total` instead would count tax and tips as sales and would credit orders that were never paid.
- Item rankings group by `menuItemId`, not by the name snapshot — otherwise renaming an item splits its history in two, and two items sharing a name merge into one.
- Aggregations performed in SQL (SUM/COUNT/DATE_TRUNC) — no row streaming to app layer.
- Returns DTOs shaped exactly for the frontend chart components.

### 9.6 Seed & Demo Data
- `prisma/seed.ts` creates: admin + staff + demo customer, realistic menu with images and modifiers, 30 days of synthetic historical orders → reports demoable immediately (portfolio impact).
- The seed also **emits the totals it generated** (net sales, order count, top items per business date) as a fixture file. Report tests assert against that fixture rather than against a second hand-written query, so AC-9 is not report SQL checking report SQL.

---

## 10. Security Architecture

### 10.1 Controls by Layer
| Layer | Controls |
|---|---|
| Transport | HTTPS/WSS, HSTS (prod) |
| Edge | CORS allow-list, rate limiting (auth, order POST), Helmet headers, body size limits |
| AuthN | bcrypt (cost 12); access JWT (HS256, **15 min**, memory-only on the client); refresh token (opaque 256-bit, 30 days, SHA-256 hashed at rest, delivered in an `httpOnly` `Secure` `SameSite=Strict` cookie scoped to `/api/v1/auth`); rotation on every exchange with reuse detection; login rate limit 10/15 min/IP. The access token carries the role, but `authenticate` re-reads `isActive` and the current role from the database on each request (briefly cached), so revocation is immediate rather than waiting for expiry |
| AuthZ | Route-level RBAC middleware + service-level ownership checks (customer can only access own orders) |
| Input | Zod validation at boundary; unknown keys stripped |
| Data | Prisma parameterized queries; PII hidden from unauthorized responses (field-level DTO mapping) |
| Payments | Stripe Elements (no card data on our servers → PCI SAQ-A), webhook signature verify + replay protection |
| Secrets | `.env` git-ignored, `.env.example` committed, secrets never logged |
| Audit | `OrderEvent` + `AuditLog` for sensitive admin actions |

### 10.2 Threats & Mitigations
| Threat | Mitigation |
|---|---|
| Forged JWT | Strong secret, algorithm pinned, 15 min expiry |
| Stolen access token (XSS) | Memory-only storage and a 15 min lifetime cap the blast radius; the refresh token is `httpOnly` so a page script cannot reach it at all |
| Stolen refresh token | Rotation makes a captured token single-use; replaying a rotated token is detected and revokes the whole session family (AUTH-11, AC-21) |
| CSRF on the refresh endpoint | `SameSite=Strict` keeps the cookie off cross-site requests entirely; a required custom header adds a second barrier, since a cross-origin form cannot set one |
| Refresh token database disclosure | Only SHA-256 hashes are stored, so leaked rows are not usable tokens |
| Price tampering (client sends fake total) | Server recomputes from DB prices (PAY-07) |
| Replay webhook | Signature + `WebhookEvent` unique insert (PAY-08) |
| Horizontal privilege escalation | Role middleware on every mutating route (NFR-S4) |
| QR token guessing | 128-bit random tokens, rate-limited lookup |
| SQL injection | Prisma only; no string-built SQL |
| XSS from menu descriptions | React auto-escaping; sanitize any markdown/HTML input |
| IDOR on orders | Ownership check in service layer, not just route |
| Stale privileges after disable/demote | Role and `isActive` re-read per request rather than trusted from the JWT body (ADM-02, AUTH-08, AC-18) |
| Client-tampered modifiers (cheaper option, skipped required choice) | Server re-resolves every modifier against the groups attached to that item and re-checks `minSelect`/`maxSelect` and availability before pricing (AC-17) |
| Table seated by a crawler or link preview | Session opening is a POST, not a GET; the token alone reads but does not mutate |

---

## 11. Deployment Architecture

### 11.1 Environments
| Env | Purpose | Stack |
|---|---|---|
| **local** | Development | Docker Compose (Postgres) + `npm run dev` (Vite + tsx watch) |
| **staging** | Demo/portfolio showcase | Single VM or Render/Fly app + managed Postgres |
| **prod** | Live restaurant (future) | Same as staging + backups, monitoring, HTTPS |

### 11.2 Runtime Topology (production)
```
 Internet ─► CDN/Reverse Proxy (Caddy/Nginx: TLS, static SPA)
                 │
                 ├─► node server (pm2, N instances behind sticky sessions)
                 │        └─► managed PostgreSQL (TLS, backups)
                 └─► Socket.IO needs sticky session + Redis adapter if >1 instance
 Stripe ───► /api/v1/payments/webhook (public route)
```

### 11.3 CI/CD Pipeline
```
push/PR → install → lint → typecheck → unit tests (vitest)
        → prisma validate → build (client+server) → (main) deploy
```

### 11.4 Configuration Management
- All config via environment variables parsed by a Zod schema at boot (fail fast on missing vars).
- Settings that change at runtime (tax %, KDS thresholds) live in DB `Setting` table, editable by ADMIN.

### 11.5 Backup & Recovery
- Nightly `pg_dump` to object storage (staging/prod), 30-day retention.
- Restore drill documented in README.

---

## 12. Cross-Cutting Concerns

### 12.1 Error Handling
- **Typed error hierarchy** (`AppError` subclasses: `ValidationError`, `AuthError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`) mapped to HTTP codes in one place.
- Unhandled rejections caught at process level → logged with request ID; never leak stack traces to clients.

### 12.2 Logging & Observability
- Structured JSON logs (`pino`): `{ ts, level, reqId, module, msg, ... }`.
- Request ID generated per request, propagated to logs and client error responses.
- Metrics (future): request latency histogram, socket connection count, orders/hour gauge.

### 12.3 Testing Strategy (design-level)
| Level | Target | Tool |
|---|---|---|
| Unit | Pricing, state machine, promo logic | Vitest, no IO |
| Integration | Repos + services against test DB | Vitest + dockerized Postgres |
| API | Route contracts (auth, validation, errors) | Supertest |
| E2E (smoke) | Place order → KDS → complete → report | Playwright (phase 7) |

### 12.4 Internationalization & Currency
- v1: English strings, single currency from Settings; string tables organized for future i18n.
- Money formatting centralized in one client util.

---

## 13. Scalability & Evolution Path

| Stage | Trigger | Change |
|---|---|---|
| Now | Single venue | Modular monolith |
| +Load | Multi-screen KDS, >50 concurrent sockets | Add Redis + Socket.IO adapter; sticky sessions |
| +Growth | Multi-venue | Extract `orders` service; add a `restaurantId` tenancy key. **Not free today**: every unique constraint (`User.email`, `Table.number`, `Discount.code`, `Setting.key`) is currently global and would each need to become composite with `restaurantId`. The module boundaries survive the change; the schema does not |
| +Analytics | Reporting slows OLTP | Read replica or nightly materialized views |
| +Channels | Aggregator integrations (Uber Eats etc.) | Anti-corruption layer in `orders` module |

The design deliberately keeps module boundaries and a single domain core so extraction is possible without a rewrite. What it does *not* claim is a tenant-ready schema — see the multi-venue row above for what that would actually cost.

---

## 14. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Pricing bugs (wrong totals) | Medium | High | Pure shared function + exhaustive unit tests + server authority |
| R2 | Lost/duplicated payment state (webhook) | Medium | High | Signature verify, idempotent dedupe, reconciliation job |
| R3 | Realtime missed events (tab sleep) | High | Medium | Reconnect refetch + 30 s safety poll on KDS |
| R4 | Scope creep (4 channels + reports) | High | Medium | Phased milestones; each phase shippable |
| R5 | Illegal state transitions | Low | High | Single shared state machine; 409 on violation |
| R6 | Money rounding errors | Low | High | Integer cents end-to-end |
| R7 | Stripe outage during service | Low | Medium | Cash/manual payment path (NFR-R6) |
| R8 | QR token leakage/spoofing | Low | Medium | Random 128-bit tokens, HTTPS, rate limiting |
| R9 | Concurrent double-bump on KDS | Medium | Low | Conditional UPDATE (`WHERE status = expected`) + 409 on 0 rows |
| R10 | Revenue reported wrongly (refunds, unpaid orders, tax or tips counted as sales) | Medium | High | One revenue definition stated in BR-16 and implemented once in the reports module; seed-generated fixtures assert the figures (§9.5, §9.6) |
| R11 | Reports and order numbers bucketed on UTC rather than the restaurant's day | Medium | Medium | `businessDate` fixed at placement from the timezone setting; every query and sequence keys on it (§6.2) |
| R12 | Stale privileges — a disabled or demoted user keeps working after the change | Medium | Medium | Role and `isActive` re-read per request (§10.1), so access stops on the next call rather than at token expiry; the 15 min access-token life and per-session revocation bound it further |
| R13 | Order amended after payment leaves the balance untracked | Low | High | `paymentStatus` is always derived from payment records versus the current total, so an amendment drops a paid order back to `PARTIALLY_PAID` (BR-14, AC-14) |
| R14 | Always-on KDS or POS device logs out mid-service | High | High | Silent refresh keeps a session alive indefinitely while in use; the device is never prompted during a shift (AUTH-10, AC-20) |
| R15 | Refresh token theft grants a long-lived session | Low | High | Rotation with reuse detection; `httpOnly` delivery; hashes at rest; revocable per session or per family (AUTH-11, AUTH-13) |

---

## Appendix A — SRS → HLD Traceability

| SRS area | HLD section |
|---|---|
| AUTH-* | §7.3, §10 |
| MENU-*/BROWSE-* | §3.1 (C7), §6.2 |
| CART-*/pricing BRs | §9.1 |
| TIP-* | §9.1, §9.3 |
| PRINT-* | §3.1 (C1, C2), §12.4 |
| ORD-*/state BRs | §9.2, §8 |
| KDS-* | §8.1, §3.2 |
| TABLE-* | §9.4 |
| PAY-* | §9.3 |
| DISC-* | §7.2, §9.1 (promo input) |
| RPT-* | §9.5 |
| NFR-* | §10, §11, §12, §13 |

## Appendix B — Revision History
| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-09-25 | Dev Team | Initial release |
| 1.2.1 | 2026-09-25 | Dev Team | §6.2: money columns `BIGINT` → `INTEGER` cents per ADR-004. No behavioural change. |
| 1.2 | 2026-09-25 | Dev Team | Added the access/refresh token architecture (§5, §10.1, §10.2) and risks R14–R15. Auth is no longer a single long-lived JWT. |
| 1.1 | 2026-09-25 | Dev Team | Design review. Title typo fixed. Refunds re-modelled as payment state (§9.3). State machine gated per edge with an explicit forward map (§9.2). Pricing moved to integer basis points, tip step and taxable-service-charge setting added (§9.1). Reporting given one revenue definition and business-date bucketing (§9.5). Table sessions split into close/clean with a POST session-open (§9.4). `order:updated` renamed `order:status`; `menu` room opened to anonymous sockets; `payment:changed` added (§8.1, §8.3). Redis added to the stack for N>1 instances (§5, §6.4). Idempotency-Key contract pointed at the LLD (§7.1). Per-request `isActive` re-check (§10). Tenant-readiness claim qualified (§13); risks R10–R13 added. |
