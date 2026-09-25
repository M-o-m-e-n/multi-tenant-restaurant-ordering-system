# Implementation Log
## Restaurant Ordering System (ROS)

A dated record of each working session: what was done, what was verified, what surprised us, and
what comes next. Newest entry first. Keep entries factual — decisions go in
[DECISIONS.md](DECISIONS.md), repository-level changes in [CHANGELOG.md](CHANGELOG.md).

---

## Entry template

```markdown
### YYYY-MM-DD — <milestone / slice ids> — <short title>

**Slices:** M?-S? ☑, M?-S? ◐ (in progress)
**Done**
- <change> — <file or area>
**Verified**
- <the slice's "Done when" check, and how it was run>
**Issues / surprises**
- <what went wrong or took longer, and why>
**Decisions raised:** ADR-NNN (or none)
**Next:** <first slice for the next session>
**Time:** <hours> (estimate was <S/M/L>)
```

---

### 2026-09-25 — M5 — Tables & QR sessions

**Slices:** M5-S1…S10 ☑
**Done**
- `lib/events.ts`: the single `publish` façade (typed event names and rooms). Menu writes now publish
  `menu:changed` through it. The Socket.IO transport attaches in M8.
- `tables` module: admin CRUD with 128-bit tokens and `TABLE_NUMBER_TAKEN`; read-only
  `GET /tables/qr/:token` and `POST /tables/sessions` (both limited to 20/min/IP); close
  (SEATED→DIRTY, refused with `TABLE_HAS_OPEN_ORDERS` listing the orders) and clean (DIRTY→FREE),
  both conditional updates; regenerate QR; SVG/PNG export pointing at `PUBLIC_APP_URL/t/<token>`;
  `table:changed` after commit; `seatByToken` exported for dine-in placement in M7.
- Client: `/t/:token` resolves (GET), opens the session (POST), stores the token in sessionStorage
  and shows the menu with a "Ordering for Table N" banner; `/pos/tables` staff map with status as
  colour plus icon plus word, Seat/Close/Mark clean, and admin QR download and add-table.
**Verified**
- 10 table integration tests, including I12 (close refused with an open order), I26 (the GET
  mutates nothing) and old tokens dying on regeneration. 91 server tests in total.
- Playwright at 420 px: scanning `/t/<token>` lands on `/menu` bound to Table 7, and the DB shows
  it SEATED. The staff map shows it seated.
**Issues / surprises**
- New error codes not in the API contract: `TABLE_NOT_SEATED` (close on a table that isn't seated)
  and `TABLE_NOT_DIRTY` (clean on a clean table). Doc debt.
- New env var `PUBLIC_APP_URL` (QR target). Documented in `.env.example`.
- I11 (an order placed with table A's token lands on A) needs orders and moves to M7-S4, as the
  milestone plan's AC map already says (AC-12 → M7).
- Until M8's sockets, the map polls every 15 s.
**Next:** M6-S1.

### 2026-09-25 — M4 — Menu

**Slices:** M4-S1…S12 ☑
**Done**
- Server `menu` module: the public `GET /menu` (schedule-window filtered in restaurant time, 86'd
  items kept as `isAvailable: false`) and `GET /menu/items/:id` with modifier groups; a 30 s tree
  cache dropped after every committed write; admin CRUD under `/staff/menu` for categories,
  items, modifier groups and options, plus attach/detach (all soft delete, no hard-delete path);
  the 86 toggle (staff and admin); an `AuditLog` row with before/after on every write.
- `resolveSelections(item, ids)`: rejects borrowed, unavailable and duplicate options and
  min/max violations with `422 INVALID_MODIFIER_SELECTION` and returns the authoritative deltas
  and the snapshot.
- `settings` service (typed, cached, audited update) and the `audit` helper.
- Client: `/menu` in the design-31 look (carousel, chips, search, list, sold-out state, item detail
  dialog); `/admin/menu` with the optimistic 86 switch and dish/category forms; `formatMoney` and
  `parseMoneyInput`.
**Verified**
- 18 menu integration tests: breakfast shows at 09:00 and not at 15:00 local; an admin edit is
  visible immediately despite the cache; soft deletes keep their rows; an item carries two groups;
  audit before/after; staff can 86 and a customer gets 403; five `resolveSelections` rejections.
- Playwright screenshots of `/menu` and `/admin/menu` (admin logged in; the session survived a
  full reload through the refresh cookie).
**Issues / surprises**
- `GET /menu` items carry `modifierGroupCount` (not in API-CONTRACT) so the client knows when it
  must open the detail dialog before adding to the cart.
- Modifier options are hard-deleted (orders keep their JSON snapshot); items and categories are
  soft-deleted.
- The admin UI doesn't yet manage modifier groups (the API does). Worth a follow-up slice.
- Menu items have no photos yet: plates show a category glyph placeholder.
**Next:** M5-S1.

### 2026-09-25 — M3 — Auth & RBAC

**Slices:** M3-S1…S11 including S2b–S2g and S10b ☑ (18/18)
**Done**
- Typed `AppError` hierarchy and one error middleware (AppError, DomainError → 422, ZodError →
  400, bad JSON → 400, unknown → 500 with no internals). Also request ids, `validate()` and the
  `h()` async wrapper.
- bcrypt (cost from env, ≥ 12 outside tests). 15-minute HS256 access tokens via `jose`.
- `RefreshToken` model with SHA-256 hashes and CASCADE; rotation in one transaction with a
  conditional revoke; reuse detection revokes the family.
- Endpoints: register, login, refresh (requires `X-Refresh-Request: 1`), logout, logout-all,
  sessions list and revoke, me. Also `/staff/users` for admins (list, create staff, change role,
  disable), which the M3 demo needs.
- `authenticate` re-reads role and `isActive` behind a 60 s cache that every change invalidates.
  `requireRole` and `optionalAuthenticate`.
- CORS allow-list with credentials; rate limits (auth 10/15 min, refresh 60/15 min, general
  300/5 min); a job runner and the daily `purgeRefreshTokens` job.
- Client: API client with an in-memory token and single-flight refresh; a non-persisted zustand
  auth store that re-hydrates via refresh; login and register pages; the `RequireRole` guard with
  `returnTo`.
**Verified**
- Integration tests on `ros_test`: I1, I2, I3, I24, I28, I29, I30, I31, I32 (192 refreshes over a
  simulated 48 h), plus a forged role claim, demotion, logout, sessions and CORS. 63 server tests.
- Client: ten concurrent 401s → exactly one refresh call.
- Smoke through the Vite proxy: login sets `rt` (HttpOnly, SameSite=Strict, Path=/api/v1/auth),
  `/me` works, refresh rotates, and a customer gets 403 on `/staff/users`.
**Issues / surprises**
- **The LLD's 60 s role cache conflicts with AC-18** ("very next request"). It's resolved by
  invalidating the cache on every role or status write. This works within one instance; at N > 1 it
  needs Redis pub/sub or no cache (M13-S9).
- Disabling a user also revokes all their refresh tokens. The LLD doesn't say this, but otherwise a
  disabled account could keep a live session.
- A missing `X-Refresh-Request` header returns `403 FORBIDDEN`. The API contract doesn't give a
  code for it.
- M3-S11's tests were written alongside each slice rather than in one final slice.
**Next:** M4-S1.

### 2026-09-25 — M2 — Database & seed

**Slices:** M2-S1…S12 ☑
**Done**
- Prisma 6.19 schema covering every LLD §2.2 entity (except `RefreshToken`, which is M3-S2b).
  Ids are Postgres `uuid` and money is `Int` cents (ADR-004).
- First migration `20260925011512_init` with hand-written CHECK constraints (DEL-01, total ≥ 0,
  qty > 0, modifier select range, percent ≤ 100%, usage within limit, positive payments,
  non-negative prices) and `UNIQUE(businessDate, orderNumber)`.
- Seed: three demo accounts, 4 categories, the 9 design-31 dishes with modifier groups (one with
  a negative delta), 14 tables with QR tokens, `SAVE10`/`WELCOME5`, and settings in basis points.
  Then 30 business days of deterministic history, with the fixture written to
  `server/prisma/seed-fixture.json`.
- `shared/schemas/settings.ts` types every setting and has `decodeSettings`/`encodeSetting`;
  `server/src/lib/time.ts` handles business dates.
- Enum parity test between `schema.prisma` and `shared` enums.
**Verified**
- `prisma migrate deploy` on the empty `ros_test` reproduces the schema; `migrate diff` shows no
  drift.
- `A-1001` inserts on two business dates; a second `A-1001` on one date is rejected; a TAKEAWAY
  row without `customerName` fails the CHECK.
- Seed: 785 orders, 744 in scope, net sales 2,757,905 cents. A SQL cross-check over the BR-16
  scope gives the same figures, and every order has exactly one `(null → PLACED)` event.
**Issues / surprises**
- **Schema additions beyond LLD §2.2** (doc debt, LLD should be amended):
  `Order.taxBps`, `serviceChargeBps`, `serviceChargeTaxable`, `discountType`, `discountValue`
  snapshot the pricing inputs so an amendment can reprice "from the values snapshotted on the order"
  (ORD-13). The LLD requires that but never lists the columns. `OrderItem.addedAt` lets the KDS
  badge a later round (ORD-12, API-CONTRACT OrderDto `addedAt`). Also a `Payment(stripePaymentIntentId)`
  index for webhook lookups and a `restaurantName` setting for receipts.
- The ERD's partial index on `MenuItem(isAvailable)` is a plain index. A hand-written partial index
  would be dropped by the next `migrate dev` because Prisma can't represent it.
- Default timezone is `America/New_York`, the LLD's example.
**Next:** M3-S1.

### 2026-09-25 — M1 — Shared domain core

**Slices:** M1-S1…S9 ☑
**Done**
- `shared/src/domain`: `enums.ts` (const arrays + literal unions), `money.ts` (`bps`,
  `assertInteger`), `pricing.ts` (`computeTotals`, `lineTotal`), `order-status.ts`
  (`ORDER_TRANSITIONS`, `FORWARD_TRANSITION`, `canTransition`, `nextStatuses`), `discounts.ts`
  (`evaluateDiscount`, `normalizeDiscountCode`), `errors.ts` (`DomainError` + codes).
- `shared/src/schemas`: strict Zod schemas for auth, cart, preview, create order, append,
  transition, cancel, list query, payment intent/cash/refund, plus response DTO types.
**Verified**
- `npm test -w shared`: 47 tests, with no DB, no network and no mocks.
- The worked example (DINE_IN, 10% off, 12.5% service, 8.75% tax, 500 tip) totals **4592**.
- P1–P12 and S1–S8 pass. `bps(-5, 1000) === -1`, and a test shows `Math.round` fails it.
**Issues / surprises**
- LLD §10.1 P8 says an empty cart is `ZERO_TOTAL`. The API contract gives `EMPTY_CART` for an
  empty cart and keeps `ZERO_TOTAL` for a zero total, so `computeTotals` throws `EMPTY_CART`.
  Doc debt: fix P8's wording in the LLD.
- `PricingInput.discount` is `{ type, value }`, not the LLD's `{ type, valueBps, value, minOrder }`.
  `value` is bps for PERCENT and cents for FIXED (as API-CONTRACT §15 says), and `minOrder` is
  checked by `evaluateDiscount` before pricing.
- A discount that hasn't started yet reports `DISCOUNT_INACTIVE`. The LLD lists only the five
  codes and doesn't say which one applies before the window opens.
**Next:** M2-S1.

### 2026-09-25 — M0 — Foundation

**Slices:** M0-S2…S12 ☑. M0-S1 ◐: git initialised, but the folder is not renamed yet (see below).
**Done**
- Git repository on `main`, one feature branch per milestone (`feat/m0-foundation`), one commit
  per slice, merged with `--no-ff`. `.gitattributes` forces LF.
- npm workspaces `shared` / `server` / `client`; `tsconfig.base.json` with `strict`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: Bundler`.
- One ESLint 9 flat config (type-aware typescript-eslint, simple-import-sort, react-hooks) and
  Prettier; Vitest in every workspace; root `npm run check` = format, lint, typecheck, test.
- `docker-compose.yml`: `postgres:15.8-alpine`, named volume, init script creating `ros_test`.
- Zod env parsing that fails fast with named problems; `server/.env.example`.
- Express app factory (`app.ts`, no listen), `server.ts` bootstrap, `GET /health`, pino logger
  with redaction.
- Vite 5 + React 18 + React Router 6 + Tailwind 3 shell with the design-31 tokens.
- GitHub Actions CI; tsup server build that bundles `@ros/shared` source; README.
**Verified**
- A deliberate type error fails `npm run typecheck`; a floating promise fails `npm run lint`.
- `DATABASE_URL=` → `Invalid environment configuration: DATABASE_URL is required`, exit 1.
- `curl /health` → `{"status":"ok"}`, directly and through the Vite proxy.
- Postgres data survives `docker compose restart`.
- `npm run build` builds server and client.
**Issues / surprises**
- **M0-S1 folder rename not done.** Renaming the directory would have broken the running Claude
  session and the open IDE. Rename `restaurnat-ordering-system` → `restaurant-ordering-system`
  yourself, with the IDE closed. Git history moves with it.
- **CI not run on GitHub**: there's no remote yet. The workflow mirrors `npm run check` + build,
  which pass locally.
- Latest majors have moved on (React 19, Express 5, Tailwind 4, Vite 8, Prisma 7, Zod 4,
  TypeScript 7). Versions pinned to what the design specifies or to the last proven major that
  supports Node 20.17: React 18.3, Express 4.22, Tailwind 3.4, Vite 5.4, Vitest 2.1, Prisma 6.19,
  Zod 3.25, TypeScript 5.9, ESLint 9.
- Branching: CODING-STANDARDS §18 asks for one slice per branch. With 100+ slices that is a lot
  of branches, so I used one branch per milestone with one commit per slice instead.
**Next:** M1-S1.

### 2026-09-25 — Pre-M0 — Money type settled (ADR-004)

**Slices:** none (design decision)
**Done**
- The owner asked why money isn't a decimal like Java's BigDecimal. Explained that integer cents is
  that same fixed-point representation with scale 2, and chose to keep it.
- Accepted ADR-004: Postgres `integer` / Prisma `Int` cents, with the rationale and rejected
  alternatives recorded (`BigInt`, `NUMERIC` in the DB only, decimal.js everywhere).
- Money columns changed from `BIGINT` to `INTEGER` in SRS §6.4, HLD §6.2, LLD §2.2 (15 columns),
  and the ERD diagrams and Prisma skeleton (15 fields each). ERD §11 now records the decision.
- CODING-STANDARDS §6 now covers why integers, display-only formatting (`formatMoney`) and a single
  `parseMoneyInput`.
**Verified**
- `bigint` remains only in rationale text and revision rows.
**Decisions raised:** ADR-004 → Accepted. No decisions remain open.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Design direction chosen; CLAUDE.md and UI skill

**Slices:** M0-S10 ◐. The direction is chosen; extracting the Tailwind tokens waits for the client
workspace (M0-S9).
**Done**
- Accepted ADR-019: design 31 "Fork & Flame", with the owner's screenshot as the visual target
  (copied to `designs/reference/31-reference-landing.png`).
- Wrote the `fork-flame-ui` project skill with tokens, type scale, component specs, contrast rules
  and per-screen guidance.
- Wrote the root `CLAUDE.md`.
**Issues / surprises**
- The prototype's red `#e5322d` fails AA for small text on `#141414` (3.5 : 1). Added a
  `flame-text` token `#ff5a52` (6.0 : 1) for prices and links.
- The screenshot's headline serif isn't identified. Philosopher is the closest free match, with
  Playfair Display as the fallback.
**Decisions raised:** ADR-019 → Accepted.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Milestone slice recount

**Slices:** none (doc maintenance)
**Done**
- Recounted every milestone table in `MILESTONES.md` and bumped it to v1.2.
- M3: 18 slices, ~19d. Total: 169 slices, ~184 working days. M0–M8 (first end-to-end demo)
  now sums to ~110 days.
- Updated the header's "Derived from" to SRS/HLD/LLD v1.2, and synced KICKOFF and PROJECT_STATE.
**Verified**
- Counted `| ☐ | **Mx-Sy** |` rows per milestone and summed sizes (S=0.5, M=1, L=2); every other
  milestone already matched §2.
**Next:** M0-S1.

### 2026-09-25 — Pre-M0 — Project-tracking files

**Slices:** none (scaffolding outside the milestone plan)
**Done**
- Added `KICKOFF.md`, `PROJECT_STATE.md`, `PROJECT_STATE_ARCHIVED.md`, `DECISIONS.md`,
  `IMPLEMENTATION_LOG.md`, `CHANGELOG.md` to `docs/`.
- Recorded 17 accepted and 2 proposed ADRs extracted from SRS/HLD/LLD/ERD.
**Issues / surprises** — found while reading the doc set:
- MILESTONES §2 still lists M3 at 11 slices / ~10d and the total at 162 slices, but M3 now has 18
  slices after the v1.1 token additions (and the revision note says 20 / ~17d). Totals need
  recounting.
- MILESTONES header says "Derived from … v1.1" while SRS, HLD and LLD are at v1.2.
- LLD revision table lists 1.1.1 after 1.2 — reorder for readability.
- ADR-004 (money column type) is still open and blocks M2-S3.
**Decisions raised:** ADR-004, ADR-019 remain Proposed.
**Next:** M0-S1 — rename the folder and `git init`.

### 2026-09-25 — Pre-M0 — Token model revision (v1.2)

**Done**
- SRS/HLD/LLD bumped to v1.2 with the access/refresh token model; ERD, API contract, coding
  standards and milestones bumped to v1.1 to match.
- LLD v1.1.1 patch: two missing error codes added.
**Why:** a 24 h JWT would log out always-on KDS devices mid-shift (see ADR-012).

### 2026-09-25 — Pre-M0 — Design review (v1.1) and supporting docs

**Done**
- Design review of SRS/HLD/LLD v1.0; all three moved to v1.1 (see CHANGELOG 0.2.0).
- Wrote ERD, API-CONTRACT, CODING-STANDARDS and MILESTONES at v1.0.

### 2026-09-25 — Pre-M0 — Initial design and UI exploration

**Done**
- SRS, HLD, LLD v1.0.
- 31 frontend design directions (`designs/01…31`) and `designs/index.html` to compare them.
