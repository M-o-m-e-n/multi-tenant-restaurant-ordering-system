# Project State
## Restaurant Ordering System (ROS)

> Read this first each session. When the phase or milestone changes, move this whole snapshot into
> [PROJECT_STATE_ARCHIVED.md](PROJECT_STATE_ARCHIVED.md) before rewriting it.

| | |
|---|---|
| **Last updated** | 2026-10-18 |
| **Phase** | Phase 2 — a pilot restaurant (first customer, private demo) |
| **Current milestone** | M14 done; tenant packs, branches, themes and the catalogue menu built (pulled forward from M15–M17, ADR-032…036). The pilot tenant is a private pack under `tenants/<id>/` |
| **Next slice** | Confirm hours, delivery fee and branch pins with the owner, then M15 (orders, tables and KDS per branch) |
| **Overall progress** | Phase 1: 165 / 169 slices. Phase 2: M14 10 / 10. Open: M0-S1 (folder rename) and M13-S11/S12. Skipped: M13-S9 (single instance) |
| **Health** | 🟢 `npm run check` green (351 tests); `npm run e2e` 15 / 15; 21/22 AC pass, AC-5 with a named exception |

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
| M9 | Payments | ✅ Done | 13 / 13 |
| M10 | Amendments, tips & receipts | ✅ Done | 13 / 13 |
| M11 | Reports & dashboard | ✅ Done | 14 / 14 |
| M12 | Delivery, takeaway & reservations | ✅ Done | 7 / 7 |
| M13 | Hardening & deploy | ◐ Local part done | 11 / 14 (S9 skipped, S11/S12 need a host) |
| M14 | Arabic and Egypt localisation | ✅ Done | 10 / 10 |
| M15–M18 | Branches, Egyptian ordering, tenant pack, demo | ☐ Outlined | — |

## 2. What exists

| Area | State |
|---|---|
| Repo | Git on `main`; one `feat/*` branch per milestone, merged `--no-ff` |
| `shared/` | Pricing, the order and delivery state machines, discount rules, time helpers, and strict Zod schemas with DTO types. 58 tests |
| `server/` | Express 4, Prisma 6 and Socket.IO. Modules: auth, users, menu, settings, discounts, tables, orders (with delivery), payments (Stripe test mode and cash), reports, reservations. Jobs: purges, reconciliation, reservation alerts. Helmet and request logs; OpenAPI generated from Zod. 268 integration tests |
| `client/` | React 18 SPA in the Fork & Flame design with real food photography. Screens: landing page, menu, cart, checkout, tracker, pay, receipt, booking, KDS, POS, table map, bookings, and admin dashboard, reports and menu. Staff and admin routes lazy-load. Arabic RTL with an English toggle (M14). 46 tests |
| E2E | Playwright on the production builds: LLD §10.3 scenarios 1–6, AC-1/2/22, and axe on 17 screens in English and Arabic (`npm run e2e`) |
| Database | 4 migrations; a deterministic seed with 30 days of history; backup and restore scripts with a recorded drill |
| Docs | SRS 1.2.1, HLD 1.2.1, LLD 1.5, API contract 1.4 + `openapi.json`, SECURITY, ACCEPTANCE, OPERATIONS, ADR-001…037 |
| Measured | KDS gets a new order 63 ms after commit (target 500). `GET /menu` p95 ≈ 69 ms at 100 concurrent (target 300). Guest JS bundle 444 kB |

## 3. Open decisions

None blocking. Build-time decisions are ADR-020…027 in [DECISIONS.md](DECISIONS.md).

## 4. Blockers

- **No host and no Stripe test keys** in this environment. Both are needed for M13-S11/S12 and a
  live AC-5. Card payment switches itself off without keys, and cash works.

## 5. Known issues and doc debt

- **Folder name still misspelled** (`restaurnat`). Rename it with the IDE closed (M0-S1).
- **No git remote**, so CI has never run on GitHub.
- `npm audit`: a Prisma CLI dev-tool advisory and react-router 6 (the open-redirect vector is closed
  in code). Both are accepted in SECURITY.md §3.
- A booking has no owner column, so guests can't list their bookings later, and closing a table
  doesn't mark its booking COMPLETED (ADR-025).
- The admin UI doesn't manage modifier groups or discounts yet. The APIs exist and are in the
  OpenAPI document.
- LLD revision-table order: 1.1.1 appears after 1.2.

## 6. Next three actions

0. **Pilot demo:** with the private pack checked out under `tenants/<id>/`, build with
   `VITE_TENANT=<id>`, seed a scratch database with `SEED_TENANT=<id>`, and walk the owner
   through it. Nothing of theirs is published until they agree (ADR-036).

1. **Rename the folder, push to GitHub** so CI runs.
2. **Deploy** following OPERATIONS.md §3. Add Stripe **test** keys and the webhook secret.
3. **M13-S12:** point the Stripe webhook at the host, pay with 4242, replay the event, and re-walk
   AC-5 live. Update ACCEPTANCE.md.

## 7. Risks to watch now

- **Proxy trust at deploy.** `trust proxy` is loopback only. Behind a platform proxy, set the hop
  count, or every guest shares one rate-limit bucket.
- **Scaling out.** Rooms, rate limits, caches and the reservation flag set are per process. Add
  Redis before a second instance (OPERATIONS.md §2).
- **Memory on the dev machine.** Full dev servers plus a browser need about 1.5 GB free. The E2E
  suite uses the lighter production builds.
