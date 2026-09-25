# Project Milestones & Delivery Plan
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-PLAN-001 |
| **Version** | 1.2 |
| **Status** | Draft |
| **Date** | 2026-09-25 |
| **Derived from** | ROS-SRS-001 v1.2 · ROS-HLD-001 v1.2 · ROS-LLD-001 v1.2 |

---

## Table of Contents
1. [How to use this plan](#1-how-to-use-this-plan)
2. [Milestone map](#2-milestone-map)
3. [Definition of done](#3-definition-of-done)
4. [M0 — Foundation](#m0--foundation)
5. [M1 — Shared domain core](#m1--shared-domain-core)
6. [M2 — Database & seed](#m2--database--seed)
7. [M3 — Auth & RBAC](#m3--auth--rbac)
8. [M4 — Menu](#m4--menu)
9. [M5 — Tables & QR sessions](#m5--tables--qr-sessions)
10. [M6 — Cart & server pricing](#m6--cart--server-pricing)
11. [M7 — Order placement & lifecycle](#m7--order-placement--lifecycle)
12. [M8 — Realtime & KDS](#m8--realtime--kds)
13. [M9 — Payments](#m9--payments)
14. [M10 — Amendments, tips & receipts](#m10--amendments-tips--receipts)
15. [M11 — Reports & admin dashboard](#m11--reports--admin-dashboard)
16. [M12 — Delivery, takeaway & reservations](#m12--delivery-takeaway--reservations)
17. [M13 — Hardening, accessibility & deploy](#m13--hardening-accessibility--deploy)
18. [Requirement → milestone traceability](#18-requirement--milestone-traceability)
19. [Risk checkpoints](#19-risk-checkpoints)
20. [Revision history](#20-revision-history)

---

## 1. How to use this plan

Fourteen milestones, 169 slices. A **slice** is the smallest unit worth committing on its own:
one focused change, independently verifiable, with a stated check that proves it works. Every
slice names the requirement it satisfies and the design section that specifies it, so nothing
here is invented — if a slice has no `Spec` reference, it is scaffolding rather than product.

**The ordering rule** comes from HLD §1.3: *every milestone must leave a runnable system*. Each
one ends with a **Demo** you can actually show. If a milestone cannot be demonstrated, it has
been cut wrong — split it rather than letting it run long.

**Sizing** is indicative for one developer: **S** ≈ half a day · **M** ≈ one day · **L** ≈ two days.
Totals are given per milestone. These are not commitments; they exist to flag when a slice has
been scoped too large (anything bigger than L should be split).

**Checkbox column** — `☐` open, `☑` done. Slices within a milestone are ordered by dependency;
where two are independent, either order works.

**Assumptions**, stated so you can correct them:
- One developer, working sequentially. No parallel tracks are assumed.
- The design direction from `designs/` is chosen in M0-S10 and everything downstream inherits it.
- Stripe stays in test mode throughout (SRS §2.5); no production payment credentials are needed.
- Deployment is a single instance until M13-S9, so Redis is optional before then (HLD §6.4, C8).

---

## 2. Milestone map

| # | Milestone | Goal | Demo at the end | Depends on | Slices | Size |
|---|---|---|---|---|---|---|
| **M0** | Foundation | The repo builds, lints, types, tests and runs | `/health` responds; SPA paints in the chosen palette; CI green | — | 12 | ~8.5d |
| **M1** | Shared domain core | All money and state logic, pure and proven | `npm test -w shared` — pricing and state machine fully green | M0 | 9 | ~8.5d |
| **M2** | Database & seed | Schema, migrations, realistic data | Prisma Studio shows a seeded restaurant with 30 days of history | M0 | 12 | ~11.5d |
| **M3** | Auth & RBAC | Identity, roles, and the error taxonomy | Register → log in → hit an admin route as a customer → `403` | M1, M2 | 18 | ~19d |
| **M4** | Menu | Browse, manage, and 86 items | Admin 86's a dish; the customer menu shows it sold out | M3 | 12 | ~13d |
| **M5** | Tables & QR sessions | The dine-in entry point | Scan a table QR → menu opens bound to that table | M3 | 10 | ~10.5d |
| **M6** | Cart & server pricing | Totals the client and server agree on | Cart total matches `/orders/preview` to the cent | M1, M4 | 9 | ~9.5d |
| **M7** | Order placement | Orders exist, transition, and are audited | Place an order; walk it to `COMPLETED`; reject an illegal move | M5, M6 | 13 | ~17d |
| **M8** | Realtime & KDS | The kitchen screen, live | Order placed on a phone appears on the KDS in under 500 ms | M7 | 13 | ~12.5d |
| **M9** | Payments | Card, cash, split, refund | Pay with `4242…`; close the browser; webhook still marks it paid | M7 | 13 | ~19d |
| **M10** | Amendments, tips & receipts | Second rounds, gratuity, printed proof | Append to a paid order → `PARTIALLY_PAID` → settle the balance | M9 | 13 | ~14.5d |
| **M11** | Reports & dashboard | Numbers the owner trusts | Reports for a seeded range match the seed's own fixture | M9 | 14 | ~14d |
| **M12** | Delivery, takeaway & reservations | The remaining channels | Book a table, seat it; place a delivery order with a fee | M7 | 7 | ~7.5d |
| **M13** | Hardening & deploy | Production posture | All 19 acceptance criteria pass on staging over HTTPS | all | 14 | ~18.5d |

**Total: 169 slices, about 184 working days** for one developer at the sizings above — roughly
nine months full time, proportionally longer part time. That is the honest figure for complete v1
scope including hardening and deployment, and it is worth knowing before you start rather than
discovering at M9. The first end-to-end demo you would show anyone — scan a QR, order, watch it
land on the kitchen screen — arrives at the end of **M8, around day 110**. Everything after that
is revenue handling, reporting and production posture.

**Critical path:** M0 → M1 → M2 → M3 → M4 → M6 → M7 → M8 → M9 → M13.
M5, M10, M11 and M12 can each slip without blocking the path, but M13 needs all of them.

**If you have to cut scope**, cut in this order: M12 (reservations are `S` priority), then M11-S13
(CSV export is `C`), then M10's kitchen-ticket printing (`PRINT-03`, `S`). Do not cut M1 or any
part of M9's webhook handling — those are where silent data corruption lives.

---

## 3. Definition of done

Applies to **every** slice; not repeated in the tables.

| Gate | Requirement |
|---|---|
| Types | `npm run typecheck` clean. No `any` in domain code (NFR-M1). |
| Lint | `npm run lint` clean, including import ordering (NFR-M2). |
| Tests | New logic has a test. Domain logic is tested without a DB or network (NFR-M3). |
| Validation | Every new route parses input with a Zod schema from `shared/schemas`, `.strict()` (NFR-S5). |
| Authorisation | Every new mutating route declares a role, and ownership is re-checked in the service (NFR-S4). |
| DTOs | Prisma models never cross the API boundary; map through `toDto()` (LLD §1). |
| Money | Integer cents; rates in basis points. No float enters a total (NFR-R2). |
| Events | Emitted only after the transaction commits (HLD §8.2). |
| Secrets | Nothing added to git; `.env.example` updated alongside (NFR-S10). |

---

## M0 — Foundation

**Goal.** A repository that builds, lints, type-checks, tests and boots — with nothing in it yet.
Every later milestone assumes these gates already exist, so cutting corners here costs more later.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M0-S1** | Rename the working folder to `restaurant-ordering-system`, then `git init` and commit the three design docs plus `designs/` | S | HLD §4 | `git log` shows one commit; the folder name is spelled correctly |
| ☑ | **M0-S2** | Create npm workspaces: root `package.json` with `shared`, `server`, `client` | S | HLD §4 | `npm install` at root links all three; `npm ls -w shared` resolves |
| ☑ | **M0-S3** | `tsconfig.base.json` with `strict: true`, extended by each workspace | S | NFR-M1 | A deliberate type error fails `npm run typecheck` |
| ☑ | **M0-S4** | ESLint + Prettier, one config, all workspaces | S | NFR-M2 | A deliberate lint error fails `npm run lint` |
| ☑ | **M0-S5** | Vitest wired in all three workspaces with a root `test` script | S | HLD §12.3 | A trivial passing test runs in each workspace |
| ☑ | **M0-S6** | `docker-compose.yml`: Postgres 15, pinned, named volume | S | NFR-B1 | `docker compose up -d` gives a reachable DB that survives a restart |
| ☑ | **M0-S7** | `.env.example` + Zod env parsing that **fails fast at boot** on a missing var | M | HLD §11.4, NFR-S10 | Deleting `DATABASE_URL` stops the server with a named error, not a stack trace |
| ☑ | **M0-S8** | Express app factory (`app.ts`, no `listen`) + `server.ts` bootstrap + `GET /health` | M | HLD §4 | `curl /health` returns `{status:"ok"}`; `app.ts` is importable by tests |
| ☑ | **M0-S9** | Vite + React 18 + React Router + Tailwind SPA shell | M | HLD §5 | `npm run dev` serves a routed shell at :5173 |
| ☑ | **M0-S10** | **Choose the design direction** from `designs/index.html`; extract its palette and type scale into Tailwind theme tokens | M | SRS §5.1 | `tailwind.config` carries named tokens; the shell renders in the chosen identity |
| ☑ | **M0-S11** | CI: install → lint → typecheck → test → `prisma validate` → build | M | HLD §11.3 | A pushed branch runs the pipeline and goes green |
| ☑ | **M0-S12** | `README.md`: one-command bootstrap, env setup, workspace map | S | NFR-B1 | A fresh clone reaches a running app following only the README |

**Traps.** Do M0-S1 before anything else — renaming a folder with `node_modules` and git history
in it is far more annoying than renaming an empty one. Do not skip M0-S7: a server that boots with
half its config missing fails later, deeper, and less legibly.

**Demo.** `docker compose up` + `npm run dev` → API answering `/health`, SPA painted in the
direction you picked, CI green on the branch.

---

## M1 — Shared domain core

**Goal.** Every rule about money and state, written once, as pure functions with no IO. This is the
highest-value milestone in the project: it is cheap to test, everything depends on it, and a bug
here corrupts data everywhere downstream.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☑ | **M1-S1** | `enums.ts` — `Role`, `OrderType`, `OrderStatus` (**no** `REFUNDED`), `PaymentStatus` (with `PARTIALLY_PAID`), `PaymentState`, `TableStatus`, `DiscountType`, `DeliveryStatus`, `ReservationStatus` | S | LLD §2.1 | Types compile; `OrderStatus` has exactly 7 members |
| ☑ | **M1-S2** | `bps(amountCents, rateBps)` — multiply by basis points, round **half away from zero** | S | NFR-R2, LLD §3.2 | `bps(5,1000) === 1` and `bps(-5,1000) === -1`; plain `Math.round` fails this test |
| ☑ | **M1-S3** | `computeTotals()` — steps 1–10 in order: lines → subtotal → discount → taxable → service charge → tax base → tax → delivery → tip → total | L | CART-04…06, BR-01, BR-03, BR-10, BR-13 · LLD §3.2 | Worked example: DINE_IN, `2×(1000+200−100)` + `1550`, 10% off, 12.5% service, 8.75% tax, 500 tip → **total 4592** |
| ☑ | **M1-S4** | Pricing tests **P1–P12** | M | LLD §10.1 | All twelve green, including P9 (service-charge taxability delta) and P11 (negative-delta symmetry) |
| ☑ | **M1-S5** | `ORDER_TRANSITIONS` as `(from, to, roles)` triples + `FORWARD_TRANSITION` map | M | ORD-02, ORD-03, BR-12 · LLD §3.1 | 10 edges exist; no edge leaves `COMPLETED` or `CANCELLED` |
| ☑ | **M1-S6** | `canTransition(from,to,role)` and `nextStatuses(from,role)` | S | LLD §3.1 | `nextStatuses('PLACED','CUSTOMER')` returns `['CANCELLED']` only |
| ☑ | **M1-S7** | State machine tests **S1–S8** | M | LLD §10.1 | All eight green, including S4 (skip-forward rejected) and S5 (per-edge role gate) |
| ☑ | **M1-S8** | Discount rule evaluation — window, minimum, limit — as a pure function returning a typed error code | M | DISC-01…06 · LLD §3.3 | Each of the five `DISCOUNT_*` codes is reachable by a test |
| ☑ | **M1-S9** | `shared/schemas` — Zod DTOs for auth, cart, order creation, amendment, payment | M | NFR-S5 · LLD §1 | Client and server both import them; `shared` has zod as its only runtime dependency |

**Traps.** M1-S2 is the slice people skip. `Math.round(-0.5)` is `-0`, not `-1`, and
`ModifierItem.priceDelta` is allowed to be negative — so without the symmetric helper, the client
preview and the server charge can differ by a cent, which is exactly what AC-4 forbids.
In M1-S5, resist collapsing the role gate onto the status: from `PLACED` a customer may cancel but
must not confirm, and only an edge-keyed gate can say that.

**Demo.** `npm test -w shared` — the entire pricing engine and state machine proven, with no
database, no network, and nothing mocked.

---

## M2 — Database & seed

**Goal.** The schema from LLD §2, migrated, plus data realistic enough that reports and the KDS
have something to show from day one.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☑ | **M2-S1** | Prisma init, datasource, client generation wired to the build | S | HLD §5 | `prisma generate` runs in CI |
| ☑ | **M2-S2** | Enums in `schema.prisma`, mirroring M1-S1 exactly | S | LLD §2.1 | Prisma enums and shared enums have identical members |
| ☑ | **M2-S3** | Menu models: `MenuCategory`, `MenuItem`, `ModifierGroup`, `ModifierItem`, `MenuItemModifierGroup` | M | LLD §2.2 | Relations resolve; an item can carry two modifier groups |
| ☑ | **M2-S4** | Order models: `Order` (with `businessDate`, `tipAmount`, `updatedAt`), `OrderItem`, `OrderEvent` | M | LLD §2.2 | `OrderEvent.fromStatus` is nullable; `Order.paymentStatus` defaults `UNPAID` |
| ☑ | **M2-S5** | Payment models: `Payment` (`PaymentState`, `tipAmount`, no `stripeEventId` unique), `WebhookEvent` (event id as PK) | M | PAY-08 · LLD §2.2 | Exactly one dedupe mechanism exists in the schema |
| ☑ | **M2-S6** | Operations models: `User`, `Table`, `Reservation`, `Delivery`, `Discount`, `Setting`, `AuditLog` | M | LLD §2.2 | `Setting.updatedBy` is nullable |
| ☑ | **M2-S7** | New models: `OrderSequence(businessDate PK, lastValue)`, `IdempotencyKey` | S | LLD §2.2 | Both migrate; `OrderSequence.lastValue` is an integer column |
| ☑ | **M2-S8** | Constraints: `UNIQUE(businessDate, orderNumber)`, `CHECK (type='DINE_IN' OR customerName IS NOT NULL)`, `CHECK (total >= 0)` | M | BR-15, DEL-01 · SRS §6.4 | Inserting `A-1001` on two different business dates both succeed |
| ☑ | **M2-S9** | Indexes per SRS §6.2 | S | NFR-P1 | `Order(businessDate)` and `OrderEvent(orderId, createdAt)` exist |
| ☑ | **M2-S10** | First migration, committed to VCS | S | HLD §6.2 | `prisma migrate deploy` on an empty DB reproduces the schema |
| ☑ | **M2-S11** | `seed.ts` part 1 — admin, staff, demo customer, 4 categories, the 9 dishes, modifier groups, 14 tables, 2 discounts, settings **in basis points** | L | HLD §9.6 | `taxBps=875`, `serviceChargeBps=1000`, `timezone` set; login works with the seeded admin |
| ☑ | **M2-S12** | `seed.ts` part 2 — 30 business days of synthetic orders, **and write the totals it generated to a fixture file** | L | HLD §9.6, AC-9 | `seed-fixture.json` holds net sales, order count and top items per business date |

**Traps.** M2-S12's fixture is what makes AC-9 meaningful. Without it, the report tests in M11
compare report SQL against a second hand-written query — which passes even when both are wrong.
Seed the settings in basis points from the start; converting later means touching every price test.

**Demo.** `prisma migrate dev && npm run seed` → Prisma Studio shows a working restaurant with a
month of trading history behind it.

---

## M3 — Auth & RBAC

**Goal.** Identity, role enforcement, and the error taxonomy every later route depends on.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☑ | **M3-S1** | bcrypt hash and verify, cost 12 | S | AUTH-07, NFR-S2 | Hashes are never returned by any DTO |
| ☑ | **M3-S2** | Access-token sign and verify with `jose`, HS256, **15 min**, secret from env | S | AUTH-02, NFR-S3 | A tampered or expired token is rejected |
| ☑ | **M3-S2b** | `RefreshToken` model, migration, and issue/hash helpers (`crypto.randomBytes(32)` → base64url, SHA-256 at rest) | M | AUTH-12, NFR-S3 · LLD §2.2 | The raw token appears nowhere in the database |
| ☑ | **M3-S2c** | `POST /auth/refresh` with rotation and reuse detection | L | AUTH-10, AUTH-11, AC-21 · LLD §4.2 | Replaying a rotated token revokes the whole family |
| ☑ | **M3-S2d** | Cookie delivery: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, plus the `X-Refresh-Request` header check | M | AUTH-12 · LLD §9 | The cookie is unreadable from `document.cookie` (AC-22) |
| ☑ | **M3-S2e** | `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/sessions`, `DELETE /auth/sessions/:familyId` | M | AUTH-06, AUTH-13 | Logout revokes server-side; a revoked cookie cannot refresh |
| ☑ | **M3-S2f** | CORS `credentials: true` against the explicit origin allow-list | S | NFR-S8 | The cookie survives a cross-origin dev setup; a wildcard origin is refused |
| ☑ | **M3-S2g** | `purgeRefreshTokens` daily job | S | AUTH-14 · LLD §4.10 | Expired and long-revoked rows are removed |
| ☑ | **M3-S3** | Typed error hierarchy — `AppError` subclasses — and the single mapping middleware | M | SRS §5.5 · LLD §8 | Every error leaves as `{error:{code,message,details?}}`; no stack reaches a client |
| ☑ | **M3-S4** | `POST /auth/register` | M | AUTH-01 | Duplicate email → `409 EMAIL_TAKEN` |
| ☑ | **M3-S5** | `POST /auth/login` | S | AUTH-02 | Wrong email and wrong password return the **same** `401 INVALID_CREDENTIALS` |
| ☑ | **M3-S6** | `authenticate` middleware — verify token, then **re-read `isActive` and `role` from the DB** with a 60 s cache | L | ADM-02, AUTH-08, AC-18 · LLD §4.2 | Disabling an account makes its next request `401 ACCOUNT_DISABLED` |
| ☑ | **M3-S7** | `requireRole(...roles)` middleware | S | AUTH-05, NFR-S4 | A customer hitting an admin route gets `403` |
| ☑ | **M3-S8** | `GET /auth/me` | S | AUTH-02 | Returns the DTO, never the hash |
| ☑ | **M3-S9** | Rate limit `/auth` at 10 per 15 min per IP | S | AUTH-09 | The 11th attempt returns `429 RATE_LIMITED` |
| ☑ | **M3-S10** | Client: auth store holding the access token **in memory only**, login and register pages, `<RequireRole>` guard with `returnTo` | L | AUTH-12 · LLD §7.1, §7.2 | Deep-linking to `/admin` while logged out returns you there after login; `localStorage` holds no token (AC-22) |
| ☑ | **M3-S10b** | API client interceptor: on `401`, refresh once and replay — **single in-flight refresh**, queued retries, no loops | L | AUTH-10 · CODING-STANDARDS §12 | Ten concurrent 401s produce exactly one refresh call |
| ☑ | **M3-S11** | Integration tests **I1, I2, I3, I24, I28–I32** | L | LLD §10.2 | Including reuse detection, refresh-after-disable, and a simulated 48 h session (AC-20, AC-21) |

**Traps.** M3-S6 is the one that looks optional and is not: if the role in the access token is
trusted outright, disabling a staff account does nothing until the token expires, and `ADM-02`
becomes decorative. M3-S10b is the one that looks trivial and is not — parallel refresh calls each
rotate the token, so all but the last look like a replay and trip reuse detection, logging the user
out. Build the single-flight queue from the start rather than debugging random logouts later.

**Demo.** Register, log in, get refused from `/admin` with `403`; an admin disables the account and
the very next request fails. Leave a tab idle for an hour and watch it keep working — the access
token has been silently renewed four times (AC-20).

---

## M4 — Menu

**Goal.** The menu customers read and admins run, including the server-side modifier validation
that everything downstream trusts.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☑ | **M4-S1** | Menu repo: category and item queries with modifier groups joined | M | LLD §4.3 | One query, no N+1 |
| ☑ | **M4-S2** | `getPublicMenu()` — filter `isActive`, `isAvailable`, and the schedule window | M | MENU-01, MENU-05, MENU-06 | A breakfast item is absent at 15:00 and present at 09:00 |
| ☑ | **M4-S3** | 30 s in-memory cache with invalidation on write | S | HLD §6.4 | An admin edit is visible immediately, not 30 s later |
| ☑ | **M4-S4** | `GET /menu` and `GET /menu/items/:id` | S | MENU-01, BROWSE-03 | Both public; no auth required |
| ☑ | **M4-S5** | Admin category CRUD with soft delete and reorder | M | MENU-02 | Deleting sets `isActive=false`; the row survives |
| ☑ | **M4-S6** | Admin item CRUD with soft delete | M | MENU-03, BR-11 | An item referenced by an order cannot be hard-deleted |
| ☑ | **M4-S7** | Modifier group and item CRUD, plus attaching groups to items | M | MENU-04 | An item can carry *Size* (min 1, max 1) and *Extras* (min 0, max 3) |
| ☑ | **M4-S8** | **`resolveSelections(itemId, modifierItemIds)`** — assert every id belongs to a group attached to that item, is available, and satisfies `minSelect`/`maxSelect`; return authoritative deltas | L | CART-03, NFR-S4, AC-17 · LLD §4.3 | A modifier borrowed from another item → `422 INVALID_MODIFIER_SELECTION` |
| ☑ | **M4-S9** | 86 toggle endpoint | S | MENU-03, AC-7 | Flips `isAvailable` and invalidates the cache |
| ☑ | **M4-S10** | `AuditLog` row on every menu write | S | ADM-04 | The diff records before and after |
| ☑ | **M4-S11** | Client: customer menu screen in the chosen design, with search and category filter | L | BROWSE-01…03 · LLD §7.3 | Sold-out items render as sold out, not hidden |
| ☑ | **M4-S12** | Client: admin menu manager with the 86 toggle | L | MENU-02…03, ADM-01 | An admin can 86 an item in two taps |

**Traps.** M4-S8 is a security slice wearing a feature's clothes. Without it a client can submit a
cheaper modifier, skip a required choice, or order an unavailable option — and the server will
price whatever it is handed. Build it before M7 depends on it.

**Demo.** An admin 86's the halibut; the customer menu shows it sold out on the next load. (It goes
live *instantly* in M8, once the broadcast exists.)

---

## M5 — Tables & QR sessions

**Goal.** The dine-in entry point, and the table lifecycle staff actually operate.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☑ | **M5-S1** | Table CRUD with `qrToken = crypto.randomBytes(16).toString('hex')` | M | TABLE-01 | Tokens are 32 hex chars and unique |
| ☑ | **M5-S2** | `GET /tables/qr/:token` — **read-only** resolve, rate-limited | S | TABLE-03, AC-12 · LLD §3.5 | Calling it repeatedly never changes table status |
| ☑ | **M5-S3** | `POST /tables/sessions {token}` — opens the session, `FREE → SEATED` | M | TABLE-03 | A `DIRTY` table returns `409 TABLE_DIRTY` |
| ☑ | **M5-S4** | `POST /tables/:id/close` — `SEATED → DIRTY`, asserting no open orders | M | TABLE-02, BR-08, AC-11 | With an open order → `409 TABLE_HAS_OPEN_ORDERS` |
| ☑ | **M5-S5** | `POST /tables/:id/clean` — `DIRTY → FREE` | S | TABLE-02 | The lifecycle closes; no state is unreachable |
| ☑ | **M5-S6** | `regenerateQr` (admin) | S | TABLE-01 | The old token stops resolving immediately |
| ☑ | **M5-S7** | QR export as PNG/SVG, one per table | M | SRS §5.2 | A printed code scans to `https://host/t/{token}` |
| ☑ | **M5-S8** | Client: `/t/:token` landing → resolve, then open the session, then the menu with table context | L | TABLE-03, BROWSE-04 | The table number is visible on the menu screen |
| ☑ | **M5-S9** | Client: staff table map with status colours and close/clean actions | L | TABLE-04 | Statuses are distinguishable without relying on colour alone |
| ☑ | **M5-S10** | Tests **I11, I12, I26** | M | LLD §10.2 | Including: a GET on the QR route mutates nothing |

**Traps.** Keep the read and the write separate (M5-S2 vs M5-S3). A `GET` that seats a table will
be fired by link previews, prefetchers and crawlers — you will see tables seat themselves.

**Demo.** Scan a printed QR with a phone; the menu opens bound to that table and the staff map
shows it turn `SEATED`.

---

## M6 — Cart & server pricing

**Goal.** A cart that survives reloads and a total the client and server agree on to the cent.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M6-S1** | Zustand cart store with persist middleware | M | CART-01 | The cart survives a reload and a login |
| ☐ | **M6-S2** | Quantity increment, decrement, remove; per-line notes | M | CART-02, CART-08 | Decrementing to zero removes the line |
| ☐ | **M6-S3** | Modifier dialog enforcing `minSelect`/`maxSelect` before "Add to cart" | L | CART-03 | The add button stays disabled until a required group is satisfied |
| ☐ | **M6-S4** | `GET /settings` public subset — `taxBps`, `serviceChargeBps`, `serviceChargeTaxable`, `deliveryFee`, `currency`, `tipPresetsBps` | S | ADM-03 · LLD §5.6 | The client has everything `computeTotals` needs |
| ☐ | **M6-S5** | Client-side live totals via the shared `computeTotals` | M | CART-04, CART-05 | No pricing arithmetic exists in the client outside the shared call |
| ☐ | **M6-S6** | `POST /orders/preview` — public, server-priced, no persistence | M | CART-06 | A guest gets authoritative totals before logging in |
| ☐ | **M6-S7** | Tip selector — presets plus a custom amount | M | TIP-01, TIP-03 | Adding a tip changes the total and leaves tax and discount untouched |
| ☐ | **M6-S8** | Promo code field calling `POST /discounts/validate` | M | DISC-02 | Each `DISCOUNT_*` code renders a distinct inline message |
| ☐ | **M6-S9** | Parity test: client preview vs server preview on the same cart | M | AC-4 | Identical to the cent across a matrix of order types and discounts |

**Traps.** M6-S9 is the whole point of the shared package. Run it over a matrix — every order type
× discount present/absent × tip present/absent × `serviceChargeTaxable` both ways — not one case.

**Demo.** Build a cart with modifiers, a promo code and a tip; the on-screen total and
`/orders/preview` agree exactly.

---

## M7 — Order placement & lifecycle

**Goal.** Orders that exist, transition legally, and leave a complete audit trail. The heart of the
system, and the milestone most worth slowing down for.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M7-S1** | `businessDate` helper — `(now() AT TIME ZONE settings.timezone)::date` | M | ORD-15, BR-15 · LLD §3.4 | An order at 00:30 local in a UTC+3 deployment gets the local day |
| ☐ | **M7-S2** | Order number allocation from `OrderSequence`, inside the placement transaction | M | ORD-10, BR-15 | Two concurrent placements never collide; `A-1001` recurs on the next day |
| ☐ | **M7-S3** | `createOrder` transaction, steps 1–10 in order | L | ORD-01, ORD-05, NFR-R1 · LLD §4.4 | Nothing is written unless every step succeeds |
| ☐ | **M7-S4** | Bind `tableId` **from the resolved QR token**, never from client input | M | AC-12 | A request naming table B with table A's token attaches to A |
| ☐ | **M7-S5** | Snapshot `nameSnapshot`, `unitPrice`, `modifiersJson`, `modifierTotal`, `lineTotal`, `station` onto each `OrderItem` | M | ORD-05, BR-11 | Renaming a menu item afterwards does not change the order |
| ☐ | **M7-S6** | First `OrderEvent` written as `(null → PLACED)` | S | ORD-04 · LLD §2.2 | `fromStatus` is null on exactly the first event |
| ☐ | **M7-S7** | Atomic discount redemption — conditional `UPDATE … WHERE usedCount < usageLimit` | M | DISC-06 · LLD §3.3 | Two concurrent checkouts cannot both take the last redemption |
| ☐ | **M7-S8** | `Idempotency-Key` claim, store and replay | L | NFR-R5 · LLD §2.2, §5.3 | The same key returns the original `201`; a different body → `422 IDEMPOTENCY_KEY_REUSED` |
| ☐ | **M7-S9** | `transitionStatus` — transactional, conditional update, `OrderEvent`, `completedAt` | L | ORD-02, ORD-04, NFR-R3 · LLD §4.4 | Illegal → `409 ILLEGAL_TRANSITION`; lost race → `409 CONCURRENT_UPDATE` |
| ☐ | **M7-S10** | `GET /orders` role-scoped and `GET /orders/:id` with an ownership check | M | ORD-07, ORD-08, NFR-S9 | A customer requesting another's order gets `404`, not `403` |
| ☐ | **M7-S11** | Customer cancellation via the state machine's own role gate | S | ORD-09, BR-06 | A customer cannot cancel from `PREPARING` |
| ☐ | **M7-S12** | Client: checkout → order created → live tracker page | L | ORD-07 · LLD §7.4 | The tracker shows the current status and the event timeline |
| ☐ | **M7-S13** | Tests **I4–I7, I21–I23** | L | LLD §10.2 | Including the concurrent-transition race and business-date bucketing |

**Traps.** `transitionStatus` must be one transaction — a crash between the status update and the
`OrderEvent` insert breaks NFR-R3 silently, and you will not notice until a report disagrees with
the timeline. The conditional `updateMany` *is* the concurrency control; there is no row lock to
take in Prisma's fluent API, and reaching for one wastes a day.

**Demo.** Place an order from a phone; walk it `PLACED → … → COMPLETED` from an API client; attempt
`COMPLETED → PREPARING` and watch it refuse with `409`.

---

## M8 — Realtime & KDS

**Goal.** The kitchen display, live, plus the broadcast layer every other screen reads from.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M8-S1** | Socket.IO server with **optional** auth handshake — no token connects anonymously, a bad token is rejected | M | BROWSE-01, AC-7 · LLD §4.9 | A tokenless socket connects successfully |
| ☐ | **M8-S2** | Room joins: `menu` for everyone; `kitchen`/`pos`/`admin` by role; `customer:{orderId}` by ownership | M | NFR-S4 · HLD §8.3 | A customer cannot join `kitchen`, even by emitting the join itself |
| ☐ | **M8-S3** | `events.publish` façade, called as the **last** step after commit | M | HLD §8.2 | A rolled-back transaction emits nothing |
| ☐ | **M8-S4** | Event catalog: `order:new`, `order:status`, `order:removed`, `menu:changed`, `table:changed`, `payment:changed` | M | LLD §6.2 | Names match the LLD exactly — `order:status`, not `order:updated` |
| ☐ | **M8-S5** | Client socket singleton with reconnect and snapshot refetch on `connect` | M | HLD §8.3 | Events are treated as hints; REST remains the source of truth |
| ☐ | **M8-S6** | KDS page: status columns, ticket cards, order number, table/type badge | L | KDS-01 · LLD §7.5 | Tickets land in the right column |
| ☐ | **M8-S7** | New tickets appear live, with an audible and visual alert | M | KDS-02, KDS-06 | No manual refresh needed |
| ☐ | **M8-S8** | Ticket aging: elapsed timer, colour band **and a text label** | M | KDS-03, NFR-U3 | State is readable without relying on colour (WCAG 1.4.1) |
| ☐ | **M8-S9** | Bump via `FORWARD_TRANSITION[current]`, optimistic, rolling back on `409` | M | KDS-04, R9 · LLD §7.5 | Two staff bumping the same ticket: one wins, one silently refetches |
| ☐ | **M8-S10** | Station filter | S | KDS-05 | Filters on the `station` snapshotted onto the order item |
| ☐ | **M8-S11** | Completed tickets linger for `kdsCompletedGraceSec`, then auto-hide | S | KDS-07 | Configurable from settings, not hard-coded |
| ☐ | **M8-S12** | 30 s safety poll regardless of socket state | S | HLD §8.4, R3 | Killing the socket still reconciles the board within 30 s |
| ☐ | **M8-S13** | Tests: **I25** and the AC-7 anonymous broadcast path | M | AC-7 | An anonymous browser receives `menu:changed` |

**Traps.** Never read `nextStatuses[0]` for the bump — array order is not meaning. And do not make
socket auth mandatory: AC-7 requires an 86'd item to disappear from a *guest's* menu, and a guest
has no token.

**Demo.** Place an order on a phone; it appears on the KDS in well under 500 ms. Bump it through to
`COMPLETED` and watch the customer's tracker follow each step.

---

## M9 — Payments

**Goal.** Card, cash, split and refund — with the webhook handling that keeps money and orders in
agreement even when the browser closes mid-flow.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M9-S1** | Stripe client, keys from env, test mode asserted at boot | S | PAY-01, SRS §2.5 | A live key in test config fails fast |
| ☐ | **M9-S2** | `createIntent(orderId, amount?)` — charge `amount ?? (total − paidSum)`, validated `0 < amount ≤ balance`; precondition `paymentStatus != PAID` | L | PAY-01, PAY-06, PAY-07, BR-09 · LLD §4.5 | Over-paying → `422 PAYMENT_EXCEEDS_BALANCE`; a second split intent is possible |
| ☐ | **M9-S3** | Stripe idempotency key passed as the SDK's **second options argument** | S | LLD §4.5 | Not a field inside the params object |
| ☐ | **M9-S4** | Raw-body route for `/payments/webhook` (`express.raw`), mounted before the JSON parser | M | LLD §9 | Signature verification sees unparsed bytes |
| ☐ | **M9-S5** | Signature verification + `WebhookEvent` dedupe by primary key | L | PAY-03, PAY-08, AC-6 | A replayed event returns 200 and writes nothing |
| ☐ | **M9-S6** | **`syncPaymentStatus(orderId)`** — the only writer of `Order.paymentStatus` | L | PAY-04 · LLD §4.5 | Derives `UNPAID`/`PARTIALLY_PAID`/`PAID`/`REFUNDED` from payment rows |
| ☐ | **M9-S7** | `payment_intent.succeeded` and `payment_intent.payment_failed` handling | M | PAY-03 | A failure leaves the order `UNPAID` and retryable |
| ☐ | **M9-S8** | `markCash(orderId, amount?, tipAmount?)` — staff only, records the actor | M | PAY-05, TIP-02, AC-8 | A customer attempting it gets `403` |
| ☐ | **M9-S9** | `refund` — admin only; valid on a `COMPLETED` **or** `CANCELLED` order; sets payment state only | L | PAY-09, BR-07, AC-13 | A paid-then-cancelled order refunds and stays `CANCELLED` |
| ☐ | **M9-S10** | `reconcilePayments` job, every 5 min | M | NFR-R4, R2 | An order stuck `UNPAID` against a succeeded intent self-heals |
| ☐ | **M9-S11** | Client: Stripe Elements checkout | L | PAY-02 · LLD §7.4 | `4242 4242 4242 4242` completes end to end |
| ☐ | **M9-S12** | Client: POS payment modal — cash, split, and a cash tip field | L | PAY-05, PAY-06 | Split payment reaches `PAID` through two records |
| ☐ | **M9-S13** | Tests **I8, I9, I10, I19, I20** | L | LLD §10.2 | Including replay, split, and refund-after-cancel |

**Traps.** Nothing except `syncPaymentStatus` may write `paymentStatus` — the moment two places
write it, split payments and amendments start disagreeing. Test M9-S5 by *actually* replaying the
same event twice; a dedupe that is never exercised is a dedupe that does not work.

**Demo.** Pay with the test card, close the browser tab immediately, and watch the webhook still
flip the order to `PAID` (AC-5).

---

## M10 — Amendments, tips & receipts

**Goal.** The second round of drinks, gratuity end to end, and a receipt built only from snapshots.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M10-S1** | `appendItems` transaction with the amendability guard | L | ORD-12, BR-14 · LLD §4.4 | Past `PREPARING` → `409 ORDER_NOT_AMENDABLE` |
| ☐ | **M10-S2** | Re-apply the order's **snapshotted** rates when recomputing, not current settings | M | ORD-13, BR-14 | A tax-rate change between rounds does not reprice round one |
| ☐ | **M10-S3** | Re-derive `paymentStatus` after append via `syncPaymentStatus` | S | ORD-13, AC-14 | A `PAID` order becomes `PARTIALLY_PAID` when its total rises |
| ☐ | **M10-S4** | `AuditLog` row `ORDER_ITEMS_APPENDED` with lines added and totals before/after | S | ORD-14 | The diff is reconstructable from the log alone |
| ☐ | **M10-S5** | `POST /orders/:id/items` — owner or staff | M | ORD-12 · LLD §5.3 | Emits `order:status` with the refreshed order |
| ☐ | **M10-S6** | KDS: appended items badged as a later course with their own timestamp | M | ORD-12 · LLD §7.5 | The kitchen can tell round two from round one at a glance |
| ☐ | **M10-S7** | Client: "Add to order" panel on the tracker and the POS | L | ORD-12 | Reuses the modifier dialog from M6-S3 |
| ☐ | **M10-S8** | Tip carried through order creation, `markCash`, and the totals DTO | M | TIP-01, TIP-02, TIP-04 | Tips appear as their own line, never inside net sales |
| ☐ | **M10-S9** | `getReceipt(id)` built **entirely from snapshots** | L | PRINT-01, PRINT-02, AC-19 | A price change after the order does not alter the receipt |
| ☐ | **M10-S10** | `GET /orders/:id/receipt` — owner or staff | S | PRINT-04 | Role-scoped like every other order route |
| ☐ | **M10-S11** | `Receipt` component with a print stylesheet | M | PRINT-01 · LLD §7.3 | `window.print()` produces a clean single page |
| ☐ | **M10-S12** | Kitchen ticket print / re-print from the KDS | M | PRINT-03 | Re-printing does not change order state |
| ☐ | **M10-S13** | Tests **I17, I18, I27** plus AC-14, AC-15, AC-19 | M | LLD §10.2 | All green |

**Traps.** M10-S2 is subtle: an amendment must reprice using the rates the order was placed under,
or a mid-service settings change silently rewrites history. Keep tips out of `paidSum` — a tip is
not payment toward the order balance.

**Demo.** Order and pay for a main; add a dessert twenty minutes later; the order drops to
`PARTIALLY_PAID`; settle the balance in cash and print the receipt.

---

## M11 — Reports & admin dashboard

**Goal.** Numbers the owner can trust, built on one revenue definition used everywhere.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M11-S1** | The shared `<scope>` predicate — not cancelled, not refunded, within the business-date range | M | BR-16 · LLD §4.8 | Defined once and imported by every report query |
| ☐ | **M11-S2** | `salesSummary` — net sales, orders, AOV, and tax/service/delivery/tips as separate lines | L | RPT-01, BR-16 | Net sales exclude tax, service charge, delivery and tips |
| ☐ | **M11-S3** | `revenueByDay` grouped on `businessDate` | M | RPT-02 | Never `date_trunc('day', placedAt)` |
| ☐ | **M11-S4** | `topItems` grouped by `menuItemId`, name carried for display only | M | RPT-03, B8 | Renaming a dish does not split its history |
| ☐ | **M11-S5** | `peakHours` with `AT TIME ZONE` conversion | M | RPT-04, AC-16 | Bars align with local service hours |
| ☐ | **M11-S6** | `salesByType` | S | RPT-05 | Grouped by `OrderType` |
| ☐ | **M11-S7** | `collectedByMethod` from **payment records**, netting refunds | M | RPT-05, BR-16 | Card and cash totals reconcile against Stripe's test dashboard |
| ☐ | **M11-S8** | `cancellations` — cancelled and refunded orders with reasons, deliberately outside `<scope>` | M | RPT-06 | Cancel reasons come from the final `OrderEvent` |
| ☐ | **M11-S9** | Quote every identifier in raw SQL; bind every value | S | NFR-S6 · LLD §1 | `FROM "Order"`, never `from orders` |
| ☐ | **M11-S10** | 60 s cache per `(from, to)` key | S | HLD §6.4 | Repeated loads do not re-query |
| ☐ | **M11-S11** | `GET /dashboard/today` with `unavailableItems` | M | ADM-01 · LLD §5.8 | Scoped to the current business date |
| ☐ | **M11-S12** | Client: admin dashboard and report screens in Recharts | L | RPT-01…06 · LLD §7.3 | Chart text colours come from theme tokens |
| ☐ | **M11-S13** | Tests against the **seed fixture** from M2-S12 | M | AC-9, I13 | Report output equals the figures the seed guaranteed |
| ☐ | **M11-S14** | CSV export | S | RPT-07 | `C` priority — cut this first if time runs short |

**Traps.** The revenue definition is the single highest-risk thing in this milestone. Summing
`Order.total` counts tax and tips as sales and credits orders nobody paid for. Write M11-S1 once,
import it everywhere, and never inline a variant.

**Demo.** Run reports over the seeded 30 days; every figure matches the fixture the seed wrote.

---

## M12 — Delivery, takeaway & reservations

**Goal.** The remaining service channels. Lower risk than everything before it, and safe to defer.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M12-S1** | Takeaway: require name and phone, no table binding | S | DEL-01 | Enforced by the `CHECK` from M2-S8 |
| ☐ | **M12-S2** | Delivery: `Delivery` record, address, note, configurable fee | M | DEL-02 | The fee is added and never discounted (BR-10) |
| ☐ | **M12-S3** | Driver assignment and `ASSIGNED → PICKED_UP → DELIVERED` | M | DEL-03, DEL-04 | Staff can advance delivery status independently of order status |
| ☐ | **M12-S4** | Reservations CRUD | M | TABLE-06 | Create, list by date, cancel |
| ☐ | **M12-S5** | Seat a reservation — table `SEATED`, reservation `SEATED` | M | TABLE-06 | Reuses the session logic from M5-S3 |
| ☐ | **M12-S6** | `reservationAlerts` job flagging overdue bookings to the `pos` room | M | TABLE-07 · LLD §4.10 | Slot + 15 min raises `reservation:flag` |
| ☐ | **M12-S7** | Client: delivery checkout fields and the staff reservation list | L | DEL-02, TABLE-06 | Address validation before the intent is created |

**Demo.** Book a table for 19:30, seat it on arrival; separately, place a delivery order and walk
it to `DELIVERED`.

---

## M13 — Hardening, accessibility & deploy

**Goal.** Production posture, and a demonstrable pass over all nineteen acceptance criteria.

| ☐ | ID | Slice | Size | Spec | Done when |
|---|---|---|---|---|---|
| ☐ | **M13-S1** | Helmet, CORS allow-list from env, 256 KB body cap | M | NFR-S8 · LLD §9 | The webhook route keeps its raw body |
| ☐ | **M13-S2** | Rate limits: auth 10/15 min/IP, `POST /orders` 30/5 min/user, general 300/5 min | S | NFR-S8 | Each returns `429 RATE_LIMITED` |
| ☐ | **M13-S3** | `pino` structured logs, request id propagated, `authorization`/`password`/`token` redacted | M | HLD §12.2 | A request id appears in both the log and the error response |
| ☐ | **M13-S4** | Security pass against NFR-S1…S10, plus the `/security-review` skill on the diff | L | NFR-S1…S10 | Every control has a test or a documented reason it does not |
| ☐ | **M13-S5** | Accessibility pass: keyboard paths, contrast ≥ 4.5:1, 44 px targets, no colour-only state | L | NFR-U2, NFR-U3 | KDS operable by touch alone; axe reports no violations |
| ☐ | **M13-S6** | Performance: k6 or autocannon, 100 concurrent `GET /menu` for 30 s | M | NFR-P1 · LLD §10.4 | p95 < 300 ms |
| ☐ | **M13-S7** | Playwright E2E scenarios 1–6 | L | LLD §10.3 | Including the tip and the amendment flows |
| ☐ | **M13-S8** | OpenAPI document generated from the Zod schemas | M | NFR-M5 | Every endpoint in LLD §5 appears |
| ☐ | **M13-S9** | Redis: Socket.IO adapter and cross-instance menu-cache invalidation | M | NFR-A1 · HLD §6.4 | Only needed at more than one instance — skip if deploying single |
| ☐ | **M13-S10** | Nightly `pg_dump` to object storage, 30-day retention, plus a documented restore drill | M | NFR-A3 · HLD §11.5 | The restore has actually been run once |
| ☐ | **M13-S11** | Deploy to staging: TLS, HSTS, env config, migrations on release | L | NFR-S1 · HLD §11.1 | A public HTTPS URL Stripe can reach for webhooks |
| ☐ | **M13-S12** | Point the Stripe webhook at staging and verify signature handling end to end | M | PAY-03 | A real test-mode event arrives and is processed once |
| ☐ | **M13-S13** | Walk **AC-1 … AC-19** on staging and record the result of each | L | SRS §9 | Nineteen passes, or a named exception with a reason |
| ☐ | **M13-S14** | Update SRS/HLD/LLD for anything the build changed; bump to v1.2 | M | — | The docs describe what was actually built |

**Traps.** M13-S13 is the real exit gate — not "the features are done". Run every criterion against
staging, not localhost, and write down what happened. M13-S14 matters for a portfolio project:
documents that drifted from the code read worse than no documents.

**Demo.** A public URL, a real Stripe test webhook round trip, and a signed-off acceptance sheet.

---

## 18. Requirement → milestone traceability

Every SRS requirement family, and where it gets built.

| Requirements | Milestone(s) |
|---|---|
| AUTH-01…14 | M3 |
| MENU-01…08 | M4 |
| BROWSE-01…04 | M4, M5 |
| CART-01…08 | M6 |
| ORD-01…11 | M7 |
| ORD-12…14 (amendment) | M10 |
| ORD-15 (business date) | M7 |
| KDS-01…07 | M8 |
| TABLE-01…05 | M5 |
| TABLE-06…07 (reservations) | M12 |
| PAY-01…09 | M9 |
| DEL-01…04 | M12 |
| DISC-01…05 | M6 |
| DISC-06 (usage limit) | M7 |
| RPT-01…07 | M11 |
| ADM-01…04 | M4, M11 |
| TIP-01…05 | M6, M9, M10 |
| PRINT-01…04 | M10 |
| BR-01…04, BR-10, BR-13 | M1 |
| BR-05…09, BR-11…12 | M4, M5, M7, M9 |
| BR-14…16 | M10, M7, M11 |
| NFR-P1…P5 | M13 (verified), M2 (indexes) |
| NFR-A1…A3 | M13 |
| NFR-S1…S10 | M3, M4, M13 |
| NFR-R1…R6 | M1, M7, M9 |
| NFR-U1…U5 | M4, M8, M13 |
| NFR-M1…M5 | M0, M13 |
| NFR-B1…B2 | M0 |

**Acceptance criteria** first become testable at: AC-1 → M8 · AC-2 → M8 · AC-3 → M7 ·
AC-4 → M6 · AC-5, AC-6 → M9 · AC-7 → M8 · AC-8 → M9 · AC-9 → M11 · AC-10 → M0 ·
AC-11 → M5 · AC-12 → M7 · AC-13 → M9 · AC-14, AC-15 → M10 · AC-16 → M7 ·
AC-17 → M4 · AC-18 → M3 · AC-19 → M10 · AC-20, AC-21, AC-22 → M3.

---

## 19. Risk checkpoints

The HLD risk register, mapped to the milestone where each risk is actually retired.

| Risk | Retired in | Checkpoint |
|---|---|---|
| R1 Pricing bugs | M1 | Tests P1–P12 green; M6-S9 parity matrix passes |
| R2 Lost or duplicated payment state | M9 | Replay test I9 passes; reconciliation job runs |
| R3 Missed realtime events | M8 | Kill the socket mid-service; the 30 s poll recovers the board |
| R4 Scope creep | every milestone | Each milestone ends with a working demo, or it gets split |
| R5 Illegal state transitions | M7 | I6 and I7 pass; `409` on both illegal and concurrent moves |
| R6 Money rounding | M1 | P11 and P12 pass; no float appears in the totals chain |
| R7 Stripe outage | M9 | Cash path works with Stripe keys deliberately removed |
| R8 QR token leakage | M5 | Tokens are 128-bit; the lookup is rate-limited and read-only |
| R9 Concurrent double-bump | M8 | Two browsers bump the same ticket; one gets `409` and refetches |
| R10 Revenue reported wrongly | M11 | Reports equal the seed fixture |
| R11 UTC vs business date | M7 | AC-16 passes with the timezone set to UTC+3 |
| R12 Stale privileges | M3 | AC-18 passes |
| R13 Amendment vs payment state | M10 | AC-14 passes |
| R14 Always-on device logs out mid-service | M3 | AC-20 passes — a 48 h simulated session never prompts |
| R15 Refresh token theft | M3 | AC-21 passes — a replayed token revokes the family |

---

## 20. Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.2 | 2026-09-25 | Dev Team | Recounted slices from the milestone tables. v1.1 added seven M3 slices (S2b…S2g, S10b), not nine: M3 is 18 slices, ~19d, not 20 / ~17d. §1 and §2 updated to match — total 169 slices, ~184 working days (was 162 / ~175); first end-to-end demo moves from ~day 100 to ~day 110. "Derived from" updated to SRS/HLD/LLD v1.2. |
| 1.1 | 2026-09-25 | Dev Team | Added nine M3 slices for the access/refresh token model (SRS v1.2 AUTH-10…14). M3 grows from 11 to 20 slices, ~10d to ~17d. |
| 1.0 | 2026-09-25 | Dev Team | Initial plan. 14 milestones, 162 slices, derived from SRS/HLD/LLD v1.1. |
