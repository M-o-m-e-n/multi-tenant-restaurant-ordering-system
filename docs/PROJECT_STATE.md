# Project State
## Restaurant Ordering System (ROS)

> Read this first each session. When the phase or milestone changes, move this whole snapshot into
> [PROJECT_STATE_ARCHIVED.md](PROJECT_STATE_ARCHIVED.md) before rewriting it.

| | |
|---|---|
| **Last updated** | 2026-09-25 |
| **Phase** | Build · M0–M8 done (first end-to-end demo reached) |
| **Current milestone** | M9 — Payments (0 / 13 slices) |
| **Next slice** | **M9-S1** — Stripe client, keys from env, test mode asserted at boot |
| **Overall progress** | 107 / 169 slices (M0-S1's folder rename is the one open slice before M9) |
| **Health** | 🟢 on track — every gate green; 187 automated tests |

---

## 1. Milestone progress

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

## 2. What exists

| Area | State |
|---|---|
| Repo | Git on `main`; one `feat/mN-*` branch per milestone, merged `--no-ff`; ~75 commits |
| `shared/` | Pricing (`computeTotals`, `bps`), state machine, discount rules, strict Zod schemas, DTO types — 47 tests |
| `server/` | Express 4 + Prisma 6 + Socket.IO. Modules: auth (access + rotating refresh tokens), users, menu, settings, discounts, tables, orders; events façade; jobs (token and idempotency purges) — 123 integration tests on `ros_test` |
| `client/` | React 18 SPA in the Fork & Flame design: menu, QR landing, cart, modifier dialog, checkout, live tracker, order history, KDS, table map, admin menu manager, login/register — 23 tests |
| Database | 4 migrations; seed with 30 business days of history and `seed-fixture.json` |
| Infra | Docker Postgres 15.8 (`ros`, `ros_test`); GitHub Actions workflow (not yet run: no remote) |
| Verified in a browser | QR → order → KDS in 105 ms; KDS bumps followed live on the phone; a guest's menu shows an 86 in 52 ms |

## 3. Open decisions

None blocking. Build-time decisions are recorded as ADR-020…ADR-023 in [DECISIONS.md](DECISIONS.md).

## 4. Blockers

- **M9 needs Stripe test keys** (`STRIPE_SECRET_KEY` sk_test_…, `STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET`) and, for webhooks locally, the Stripe CLI (`stripe listen`). Card
  payment can't be demonstrated without them. Cash payment can.

## 5. Known issues and doc debt

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

## 6. Next three actions

1. **Rename the folder** and push to a GitHub remote, so CI runs.
2. **Add Stripe test keys** to `server/.env` and start **M9** (payments: intent, webhook with
   dedupe, `syncPaymentStatus`, cash, split, refund, reconciliation).
3. **Amend the LLD and API contract** for the build-time additions listed above.

## 7. Risks to watch now

- **R2 Lost or duplicated payment state** — M9's webhook dedupe and `syncPaymentStatus` as the
  only writer of `paymentStatus` are where silent corruption lives. Test replay for real.
- **R13 Amendment vs payment state** — M10 must derive `paymentStatus`, never set it.
- **Single-instance assumptions** — the auth cache, menu cache and in-memory rate limits are
  per-process. Fine until M13-S9 introduces more than one instance.
