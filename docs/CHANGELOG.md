# Changelog
## Restaurant Ordering System (ROS)

All notable changes to this repository. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/) once code ships. Until then, entries track the design
document set.

Sections per release: **Added · Changed · Deprecated · Removed · Fixed · Security**.

---

## [Unreleased]

### Added — tenant packs, branches, themes and a catalogue menu (ADR-032…036)
- **Tenant packs.** `VITE_TENANT=<id>` builds one restaurant's site and `SEED_TENANT=<id>` (or
  `--tenant=`) seeds its data. Fork & Flame is the default and ships here; another restaurant is a
  private pack checked out under `tenants/<id>/`, which this repository ignores (ADR-036). A pack
  can bring its own landing, pages, stylesheet, fonts, photos, seed data and E2E specs.
- **Branches on a free map:** a keyless Google Maps embed, directions, call and WhatsApp for each
  branch, a live open/closed chip (hours past midnight), and "find the branch nearest me".
- **Admin pin editor:** drag the pin on an OpenStreetMap map or paste a Google Maps link.
- **Feedback inbox:** complaints, suggestions and questions from the contact page land in an admin
  inbox with an unread badge, live over the socket.
- **Themes.** Colour tokens are CSS variables; a sun/moon toggle in the nav switches light and dark
  for tenants that offer both, and the choice is remembered. Fork & Flame is unchanged (dark only).
- **Catalogue menu** for long menus: categories with photos down the side, the chosen category as a
  photo grid under a large title, a category strip on phones, and search across the whole menu.
  A dish with choices shows its "from" price.
### Fixed
- The phone header no longer overflows: the theme button moves into the menu sheet.

### Added — M14, Arabic and Egypt localisation
- **The whole app in Arabic RTL** with an English toggle (ADR-030):
  - typed `ar`/`en` dictionaries with Arabic plural forms
  - tenant copy in both languages
  - a persisted language choice that sets `<html lang dir>`
  - a test that fails if English is hard-coded in any screen
- **Server errors** show in the reader's language by error code; validation messages map by field.
- **RTL layout** uses logical CSS. The marquee, carousel, chip pill, toast, mobile sheet, progress bar
  and garnish all follow the reading direction.
- **Arabic type:** Cairo and El Messiri load behind the Latin faces.
- **Money** is shown in the tenant's currency: "90 ج.م" in Arabic, "EGP 90" in English, no decimals
  for whole pounds. Dates and times follow the reader's language.
- **Phone numbers** are stored in international form; Egyptian mobiles written locally
  (`010 0123 4567`) become `+201001234567`.
- **axe** runs on all 17 screens in both languages (0 violations).

### Added
- **Interactive motion layer (no new dependencies, ADR-028):**
  - Hero:
    - canvas embers that scatter from the pointer
    - pointer parallax, with the plate tilting and a highlight following the pointer
    - a word-by-word kinetic headline with a flame shimmer
    - magnetic CTAs
    - a live "open now" chip on the restaurant's clock
  - A pinned scroll story ("From your table to our fire, and back") that walks a phone mock of the
    tracker through four stages.
  - A scroll-velocity marquee that speeds up, reverses and leans.
  - A quote that lights up word by word, and photo parallax.
  - A pointer spotlight on cards.
  - A flame scroll-progress bar and a glass nav that shrinks on scroll.
  - Nav underlines, a mobile menu sheet (the nav had no phone menu before), and route
    transitions.
  - A sliding category pill.
  - An "added to cart" toast with Undo.
- E2E can run beside a dev session: `E2E_API_PORT`/`E2E_WEB_PORT` start the suite's own stack,
  `E2E_SKIP_SEED=1` leaves the dev data alone, and Vite's proxy target comes from `API_TARGET`.

### Fixed
- The modifier dialog flashed "Choose size and doneness" for one frame before applying the
  defaults.
- The phone header wrapped the logo and "Sign In" onto two lines; on phones the account action
  now lives in the menu sheet.

- **Client motion pass (no new dependencies):** a shared motion layer
  (`shared/ui/motion.tsx`: scroll `Reveal`, animated `CountUp`; `motionUtils.ts`:
  reduced-motion guard, `flyToCart` flight to the nav cart) with unit tests;
  menu skeletons; scroll reveals and animated stats on the landing; drag-to-scroll
  signature rail; staggered menu, cart and table-map entrances; fly-to-cart from
  the modifier dialog; popping cart badge; pulsing live tracker step; KDS ticket
  drop-in; dialog entrances; global button press states. Everything respects
  `prefers-reduced-motion` and adds ~6 kB to the guest bundle.

---

## [0.5.0] — 2026-09-25 — Feature-complete: M9–M13

Everything in the SRS is built. 21 of 22 acceptance criteria pass outright on local production
builds, and AC-5 passes with a named exception (see docs/ACCEPTANCE.md). Staging deploy and a live
Stripe webhook remain.

### Added
- **Hardening (M13):**
  - helmet with a JSON-API CSP and HSTS
  - one structured log line per request, carrying the request id, with the query string dropped
  - wider log redaction
  - a guard sweep over all 39 mutating endpoints
  - docs/SECURITY.md (NFR-S1…S10 mapped to code and tests)
  - an OpenAPI 3 document generated from the Zod schemas and checked against the mounted routes
  - Playwright E2E for LLD §10.3 scenarios 1–6 and AC-1/2/22
  - axe on 17 screens
  - an autocannon load test (p95 ≈ 69 ms)
  - backup and restore scripts with a recorded drill
  - docs/OPERATIONS.md and docs/ACCEPTANCE.md
- **Payments (M9):** a `PaymentGateway` abstraction with Stripe in test mode only (live keys
  refused; with no keys card payment is off and cash still works); intents for the balance or a
  split amount with `Idempotency-Key`; a raw-body, signature-checked, deduped webhook; cash with
  tips; admin refunds; a reconciliation job; Stripe Elements pay page and the `/pos` till.
- **Amendments & receipts (M10):** append items while PLACED/CONFIRMED/PREPARING, repriced from
  the order's snapshots, with a conditional update; snapshot receipts; kitchen ticket printing.
- **Reports (M11):** one BR-16 revenue scope for every report; summary, revenue by day, top
  items, peak hours, breakdowns, cancellations; today's dashboard; Recharts admin pages; CSV export.
- **Delivery & reservations (M12):** `PATCH /orders/:id/delivery` (assign a driver, then
  `ASSIGNED → PICKED_UP → DELIVERED`); a reservations module (book, list by business date,
  seat onto a free table, cancel); the `reservationAlerts` job raising `reservation:flag`;
  the `/reserve` booking page, the `/pos/reservations` host list, delivery controls in the POS,
  and delivery progress on the tracker.
- **UI:** real food and venue photography (Unsplash, credited in the README) for every dish; a
  full landing page (hero on a slate plate, marquee, live signatures rail, how-it-works, story,
  quote band, reviews, visit/hours, footer); a photo banner on the menu.

### Changed
- The client lazy-loads staff, admin and pay routes; the guest bundle drops from 880 kB to 444 kB.
- `bcrypt` 6 (drops the vulnerable `tar` install chain).
- `GET /settings` also returns `timezone`; the pure time helpers moved to `@ros/shared`
  (ADR-024). LLD 1.3 records the M12 endpoints and error codes (ADR-025).
- `MenuItem.imageUrl` accepts a same-origin `/images/...` path as well as an http(s) URL
  (ADR-026).

### Fixed
- **Security:** the post-login `returnTo` accepted `/\host`, an open redirect; backslashes and
  control characters are now refused.
- The KDS badged a second round only if it came more than a minute after placement.
- The KDS board and the cancellations list could not be scrolled from the keyboard.
- A refunded order no longer shows its total as still owed in the POS, and cannot take a further
  payment (`409 ORDER_REFUNDED`).

---

## [0.4.0] — 2026-09-25 — First build: M0–M8

The first runnable system: scan a table QR, order from the menu, and watch the ticket land on the
kitchen display in real time.

### Added
- **Foundation (M0):** npm workspaces `shared` / `server` / `client`; strict TypeScript;
  one ESLint + Prettier config; Vitest everywhere; Docker Postgres 15.8 with a test database;
  fail-fast Zod env parsing; Express app factory with `/health`; Vite + React 18 + Tailwind shell
  in the design-31 tokens; GitHub Actions CI; README.
- **Shared domain (M1):** `bps()`, `computeTotals()` (the reference order totals 4592),
  role-gated `ORDER_TRANSITIONS` with `FORWARD_TRANSITION`, `evaluateDiscount`, strict Zod
  schemas — pricing P1–P12 and state machine S1–S8 tests.
- **Database (M2):** Prisma 6 schema for every LLD entity, CHECK constraints, per-day order
  numbers, indexes; a deterministic seed with 30 business days of history and a fixture file.
- **Auth (M3):** 15-minute access tokens, rotating refresh tokens with reuse detection in an
  httpOnly cookie, sessions, per-request role and status re-read, role guards, CORS allow-list,
  rate limits, purge job; client auth store with single-flight refresh.
- **Menu (M4):** public menu with schedule windows and sold-out items, audited admin CRUD, the 86
  toggle, server-side modifier validation; customer menu and admin menu manager.
- **Tables (M5):** QR tokens and SVG/PNG export, read-only resolve, FREE → SEATED → DIRTY → FREE
  with the open-order guard; QR landing and staff table map; the `events.publish` façade.
- **Cart & pricing (M6):** database-priced `/orders/preview`, public settings, discounts;
  persisted cart, modifier dialog, tips, promo codes; a 36-case client/server parity matrix.
- **Orders (M7):** single-transaction placement with idempotency keys, table binding from the QR
  token, atomic discount redemption, business dates and daily numbers; race-safe state machine;
  checkout, live tracker and history.
- **Realtime & KDS (M8):** Socket.IO with optional auth and server-side rooms; live kitchen display
  with ageing bands, bumps, station filter and alerts.

### Changed
- ADR-019 accepted: the frontend direction is **design 31, "Fork & Flame"**.
- ADR-004 accepted: money is **integer cents in Postgres `integer` columns** (Prisma `Int`), not
  `BIGINT` and not a decimal type. SRS 1.2.1, HLD 1.2.1 and LLD 1.2.1 (`BIGINT` → `INTEGER`), ERD 1.2
  (diagrams, Prisma skeleton and §11), CODING-STANDARDS 1.2 (why no BigDecimal; display-only
  formatting).
- Build-time decisions recorded as ADR-020…023 (dependency versions, schema additions, API
  additions, git workflow).

### Fixed
- MILESTONES v1.2: slice counts recounted from the tables. M3 is 18 slices / ~19d (was listed as
  11 / ~10d in §2 and 20 / ~17d in the v1.1 note); total is 169 slices / ~184 working days (was
  162 / ~175); first end-to-end demo at ~day 110 (was ~100). "Derived from" now cites v1.2 docs.
- ERD v1.1.1: Mermaid parse errors in diagrams 1 and 2 — multiple attribute keys must be
  comma-separated (`FK, UK`, `PK, FK`).

### Docs
- Project-tracking files: `KICKOFF.md`, `PROJECT_STATE.md`, `PROJECT_STATE_ARCHIVED.md`,
  `DECISIONS.md`, `IMPLEMENTATION_LOG.md`, `CHANGELOG.md`; `CLAUDE.md`; the `fork-flame-ui`
  project skill; the owner's reference screenshot in `designs/reference/`.

---

## [0.3.0] — 2026-09-25 — Access/refresh token model

### Added
- SRS v1.2: AUTH-10…14 (refresh exchange, rotation with reuse detection, httpOnly cookie delivery,
  session listing, purge); AC-20…22.
- HLD v1.2: token architecture in §5, §10.1, §10.2; risks R14 (KDS logs out mid-service) and R15
  (refresh token theft).
- LLD v1.2: `RefreshToken` model; refresh algorithm (§4.2); `/auth/refresh`, `/auth/logout`,
  `/auth/logout-all`, `/auth/sessions`; session error codes; CSRF and CORS-credentials rules;
  purge job; tests I28–I32.
- ERD v1.1: `RefreshToken` across all diagrams and tables; its `CASCADE` delete documented as the
  one exception to the SET NULL rule.
- API-CONTRACT v1.1 and CODING-STANDARDS v1.1: token handling rules.
- MILESTONES v1.1: seven new M3 slices (S2b…S2g, S10b) for the token model.

### Changed
- SRS AUTH-02 and AUTH-06 rewritten; NFR-S3 and NFR-S8 updated. Auth is no longer a single
  24 h JWT — see [ADR-012](DECISIONS.md#adr-012--short-access-jwt--rotating-opaque-refresh-token).

### Fixed
- LLD v1.1.1: added `REFUND_NOT_AVAILABLE` (422) and `TABLE_NUMBER_TAKEN` (409), which the API
  contract required and the LLD lacked.

### Security
- Access tokens now live 15 min and in memory only; refresh tokens are hashed at rest, rotated on
  use, and revoke their family on replay.

---

## [0.2.0] — 2026-09-25 — Design review

### Added
- Scope: tips (SRS §3.13), order amendments (ORD-12…14), receipts and kitchen tickets (§3.14).
- `PaymentStatus.PARTIALLY_PAID`; `PaymentState` for payment records.
- Business date and restaurant timezone as first-class concepts (ORD-15, BR-15).
- `OrderSequence` and `IdempotencyKey` models; server-side modifier validation; `appendItems`,
  `getReceipt`, `syncPaymentStatus`.
- `payment:changed` realtime event; Redis for N>1 instances.
- Tests P9–P12, S1–S8, I15–I27; acceptance criteria AC-13…19; risks R10–R13.
- ERD, API contract, coding standards and milestone plan (v1.0 of each).

### Changed
- Refunds re-modelled as payment state only; refund allowed on cancelled orders
  ([ADR-005](DECISIONS.md#adr-005--refunds-are-payment-state-not-order-state)).
- State machine gated per edge with an explicit `FORWARD_TRANSITION`; BR-12 made a strict one-step
  sequence.
- Pricing moved to integer basis points with a symmetric `bps()` helper, explicit tax base, tip
  step, and a `serviceChargeTaxable` setting.
- Reports rewritten around one revenue definition, business-date bucketing, `menuItemId` grouping
  and quoted identifiers.
- Table sessions split into read / open / close / clean; session open is a POST.
- `order:updated` renamed `order:status`; anonymous sockets admitted to `menu`.
- Per-request `isActive` and role re-check.
- NFR-S5 now rejects unknown fields; NFR-U3 bars colour-only signalling.

### Removed
- `REFUNDED` from `OrderStatus`.
- The `Setting`-based daily order counter.

### Fixed
- `UNIQUE(orderNumber)` collision on day two → `UNIQUE(businessDate, orderNumber)`.
- Pricing test P2; AC-9 de-circularised (asserts against a seed fixture).
- HLD title typo; SRS index list, unique constraints and Appendix A; Appendices B and C completed.

---

## [0.1.0] — 2026-09-25 — Initial design

### Added
- SRS v1.0, HLD v1.0, LLD v1.0.
- 31 frontend design directions in `designs/` with an index page.
