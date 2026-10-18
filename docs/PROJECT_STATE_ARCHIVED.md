# Project State — Archive
## Restaurant Ordering System (ROS)

Superseded snapshots of [PROJECT_STATE.md](PROJECT_STATE.md), newest first. Paste the entire old
snapshot under a dated heading when the phase or milestone changes; do not edit entries afterwards.

**Archiving rule**
1. Copy the full current `PROJECT_STATE.md` body below the divider, under
   `## Snapshot — YYYY-MM-DD — <phase / milestone>`.
2. Add a one-line **Closed because:** note (e.g. "M0 demo passed").
3. Then rewrite `PROJECT_STATE.md` for the new phase.

---

## Snapshot — 2026-09-26 — Feature-complete, M13 local part done

**Closed because:** Phase 2 (a pilot restaurant) started; M14 Arabic and Egypt localisation is built.

> Read this first each session. When the phase or milestone changes, move this whole snapshot into
> [PROJECT_STATE_ARCHIVED.md](PROJECT_STATE_ARCHIVED.md) before rewriting it.

| | |
|---|---|
| **Last updated** | 2026-09-25 |
| **Phase** | Feature-complete · verified locally · not yet deployed |
| **Current milestone** | M13 — the only open items are the staging deploy (S11) and a live Stripe webhook (S12) |
| **Next slice** | **M13-S11**: deploy to a host with TLS (checklist in [OPERATIONS.md](OPERATIONS.md) §3) |
| **Overall progress** | 165 / 169 slices. Open: M0-S1 (folder rename) and M13-S11/S12. Skipped: M13-S9 (single instance) |
| **Health** | 🟢 `npm run check` green (351 tests); `npm run e2e` 15 / 15; 21/22 AC pass, AC-5 with a named exception |

---

### 1. Milestone progress

| # | Milestone | Status | Slices done |
|---|---|---|---|
| M0 | Foundation | ✅ Done (rename pending) | 11 / 12 |
| M1 | Shared domain core | ✅ Done | 9 / 9 |
| M2 | Database & seed | ✅ Done | 12 / 12 |
| M3 | Auth & RBAC | ✅ Done | 18 / 18 |
| M4 | Menu | ✅ Done | 12 / 12 |
| M5 | Tables & QR sessions | ✅ Done | 10 / 10 |
| M6 | Cart & server pricing | ✅ Done | 9 / 9 |
| M7 | Order placement & lifecycle | ✅ Done | 13 / 13 |
| M8 | Realtime & KDS | ✅ Done | 13 / 13 |
| M9 | Payments | ✅ Done | 13 / 13 |
| M10 | Amendments, tips & receipts | ✅ Done | 13 / 13 |
| M11 | Reports & dashboard | ✅ Done | 14 / 14 |
| M12 | Delivery, takeaway & reservations | ✅ Done | 7 / 7 |
| M13 | Hardening & deploy | ◐ Local part done | 11 / 14 (S9 skipped, S11/S12 need a host) |

### 2. What exists

| Area | State |
|---|---|
| Repo | Git on `main`; one `feat/*` branch per milestone, merged `--no-ff` |
| `shared/` | Pricing, the order and delivery state machines, discount rules, time helpers, and strict Zod schemas with DTO types. 58 tests |
| `server/` | Express 4, Prisma 6 and Socket.IO. Modules: auth, users, menu, settings, discounts, tables, orders (with delivery), payments (Stripe test mode and cash), reports, reservations. Jobs: purges, reconciliation, reservation alerts. Helmet and request logs; OpenAPI generated from Zod. 268 integration tests |
| `client/` | React 18 SPA in the Fork & Flame design with real food photography. Screens: landing page, menu, cart, checkout, tracker, pay, receipt, booking, KDS, POS, table map, bookings, and admin dashboard, reports and menu. Staff and admin routes lazy-load. 25 tests |
| E2E | 15 Playwright tests on the production builds: LLD §10.3 scenarios 1–6, AC-1/2/22, and axe on 17 screens (`npm run e2e`) |
| Database | 4 migrations; a deterministic seed with 30 days of history; backup and restore scripts with a recorded drill |
| Docs | SRS 1.2.1, HLD 1.2.1, LLD 1.3.2, API contract 1.2 + `openapi.json`, SECURITY, ACCEPTANCE, OPERATIONS, ADR-001…027 |
| Measured | KDS gets a new order 63 ms after commit (target 500). `GET /menu` p95 ≈ 69 ms at 100 concurrent (target 300). Guest JS bundle 444 kB |

### 3. Open decisions

None blocking. Build-time decisions are ADR-020…027 in [DECISIONS.md](DECISIONS.md).

### 4. Blockers

- **No host and no Stripe test keys** in this environment. Both are needed for M13-S11/S12 and a
  live AC-5. Card payment switches itself off without keys, and cash works.

### 5. Known issues and doc debt

- **Folder name still misspelled** (`restaurnat`). Rename it with the IDE closed (M0-S1).
- **No git remote**, so CI has never run on GitHub.
- `npm audit`: a Prisma CLI dev-tool advisory and react-router 6 (the open-redirect vector is closed
  in code). Both are accepted in SECURITY.md §3.
- A booking has no owner column, so guests can't list their bookings later, and closing a table
  doesn't mark its booking COMPLETED (ADR-025).
- The admin UI doesn't manage modifier groups or discounts yet. The APIs exist and are in the
  OpenAPI document.
- LLD revision-table order: 1.1.1 appears after 1.2.

### 6. Next three actions

1. **Rename the folder, push to GitHub** so CI runs.
2. **Deploy** following OPERATIONS.md §3. Add Stripe **test** keys and the webhook secret.
3. **M13-S12:** point the Stripe webhook at the host, pay with 4242, replay the event, and re-walk
   AC-5 live. Update ACCEPTANCE.md.

### 7. Risks to watch now

- **Proxy trust at deploy.** `trust proxy` is loopback only. Behind a platform proxy, set the hop
  count, or every guest shares one rate-limit bucket.
- **Scaling out.** Rooms, rate limits, caches and the reservation flag set are per process. Add
  Redis before a second instance (OPERATIONS.md §2).
- **Memory on the dev machine.** Full dev servers plus a browser need about 1.5 GB free. The E2E
  suite uses the lighter production builds.

---

## Snapshot — 2026-09-25 — Build, M0–M8 done (M9 next)

**Closed because:** M9–M13 were built in the next session; 21 of 22 acceptance criteria pass on
local production builds (AC-5 with a named exception), and only the staging deploy remains.

| | |
|---|---|
| **Last updated** | 2026-09-25 |
| **Phase** | Build · M0–M8 done (first end-to-end demo reached) |
| **Current milestone** | M9 — Payments (0 / 13 slices) |
| **Next slice** | **M9-S1** — Stripe client, keys from env, test mode asserted at boot |
| **Overall progress** | 107 / 169 slices (M0-S1's folder rename is the one open slice before M9) |
| **Health** | 🟢 on track — every gate green; 187 automated tests |

---

### 1. Milestone progress

| # | Milestone | Status | Slices done |
|---|---|---|---|
| M0 | Foundation | ✅ Done (rename pending) | 11 / 12 |
| M1 | Shared domain core | ✅ Done | 9 / 9 |
| M2 | Database & seed | ✅ Done | 12 / 12 |
| M3 | Auth & RBAC | ✅ Done | 18 / 18 |
| M4 | Menu | ✅ Done | 12 / 12 |
| M5 | Tables & QR sessions | ✅ Done | 10 / 10 |
| M6 | Cart & server pricing | ✅ Done | 9 / 9 |
| M7 | Order placement & lifecycle | ✅ Done | 13 / 13 |
| M8 | Realtime & KDS | ✅ Done | 13 / 13 |
| M9 | Payments | ▶ Next | 0 / 13 |
| M10 | Amendments, tips & receipts | Not started | 0 / 13 |
| M11 | Reports & dashboard | Not started | 0 / 14 |
| M12 | Delivery, takeaway & reservations | Not started | 0 / 7 |
| M13 | Hardening & deploy | Not started | 0 / 14 |

### 2. What exists

| Area | State |
|---|---|
| Repo | Git on `main`; one `feat/mN-*` branch per milestone, merged `--no-ff`; ~75 commits |
| `shared/` | Pricing (`computeTotals`, `bps`), state machine, discount rules, strict Zod schemas, DTO types — 47 tests |
| `server/` | Express 4 + Prisma 6 + Socket.IO. Modules: auth (access + rotating refresh tokens), users, menu, settings, discounts, tables, orders; events façade; jobs (token and idempotency purges) — 123 integration tests on `ros_test` |
| `client/` | React 18 SPA in the Fork & Flame design: menu, QR landing, cart, modifier dialog, checkout, live tracker, order history, KDS, table map, admin menu manager, login/register — 23 tests |
| Database | 4 migrations; seed with 30 business days of history and `seed-fixture.json` |
| Infra | Docker Postgres 15.8 (`ros`, `ros_test`); GitHub Actions workflow (not yet run: no remote) |
| Verified in a browser | QR → order → KDS in 105 ms; KDS bumps followed live on the phone; a guest's menu shows an 86 in 52 ms |

### 3. Open decisions

None blocking. Build-time decisions are recorded as ADR-020…ADR-023 in [DECISIONS.md](DECISIONS.md).

### 4. Blockers

- **M9 needs Stripe test keys** (`STRIPE_SECRET_KEY` sk_test_…, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`) and, for webhooks locally, the Stripe CLI (`stripe listen`). Card
  payment can't be demonstrated without them. Cash payment can.

### 5. Known issues and doc debt

- **Folder name still misspelled** (`restaurnat`). Rename it with the IDE closed (M0-S1). Git
  history moves with it.
- **No git remote.** Push to GitHub to run CI (M0-S11's "goes green" check is unverified).
- **LLD needs amending** for build-time schema additions: `Order.taxBps / serviceChargeBps /
  serviceChargeTaxable / discountType / discountValue` (pricing snapshot, ORD-13),
  `OrderItem.addedAt` and `lineNo` (ADR-021).
- **API contract needs amending**: preview response `discount` field; `modifierGroupCount` on
  menu items; codes `TABLE_NOT_SEATED`, `TABLE_NOT_DIRTY`, `USER_NOT_FOUND`,
  `SESSION_NOT_FOUND`, `DISCOUNT_CODE_TAKEN`, `ROUTE_NOT_FOUND`, `PAYLOAD_TOO_LARGE`; header
  `Idempotent-Replayed`; endpoint `GET /settings/kds`; `/staff/users` endpoints.
- **LLD §10.1 P8** says an empty cart is `ZERO_TOTAL`; the code (and API contract) use `EMPTY_CART`.
- **LLD revision table** order: 1.1.1 appears after 1.2.
- The admin UI doesn't manage modifier groups or discounts yet (the APIs exist).
- Menu items have no photos; the plates show category glyphs.

### 6. Next three actions

1. **Rename the folder** and push to a GitHub remote, so CI runs.
2. **Add Stripe test keys** to `server/.env` and start **M9** (payments: intent, webhook with
   dedupe, `syncPaymentStatus`, cash, split, refund, reconciliation).
3. **Amend the LLD and API contract** for the build-time additions listed above.

### 7. Risks to watch now

- **R2 Lost or duplicated payment state** — M9's webhook dedupe and `syncPaymentStatus` as the
  only writer of `paymentStatus` are where silent corruption lives. Test replay for real.
- **R13 Amendment vs payment state** — M10 must derive `paymentStatus`, never set it.
- **Single-instance assumptions** — the auth cache, menu cache and in-memory rate limits are
  per-process. Fine until M13-S9 introduces more than one instance.

---

## Snapshot — 2026-09-25 — Design complete, build not started

**Closed because:** the build ran M0 through M8 in one session; the M8 demo passed (an order from a phone reached the KDS in 105 ms and the tracker followed every bump).

| | |
|---|---|
| **Phase** | Design complete · build not started |
| **Current milestone** | M0 — Foundation (0 / 12 slices) |
| **Next slice** | **M0-S1** — rename folder to `restaurant-ordering-system`, `git init`, first commit |
| **Overall progress** | 0 / 169 slices |

### 1. Milestone progress

| # | Milestone | Status | Slices done |
|---|---|---|---|
| M0 | Foundation | ▶ Next | 0 / 12 |
| M1 | Shared domain core | Not started | 0 / 9 |
| M2 | Database & seed | Not started | 0 / 12 |
| M3 | Auth & RBAC | Not started | 0 / 18 |
| M4 | Menu | Not started | 0 / 12 |
| M5 | Tables & QR sessions | Not started | 0 / 10 |
| M6 | Cart & server pricing | Not started | 0 / 9 |
| M7 | Order placement & lifecycle | Not started | 0 / 13 |
| M8 | Realtime & KDS | Not started | 0 / 13 |
| M9 | Payments | Not started | 0 / 13 |
| M10 | Amendments, tips & receipts | Not started | 0 / 13 |
| M11 | Reports & dashboard | Not started | 0 / 14 |
| M12 | Delivery, takeaway & reservations | Not started | 0 / 7 |
| M13 | Hardening & deploy | Not started | 0 / 14 |

### 2. What exists

| Area | State |
|---|---|
| `docs/` | SRS 1.2.1 · HLD 1.2.1 · LLD 1.2.1 · ERD 1.2 · API-CONTRACT 1.1 · CODING-STANDARDS 1.2 · MILESTONES 1.2 · tracking files |
| `designs/` | 31 static HTML design directions + `index.html`; **design 31 chosen** (ADR-019), reference image in `designs/reference/` |
| Claude setup | `CLAUDE.md` at the root; project skill `fork-flame-ui` for all UI work |
| Code | None — no `package.json`, no workspaces |
| Git | Not initialised |
| Infra | No Docker, CI, or environments |

### 3. Open decisions

None. All ADRs in [DECISIONS.md](DECISIONS.md) are accepted. Money is integer cents in
`integer` columns (ADR-004), and the UI is design 31 (ADR-019).

### 4. Blockers

None. M0 can start immediately.

### 5. Known issues and doc debt

- **LLD revision table** order: 1.1.1 appears after 1.2.
- **Folder name** is misspelled (`restaurnat`) — fixed by M0-S1.

### 6. Next three actions

1. **M0-S1** — close editors/IDE, rename the folder, `git init`, commit `docs/` + `designs/`.
   (The `.idea/` module file and Claude project memory are keyed to the old path; expect to
   re-open the project afterwards.)
2. **M0-S2 → S5** — workspaces, strict tsconfig, ESLint/Prettier, Vitest.
3. **M0-S6 → S8** — Docker Postgres, fail-fast env parsing, Express app + `/health`.

### 7. Risks to watch now

- **R4 Scope creep** — the plan is ~184 working days; resist adding features before M8's demo.
- **R6 Money rounding** — M1-S2 (`bps()` half-away-from-zero) is the slice most likely to be skipped.

---

## Snapshot — 2026-09-25 — Design v1.1 (before the token-model revision)

**Closed because:** the v1.1 design assumed a single 24 h JWT with no refresh tokens; this was
reversed in the v1.2 revision (ADR-012), which added nine M3 slices.

| | |
|---|---|
| **Phase** | Design review complete |
| **Docs** | SRS 1.1 · HLD 1.1 · LLD 1.1 · ERD 1.0 · API-CONTRACT 1.0 · CODING-STANDARDS 1.0 · MILESTONES 1.0 |
| **Plan** | 14 milestones, 162 slices, ~175 working days; M3 at 11 slices / ~10d |
| **Code / git** | None / not initialised |
| **Open decisions** | Money column type (ERD §11); design direction (M0-S10) |

---

## Snapshot — 2026-09-25 — Design v1.0 (initial draft)

**Closed because:** the design review produced v1.1, which changed the refund model, state machine,
pricing units, order numbering and reporting (see CHANGELOG 0.2.0).

| | |
|---|---|
| **Phase** | Initial design drafted |
| **Docs** | SRS 1.0 · HLD 1.0 · LLD 1.0 |
| **Design exploration** | 31 frontend directions in `designs/` |
| **Known problems (found in review)** | `REFUNDED` as an order status; source-keyed role gate; rates not yet in basis points; `UNIQUE(orderNumber)` collision on day two; order counter in `Setting`; reports bucketed on UTC and summing `Order.total`; mutating QR GET |
