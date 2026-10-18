# Architecture Decision Records
## Restaurant Ordering System (ROS)

| | |
|---|---|
| **Document ID** | ROS-ADR-001 |
| **Date** | 2026-09-25 |

Each record states what was decided, why, and what it costs. Records are **never edited after
acceptance** except to change the status line — a reversed decision gets a new record that
supersedes the old one.

**Status values:** `Proposed` · `Accepted` · `Superseded by ADR-NNN` · `Rejected`

## Index

| ADR | Title | Status | Source |
|---|---|---|---|
| [001](#adr-001--typescript-monorepo-with-npm-workspaces) | TypeScript monorepo with npm workspaces | Accepted | HLD §4, §5 |
| [002](#adr-002--pricing-and-state-rules-live-in-a-shared-pure-package) | Pricing and state rules live in a shared pure package | Accepted | HLD §9.1–9.2 |
| [003](#adr-003--money-as-integer-cents-rates-as-basis-points) | Money as integer cents, rates as basis points | Accepted | SRS §2.4, NFR-R2 |
| [004](#adr-004--money-column-type-int-vs-bigint) | Money column type: `Int` vs `BigInt` | Accepted — `Int` | ERD §11 |
| [005](#adr-005--refunds-are-payment-state-not-order-state) | Refunds are payment state, not order state | Accepted | SRS v1.1, LLD §4.5 |
| [006](#adr-006--paymentstatus-is-derived-by-a-single-writer) | `paymentStatus` is derived by a single writer | Accepted | LLD §4.5 |
| [007](#adr-007--state-machine-gated-per-edge-with-an-explicit-forward-map) | State machine gated per edge, with an explicit forward map | Accepted | LLD §3.1 |
| [008](#adr-008--business-date-in-the-restaurants-timezone) | Business date in the restaurant's timezone | Accepted | SRS ORD-15, BR-15 |
| [009](#adr-009--dedicated-ordersequence-table-for-order-numbers) | Dedicated `OrderSequence` table for order numbers | Accepted | HLD §6.2 |
| [010](#adr-010--snapshot-menu-data-onto-order-items) | Snapshot menu data onto order items | Accepted | SRS ORD-05, BR-11 |
| [011](#adr-011--webhookevent-is-the-sole-stripe-dedupe-authority) | `WebhookEvent` is the sole Stripe dedupe authority | Accepted | HLD §6.2, PAY-08 |
| [012](#adr-012--short-access-jwt--rotating-opaque-refresh-token) | Short access JWT + rotating opaque refresh token | Accepted | SRS v1.2, LLD v1.2 §4.2 |
| [013](#adr-013--re-read-role-and-isactive-on-every-request) | Re-read role and `isActive` on every request | Accepted | LLD §4.2 |
| [014](#adr-014--realtime-events-are-hints-rest-is-truth) | Realtime events are hints; REST is truth | Accepted | HLD §8 |
| [015](#adr-015--anonymous-sockets-may-join-the-menu-room) | Anonymous sockets may join the `menu` room | Accepted | HLD v1.1 §8.3 |
| [016](#adr-016--one-revenue-definition-for-all-reports) | One revenue definition for all reports | Accepted | SRS BR-16, LLD §4.8 |
| [017](#adr-017--qr-resolve-is-read-only-session-open-is-a-post) | QR resolve is read-only; session open is a POST | Accepted | LLD §3.5 |
| [018](#adr-018--redis-only-above-one-instance) | Redis only above one instance | Accepted | HLD §5, §6.4 |
| [019](#adr-019--frontend-design-direction) | Frontend design direction | Accepted — design 31 | MILESTONES M0-S10 |
| [020](#adr-020--dependency-versions-for-the-build) | Dependency versions for the build | Accepted | Build, M0 |
| [021](#adr-021--schema-additions-made-during-the-build) | Schema additions made during the build | Accepted | Build, M2/M7 |
| [022](#adr-022--api-additions-made-during-the-build) | API additions made during the build | Accepted | Build, M3–M8 |
| [023](#adr-023--git-workflow-one-branch-per-milestone) | Git workflow: one branch per milestone | Accepted | Build, M0 |
| [024](#adr-024--restaurant-timezone-is-public-time-helpers-live-in-shared) | Restaurant timezone is public; time helpers live in `shared` | Accepted | Build, M12 |
| [025](#adr-025--delivery-and-reservation-rules-the-spec-left-open) | Delivery and reservation rules the spec left open | Accepted | Build, M12 |
| [026](#adr-026--real-photography-served-with-the-client) | Real photography served with the client | Accepted | Build, UI |
| [027](#adr-027--how-m13-was-verified-without-a-staging-host) | How M13 was verified without a staging host | Accepted | Build, M13 |
| [028](#adr-028--motion-without-an-animation-library) | Motion without an animation library | Accepted | Build, UI |
| [029](#adr-029--one-tenant-per-deployment-many-branches) | One tenant per deployment, many branches | Accepted | Phase 2 |
| [030](#adr-030--arabic-first-i18n-without-a-library) | Arabic-first i18n without a library | Accepted | Phase 2, M14 |
| [031](#adr-031--menu-prices-are-final-for-the-demo) | Menu prices are final for the demo | Accepted | Phase 2 |

---

### ADR-001 — TypeScript monorepo with npm workspaces
**Status:** Accepted · 2026-09-25
**Context.** Client and server must share validation schemas and pricing code; the project has
exactly three packages.
**Decision.** One repository, npm workspaces `shared`, `server`, `client`; TypeScript `strict`
everywhere.
**Alternatives.** pnpm, Turborepo, Nx — rejected as extra tooling with no payoff at three packages.
**Consequences.** Zero build orchestration to maintain. If build times grow, Turborepo can be added
without restructuring.

### ADR-002 — Pricing and state rules live in a shared pure package
**Status:** Accepted · 2026-09-25
**Context.** The on-screen cart total and the server charge must agree to the cent (AC-4); illegal
order transitions must be impossible from any caller.
**Decision.** `computeTotals`, `bps`, `ORDER_TRANSITIONS`, `canTransition` and discount evaluation
live in `shared/domain` as pure functions with no IO. Both client and server import them. The
server remains authoritative.
**Consequences.** Domain logic is testable without a DB (NFR-M3). `shared` may depend only on `zod`.

### ADR-003 — Money as integer cents, rates as basis points
**Status:** Accepted · 2026-09-25
**Context.** Float arithmetic on money produces off-by-a-cent errors, and percentage rates as
decimals reintroduce floats mid-chain.
**Decision.** All amounts are integer minor units. Tax, service charge and percent discounts are
integer basis points. Rounding goes through one helper, `bps()`, which rounds **half away from
zero** so negative modifier deltas round symmetrically.
**Consequences.** `Math.round` is banned in the totals chain (it rounds `-0.5` to `-0`). Settings
are seeded in bps from day one.

### ADR-004 — Money column type: `Int` vs `BigInt`
**Status:** Accepted · 2026-09-25 — **integer cents in Postgres `integer` columns (Prisma `Int`)**
**Context.** LLD §2.2, HLD §6.2 and SRS §6.4 said `BIGINT` cents, but LLD §1 says money is a `number`
in TypeScript. Prisma maps `BigInt` to a JS `bigint`, which throws on `JSON.stringify` and can't be
mixed with `number`, so the documents contradicted each other.
**Decision.** Every money column is a Postgres `integer` holding minor units (cents), and money is a
`number` in TypeScript. `1234` means $12.34. The decimal point appears only when money is formatted
for display.
- The per-row ceiling is 2,147,483,647 cents ($21.47M), far beyond any order or line total.
- Postgres promotes `SUM(integer)` to `bigint`, so report aggregates can't overflow.
- Rates stay integer basis points (ADR-003). All rounding goes through `bps()`.

**Why not a decimal / BigDecimal type.** This came up directly: "shouldn't money be like Java's
BigDecimal?"
- Integer cents **is** a fixed-point decimal. A Java `BigDecimal` is stored as an unscaled integer
  plus a scale, so `12.34` is `1234` with scale 2. Here the scale is always 2, so only the integer is
  stored.
- JavaScript has no BigDecimal. A plain `number` holding dollars is a binary float
  (`0.1 + 0.2 = 0.30000000000000004`).
- A decimal type would mean Postgres `NUMERIC(12,2)` → `Prisma.Decimal` (decimal.js) on the server
  and in the browser. All arithmetic becomes method calls (`a.plus(b).times(r)`), amounts travel as
  strings in JSON, and the shared pricing engine and its tests get rewritten.
- Stripe takes integer minor units (`amount: 1099` is $10.99), so a decimal design would convert
  back to cents at the payment boundary anyway.

**Alternatives rejected.**
- *`BigInt` columns.* JSON and arithmetic friction for range we don't need.
- *`NUMERIC` in the DB, cents in code.* Adds a conversion step at every repository boundary just so
  raw rows are easier to read.
- *Decimal everywhere.* Costs listed above.

**Consequences.** Amended LLD §2.2, HLD §6.2, SRS §6.4 and ERD §10–11 (`BIGINT` → `INTEGER`).
CODING-STANDARDS §6 records the rationale. M2 is unblocked.

### ADR-005 — Refunds are payment state, not order state
**Status:** Accepted · 2026-09-25 (SRS/LLD v1.1 review)
**Context.** v1.0 had `REFUNDED` as an `OrderStatus`, which conflated what happened in the kitchen
with what happened to the money, and made a cancelled-then-refunded order unrepresentable.
**Decision.** `OrderStatus` has 7 members and no `REFUNDED`. Refunds live on `Payment` records and
surface via `PaymentStatus` (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`). Refunds are allowed
on `COMPLETED` or `CANCELLED` orders and never move order status.

### ADR-006 — `paymentStatus` is derived by a single writer
**Status:** Accepted · 2026-09-25
**Decision.** `syncPaymentStatus(orderId)` is the only code that writes `Order.paymentStatus`. It
derives the value from payment rows versus the current order total.
**Consequences.** Split payments, amendments (a paid order falling to `PARTIALLY_PAID`, AC-14) and
refunds all stay consistent. Tips are excluded from `paidSum`.

### ADR-007 — State machine gated per edge, with an explicit forward map
**Status:** Accepted · 2026-09-25
**Context.** A role gate keyed on the *source status* cannot express "from `PLACED` a customer may
cancel but not confirm". Reading `nextStatuses()[0]` for the KDS bump relies on array order.
**Decision.** Transitions are `(from, to, roles)` triples — 10 edges, none leaving `COMPLETED` or
`CANCELLED`. A separate `FORWARD_TRANSITION` map names the bump target. Strict one-step sequence
(BR-12). Concurrency via conditional `UPDATE … WHERE status = expected` → `409 CONCURRENT_UPDATE`.

### ADR-008 — Business date in the restaurant's timezone
**Status:** Accepted · 2026-09-25
**Decision.** `Order.businessDate` is fixed at placement as
`(now() AT TIME ZONE settings.timezone)::date`. Order numbering and every report bucket key on it;
`date_trunc('day', placedAt)` is forbidden.
**Consequences.** A 00:30 local order in a UTC+3 deployment is filed under the correct day (AC-16).

### ADR-009 — Dedicated `OrderSequence` table for order numbers
**Status:** Accepted · 2026-09-25
**Context.** v1.0 kept the daily counter in `Setting`, whose `value` is text, which requires an
`updatedBy` user, and which would grow one row per day. `UNIQUE(orderNumber)` also collided on day two.
**Decision.** `OrderSequence(businessDate PK, lastValue int)`, incremented atomically inside the
placement transaction. Uniqueness is `UNIQUE(businessDate, orderNumber)`.

### ADR-010 — Snapshot menu data onto order items
**Status:** Accepted · 2026-09-25
**Decision.** `OrderItem` stores `nameSnapshot`, `unitPrice`, `modifiersJson`, `modifierTotal`,
`lineTotal` and `station` at placement. Receipts are built entirely from snapshots (AC-19);
reports group by `menuItemId` so renames don't split history.

### ADR-011 — `WebhookEvent` is the sole Stripe dedupe authority
**Status:** Accepted · 2026-09-25
**Decision.** The Stripe event id is `WebhookEvent`'s primary key. `Payment` carries no competing
unique `stripeEventId`. A replayed event returns `200` and writes nothing (AC-6).

### ADR-012 — Short access JWT + rotating opaque refresh token
**Status:** Accepted · 2026-09-25 (SRS/HLD/LLD v1.2). Supersedes the v1.1 position that no refresh
tokens were needed.
**Context.** A 24 h JWT expires mid-shift on always-on KDS/POS devices (SRS §8.1) and gives an XSS a
full day of access.
**Decision.** Access token: HS256 via `jose`, 15 min, held **in memory only**. Refresh token: 32
random bytes, base64url, stored SHA-256-hashed, delivered as
`HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` plus an `X-Refresh-Request` header check.
Rotated on every use; reuse of a rotated token revokes the whole family. Client refresh is
single-flight.
**Consequences.** New `RefreshToken` model (the one `CASCADE` delete in the schema), four session
endpoints, a purge job, and AC-20…22.

### ADR-013 — Re-read role and `isActive` on every request
**Status:** Accepted · 2026-09-25
**Decision.** `authenticate` verifies the token, then re-reads `role` and `isActive` from the DB
(60 s cache). The token's role claim is never trusted alone.
**Consequences.** Disabling an account takes effect on the next request (AC-18) at the cost of one
cached lookup.

### ADR-014 — Realtime events are hints; REST is truth
**Status:** Accepted · 2026-09-25
**Decision.** Socket.IO events are published only **after commit**, via one `events.publish` façade.
Clients refetch snapshots on reconnect, and the KDS polls every 30 s regardless of socket state.
Event names follow LLD §6.2 (`order:status`, not `order:updated`).

### ADR-015 — Anonymous sockets may join the `menu` room
**Status:** Accepted · 2026-09-25
**Decision.** Socket auth is optional: no token connects anonymously and may join only `menu`; a bad
token is rejected. Staff rooms are role-gated; `customer:{orderId}` is ownership-gated.
**Why.** AC-7 requires an 86'd item to disappear from a guest's menu, and guests have no token.

### ADR-016 — One revenue definition for all reports
**Status:** Accepted · 2026-09-25
**Decision.** A single `<scope>` predicate (not cancelled, not refunded, within the business-date
range) is defined once and imported by every report. Net sales exclude tax, service charge,
delivery and tips; collected-by-method comes from payment records net of refunds.
**Verification.** The seed writes its own totals to `seed-fixture.json`; report tests assert against
that fixture (AC-9), not against a second hand-written query.

### ADR-017 — QR resolve is read-only; session open is a POST
**Status:** Accepted · 2026-09-25
**Decision.** `GET /tables/qr/:token` only resolves (rate-limited). `POST /tables/sessions` seats the
table. Table lifecycle is `FREE → SEATED → DIRTY → FREE` via explicit close and clean actions.
`tableId` on an order is bound from the resolved token, never from client input (AC-12).
**Why.** Link previews and prefetchers fire GETs; a mutating GET seats tables on its own.

### ADR-018 — Redis only above one instance
**Status:** Accepted · 2026-09-25
**Decision.** Local and staging run single-instance with in-process caches and no Redis. Redis
(Socket.IO adapter + cross-instance menu-cache invalidation) is added only when N > 1 (M13-S9).

### ADR-019 — Frontend design direction
**Status:** Accepted · 2026-09-25 — **design 31, "Fork & Flame"**
**Context.** There were 31 candidate directions in `designs/` (index at `designs/index.html`). The
owner supplied a reference screenshot of a dark restaurant landing page, which design 31 was modelled
on.
**Decision.** Design 31. The visual target is `designs/reference/31-reference-landing.png`, and the
working prototype is `designs/31-fork-flame-landing.html`. It uses a dark charcoal page, a single red
accent used on actions only, round plated-food photos over dark cards, a display serif (Philosopher)
with a sans body (Poppins), and red pill CTAs with a soft glow. The screenshot's brand name is not
used; the product is "Fork & Flame".
**Codified in** the project skill `.claude/skills/fork-flame-ui/SKILL.md`: Tailwind tokens, type
scale, component specs, and how the style extends to KDS, POS, admin and receipts.
**Alternatives.** The other 30 directions (`designs/01…30`) are rejected. Don't borrow from them.
**Consequences.**
- The red `#e5322d` is only 3.5 : 1 on the dark background, so it's used for fills and large text
  only. Red *text* uses `#ff5a52` (6.0 : 1) to meet NFR-U2.
- A dark-only UI needs a separate black-on-white print stylesheet for receipts (M10-S11).
- The look depends on good cut-out food photography. Every `MenuItem` needs an image, or it gets a
  neutral plate placeholder.
- M0-S10's remaining work is to put the skill's tokens into `client/tailwind.config.ts`.

### ADR-020 — Dependency versions for the build
**Status:** Accepted · 2026-09-25
**Context.** By the time the build started, most libraries had moved a major version past what the
design assumed: React 19, Express 5, Tailwind 4, Vite 8, Prisma 7, Zod 4, TypeScript 7, ESLint 10.
The machine runs Node 20.17.
**Decision.** Keep the majors the HLD names, and elsewhere use the last proven major that supports
Node 20.17: React 18.3, React Router 6.30, Express 4.22, Tailwind 3.4, Vite 5.4, Vitest 2.1,
Prisma 6.19, Zod 3.25, TypeScript 5.9, ESLint 9, jose 5, Socket.IO 4.8, TanStack Query 5,
Zustand 5.
**Consequences.** Everything is well documented and stable. Upgrading to the newer majors is a
deliberate later task; Prisma 7 in particular wants a `prisma.config.ts` (it already warns about
`package.json#prisma`).

### ADR-021 — Schema additions made during the build
**Status:** Accepted · 2026-09-25
**Context.** The LLD requires things its column list doesn't provide for.
**Decision.**
- `Order.taxBps`, `serviceChargeBps`, `serviceChargeTaxable`, `discountType`,
  `discountValue`: the pricing inputs an order was placed under, so an amendment reprices with them
  rather than with current settings (ORD-13, BR-14).
- `OrderItem.addedAt`: when a line joined the order, so the KDS can badge a later round (ORD-12,
  API-CONTRACT `addedAt`).
- `OrderItem.lineNo`: the guest's line order. Lines placed together share `addedAt`, so without it
  receipts and tickets came back shuffled.
- `Payment(stripePaymentIntentId)` index for webhook lookups; `restaurantName` setting for receipts.
**Consequences.** LLD §2.2 and ERD §10 need amending to match (doc debt in PROJECT_STATE).

### ADR-022 — API additions made during the build
**Status:** Accepted · 2026-09-25
**Decision.** Additive, non-breaking under API-CONTRACT §19:
- `POST /orders/preview` returns `discount: {code, type, value} | null`, so the client can price
  with the code and agree with the server to the cent. The cart applies codes through preview (which
  is public), so guests can use one before signing in.
- `MenuItemDto.modifierGroupCount`; `GET /settings/kds` for staff; `/staff/users` for ADM-02.
- Error codes `TABLE_NOT_SEATED`, `TABLE_NOT_DIRTY`, `USER_NOT_FOUND`, `SESSION_NOT_FOUND`,
  `DISCOUNT_CODE_TAKEN`, `ROUTE_NOT_FOUND`, `PAYLOAD_TOO_LARGE`; response header
  `Idempotent-Replayed: true`.
- Order socket events carry a per-audience view: staff actions to staff rooms, the owner's to the
  owner.
**Consequences.** API-CONTRACT needs a 1.2 listing these (doc debt).

### ADR-023 — Git workflow: one branch per milestone
**Status:** Accepted · 2026-09-25
**Context.** CODING-STANDARDS §18 asks for one branch per slice. With 169 slices, that's a great
many short-lived branches for one developer.
**Decision.** One `feat/mN-<slug>` branch per milestone, one conventional commit per slice (or per
tightly coupled group of slices, named in the commit), merged into `main` with `--no-ff` once the
milestone's gates pass and its tracking docs are updated. Every commit on a branch passes
`npm run check`.
**Consequences.** `git log --first-parent main` reads as the milestone list; the slice history
stays in each branch. CODING-STANDARDS §18 should be relaxed to match.

### ADR-024 — Restaurant timezone is public; time helpers live in `shared`
**Status:** Accepted · 2026-09-25
**Context.** A guest booking "7:30 pm" must mean 7:30 pm at the restaurant, even when their browser
runs in another zone. The client needs the restaurant's IANA zone and the same wall-clock → UTC
conversion the server uses. LLD §5.6 left `timezone` out of `GET /settings`, and a test asserted it.
**Decision.** Add `timezone` to `PublicSettings`. Move `businessDateOf`, `zonedTimeToUtc` and
`addDays` from `server/src/lib/time.ts` to `shared/src/domain/time.ts` (pure, no clock); the
server module re-exports them, so no server import changed.
**Consequences.** The zone is not sensitive (the address is on the landing page). Client and server
convert slots identically, including across DST. LLD §5.6 is amended.

### ADR-025 — Delivery and reservation rules the spec left open
**Status:** Accepted · 2026-09-25
**Context.** SRS DEL-03/04 and TABLE-06/07 name the behaviour but LLD §5 lists no delivery endpoint,
and says nothing about a booking's time window, seating onto an occupied table, or how often an
overdue booking is flagged.
**Decision.**
- `PATCH /orders/:id/delivery` (staff) takes `{ driverName?, status? }`. Delivery moves one step
  at a time, `PENDING → ASSIGNED → PICKED_UP → DELIVERED`, through a shared status map and a
  conditional update. Naming a driver on a PENDING delivery assigns it; the driver may change until
  pick-up. It is independent of order status but refused on a cancelled order. Announced as an
  `order:status` refresh with `from === to`, like an amendment. New codes: `409 NOT_A_DELIVERY`,
  `422 DRIVER_REQUIRED`.
- Reservations: any signed-in user may book; only staff may pin a table. A slot must be in the
  future and at most 90 days ahead (`422 RESERVATION_IN_PAST | RESERVATION_TOO_FAR`). Seating
  reuses the tables module's conditional `FREE → SEATED` move (`seatById`), but unlike a QR scan
  it never joins an occupied table (`409 TABLE_OCCUPIED`); with no table given or booked,
  `422 TABLE_REQUIRED`. Only PENDING bookings can be seated or cancelled.
- `reservationAlerts` flags each booking once per process (an in-memory set), scanning the last
  12 hours. `GET /reservations` computes `overdue` itself, so a restart that re-flags is harmless.
**Consequences.** `COMPLETED` is not yet written: closing a table does not complete its booking,
because the tables module would have to import reservations (a cycle). A booking has no owner
column, so a guest sees the confirmation once but cannot list their bookings later.

### ADR-026 — Real photography served with the client
**Status:** Accepted · 2026-09-25
**Context.** The fork-flame-ui skill asks for plated food photos; the emoji placeholders made the
customer screens look unfinished. `imageUrl` accepted only absolute URLs.
**Decision.** Ship Unsplash photos (Unsplash License, credited in the README) as static files in
`client/public/images`, and seed each dish's `imageUrl` with a same-origin `/images/dishes/…`
path. The item schema accepts an http(s) URL or a `/path`; other schemes and `//host` are refused.
**Consequences.** Photos load from the app's own origin with no third-party requests. The landing
page (hero, marquee, live signatures rail, how-it-works, story, quote band, reviews, visit) is
built from these assets.

### ADR-027 — How M13 was verified without a staging host
**Status:** Accepted · 2026-09-25
**Context.** M13 asks for a staging deploy, a live Stripe webhook, and an acceptance walk on
staging. The build environment has no public host, no Stripe keys, and little free memory.
**Decision.**
- E2E and axe run against the **production builds**: the tsup API plus `vite preview` on the dev
  origin, so cookies and sockets behave as they do in development. Every run reseeds.
- Browser runs log in many times from one IP, so `RATE_LIMITS_DISABLED=true` switches the
  limiters off for them. The env schema refuses it in production, and a test proves that.
- The acceptance walk (ACCEPTANCE.md) is done on those local builds. AC-5 is recorded as a pass with
  a named exception.
- Staff, admin and card-payment routes are lazy-loaded, halving the guest bundle (880 → 444 kB).
- The KDS "later round" badge now marks any line added after placement, not only lines added more
  than 60 s later. The E2E showed a quick second round going unbadged, and placement stamps the
  first round with `placedAt` exactly, so no heuristic window is needed.
**Consequences.** M13-S11 and S12 stay open until a host exists. OPERATIONS.md has the checklist.
The E2E suite (`npm run e2e`) is not part of `npm run check`, because it needs Docker, a build and
about 1 GB of memory.

### ADR-028 — Motion without an animation library
**Status:** Accepted · 2026-09-25
**Context.** The customer asked for a far more animated and reactive frontend. Options were
framer-motion or GSAP (about 30–60 kB gzipped, plus a new idiom), or hand-built effects on
platform APIs.
**Decision.**
- **No animation dependency.** Effects use CSS transitions and keyframes, the Web Animations API,
  one canvas, and a single shared rAF loop for scroll (`scrollFx`).
- **What may move.** Only `transform`, `opacity` and canvas pixels animate. Nothing animates
  layout.
- **Who sees it.**
  - Pointer effects (parallax, magnetic pull, spotlight) run only on fine pointers.
  - Everything decorative checks `prefersReducedMotion()` and stands still.
  - Canvas and rAF loops stop when off-screen or on a hidden tab.
- **Accessibility first.**
  - Animated text keeps a single accessible copy (`sr-only` sentence plus `aria-hidden` visual
    words).
  - Dimmed text changes colour instead of opacity, so it keeps AA contrast.
  - The pinned scroll story is a plain ordered list on phones and under reduced motion.
**Consequences.** The guest bundle grew 25 kB across both motion passes. The effects are ours to
maintain, each about 30–120 lines, and `e2e/a11y.spec.ts` guards the contrast and keyboard rules
on every screen.

### ADR-029 — One tenant per deployment, many branches
**Status:** Accepted · 2026-09-25
**Context.** A pilot restaurant has two branches with different dine-in, menu and kitchen needs.
ROS has no branch concept. Selling to further restaurants is the business goal.
**Decision.**
- **One restaurant per deployment**, with its own database and brand. Inside it, a `Branch` model
  scopes tables, orders, order sequences, bookings, staff, settings overrides, menu availability
  and realtime rooms.
- **Tenant packs.** Each restaurant's brand and seed data live in a tenant pack. Fork & Flame is
  the default pack and ships in this repository; other packs are private (ADR-036).
- **No multi-tenancy.** No tenant id on rows, no cross-restaurant data, no shared database.
**Consequences.**
- Isolation between customers comes from infrastructure, not code. The schema change is limited
  to `branchId`.
- Onboarding a restaurant means a tenant pack plus a deployment.
- A shared multi-restaurant SaaS would need another ADR.

### ADR-030 — Arabic-first i18n without a library
**Status:** Accepted · 2026-09-25
**Context.** The pilot restaurant's customers and staff read Arabic, and the site must be RTL. The
client has about 400 hard-coded English strings.
**Decision.**
- **Dictionaries.** Typed dictionaries (`client/src/i18n/ar.ts`, `en.ts`) behind a small
  `useT()` hook, with no i18next. The English dictionary defines the key type, so a key missing
  in Arabic fails typecheck.
- **Language choice.** It persists per device. The tenant sets the default (Arabic for an Egyptian
  tenant, English for Fork & Flame). `<html lang dir>` follows it.
- **Server errors** stay English for logs. The client translates them by `error.code`.
- **Menu content** (names and descriptions) is data, not UI. Bilingual menu fields arrive with the
  tenant pack (M17).
- **Layout** uses logical CSS (`ms-`, `start-`, `border-s`), and motion reads the direction.
- **Register.** Guest-facing copy is friendly Egyptian Arabic ("شوف المنيو", "بكرة"), the way
  Egyptian menus speak. System lines (sign-in, errors) stay plain and short. Numbers use Latin
  digits (`ar-EG-u-nu-latn`), as Egyptian menus do.
- **Menu data** (dish names) gets `dir="auto"`, so a Latin name reads correctly inside an RTL page.
**Consequences.** About 2 kB of runtime and no dependency. Plurals are handled per key with
functions, which covers Arabic's forms for the few counted strings.

### ADR-031 — Menu prices are final for the demo
**Status:** Accepted · 2026-09-25
**Context.** Egyptian fast-food menus show the price the guest pays. The pricing engine adds tax
and service charge on top. How a pilot restaurant accounts for VAT (14%) is unknown until it is
asked.
**Decision.**
- **Tenant settings.** An Egyptian tenant uses `taxBps = 0`, `serviceChargeBps = 0` and
  `tipPresetsBps = []`, so totals equal the menu prices plus any delivery fee.
- **VAT later.** A VAT-inclusive mode (extracting 14% for receipts) is deferred to the pilot
  (plan B2), after confirming the restaurant's tax setup.
- **Engine unchanged.** The shared pricing engine and its tests are not changed now.
**Consequences.** The demo shows exactly the menu prices. Receipts carry no tax line until B2.

### ADR-032 — Tenant packs, branches and a free map
**Status:** Accepted · 2026-09-26 · how packs are stored and resolved is amended by ADR-036
**Context.** A pilot restaurant needs a website: its About and Contact content, its photos, its
branches on a map, and a complaints form. This pulls the tenant pack (M17) and the branch record
(the start of M15) forward. The Fork & Flame portfolio build must never carry a customer's
material, and maps must cost nothing.
**Decision.**
- **One tenant per build.** `VITE_TENANT` picks the client tenant at build time; the seed takes
  `--tenant=` or `SEED_TENANT`. A tenant's photos are served and copied only into its own build.
- **Imported, reviewed data.** A pack's importer reads the restaurant's public menu once and writes
  reviewed JSON (prices in piastres) and resized photos. The app never scrapes at runtime. Dishes
  without a photo show their category's photo.
- **Branch model.** `Branch` holds names, addresses, phones, WhatsApp, a map pin (`lat`/`lng` as
  doubles; coordinates are not money) and weekly hours where a close after 24 means after midnight.
  Orders, tables and the KDS gain a `branchId` in M15, not now.
- **Maps.** Guests see the keyless Google Maps embed and directions deep links. The admin places the
  pin by dragging it on a Leaflet map over OpenStreetMap tiles (admin-only, lazy-loaded) or by
  pasting a Google Maps link, whose coordinates are parsed on the client. "Nearest branch" uses the
  browser's Geolocation API; the position never leaves the device.
- **Feedback inbox.** `POST /contact` is public, strict and rate-limited (5 per 15 minutes per IP).
  Messages land in an admin inbox with an unread badge; `message:new` goes to the `admin` room
  after commit; marking read is audited.
- **Site pages.** A tenant turns on branches, about and contact (`brand.pages`). Branches and
  contact have generic pages in design 31; a tenant may draw its own.
**Alternatives.** A Google Maps JavaScript API key (billing account, not free). Mapbox (a key and
quotas). Scraping a restaurant's site live (fragile, and its site may be replaced). A runtime
tenant switch (would ship every tenant to every visitor).
**Consequences.** The OpenStreetMap tile policy allows light admin use; a busy deployment should
use a tile provider. Pins start approximate and must be confirmed by the owner. LLD 1.4 and API
contract 1.3 record the schema and endpoints.

### ADR-033 — Colour themes as CSS variables, with a light theme
**Status:** Accepted · 2026-10-11
**Context.** A restaurant whose own site is light should not be forced into design 31's dark
look. Every colour token was a fixed hex in the Tailwind config.
**Decision.**
- **Tokens are variables.** Each Tailwind colour reads `rgb(var(--c-…) / <alpha-value>)` from
  `client/src/styles/themes.css`; shadows, page and card gradients and the font stacks are variables
  too. Class names in components do not change.
- **Two themes.** `dark` is design 31, unchanged. `light` is cream paper and charcoal ink. A tenant
  lists the themes it offers, the first being its default: Fork & Flame `['dark']` (no toggle), a
  light tenant `['light', 'dark']`. The choice persists per device (`ros-theme`) and sets
  `<html data-theme>`; an inline script applies it before first paint.
- **Accent in light.** The accent fill is charcoal (white text 13:1). Saffron `#eaa01a` is 2:1 on
  the page, so it is used for fills and stars only; small accent text is a dark amber (5.3:1) and
  headline accents a mid amber (large text) through a separate `text-flame` value.
- **Per-tenant shape.** `<html data-tenant>` lets a tenant's own stylesheet change faces and
  shapes.
- **Paper stays paper.** Receipts and kitchen tickets use fixed `paper` tokens in every theme.
- **Runtime colours.** Charts, the ember canvas and the Stripe form read the variables when they
  render; pages remount on a theme change.
**Alternatives.** Tailwind's `dark:` variant on every class (hundreds of edits, and two palettes
frozen into markup). A separate stylesheet per tenant (duplicates every rule).
**Consequences.** A new theme is one block of variables. The E2E axe sweep now waits for entrance
animations, because a faster first paint let it measure buttons mid-fade. The fork-flame-ui skill
notes the light palette.

### ADR-034 — A tenant may have its own visual identity
**Status:** Accepted · 2026-10-12
**Context.** A tenant that only recolours design 31 reads as a reskin. A restaurant with a strong
look of its own (the reference was momofuku.com: stacked photo panels, one huge line of type each,
a cream page, one handwritten accent face) needs its own pages.
**Decision.**
- **Own pages.** A tenant pack may replace the landing page and draw its own about, branches and
  contact pages (ADR-036), built from the app's pieces.
- **Poster tokens.** Fixed `brand-*` colours (charcoal, cream, sand, saffron, amber) for blocks
  that look the same in light and dark, and a `font-hand` face a tenant's stylesheet can set.
- **Faces per tenant.** A pack's page head loads its own fonts, only in its build.
- **Photos.** A pack uses the restaurant's own photos, never stock; photos with text overlays or
  identifiable guests are left out or cropped.
**Alternatives.** Stock photography (not theirs). Copying a reference site's layout outright (its
identity, not the restaurant's).
**Consequences.** An identity depends on the restaurant's photos; better originals from the owner
improve it.

### ADR-035 — A catalogue menu, and sizes as a choice
**Status:** Accepted · 2026-10-12
**Context.** A long menu (hundreds of dishes in dozens of categories) behind a row of chips over
one list is slow to use. Restaurants also often publish each size as its own line, where a guest
thinks of one dish with a size.
**Decision.**
- **Catalogue layout.** A tenant chooses its menu layout (`brand.menu`). `catalog` shows the
  categories down the side, each with a photo, and the chosen category as a photo grid with a
  large title; on a phone the categories are a strip under the header. Search looks across every
  category. Fork & Flame keeps `list`, design 31's chips and rows.
- **Sizes are modifiers.** A pack's seed may fold size lines together: dishes whose names differ
  only by a size word become one dish priced at its smallest size, with a required single-choice
  size group whose options carry the price difference. Each dish gets its own group, because the
  step between sizes differs per dish.
- **No engine change.** It uses the existing modifier groups, so pricing, order snapshots, the
  kitchen ticket and reports already handle it. The imported JSON stays as published.
- **Display.** A dish with choices shows "from <price>".
**Alternatives.** A size column on the dish (a schema and pricing change for what a modifier
already does). Merging in the importer (loses the record of what was published).
**Consequences.** M16's "size and weight groups" is done for sizes; weights remain.

### ADR-036 — Private tenant packs outside the public tree
**Status:** Accepted · 2026-10-18
**Context.** This repository is public (a portfolio). A pilot tenant's name, menu, text and photos
belong to the restaurant and must not be published before it agrees. ADR-032 kept a tenant's code
in `client/src` behind literal `VITE_TENANT` comparisons, which keeps it out of other builds but
not out of the repository.
**Decision.**
- **Packs live outside the tree.** A private tenant is a pack in its own private repository,
  checked out at `tenants/<id>/`, which this repository ignores. The public code never names it.
- **Layout.** `client/index.ts` exports a `Tenant` (brand, copy, optional `home` and page loaders);
  `client/` may hold its pages and stylesheet. `site.json` gives the page title, language,
  direction, theme and extra head tags. `assets/` holds its photos, served at `/tenants/<id>/`.
  `server/index.ts` exports a `SeedTenant`. `e2e/` holds its Playwright specs.
- **Resolution.** Vite resolves `@tenant` to the built tenant's module (Fork & Flame in
  `client/src/tenants/forkandflame` by default) and `@client/*` to `client/src`, so a pack imports
  the app's pieces. Tailwind scans only the built pack. The seed imports
  `tenants/<id>/server/index.ts`. Playwright runs `tenants/<id>/e2e` for that tenant.
- **No cycles.** Page fields are loaders (`() => Promise<Component>`), so a tenant module imports
  nothing from the app at run time.
- **Checks.** When a pack is checked out, `npm run check` lints, type-checks and tests it with the
  app; without one, nothing changes.
**Alternatives.** A private branch of this repository (one `git push --all` publishes it). Git
submodules (the public repository would reference the private one by name).
**Consequences.** A restaurant's material never enters the public history. A pack can break when
the app's internals change; its type-check under `npm run check` catches that.

### ADR-037 — Menu text in two languages
**Status:** Accepted · 2026-10-18
**Context.** The interface follows the language toggle (ADR-030), but dish, category and modifier
names are data with one `name` column, so an Arabic page listed English dishes (and an Arabic menu
stayed Arabic in English). ADR-030 deferred bilingual menu fields to the tenant pack.
**Decision.**
- **One own name, plus translations.** `name`/`description` stay the restaurant's own wording, in
  whatever language it writes its menu. A `translations` jsonb column on categories, items,
  modifier groups and options holds other languages: `{ ar: { name, description? }, en: {…} }`.
- **Strict at the edge.** Admin create and update bodies take `translations`, validated by a strict
  schema (`en`/`ar` only, non-empty names, the same length limits). An update replaces the whole
  object. The DTO always has `translations`, `{}` when there are none.
- **Resolved on the client.** `useMenu`/`useMenuItem` select the active language from the cached
  server shape (`translations[lang]`, falling back to the own text), so every screen that lists
  dishes follows the toggle without its own code, and a switch needs no refetch.
- **Snapshots unchanged.** Orders snapshot the own `name`, so the kitchen, receipts and reports read
  one consistent wording. A cart line keeps the name it was added under.
- **Admin form.** The dish form has an optional name and description per language. Categories,
  groups and options take translations through the API for now.
**Alternatives.** `nameEn`/`nameAr` columns (four columns per table, and one of them duplicates
`name`). A translations table (joins on the hottest read for two languages). Translating on the
server per request (the cached menu would vary by language).
**Consequences.** Fork & Flame's seed carries Arabic for every dish, category, group and option. A
missing translation shows the own wording. Searching the menu matches the displayed language.

---

## Template

```markdown
### ADR-NNN — <title>
**Status:** Proposed · YYYY-MM-DD
**Context.** <the forces at play>
**Decision.** <what we will do>
**Alternatives.** <what else was considered, why not>
**Consequences.** <what gets easier, what gets harder, what docs change>
```
