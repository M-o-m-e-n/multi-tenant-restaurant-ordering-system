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
