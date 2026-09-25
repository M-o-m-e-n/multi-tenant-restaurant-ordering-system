# Software Requirements Specification (SRS)
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-SRS-001 |
| **Version** | 1.2.1 |
| **Status** | Draft |
| **Date** | 2026-09-25 |
| **Author** | Development Team |
| **Stakeholders** | Project Owner, Restaurant Staff, End Customers |

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Business Rules](#7-business-rules)
8. [Assumptions, Dependencies & Constraints](#8-assumptions-dependencies--constraints)
9. [Acceptance Criteria](#9-acceptance-criteria)
10. [Appendices](#10-appendices)

---

## 1. Introduction

### 1.1 Purpose
This document specifies the complete software requirements for the **Restaurant Ordering System (ROS)** — a full-stack, multi-channel digital ordering platform covering customer self-ordering, kitchen operations, point-of-sale, and management analytics.

ROS is a **learning/portfolio project** whose goal is to demonstrate production-grade patterns: domain state machines, pricing engines, realtime event propagation, payment integration, and clean layered architecture.

### 1.2 Scope
ROS replaces the traditional paper-ticket restaurant workflow with a unified digital system:

**In scope:**
- Digital menu browsing and ordering (dine-in QR, takeaway, delivery, counter POS)
- Real-time kitchen display system (KDS)
- Payment processing (Stripe test mode + cash)
- Table and reservation management
- Promotions/discounts engine
- Sales and menu performance analytics
- Role-based staff administration
- Tips/gratuity capture at checkout and against cash payments
- Amending an open order (appending items to an unfinished ticket)
- Printable customer receipts and kitchen tickets

**Out of scope (v1):**
- Inventory/stock depletion tracking
- Multi-restaurant (SaaS tenancy) support
- Native mobile applications (responsive web only)
- Loyalty/rewards programs
- Accounting system integration
- Live driver GPS tracking (delivery status is manual)
- Direct thermal/ESC-POS printer integration (receipts and tickets print via the browser print dialog)

### 1.3 Definitions, Acronyms & Abbreviations
| Term | Definition |
|---|---|
| ROS | Restaurant Ordering System |
| SRS | Software Requirements Specification |
| HLD / LLD | High / Low Level Design |
| KDS | Kitchen Display System |
| POS | Point of Sale |
| QR | Quick Response code |
| Order Lifecycle | The state progression of an order from placement to completion |
| Bump | Action of moving a ticket forward/dismissing it on the KDS |
| 86'ing | Marking a menu item as temporarily unavailable/sold out |
| Snapshot | Value copied at order time so later menu edits don't alter history |
| JWT | JSON Web Token |
| RBAC | Role-Based Access Control |
| DTO | Data Transfer Object |
| Business Date | The restaurant's operating day, derived from `placedAt` in the configured restaurant timezone. All daily sequences and report buckets key on it, never on UTC. |
| Access token | A short-lived (15 min) signed JWT sent on every API call. Held in memory only; never written to disk or browser storage. |
| Refresh token | A long-lived (30 day) opaque random value that buys new access tokens. Stored hashed server-side and delivered to the browser in an httpOnly cookie, so page scripts cannot read it. |
| Token rotation | Issuing a new refresh token on every refresh and revoking its predecessor, so a captured token is usable at most once. |
| Session family | The chain of refresh tokens descending from one login. Detecting a replayed token revokes the whole family, because a replay means the token was stolen. |
| bps | Basis points — one hundredth of a percent. Rates (tax, service charge, percent discounts) are stored as integers in bps so no float ever enters a money calculation (NFR-R2). |
| Tip | A discretionary amount added by the customer. Distinct from the service charge, which is a mandatory restaurant-set percentage (BR-02). |

### 1.4 References
- ISO/IEC/IEEE 29148:2018 — Requirements Engineering (supersedes IEEE 830-1998)
- IEEE 830-1998 — Recommended Practice for SRS (retained for its document structure)
- Project brainstorm & architecture plan (v1.0, 2026-09-25)
- Stripe API documentation (Payments Intents, Webhooks)
- Prisma ORM documentation

### 1.5 Overview
Sections 2–3 describe behavior from the user's perspective (what the system does). Sections 4–7 describe quality attributes, interfaces, data, and invariants (how the system must be built). Section 9 defines verifiable acceptance criteria.

---

## 2. Overall Description

### 2.1 Product Perspective
ROS is a new, self-contained system composed of a React single-page application, an Express REST API, a realtime gateway (Socket.IO), and a PostgreSQL database. It interacts with external systems: **Stripe** (payments) and an **SMTP provider** (optional transactional email).

### 2.2 User Classes and Characteristics

| User Class | Description | Technical Skill | Priority |
|---|---|---|---|
| **Customer** | Guest ordering via phone (QR link), web, or kiosk | Low (consumer app expectations) | High |
| **Waiter / Counter Staff** | Takes orders, manages tables, marks payments | Medium | High |
| **Kitchen Staff** | Views tickets, advances order states on KDS | Low (touch, fast glance) | High |
| **Manager / Admin** | Manages menu, discounts, staff, views reports | Medium–High | Medium |
| **System / Integrator** | Stripe webhook caller, scheduled jobs | N/A (machine actor) | High |

### 2.3 Operating Environment
- **Client:** Modern evergreen browser (Chrome/Edge/Firefox/Safari, last 2 versions); responsive from 360px to 1920px; tablets (KDS/POS) at ≥1024px.
- **Server:** Node.js ≥ 20 LTS, Linux or Windows.
- **Database:** PostgreSQL ≥ 15.
- **Runtime:** Docker Compose for local development; Node process manager (pm2/systemd) for deployment.
- **Network:** HTTPS required in production; WebSocket (WSS) for realtime.

### 2.4 Design and Implementation Constraints
1. TypeScript mandated across all workspaces.
2. All business logic must live in service modules — route handlers stay thin.
3. Order state transitions must be validated against a single shared state-machine definition (no ad-hoc status writes).
4. Monetary values stored as integers (minor units / cents) and rates as integer basis points — no floating-point money anywhere in the totals chain.
5. Menu prices/names must be snapshotted onto order items at placement time.
6. Passwords stored only as bcrypt hashes; JWT secrets via environment variables.

### 2.5 Assumptions
- One restaurant per deployment.
- Tax rate, service charge percentage, and delivery fee are configurable settings, not hard-coded.
- The restaurant operates in one timezone, held as a setting; every business-day boundary (order numbering, reporting) derives from it rather than from UTC.
- Stripe operates in **test mode**; no real card data is processed.
- Staff accounts are provisioned by an admin (self-signup is customer-only).

---

## 3. Functional Requirements

Priority legend: **M** = Must (v1), **S** = Should, **C** = Could.

### 3.1 Authentication & Authorization

| ID | Requirement | Pri |
|---|---|---|
| AUTH-01 | The system shall allow a customer to register with email + password and receive a JWT. | M |
| AUTH-02 | The system shall allow any user to log in and receive a short-lived access token (default 15 min) together with a long-lived refresh token (default 30 days). | M |
| AUTH-03 | The system shall support three roles: `CUSTOMER`, `STAFF`, `ADMIN`. | M |
| AUTH-04 | The system shall reject access to protected routes when the JWT is missing, expired, or invalid. | M |
| AUTH-05 | The system shall enforce role-based access: customers may only read/write their own orders; STAFF may manage orders/tables; ADMIN may manage menu/discounts/staff/reports. | M |
| AUTH-06 | The system shall allow a user to log out, revoking the refresh token server-side and clearing it from the browser — not merely discarding it client-side. | M |
| AUTH-07 | The system shall hash passwords with bcrypt (cost ≥ 12). | M |
| AUTH-08 | The system shall allow an ADMIN to create staff accounts and change a user's role. | S |
| AUTH-09 | The system shall rate-limit login attempts (max 10 / 15 min per IP). | S |
| AUTH-10 | The system shall exchange a valid refresh token for a new access token without re-prompting for credentials, so a session survives indefinitely while in use. An always-on KDS or POS device shall never be logged out mid-service. | M |
| AUTH-11 | The system shall rotate the refresh token on every exchange, revoking the previous one. Presenting an already-revoked token shall be treated as theft: the entire session family is revoked and re-authentication is required. | M |
| AUTH-12 | The system shall deliver the refresh token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie scoped to the auth path, so page scripts cannot read it. The access token shall be held in memory only and never written to `localStorage` or `sessionStorage`. | M |
| AUTH-13 | A user shall be able to list their active sessions (device, last used, created) and revoke any one of them, or all of them at once. | S |
| AUTH-14 | The system shall purge expired and revoked refresh tokens on a schedule. | S |

### 3.2 Menu Management

| ID | Requirement | Pri |
|---|---|---|
| MENU-01 | The system shall display the menu grouped by category, with item name, description, price, image, and availability. | M |
| MENU-02 | An ADMIN shall be able to create, edit, soft-delete, and reorder menu categories. | M |
| MENU-03 | An ADMIN shall be able to create, edit, soft-delete, and 86 menu items. | M |
| MENU-04 | An ADMIN shall be able to attach modifier groups (e.g., *Size*, *Extras*) to items with `minSelect`/`maxSelect` constraints. | M |
| MENU-05 | The system shall hide unavailable (86'd) items from the customer menu, showing them as "Sold out" instead of removing them entirely. | M |
| MENU-06 | The system shall support optional item availability schedules (e.g., breakfast items only 07:00–11:00). | S |
| MENU-07 | The system shall store allergen/dietary tags on items and filter by them (vegetarian, gluten-free, etc.). | S |
| MENU-08 | An ADMIN shall be able to bulk-toggle availability during service. | C |

### 3.3 Menu Browsing (Customer)

| ID | Requirement | Pri |
|---|---|---|
| BROWSE-01 | A customer shall be able to view the menu without logging in; login is required only at checkout. | M |
| BROWSE-02 | A customer shall be able to search items by name and filter by category. | M |
| BROWSE-03 | A customer shall be able to open an item detail view showing description, modifiers, and computed price. | M |
| BROWSE-04 | A customer scanning a table QR code shall land on the menu pre-bound to that table (dine-in session). | M |

### 3.4 Cart & Pricing

| ID | Requirement | Pri |
|---|---|---|
| CART-01 | The system shall maintain a client-side cart persisting across page reloads (localStorage) and surviving login. | M |
| CART-02 | The system shall allow quantity increment/decrement and removal of line items. | M |
| CART-03 | The system shall enforce modifier group `minSelect`/`maxSelect` constraints before allowing "Add to cart". | M |
| CART-04 | The system shall compute line totals as `(basePrice + Σ modifier deltas) × qty`. | M |
| CART-05 | The system shall compute: subtotal, discount, service charge, tax, delivery fee, and grand total via a single shared pricing function. | M |
| CART-06 | The system shall provide a server-side `/orders/preview` endpoint returning authoritative totals (client preview may never be trusted for charging). | M |
| CART-07 | The system shall prevent checkout when the cart is empty or contains an item that became unavailable. | M |
| CART-08 | The system shall allow order notes per line item (e.g., "no onions"). | M |

### 3.5 Order Placement & Lifecycle

| ID | Requirement | Pri |
|---|---|---|
| ORD-01 | The system shall accept orders of type `DINE_IN`, `TAKEAWAY`, or `DELIVERY`. | M |
| ORD-02 | The system shall validate order state transitions against the shared state machine and reject illegal transitions with `409 Conflict`. | M |
| ORD-03 | The system shall define the canonical lifecycle: `PLACED → CONFIRMED → PREPARING → READY → SERVED → COMPLETED`, advancing one step at a time, with `CANCELLED` reachable from any pre-`COMPLETED` state. A refund is **not** an order status — it is a payment-lifecycle event (PAY-04, BR-07). | M |
| ORD-04 | The system shall write an `OrderEvent` audit row for every status transition (actor, timestamp, from → to). | M |
| ORD-05 | The system shall snapshot item name, price, and chosen modifiers onto each `OrderItem` at placement. | M |
| ORD-06 | The system shall broadcast status changes to subscribed clients within 500 ms. | M |
| ORD-07 | A customer shall be able to view their own order history and live-track the current order status. | M |
| ORD-08 | A STAFF/ADMIN user shall be able to view all orders with filters (status, type, date, table). | M |
| ORD-09 | A customer shall be able to cancel an order while it is in `PLACED` or `CONFIRMED`. | M |
| ORD-10 | The system shall assign a human-readable order number (e.g., `#A-1042`) unique per day. | S |
| ORD-11 | The system shall support scheduled/pre-orders with a requested time. | C |
| ORD-12 | The system shall allow items to be appended to an existing order while its status is `PLACED`, `CONFIRMED`, or `PREPARING`; later states are not amendable. | M |
| ORD-13 | Appending items shall recompute every total and re-derive `paymentStatus` from the sum of successful payments against the new total — so an already-paid order becomes `PARTIALLY_PAID`. | M |
| ORD-14 | Every amendment shall be recorded in the audit log with the acting user, the appended lines, and the totals before and after. | M |
| ORD-15 | The system shall assign each order a business date derived from the configured restaurant timezone, used for order numbering and all reporting. | M |

### 3.6 Kitchen Display System (KDS)

| ID | Requirement | Pri |
|---|---|---|
| KDS-01 | The KDS shall display active tickets grouped by status in configurable columns. | M |
| KDS-02 | A new order shall appear on the KDS in real time without manual refresh. | M |
| KDS-03 | Each ticket shall show elapsed time since placement, color-coding aging tickets (green < 8 min, amber 8–15 min, red > 15 min — configurable). | M |
| KDS-04 | Kitchen staff shall be able to advance a ticket to the next status with one tap ("bump"). | M |
| KDS-05 | The KDS shall allow a station filter (e.g., grill, cold, bar) if items are assigned stations. | S |
| KDS-06 | The KDS shall produce an audible/visual alert on new tickets. | S |
| KDS-07 | Completed tickets shall remain visible for a configurable grace period (default 60 s), then auto-hide. | S |

### 3.7 Dine-In & Table Management

| ID | Requirement | Pri |
|---|---|---|
| TABLE-01 | An ADMIN shall be able to define tables with unique numbers and generate a QR token per table. | M |
| TABLE-02 | Table status shall follow `FREE → SEATED → DIRTY → FREE`. | M |
| TABLE-03 | Scanning a QR code shall open the menu bound to that table; orders placed in that session are linked to the table. | M |
| TABLE-04 | A STAFF user shall be able to manually mark table status from a table map view. | M |
| TABLE-05 | The system shall support merging two tables into one order. | C |
| TABLE-06 | The system shall support reservations: create, list, seat (converts to a SEATED table session), cancel. | S |
| TABLE-07 | The system shall flag overdue reservations (slot + 15 min) on the staff view. | C |

### 3.8 Payments

| ID | Requirement | Pri |
|---|---|---|
| PAY-01 | The system shall create a Stripe PaymentIntent in test mode with the authoritative total from server-side pricing. | M |
| PAY-02 | The system shall confirm payment client-side using Stripe Elements (card `4242 4242 4242 4242` in test mode). | M |
| PAY-03 | The system shall verify Stripe webhook signatures and process `payment_intent.succeeded` / `payment_intent.payment_failed`. | M |
| PAY-04 | Order payment status shall be `UNPAID → PARTIALLY_PAID → PAID`, plus `REFUNDED`. A failed card attempt leaves the order `UNPAID` so the customer may retry; the individual `Payment` record carries its own `FAILED` state. | M |
| PAY-05 | The system shall support marking an order as paid by **cash** (STAFF/ADMIN only), recording the acting user. | M |
| PAY-06 | The system shall support **split payment**: paying a portion by card and the remainder by cash. | S |
| PAY-07 | The system shall never trust a client-supplied amount when creating a PaymentIntent. | M |
| PAY-08 | The system shall idempotently handle duplicate webhook deliveries (event ID deduplication). | M |
| PAY-09 | An ADMIN shall be able to issue a full refund against any order holding a successful payment — including a `CANCELLED` one — setting `paymentStatus` to `REFUNDED` and leaving the order's status untouched. | S |

### 3.9 Takeaway & Delivery

| ID | Requirement | Pri |
|---|---|---|
| DEL-01 | Takeaway orders shall require customer name and phone; no table binding. | M |
| DEL-02 | Delivery orders shall additionally require address, optional door/notes, and incur a configurable delivery fee. | M |
| DEL-03 | The system shall store a `Delivery` record with status `ASSIGNED → PICKED_UP → DELIVERED`. | S |
| DEL-04 | A STAFF user shall be able to assign a driver name and update delivery status. | S |

### 3.10 Discounts & Promotions

| ID | Requirement | Pri |
|---|---|---|
| DISC-01 | An ADMIN shall be able to create discounts with type `PERCENT` or `FIXED`, a value, active window, and optional minimum order value. | M |
| DISC-02 | A customer shall be able to apply a promo code at checkout; invalid/expired codes return a clear error. | M |
| DISC-03 | The system shall apply at most one discount per order (v1). | M |
| DISC-04 | Discounts shall apply to the subtotal before tax and service charge. | M |
| DISC-05 | The system shall prevent discount stacking and discount codes from driving totals below zero. | M |
| DISC-06 | An ADMIN shall be able to set an optional total usage limit on a discount code; the system shall count redemptions atomically at order placement and reject the code once the limit is reached. | S |

### 3.11 Reporting & Analytics

| ID | Requirement | Pri |
|---|---|---|
| RPT-01 | An ADMIN shall be able to view net sales, order count, and average order value for a selected business-date range, using the single revenue definition in BR-16. Tax, service charge, delivery fees and tips are shown as their own lines. | M |
| RPT-02 | The system shall show a daily revenue trend chart (line/bar). | M |
| RPT-03 | The system shall rank menu items by quantity sold and revenue (top/bottom performers). | M |
| RPT-04 | The system shall show order volume by hour of day (peak hours heatmap). | M |
| RPT-05 | The system shall break down net sales by order type, and amounts collected by payment method (the latter derived from payment records, per BR-16). | M |
| RPT-06 | The system shall list voids/cancellations and refunds for the period. | S |
| RPT-07 | Reports shall be exportable to CSV. | C |

### 3.12 Administration

| ID | Requirement | Pri |
|---|---|---|
| ADM-01 | An ADMIN dashboard shall surface today's key metrics (orders, revenue, active tickets, table status). | M |
| ADM-02 | An ADMIN shall manage staff accounts (create, disable, change role). | S |
| ADM-03 | An ADMIN shall edit system settings: tax rate, service charge %, whether the service charge is itself taxable, delivery fee, currency, restaurant timezone, KDS aging thresholds, and the KDS completed-ticket grace period. | M |
| ADM-04 | The system shall expose an audit log of administrative actions. | C |

### 3.13 Tips & Gratuity

| ID | Requirement | Pri |
|---|---|---|
| TIP-01 | A customer shall be able to add a tip at checkout, choosing from configurable preset percentages or entering a custom amount. | M |
| TIP-02 | A STAFF/ADMIN user shall be able to record a cash tip when marking an order paid by cash. | M |
| TIP-03 | The tip shall be excluded from the discount base and the tax base, and added last to the total. | M |
| TIP-04 | Tips shall be reported as their own line, never folded into sales revenue. | M |
| TIP-05 | The system shall allow the tip presets (and a no-tip option) to be configured by an ADMIN. | S |

### 3.14 Receipts & Kitchen Tickets

| ID | Requirement | Pri |
|---|---|---|
| PRINT-01 | The system shall render a printable receipt for any order, showing line items with modifiers, every total component (subtotal, discount, service charge, tax, delivery fee, tip), payment method(s), order number, and business date. | M |
| PRINT-02 | Receipts shall be rendered entirely from the values snapshotted on the order — never recomputed from the live menu or current settings. | M |
| PRINT-03 | Kitchen staff shall be able to print or re-print a kitchen ticket for a selected order from the KDS. | S |
| PRINT-04 | A customer shall be able to view and print the receipt for their own order; STAFF/ADMIN may do so for any order. | M |

---

## 4. Non-Functional Requirements

### 4.1 Performance
| ID | Requirement |
|---|---|
| NFR-P1 | API p95 latency ≤ 300 ms for read endpoints under 100 concurrent users. |
| NFR-P2 | Order placement (POST) p95 ≤ 800 ms including DB write. |
| NFR-P3 | Realtime event delivery from state change to KDS render ≤ 500 ms on LAN. |
| NFR-P4 | Menu page first contentful paint ≤ 2 s on 4G; images lazy-loaded and CDN-ready. |
| NFR-P5 | KDS must support 60 tickets on screen without noticeable frame drops. |

### 4.2 Scalability & Availability
| ID | Requirement |
|---|---|
| NFR-A1 | Stateless API servers; horizontal scaling possible behind a load balancer (requires Socket.IO Redis adapter). |
| NFR-A2 | System availability target 99.5% during service hours. |
| NFR-A3 | Database nightly backups with point-in-time recovery enabled in production. |

### 4.3 Security
| ID | Requirement |
|---|---|
| NFR-S1 | All traffic over HTTPS/WSS in production; HSTS enabled. |
| NFR-S2 | Passwords bcrypt-hashed (cost ≥ 12); never logged or returned. |
| NFR-S3 | Access tokens signed HS256/RS256, secret ≥ 256 bits, from environment only, lifetime ≤ 15 min. Refresh tokens are 256-bit random opaque values — never JWTs, because they must be revocable — stored only as SHA-256 hashes, so a database disclosure does not yield usable tokens. |
| NFR-S4 | Role checks enforced server-side on every mutating endpoint (never client-only). |
| NFR-S5 | Input validated with Zod at every route boundary; unknown fields **rejected** (schemas are `.strict()`), so a tampered payload fails loudly rather than being silently trimmed. |
| NFR-S6 | SQL injection prevented via Prisma parameterization; no raw string-concatenated SQL. |
| NFR-S7 | Stripe webhook signatures verified; replay-protected by event ID dedup. |
| NFR-S8 | CORS restricted to an explicit origin allow-list with credentials enabled (never a wildcard, which browsers forbid alongside credentials); rate limiting on auth, refresh and order-placement endpoints. |
| NFR-S9 | PII (name, phone, address) accessible only to the owning customer and staff; never exposed in public endpoints. |
| NFR-S10 | Secrets never committed; `.env` git-ignored with `.env.example` provided. |

### 4.4 Reliability & Data Integrity
| ID | Requirement |
|---|---|
| NFR-R1 | Order placement + stock snapshot must be transactional (single DB transaction). |
| NFR-R2 | Money computed in integer cents and rates in integer basis points; no floating-point arithmetic anywhere in the totals chain. |
| NFR-R3 | Order status changes are append-only via `OrderEvent`; the current status column is derivable. |
| NFR-R4 | Stripe webhook processing must be idempotent and crash-safe. |
| NFR-R5 | The system must never lose an accepted order (acknowledged only after commit). |
| NFR-R6 | Graceful degradation: if Stripe is unreachable, staff can mark orders for later payment (cash/manual flow continues). |

### 4.5 Usability
| ID | Requirement |
|---|---|
| NFR-U1 | Customer flow from menu → checkout completable in ≤ 6 taps/steps. |
| NFR-U2 | KDS fully operable by touch with no keyboard required; targets ≥ 44×44 px. |
| NFR-U3 | WCAG 2.1 AA: keyboard navigable, contrast ≥ 4.5:1, alt text on food images. Status and KDS ticket aging are never conveyed by colour alone (SC 1.4.1) — every colour band carries a text or icon equivalent. |
| NFR-U4 | Interface available in English (i18n-ready structure for future localization). |
| NFR-U5 | Clear error messages with actionable recovery for every failure path. |

### 4.6 Maintainability
| ID | Requirement |
|---|---|
| NFR-M1 | Strict TypeScript (`strict: true`), zero `any` in domain code. |
| NFR-M2 | Lint (ESLint) and typecheck pass in CI for all workspaces. |
| NFR-M3 | Business logic (pricing, state machine) unit-testable without DB or network. |
| NFR-M4 | Modules organized by domain (menu, orders, payments, tables, reports) not by technical layer alone. |
| NFR-M5 | Every API endpoint documented (OpenAPI or equivalent). |

### 4.7 Portability
| ID | Requirement |
|---|---|
| NFR-B1 | One-command environment bootstrap (`docker compose up` + `npm run dev`). |
| NFR-B2 | No OS-specific paths in code; environment config via variables. |

---

## 5. External Interface Requirements

### 5.1 User Interfaces
| Interface | Description |
|---|---|
| Customer Web | Mobile-first SPA: menu grid, item modal, cart drawer, checkout, live tracker |
| KDS | Full-screen desktop/tablet, dark theme, column-based tickets, big bump buttons |
| POS/Staff | Tablet/desktop terminal: order entry, table map, payment marking |
| Admin | Desktop dashboard: menu manager, discounts, settings, reports (charts) |

### 5.2 Hardware Interfaces
- QR codes printable/exportable per table (PNG/SVG).
- Optional barcode-style order numbers for kitchen ticket matching.
- Receipts and kitchen tickets are produced through the browser's print dialog against a print stylesheet; they therefore work with any OS-installed printer. Direct thermal/ESC-POS printer control is out of scope for v1 (§1.2).

### 5.3 Software Interfaces
| System | Interface | Purpose |
|---|---|---|
| Stripe | REST API + Webhooks (HTTPS) | PaymentIntent creation, confirmation, refunds |
| SMTP (optional) | Transactional email API | Order confirmation, password reset |
| Socket.IO | WebSocket protocol | Realtime order/KDS/table updates |

### 5.4 Communication Interfaces
| Protocol | Usage |
|---|---|
| HTTPS (TLS 1.2+) | All REST calls |
| WSS | Socket.IO realtime channel |
| Webhook (HTTPS POST) | Stripe → `/api/v1/payments/webhook` |

### 5.5 API Conventions
- Base path `/api/v1`; JSON request/response.
- Auth via `Authorization: Bearer <jwt>`.
- Consistent error body: `{ "error": { "code": string, "message": string, "details"?: object } }`.
- Standard HTTP codes: 200/201/204 success, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict (illegal transition), 422 business rule, 429 rate-limited, 500 unexpected.
- Pagination: `?page=&limit=` returning `{ data, meta: { page, limit, total } }`.
- Retry safety: `POST /orders` and payment-intent creation accept an `Idempotency-Key` header; a repeat of the same key replays the stored response instead of creating a second order or charge (NFR-R5).

---

## 6. Data Requirements

### 6.1 Data Entities (summary)
`User`, `Table`, `MenuCategory`, `MenuItem`, `ModifierGroup`, `ModifierItem`, `Order`, `OrderItem`, `OrderEvent`, `Discount`, `Payment`, `WebhookEvent`, `Reservation`, `Delivery`, `Setting`, `AuditLog`.

Full attribute-level model: see **LLD §3 (Data Model)**.

### 6.2 Data Volumes
| Entity | Est. rows/year |
|---|---|
| Order | ~120,000 |
| OrderItem | ~450,000 |
| OrderEvent | ~700,000 |
| Payment | ~130,000 |
| Menu/other | < 5,000 |

Rows per year as above; retention is ≥ 7 years (§6.3), so size the five-year case at roughly 5× these figures.

Indexes required on `Order(placedAt)`, `Order(businessDate)`, `Order(status)`, `Order(tableId, status)`, `OrderItem(orderId)`, `OrderEvent(orderId, createdAt)`. Webhook replay protection is carried by the `WebhookEvent` primary key (the Stripe event id) — there is deliberately no second dedupe index on `Payment`.

### 6.3 Data Retention & Privacy
- Transactional order data retained ≥ 7 years (tax/accounting expectation).
- PII subject to deletion/anonymization requests (retention of anonymized order rows for reporting).
- Audit/event logs immutable; no hard deletes of `OrderEvent`.

### 6.4 Data Integrity Rules
1. FK constraints with explicit `onDelete` behavior (orders cascade items/events; menu items referenced by orders use snapshot instead of FK restrictions).
2. Enumerated statuses enforced at DB level via native enums/CHECK.
3. Monetary columns `INTEGER` (cents, i.e. fixed-point with two decimal places), currency code column.
4. Unique constraints: `Table.number`, `Table.qrToken`, `Discount.code`, `WebhookEvent.id` (the Stripe event id, as primary key), and `(Order.businessDate, Order.orderNumber)` — the order number recycles daily, so it is unique only *within* a business date.
5. Conditional requirements (e.g. `customerName` mandatory for takeaway/delivery but not dine-in) are enforced by `CHECK` constraints, not by column-level `NOT NULL`.

---

## 7. Business Rules

| ID | Rule |
|---|---|
| BR-01 | Total = (subtotal − discount) + serviceCharge + tax + deliveryFee + tip; never negative. |
| BR-02 | Service charge applies only to `DINE_IN` orders. |
| BR-03 | Tax applies to (subtotal − discount), plus the service charge when the `serviceChargeTaxable` setting is enabled. The setting defaults to disabled; it exists because jurisdictions differ and AC-4 requires the client preview and the server charge to agree exactly. |
| BR-04 | At most one discount code per order. |
| BR-05 | An item marked unavailable after placement may not be removed from an existing order — it can only be cancelled with staff approval. |
| BR-06 | Only `PLACED`/`CONFIRMED` orders may be cancelled by a customer. |
| BR-07 | A refund may be issued only where a successful payment exists. It sets `paymentStatus` to `REFUNDED` and leaves the order's status unchanged — so a refunded order that was cancelled stays `CANCELLED`, and one that was completed stays `COMPLETED`. |
| BR-08 | A table in `SEATED` state cannot be freed until all its open orders are completed or cancelled. |
| BR-09 | PaymentIntent amount always equals the server-computed outstanding balance (total − sum of successful payments) at creation time; any change to the order after intent creation requires a new intent. |
| BR-10 | Discounts never apply to delivery fee. |
| BR-11 | A menu item cannot be hard-deleted if referenced by a non-test order; it is deactivated instead. |
| BR-12 | Staff advance an order exactly one step along the canonical sequence; skipping ahead (e.g. `PLACED → PREPARING`) and moving backwards are both rejected, so the event log has no gaps. Only STAFF/ADMIN may cancel, except that a customer may cancel their own order while it is `PLACED` or `CONFIRMED` (ORD-09, BR-06). |
| BR-13 | Tips are never discounted and never taxed; the tip is added after every other component. |
| BR-14 | Items may be appended to an order only while it is `PLACED`, `CONFIRMED`, or `PREPARING`. Appending recomputes all totals and re-derives `paymentStatus`; an order already `PAID` becomes `PARTIALLY_PAID` when its total rises. |
| BR-15 | An order's business date is fixed at placement from the restaurant timezone and never changes, even if the order completes after local midnight. Order numbers are unique within a business date, not globally. |
| BR-16 | Sales revenue excludes tax, service charge, delivery fees and tips, and excludes cancelled and refunded orders. Amounts actually collected are derived from payment records, not from order totals. |

---

## 8. Assumptions, Dependencies & Constraints

### 8.1 Assumptions
- Single-restaurant deployment; menu and settings are global.
- Customers own a smartphone with camera + browser for QR ordering.
- Kitchen has at least one always-on display device.
- Staff has been trained on basic KDS/POS operation.

### 8.2 Dependencies
| Dependency | Type | Risk |
|---|---|---|
| Stripe | External API | Downtime → mitigated by cash/manual flow (NFR-R6) |
| Docker / PostgreSQL | Infrastructure | Version drift → pinned in compose file |
| Node.js ≥ 20 | Runtime | LTS only |
| Public HTTPS domain | Hosting | Required for QR + webhooks |

### 8.3 Constraints
- Budget: zero-cost external services in test phase (Stripe test mode, local Docker).
- Timeline: phased delivery; any milestone must leave a runnable system.
- Legal: PCI scope minimized by using Stripe Elements (card data never touches our servers).

---

## 9. Acceptance Criteria

The system is accepted when all of the following demonstrably pass:

| # | Scenario |
|---|---|
| AC-1 | Guest scans table QR → menu loads bound to table → adds item with modifiers → cart total matches hand-calculated value → logs in → order is created and appears on KDS **within 500 ms**. |
| AC-2 | Kitchen advances ticket `PLACED → CONFIRMED → PREPARING → READY → SERVED → COMPLETED`; the customer's tracker updates live at each step. |
| AC-3 | An illegal transition (e.g., `COMPLETED → PREPARING`) is rejected with `409` and logged. |
| AC-4 | Applying promo `SAVE10` (10%) yields subtotal−10% then tax on the reduced amount; totals identical in client preview and server charge. |
| AC-5 | Stripe test card `4242…` completes payment → webhook flips `paymentStatus` to `PAID` even if the browser closes immediately after redirect. |
| AC-6 | Duplicate delivery of the same Stripe event does not double-record a payment. |
| AC-7 | Marking an item 86'd hides it from the customer menu immediately (via realtime update) without affecting historical orders. |
| AC-8 | Cash payment by STAFF records the acting user; a CUSTOMER attempting it receives `403`. |
| AC-9 | Reports for a seeded date range match the totals the seed script independently guarantees (the seed asserts its own figures, so the check is not report-SQL against report-SQL). |
| AC-10 | `npm run lint` and `npm run typecheck` pass with zero errors; pricing engine and state machine unit tests all green. |
| AC-11 | Table lifecycle enforced: cannot free a SEATED table with open orders. |
| AC-12 | QR token of Table A can never create an order attached to Table B. |
| AC-13 | A customer pays by card, then cancels while `PLACED`; an ADMIN refunds the order. The refund succeeds, `paymentStatus` becomes `REFUNDED`, and the order remains `CANCELLED`. |
| AC-14 | Appending an item to an order already marked `PAID` raises the total and flips `paymentStatus` to `PARTIALLY_PAID`; the outstanding balance is collectable by card or cash. |
| AC-15 | A tip added at checkout appears in the total but changes neither the tax nor the discount, and is reported on its own line rather than as sales revenue. |
| AC-16 | An order placed at 00:30 local time in a UTC+3 deployment is numbered and reported under the local business date, not the UTC one. |
| AC-17 | A submitted modifier that is not attached to the ordered item, is unavailable, or violates `minSelect`/`maxSelect` is rejected server-side even when the client permits it. |
| AC-18 | Disabling a staff account takes effect on that account's very next request, without waiting for the JWT to expire. |
| AC-19 | A receipt rendered after the menu price of an ordered item has changed still shows the price charged at the time of the order. |
| AC-20 | A KDS tablet left running for 48 hours continuously never prompts for login; its access token is silently renewed throughout. |
| AC-21 | A refresh token replayed after it has been rotated revokes the entire session family, and every device on that session must re-authenticate. |
| AC-22 | The refresh token is not readable from `document.cookie` or any browser storage, and the access token is absent from `localStorage` after a page reload. |

---

## 10. Appendices

### Appendix A — Order & Payment State Machines

The two lifecycles are **orthogonal**: an order in any status may hold payments, and a payment
event never moves the order.

**Order lifecycle** — one step forward at a time, never backwards (BR-12):
```
PLACED ──► CONFIRMED ──► PREPARING ──► READY ──► SERVED ──► COMPLETED
   │           │             │           │          │
   ▼           ▼             ▼           ▼          ▼
 ┌───────────────────────────────────────────────────┐
 │                    CANCELLED                      │   terminal
 └───────────────────────────────────────────────────┘
   reachable from every pre-COMPLETED state;
   by STAFF/ADMIN at any point, by the owning customer only from PLACED or CONFIRMED (ORD-09)
```

**Payment lifecycle** — held on the order as `paymentStatus`, derived from the sum of successful
payment records against the order total:
```
UNPAID ──► PARTIALLY_PAID ──► PAID ──► REFUNDED
   │                            ▲
   └────────────────────────────┘
     (a single payment covering the whole balance)
```
A failed card attempt leaves the order `UNPAID` and is retryable. A refund requires a successful
payment and is valid against a `COMPLETED` **or** a `CANCELLED` order — the common case being a
customer who paid at checkout and then cancelled (BR-07, AC-13). Appending items to a `PAID` order
raises the total and returns it to `PARTIALLY_PAID` (BR-14).

### Appendix B — Roles & Permissions Matrix
| Capability | CUSTOMER | STAFF | ADMIN |
|---|---|---|---|
| Browse menu | ✅ | ✅ | ✅ |
| Place own order | ✅ | ✅ | ✅ |
| View own orders | ✅ | ✅ | ✅ |
| View all orders | ❌ | ✅ | ✅ |
| Advance order status | ❌ | ✅ | ✅ |
| Cancel own order (PLACED/CONFIRMED) | ✅ | ✅ | ✅ |
| Cancel any order | ❌ | ✅ | ✅ |
| Append items to an open order | ✅ (own) | ✅ | ✅ |
| Add tip at checkout | ✅ | ✅ | ✅ |
| Record cash tip | ❌ | ✅ | ✅ |
| Mark cash payment | ❌ | ✅ | ✅ |
| View / print own receipt | ✅ (own) | ✅ | ✅ |
| List and revoke own sessions | ✅ | ✅ | ✅ |
| Print kitchen ticket | ❌ | ✅ | ✅ |
| Manage tables | ❌ | ✅ | ✅ |
| Manage menu | ❌ | ❌ | ✅ |
| Manage discounts | ❌ | ❌ | ✅ |
| View reports | ❌ | ❌ | ✅ |
| Manage settings/staff | ❌ | ❌ | ✅ |
| Refund payment | ❌ | ❌ | ✅ |

### Appendix C — Requirements Traceability

Each requirement family maps to the architecture that realises it (HLD) and the module, schema,
endpoint and test that implement it (LLD).

| Requirements | HLD | LLD |
|---|---|---|
| AUTH-01…14 | §3.1 (C14), §7.3, §10.1, §10.2 | §2.2 (RefreshToken), §4.2, §5.1, §9, §10.2 (I1–I3, I28–I31) |
| MENU-01…08 | §3.1 (C7), §6.2, §6.4 | §2.2 (MenuCategory, MenuItem, Modifier*), §4.3, §5.2 |
| BROWSE-01…04 | §3.1 (C1), §6.4, §9.4 | §4.3, §5.2, §7.1, §7.3 |
| CART-01…08 | §9.1 | §3.2, §4.4 (`previewCart`), §5.3, §7.2, §10.1 (P1–P9) |
| ORD-01…15 | §3.2, §8, §9.2 | §2.2 (Order, OrderItem, OrderEvent, OrderSequence), §3.1, §3.4, §4.4, §5.3, §10.1 (S1–S8), §10.2 (I17, I18, I22, I23) |
| KDS-01…07 | §3.1 (C2), §8.1 | §5.3, §6.2, §7.5 |
| TABLE-01…07 | §9.4 | §2.2 (Table, Reservation), §3.5, §4.6, §5.5 |
| PAY-01…09 | §3.3, §9.3, §10.2 | §2.2 (Payment, WebhookEvent), §4.5, §5.4, §10.2 (I8–I10, I19–I21) |
| DEL-01…04 | §3.1 (C1), §6.1 | §2.2 (Delivery), §5.3 |
| DISC-01…06 | §9.1 | §2.2 (Discount), §3.3, §4.7, §5.6 |
| RPT-01…07 | §9.5 | §4.8, §5.7 |
| ADM-01…04 | §3.1 (C15), §11.4 | §2.2 (Setting, AuditLog), §5.6, §5.8 |
| TIP-01…05 | §9.1 | §2.2 (`Order.tipAmount`), §3.2, §4.5, §5.3, §7.4 |
| PRINT-01…04 | §3.1 (C1, C2), §12.4 | §4.4 (`getReceipt`), §5.3, §7.3 |
| BR-01…16 | §9.1, §9.2, §9.3, §9.4 | §3.1, §3.2, §3.3, §3.5, §4.4, §4.5 |
| NFR-P1…P5 | §6.3, §6.4, §8.4, §13 | §2.2 (indexes), §4.8, §10.4 |
| NFR-A1…A3 | §11.2, §11.5, §13 | §4.9 |
| NFR-S1…S10 | §10.1, §10.2 | §9 |
| NFR-R1…R6 | §6.3, §8.2, §9.3 | §3.1, §3.2, §4.4, §4.5 |
| NFR-U1…U5 | §3.1, §12.1, §12.4 | §7.1, §7.3, §7.5, §8 |
| NFR-M1…M5 | §4, §12.3 | §1, §10 |
| NFR-B1…B2 | §11.1, §11.4 | §1 |

### Appendix D — Revision History
| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-09-25 | Dev Team | Initial release |
| 1.2.1 | 2026-09-25 | Dev Team | §6.4: monetary columns `BIGINT` → `INTEGER` cents per ADR-004. No requirement change. |
| 1.2 | 2026-09-25 | Dev Team | Added the access/refresh token model, which v1.1 lacked. AUTH-02 and AUTH-06 rewritten; AUTH-10…14 added (refresh exchange, rotation with reuse detection, httpOnly cookie delivery, session listing, purge). NFR-S3 and NFR-S8 updated. AC-20…22 added. Rationale: a 24 h token expires mid-service on the always-on kitchen display SRS §8.1 assumes, and leaves an XSS a full day of access. |
| 1.1 | 2026-09-25 | Dev Team | Design review. Refunds become payment state only (ORD-03, PAY-04, PAY-09, BR-07); `PARTIALLY_PAID` added. BR-12 fixed to a strict one-step sequence. New scope: tips (§3.13), order amendment (ORD-12…14), receipts (§3.14). Business date and restaurant timezone made first-class (ORD-15, BR-15). Service-charge taxability made an explicit setting (BR-03). NFR-S5 corrected to reject unknown fields; NFR-R2 extended to basis-point rates; NFR-U3 bars colour-only signalling. Index list, unique constraints and Appendix A corrected; Appendices B and C completed; AC-9 de-circularised and AC-13…19 added. |
